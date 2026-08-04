import { Notice, Plugin, TFile, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, OllamaOrchestratorSettings } from "./settings";
import { OllamaOrchestratorSettingTab } from "./settingsTab";
import { OllamaClient } from "./ollamaClient";
import { MemoryStore, MemoryStoreData, emptyStoreData } from "./memoryStore";
import { TempMemoryStore, TempMemoryData, emptyTempMemoryData } from "./tempMemoryStore";
import { NoteMemoryStore, NoteMemoryStoreData, emptyNoteMemoryData } from "./noteMemoryStore";
import { ChatSessionStore, ChatSessionStoreData, emptyChatSessionData } from "./chatSessionStore";
import { ChatHistoryStore, ChatHistoryData, emptyChatHistoryData } from "./chatHistoryStore";
import { ActiveFileTracker } from "./activeFileTracker";
import { Orchestrator } from "./orchestrator";
import { ChatView, CHAT_VIEW_TYPE } from "./chatView";

interface PluginData {
	settings: OllamaOrchestratorSettings;
	memory: MemoryStoreData;
	tempMemory: TempMemoryData;
	noteMemory: NoteMemoryStoreData;
	chatSessions: ChatSessionStoreData;
	chatHistory: ChatHistoryData;
}

/**
 * Memory moved from a variable-depth compression tree to a fixed stack of
 * named layers — an older vault's persisted data may still be in the old
 * shape (a "trees" map instead of "memories", each entry missing a `.layers`
 * array). Rather than crash on that structural mismatch, drop anything that
 * doesn't look like a valid layered memory (and the topic that pointed to
 * it) so the plugin starts clean instead of throwing. Existing topic/note
 * FILES in the vault are untouched either way — only the internal cache
 * that can't be reused is discarded; re-ingesting or re-referencing rebuilds
 * it in the new format.
 */
function sanitizeMemoryData(raw: unknown): MemoryStoreData {
	const data = raw as Partial<MemoryStoreData> | undefined;
	const topics = data?.topics ?? {};
	const memories = (data as { memories?: Record<string, { layers?: unknown }> } | undefined)?.memories ?? {};

	const cleanTopics: MemoryStoreData["topics"] = {};
	const cleanMemories: MemoryStoreData["memories"] = {};
	for (const [id, topic] of Object.entries(topics)) {
		const memory = memories[id];
		if (memory && Array.isArray(memory.layers)) {
			cleanTopics[id] = topic;
			cleanMemories[id] = memory as MemoryStoreData["memories"][string];
		}
	}
	return { topics: cleanTopics, memories: cleanMemories };
}

function sanitizeNoteMemoryData(raw: unknown): NoteMemoryStoreData {
	const data = raw as Partial<NoteMemoryStoreData> | undefined;
	const entries = data?.entries ?? {};
	const clean: NoteMemoryStoreData["entries"] = {};
	for (const [path, entry] of Object.entries(entries)) {
		const memory = (entry as { memory?: { layers?: unknown } }).memory;
		if (memory && Array.isArray(memory.layers)) {
			clean[path] = entry;
		}
	}
	return { entries: clean };
}

export default class OllamaOrchestratorPlugin extends Plugin {
	settings: OllamaOrchestratorSettings = DEFAULT_SETTINGS;
	memoryData: MemoryStoreData = emptyStoreData();
	tempMemoryData: TempMemoryData = emptyTempMemoryData();
	noteMemoryData: NoteMemoryStoreData = emptyNoteMemoryData();
	chatSessionData: ChatSessionStoreData = emptyChatSessionData();
	chatHistoryData: ChatHistoryData = emptyChatHistoryData();

	client!: OllamaClient;
	memoryStore!: MemoryStore;
	tempMemoryStore!: TempMemoryStore;
	noteMemoryStore!: NoteMemoryStore;
	chatSessionStore!: ChatSessionStore;
	chatHistoryStore!: ChatHistoryStore;
	orchestrator!: Orchestrator;
	activeFileTracker!: ActiveFileTracker;

