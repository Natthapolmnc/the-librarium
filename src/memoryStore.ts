import { App, TFile, normalizePath } from "obsidian";
import { OllamaClient } from "./ollamaClient";
import { OllamaOrchestratorSettings } from "./settings";
import { LayeredMemory, buildLayeredMemory, extendLayeredMemory, BuildProgress } from "./summarizer";
import { CancellationToken } from "./cancellation";

export interface MemoryTopic {
	id: string;
	name: string;
	overview: string; // convenience cache of the memory's Overview layer, always kept in sync
	notePath: string; // the main note: Overview + links to the deeper layers
	folderPath: string; // companion folder holding one file per deeper layer, plus the Original
	updatedAt: number;
}

export interface MemoryStoreData {
	topics: Record<string, MemoryTopic>;
	memories: Record<string, LayeredMemory>; // keyed by topic id
}

export function emptyStoreData(): MemoryStoreData {
	return { topics: {}, memories: {} };
}

export function slugify(name: string): string {
	return (
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "")
			.slice(0, 60) || "topic"
	);
}

function layerFileName(layer: { index: number; name: string }): string {
	return `${String(layer.index).padStart(2, "0")}-${slugify(layer.name)}.md`;
}

function renderMainNote(topic: MemoryTopic, memory: LayeredMemory): string {
	const lines: string[] = [];
	lines.push("---");
	lines.push(`topic_id: ${topic.id}`);
	lines.push(`updated: ${new Date(topic.updatedAt).toISOString()}`);
	lines.push("---");
	lines.push("");
	lines.push(`# ${topic.name}`);
	lines.push("");
	lines.push("## Overview");
	lines.push(memory.layers[0].text.trim());

	if (memory.layers.length > 1) {
		lines.push("");
		lines.push("## More detail");
		lines.push(
			"_Each link below expands on the one above it without changing its meaning — pulled in only as needed, when a question this Overview alone can't answer needs it._"
		);
		lines.push("");
		for (let i = 1; i < memory.layers.length; i++) {
			const layer = memory.layers[i];
			lines.push(`- [[${topic.folderPath}/${layerFileName(layer)}|${layer.name}]]`);
		}
		lines.push(`- [[${topic.folderPath}/original.md|Original source text]]`);
	}
	lines.push("");
	return lines.join("\n");
}

function renderLayerFile(topic: MemoryTopic, layer: { index: number; name: string; text: string }): string {
	const lines: string[] = [];
	lines.push("---");
	lines.push(`topic_id: ${topic.id}`);
	lines.push(`layer_index: ${layer.index}`);
	lines.push("---");
	lines.push("");
	lines.push(`# ${topic.name} — ${layer.name}`);
	lines.push("");
	lines.push(`_Part of [[${topic.notePath}|${topic.name}]]. This layer expands on the one above it without changing its meaning._`);
	lines.push("");
	lines.push(layer.text.trim());
	lines.push("");
	return lines.join("\n");
}

function renderOriginalFile(topic: MemoryTopic, memory: LayeredMemory): string {
	const lines: string[] = [];
	lines.push("---");
	lines.push(`topic_id: ${topic.id}`);
	lines.push("---");
	lines.push("");
	lines.push(`# ${topic.name} — Original source text`);
	lines.push("");
	lines.push(`_Part of [[${topic.notePath}|${topic.name}]]. Only loaded when even the Comprehensive Summary isn't detailed enough._`);
	lines.push("");
	lines.push(memory.original.trim());
	lines.push("");
	return lines.join("\n");
}

/**
 * Manages the on-disk memory topic files: a main note (Overview + links)
 * plus a companion folder with one file per deeper layer and the raw
 * Original — a real, browsable representation of the progressive-
 * abstraction stack, not just an opaque internal blob. The underlying
 * `LayeredMemory` (needed for hierarchical search) is kept in plugin data
 * since it's not meant for manual editing; the vault files are always
 * regenerated from it, never the other way around.
 */
