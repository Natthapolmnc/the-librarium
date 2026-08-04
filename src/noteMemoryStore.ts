import { App, TFile, normalizePath } from "obsidian";
import { OllamaClient } from "./ollamaClient";
import { OllamaOrchestratorSettings } from "./settings";
import { LayeredMemory, buildLayeredMemory, extendLayeredMemory, BuildProgress } from "./summarizer";
import { CancellationToken } from "./cancellation";
import { slugify } from "./memoryStore";

export interface NoteMemoryEntry {
	filePath: string; // vault path of the mirrored note — the key
	fileName: string;
	sourceText: string; // last-synced full text, kept so incremental refresh can diff an append
	memory: LayeredMemory;
	mirrorFolderPath: string; // companion folder under noteMemoryFolder holding one file per layer + original
	mirrorNotePath: string; // the main mirror note: Overview + links to the deeper layers
	updatedAt: number;
}

export interface NoteMemoryStoreData {
	entries: Record<string, NoteMemoryEntry>; // keyed by filePath
}

export function emptyNoteMemoryData(): NoteMemoryStoreData {
	return { entries: {} };
}

function layerFileName(layer: { index: number; name: string }): string {
	return `${String(layer.index).padStart(2, "0")}-${slugify(layer.name)}.md`;
}

function renderMirrorNote(entry: NoteMemoryEntry): string {
	const lines: string[] = [];
	lines.push("---");
	lines.push(`source_path: ${entry.filePath}`);
	lines.push(`synced: ${new Date(entry.updatedAt).toISOString()}`);
	lines.push("---");
	lines.push("");
	lines.push(`# Note memory: ${entry.fileName}`);
	lines.push("");
	lines.push(
		`_Layered mirror of [[${entry.filePath}|${entry.fileName}]], used when "Include current note" is on so a query only pulls in the level of detail it needs instead of the whole file. Refresh from the chat panel or the command palette — this doesn't update on its own._`
	);
	lines.push("");
	lines.push("## Overview");
	lines.push(entry.memory.layers[0].text.trim());

	if (entry.memory.layers.length > 1) {
		lines.push("");
		lines.push("## More detail");
		for (let i = 1; i < entry.memory.layers.length; i++) {
			const layer = entry.memory.layers[i];
			lines.push(`- [[${entry.mirrorFolderPath}/${layerFileName(layer)}|${layer.name}]]`);
		}
		lines.push(`- [[${entry.mirrorFolderPath}/original.md|Original note text]]`);
	}
	lines.push("");
	return lines.join("\n");
}

function renderLayerFile(entry: NoteMemoryEntry, layer: { index: number; name: string; text: string }): string {
	const lines: string[] = [];
	lines.push("---");
	lines.push(`source_path: ${entry.filePath}`);
	lines.push(`layer_index: ${layer.index}`);
	lines.push("---");
	lines.push("");
	lines.push(`# ${entry.fileName} — ${layer.name}`);
	lines.push("");
	lines.push(`_Part of [[${entry.mirrorNotePath}|${entry.fileName}'s note memory]]. Expands on the layer above it without changing its meaning._`);
	lines.push("");
	lines.push(layer.text.trim());
	lines.push("");
	return lines.join("\n");
}

function renderOriginalFile(entry: NoteMemoryEntry): string {
	const lines: string[] = [];
	lines.push("---");
	lines.push(`source_path: ${entry.filePath}`);
	lines.push("---");
	lines.push("");
	lines.push(`# ${entry.fileName} — Original note text`);
	lines.push("");
	lines.push(`_Snapshot as of the last sync. Part of [[${entry.mirrorNotePath}|${entry.fileName}'s note memory]]._`);
	lines.push("");
	lines.push(entry.memory.original.trim());
	lines.push("");
	return lines.join("\n");
}

/**
 * A distinct memory type from regular topics: a 1:1 layered mirror of a
 * single note, auto-built the first time that note is referenced in chat
 * ("this note", "the current note", or the "Include current note" toggle),
 * and otherwise only updated when the user explicitly asks — via chat, a
 * command, or a button — either a full rebuild or an incremental update
 * (append-only diff against what was last synced).
 */
export class NoteMemoryStore {
	constructor(
		private app: App,
		private data: NoteMemoryStoreData,
		private folder: string,
		private persist: () => Promise<void>
	) {}

	async ensureFolder(path: string): Promise<void> {
		const normalized = normalizePath(path);
		if (!this.app.vault.getAbstractFileByPath(normalized)) {
			await this.app.vault.createFolder(normalized).catch(() => void 0);
		}
	}

	get(filePath: string): NoteMemoryEntry | undefined {
		return this.data.entries[filePath];
	}

	list(): NoteMemoryEntry[] {
		return Object.values(this.data.entries).sort((a, b) => b.updatedAt - a.updatedAt);
	}

	/** Returns the existing mirror for this file, building it fresh if it doesn't exist yet. Never auto-refreshes a stale one. */
	async ensure(
		file: TFile,
		client: OllamaClient,
		settings: OllamaOrchestratorSettings,
		onProgress?: (p: BuildProgress) => void,
		token?: CancellationToken
	): Promise<NoteMemoryEntry> {
		const existing = this.data.entries[file.path];
		if (existing) return existing;
		const content = await this.app.vault.read(file);
		return this.rebuildFull(file, content, client, settings, onProgress, token);
	}

	/** Whether this note's mirror is out of date relative to its current on-disk content — surfaced in the UI, never acted on automatically. */
	async isStale(file: TFile): Promise<boolean> {
		const existing = this.data.entries[file.path];
		if (!existing) return false;
		const content = await this.app.vault.read(file);
		return content !== existing.sourceText;
	}

