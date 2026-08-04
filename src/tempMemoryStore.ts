import { App, TFile, normalizePath } from "obsidian";
import { slugify } from "./memoryStore";

/**
 * A candidate memory update the orchestrator noticed but has NOT committed
 * to permanent memory yet. Surfaced in the chat panel for the user to
 * confirm or discard. Each entry belongs to a chat session — it's used as
 * live context for that session, and stays there (and stays revisitable)
 * even after the chat moves on, right up until it's confirmed, discarded,
 * or the session's temp-memory is explicitly cleared/restarted.
 */
export interface TempMemoryEntry {
	id: string;
	sessionId: string;
	action: "extend" | "new";
	topicId?: string; // set when action === "extend"
	topicName?: string; // display name: existing topic's name, or the proposed new topic's name
	fact: string;
	sourceQuery: string;
	notePath: string;
	createdAt: number;
}

export type TempMemoryData = Record<string, TempMemoryEntry>;

export function emptyTempMemoryData(): TempMemoryData {
	return {};
}

function renderTempNote(entry: TempMemoryEntry): string {
	const lines: string[] = [];
	lines.push("---");
	lines.push(`temp_id: ${entry.id}`);
	lines.push("status: pending");
	lines.push(`action: ${entry.action}`);
	if (entry.topicId) lines.push(`related_topic_id: ${entry.topicId}`);
	if (entry.topicName) lines.push(`topic_name: ${entry.topicName}`);
	lines.push(`created: ${new Date(entry.createdAt).toISOString()}`);
	lines.push("---");
	lines.push("");
	lines.push("# Pending memory update");
	lines.push("");
	lines.push(`**From query:** ${entry.sourceQuery}`);
	lines.push("");
	lines.push(`**Proposed fact:** ${entry.fact}`);
	lines.push("");
	lines.push(
		entry.action === "extend"
			? `Would extend existing topic **${entry.topicName ?? entry.topicId}**.`
			: `Would create a new topic **${entry.topicName}**.`
	);
	lines.push("");
	lines.push(
		"Confirm or discard this from The Librarium chat panel. Clearing that chat's temp-memory (or letting the chat get pruned) removes unconfirmed entries too."
	);
	lines.push("");
	return lines.join("\n");
}

export class TempMemoryStore {
	constructor(
		private app: App,
		private data: TempMemoryData,
		private folder: string,
		private persist: () => Promise<void>
	) {}

	async ensureFolder(): Promise<void> {
		const path = normalizePath(this.folder);
		if (!this.app.vault.getAbstractFileByPath(path)) {
			await this.app.vault.createFolder(path).catch(() => void 0);
		}
	}

	list(): TempMemoryEntry[] {
		return Object.values(this.data).sort((a, b) => b.createdAt - a.createdAt);
	}

	/** Entries belonging to one chat session, most recent first (recency is what gives them more weight in context). */
	listForSession(sessionId: string): TempMemoryEntry[] {
		return Object.values(this.data)
			.filter((e) => e.sessionId === sessionId)
			.sort((a, b) => b.createdAt - a.createdAt);
	}

	get(id: string): TempMemoryEntry | undefined {
		return this.data[id];
	}

	async create(partial: Omit<TempMemoryEntry, "id" | "notePath" | "createdAt">): Promise<TempMemoryEntry> {
		await this.ensureFolder();
		const id = `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
		const label = partial.topicName ?? partial.topicId ?? "topic";
		const notePath = normalizePath(`${this.folder}/${slugify(label)}-${id}.md`);
		const entry: TempMemoryEntry = { ...partial, id, notePath, createdAt: Date.now() };

		this.data[id] = entry;
		await this.app.vault.create(notePath, renderTempNote(entry));
		await this.persist();
		return entry;
	}

	async discard(id: string): Promise<void> {
		const entry = this.data[id];
		if (!entry) return;
		const file = this.app.vault.getAbstractFileByPath(entry.notePath);
		if (file instanceof TFile) await this.app.vault.delete(file);
		delete this.data[id];
		await this.persist();
	}

	/** Explicit "restart temp-memory" for one chat, without touching other sessions' pending entries. */
	async clearSession(sessionId: string): Promise<void> {
		const ids = Object.values(this.data)
			.filter((e) => e.sessionId === sessionId)
			.map((e) => e.id);
		for (const id of ids) await this.discard(id);
	}

	/** Wipes every pending entry across every session. Rarely needed directly — prefer clearSession(). */
	async clearAll(): Promise<void> {
		for (const id of Object.keys(this.data)) {
			await this.discard(id);
		}
	}
}