export class MemoryStore {
	constructor(
		private app: App,
		private data: MemoryStoreData,
		private folder: string,
		private persist: () => Promise<void>
	) {}

	async ensureFolder(path: string): Promise<void> {
		const normalized = normalizePath(path);
		if (!this.app.vault.getAbstractFileByPath(normalized)) {
			await this.app.vault.createFolder(normalized).catch(() => void 0);
		}
	}

	listTopics(): MemoryTopic[] {
		return Object.values(this.data.topics).sort((a, b) => b.updatedAt - a.updatedAt);
	}

	getTopic(id: string): MemoryTopic | undefined {
		return this.data.topics[id];
	}

	getMemory(topicId: string): LayeredMemory | undefined {
		return this.data.memories[topicId];
	}

	/** Create a brand-new topic by building a full layered memory from raw text. */
	async createTopicFromText(
		name: string,
		text: string,
		client: OllamaClient,
		settings: OllamaOrchestratorSettings,
		onProgress?: (p: BuildProgress) => void,
		token?: CancellationToken
	): Promise<MemoryTopic> {
		const memory = await buildLayeredMemory(text, client, settings, onProgress, token);
		return this.createTopic(name, memory);
	}

	/**
	 * Grows an existing topic with new raw text. Extends the layered memory
	 * (merging into the existing Comprehensive Summary, then recascading the
	 * layers above it) rather than editing files directly, so every layer
	 * file always stays derived from the memory, never hand-patched.
	 */
	async appendRawContent(
		id: string,
		text: string,
		client: OllamaClient,
		settings: OllamaOrchestratorSettings,
		onProgress?: (p: BuildProgress) => void,
		token?: CancellationToken
	): Promise<MemoryTopic> {
		const existing = this.data.memories[id];
		const memory = existing
			? await extendLayeredMemory(existing, text, client, settings, onProgress, token)
			: await buildLayeredMemory(text, client, settings, onProgress, token);
		return this.updateTopic(id, memory);
	}

	private async createTopic(name: string, memory: LayeredMemory): Promise<MemoryTopic> {
		await this.ensureFolder(this.folder);
		const id = `${slugify(name)}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
		const slugBase = `${slugify(name)}-${id.slice(-8)}`;
		const notePath = normalizePath(`${this.folder}/${slugBase}.md`);
		const folderPath = normalizePath(`${this.folder}/${slugBase}`);

		const topic: MemoryTopic = { id, name, overview: memory.layers[0].text, notePath, folderPath, updatedAt: Date.now() };
		this.data.topics[id] = topic;
		this.data.memories[id] = memory;

		await this.writeAllFiles(topic, memory);
		await this.persist();
		return topic;
	}

	private async updateTopic(id: string, memory: LayeredMemory): Promise<MemoryTopic> {
		const topic = this.data.topics[id];
		if (!topic) throw new Error(`Unknown memory topic: ${id}`);

		topic.overview = memory.layers[0].text;
		topic.updatedAt = Date.now();
		this.data.memories[id] = memory;

		await this.writeAllFiles(topic, memory);
		await this.persist();
		return topic;
	}

	private async writeAllFiles(topic: MemoryTopic, memory: LayeredMemory): Promise<void> {
		await this.writeFile(topic.notePath, renderMainNote(topic, memory));

		if (memory.layers.length > 1) {
			await this.ensureFolder(topic.folderPath);
			for (let i = 1; i < memory.layers.length; i++) {
				const layer = memory.layers[i];
				await this.writeFile(normalizePath(`${topic.folderPath}/${layerFileName(layer)}`), renderLayerFile(topic, layer));
			}
			await this.writeFile(normalizePath(`${topic.folderPath}/original.md`), renderOriginalFile(topic, memory));
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
			// Path collision despite the unique id suffix (e.g. a stale vault
			// cache) — fall back to modifying whatever is actually there
			// rather than silently losing the content.
			const retry = this.app.vault.getAbstractFileByPath(path);
			if (retry instanceof TFile) {
				await this.app.vault.modify(retry, content);
			} else {
				throw err;
			}
		}
	}
}