	/** Full rebuild from scratch — always correct, costs a fresh summarization pass over the whole note. */
	async refreshFull(
		file: TFile,
		client: OllamaClient,
		settings: OllamaOrchestratorSettings,
		onProgress?: (p: BuildProgress) => void,
		token?: CancellationToken
	): Promise<NoteMemoryEntry> {
		const content = await this.app.vault.read(file);
		return this.rebuildFull(file, content, client, settings, onProgress, token);
	}

	/**
	 * Incremental refresh: if the note's current content still starts with
	 * exactly what was last synced (the common append-only case — journal
	 * entries, running notes, logs), only the new suffix is chunked and
	 * summarized, and the layered memory is extended rather than rebuilt. If
	 * the note was edited in the middle instead, an append-only diff isn't
	 * meaningful, so this safely falls back to a full rebuild instead of
	 * producing layers that no longer match the note.
	 */
	async refreshIncremental(
		file: TFile,
		client: OllamaClient,
		settings: OllamaOrchestratorSettings,
		onProgress?: (p: BuildProgress) => void,
		token?: CancellationToken
	): Promise<{ entry: NoteMemoryEntry; fellBackToFull: boolean }> {
		const content = await this.app.vault.read(file);
		const existing = this.data.entries[file.path];

		if (!existing) {
			return { entry: await this.rebuildFull(file, content, client, settings, onProgress, token), fellBackToFull: true };
		}
		if (content === existing.sourceText) {
			return { entry: existing, fellBackToFull: false };
		}
		if (!content.startsWith(existing.sourceText)) {
			return { entry: await this.rebuildFull(file, content, client, settings, onProgress, token), fellBackToFull: true };
		}

		const addedText = content.slice(existing.sourceText.length);
		if (!addedText.trim()) {
			return { entry: existing, fellBackToFull: false };
		}

		const memory = await extendLayeredMemory(existing.memory, addedText, client, settings, onProgress, token);
		const entry: NoteMemoryEntry = { ...existing, sourceText: content, memory, updatedAt: Date.now() };
		this.data.entries[file.path] = entry;
		await this.writeAllFiles(entry);
		await this.persist();
		return { entry, fellBackToFull: false };
	}

	private async rebuildFull(
		file: TFile,
		content: string,
		client: OllamaClient,
		settings: OllamaOrchestratorSettings,
		onProgress?: (p: BuildProgress) => void,
		token?: CancellationToken
	): Promise<NoteMemoryEntry> {
		const memory = await buildLayeredMemory(content, client, settings, onProgress, token);

		// Reuse the mirror location from any existing entry for this exact
		// file (a full refresh of an already-mirrored note), so rebuilding
		// doesn't orphan the previous mirror files under a fresh path. Only
		// a genuinely new file gets a newly allocated slug.
		const existing = this.data.entries[file.path];
		const slug = existing ? undefined : this.uniqueSlug(file);
		const mirrorNotePath = existing?.mirrorNotePath ?? normalizePath(`${this.folder}/${slug}.md`);
		const mirrorFolderPath = existing?.mirrorFolderPath ?? normalizePath(`${this.folder}/${slug}`);

		const entry: NoteMemoryEntry = {
			filePath: file.path,
			fileName: file.basename,
			sourceText: content,
			memory,
			mirrorFolderPath,
			mirrorNotePath,
			updatedAt: Date.now(),
		};
		this.data.entries[file.path] = entry;
		await this.writeAllFiles(entry);
		await this.persist();
		return entry;
	}

	/**
	 * Basename-derived slug, disambiguated against every other tracked
	 * file's mirror folder so two vault files with the same name (a common
	 * Obsidian occurrence — same filename in different folders) don't
	 * silently share, and overwrite, the same mirror. Deterministic given
	 * the current set of entries: the first note to claim a name gets the
	 * plain slug, later ones get "-2", "-3", etc.
	 */
	private uniqueSlug(file: TFile): string {
		const base = slugify(file.basename);
		const taken = new Set(
			Object.values(this.data.entries)
				.filter((e) => e.filePath !== file.path)
				.map((e) => e.mirrorFolderPath)
		);
		let candidate = base;
		for (let n = 2; taken.has(normalizePath(`${this.folder}/${candidate}`)); n++) {
			candidate = `${base}-${n}`;
		}
		return candidate;
	}

	private async writeAllFiles(entry: NoteMemoryEntry): Promise<void> {
		await this.ensureFolder(this.folder);
		await this.writeFile(entry.mirrorNotePath, renderMirrorNote(entry));

		if (entry.memory.layers.length > 1) {
			await this.ensureFolder(entry.mirrorFolderPath);
			for (let i = 1; i < entry.memory.layers.length; i++) {
				const layer = entry.memory.layers[i];
				await this.writeFile(normalizePath(`${entry.mirrorFolderPath}/${layerFileName(layer)}`), renderLayerFile(entry, layer));
			}
			await this.writeFile(normalizePath(`${entry.mirrorFolderPath}/original.md`), renderOriginalFile(entry));
		}
	}

	private async writeFile(path: string, content: string): Promise<void> {
		const existing = this.app.vault.getAbstractFileByPath(path);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, content);
			return;
		}
		try {
			await this.app.vault.create(path, content);
		} catch (err) {
			const retry = this.app.vault.getAbstractFileByPath(path);
			if (retry instanceof TFile) {
				await this.app.vault.modify(retry, content);
			} else {
				throw err;
			}
		}
	}
}