	async onload(): Promise<void> {
		await this.loadPluginData();

		this.client = new OllamaClient(this.settings.ollamaBaseUrl);
		this.activeFileTracker = new ActiveFileTracker(this.app);
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => this.activeFileTracker.handleActiveLeafChange(leaf))
		);
		this.rebuildStores();

		this.addSettingTab(new OllamaOrchestratorSettingTab(this.app, this));

		this.registerView(CHAT_VIEW_TYPE, (leaf: WorkspaceLeaf) => new ChatView(leaf, this));

		this.addRibbonIcon("message-circle", "Open The Librarium chat", () => this.activateChatView());

		this.addCommand({
			id: "open-chat",
			name: "Open chat panel",
			callback: () => this.activateChatView(),
		});

		this.addCommand({
			id: "ingest-active-file",
			name: "Ingest active file into memory (as its own topic)",
			checkCallback: (checking) => {
				const file = this.activeFileTracker.getFile();
				if (!file || file.extension !== "md") return false;
				if (checking) return true;
				this.ingestFile(file);
				return true;
			},
		});

		this.addCommand({
			id: "note-memory-refresh-full",
			name: "Note memory: full rebuild for active note",
			checkCallback: (checking) => {
				const file = this.activeFileTracker.getFile();
				if (!file || file.extension !== "md") return false;
				if (checking) return true;
				this.refreshNoteMemory(file, "full");
				return true;
			},
		});

		this.addCommand({
			id: "note-memory-refresh-incremental",
			name: "Note memory: incremental update for active note",
			checkCallback: (checking) => {
				const file = this.activeFileTracker.getFile();
				if (!file || file.extension !== "md") return false;
				if (checking) return true;
				this.refreshNoteMemory(file, "incremental");
				return true;
			},
		});
	}

	async ingestFile(file: TFile): Promise<void> {
		new Notice(`Ingesting "${file.basename}"...`);
		try {
			const topic = await this.orchestrator.ingestFile(file, (msg) => new Notice(msg));
			new Notice(`Memory topic ready: ${topic.name}`);
		} catch (err) {
			new Notice(`Ingestion failed: ${(err as Error).message}`);
		}
	}

	async refreshNoteMemory(file: TFile, mode: "full" | "incremental"): Promise<void> {
		new Notice(`Syncing note memory for "${file.basename}"...`);
		try {
			if (mode === "full") {
				await this.noteMemoryStore.refreshFull(file, this.client, this.settings, (p) => {
					if (p.status === "starting") new Notice(`${p.phase}...`);
				});
				new Notice(`Note memory rebuilt for "${file.basename}".`);
			} else {
				const { fellBackToFull } = await this.noteMemoryStore.refreshIncremental(file, this.client, this.settings, (p) => {
					if (p.status === "starting") new Notice(`${p.phase}...`);
				});
				new Notice(
					fellBackToFull
						? `"${file.basename}" wasn't a clean append since last sync — did a full rebuild instead.`
						: `Note memory incrementally updated for "${file.basename}".`
				);
			}
		} catch (err) {
			new Notice(`Note memory sync failed: ${(err as Error).message}`);
		}
	}

	async activateChatView(): Promise<void> {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0];
		if (!leaf) {
			leaf = workspace.getRightLeaf(false)!;
			await leaf.setViewState({ type: CHAT_VIEW_TYPE, active: true });
		}
		workspace.revealLeaf(leaf);
	}

	private rebuildStores(): void {
		this.memoryStore = new MemoryStore(this.app, this.memoryData, this.settings.memoriesFolder, () => this.savePluginData());
		this.tempMemoryStore = new TempMemoryStore(this.app, this.tempMemoryData, this.settings.tempMemoryFolder, () => this.savePluginData());
		this.noteMemoryStore = new NoteMemoryStore(this.app, this.noteMemoryData, this.settings.noteMemoryFolder, () => this.savePluginData());
		this.chatHistoryStore = new ChatHistoryStore(this.chatHistoryData, () => this.savePluginData());
		this.chatSessionStore = new ChatSessionStore(this.chatSessionData, () => this.savePluginData(), (sessionId) => {
			this.tempMemoryStore.clearSession(sessionId);
			this.chatHistoryStore.clearSession(sessionId);
		});

		if (this.orchestrator) {
			this.orchestrator.settings = this.settings;
			this.orchestrator.memory = this.memoryStore;
			this.orchestrator.tempMemory = this.tempMemoryStore;
			this.orchestrator.noteMemory = this.noteMemoryStore;
			this.orchestrator.chatHistory = this.chatHistoryStore;
		} else {
			this.orchestrator = new Orchestrator(
				this.app,
				this.client,
				this.settings,
				this.memoryStore,
				this.tempMemoryStore,
				this.noteMemoryStore,
				this.chatHistoryStore,
				this.activeFileTracker
			);
		}
	}

	private async loadPluginData(): Promise<void> {
		const raw = (await this.loadData()) as Partial<PluginData> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, raw?.settings ?? {});
		this.memoryData = sanitizeMemoryData(raw?.memory);
		this.tempMemoryData = raw?.tempMemory ?? emptyTempMemoryData();
		this.noteMemoryData = sanitizeNoteMemoryData(raw?.noteMemory);
		this.chatSessionData = raw?.chatSessions ?? emptyChatSessionData();
		this.chatHistoryData = raw?.chatHistory ?? emptyChatHistoryData();
	}

	async savePluginData(): Promise<void> {
		const data: PluginData = {
			settings: this.settings,
			memory: this.memoryData,
			tempMemory: this.tempMemoryData,
			noteMemory: this.noteMemoryData,
			chatSessions: this.chatSessionData,
			chatHistory: this.chatHistoryData,
		};
		await this.saveData(data);
	}

	async saveSettings(): Promise<void> {
		this.client.setBaseUrl(this.settings.ollamaBaseUrl);
		this.rebuildStores();
		await this.savePluginData();
	}

	onunload(): void {
		// leaves are cleaned up by Obsidian automatically
	}
}
