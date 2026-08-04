export interface StoredChatMessage {
	role: "user" | "assistant";
	content: string;
}

export interface ChatSession {
	id: string;
	title: string;
	createdAt: number;
	updatedAt: number;
	messages: StoredChatMessage[];
}

export interface ChatSessionStoreData {
	sessions: Record<string, ChatSession>;
}

export function emptyChatSessionData(): ChatSessionStoreData {
	return { sessions: {} };
}

function fallbackTitle(text: string): string {
	const clean = text.trim().replace(/\s+/g, " ");
	return clean.length > 48 ? `${clean.slice(0, 48)}…` : clean || "New chat";
}

/**
 * Every chat is a session you can come back to. Each session owns its own
 * slice of temp-memory (see TempMemoryStore.listForSession), so revisiting
 * an old chat shows you exactly the unconfirmed notes that were live during
 * that conversation, not whatever's live in your current one.
 *
 * Sessions start as an in-memory-only "draft" (`create()`), invisible to
 * `list()` and never written to disk — clicking "New chat" and then
 * abandoning it without sending anything leaves no trace. A draft is
 * promoted to a real, persisted, listed session the moment its first
 * message is appended.
 */
export class ChatSessionStore {
	private static MAX_SESSIONS = 30;
	private drafts = new Map<string, ChatSession>();

	constructor(
		private data: ChatSessionStoreData,
		private persist: () => Promise<void>,
		private onPrune?: (sessionId: string) => void
	) {}

	list(): ChatSession[] {
		return Object.values(this.data.sessions).sort((a, b) => b.updatedAt - a.updatedAt);
	}

	get(id: string): ChatSession | undefined {
		return this.data.sessions[id] ?? this.drafts.get(id);
	}

	isDraft(id: string): boolean {
		return this.drafts.has(id);
	}

	/** Creates a new session, but only in memory — nothing is persisted or listed until its first message. */
	create(): ChatSession {
		const id = `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
		const now = Date.now();
		const session: ChatSession = { id, title: "New chat", createdAt: now, updatedAt: now, messages: [] };
		this.drafts.set(id, session);
		return session;
	}

	async appendMessage(id: string, message: StoredChatMessage): Promise<void> {
		const session = this.get(id);
		if (!session) return;

		session.messages.push(message);
		session.updatedAt = Date.now();
		if (session.messages.length === 1 && message.role === "user") {
			session.title = fallbackTitle(message.content); // placeholder until generateShortTitle resolves and calls setTitle
		}

		if (this.drafts.has(id)) {
			this.drafts.delete(id);
			this.data.sessions[id] = session;
			await this.prune();
		}
		await this.persist();
	}

	async setTitle(id: string, title: string): Promise<void> {
		const session = this.get(id);
		if (!session) return;
		session.title = title.trim() || session.title;
		if (this.data.sessions[id]) await this.persist(); // a still-draft session's title just lives in memory until it's promoted
	}

	/** Deletes a session outright — its temp-memory is cleared via onPrune, same as natural pruning. */
	async deleteSession(id: string): Promise<void> {
		this.drafts.delete(id);
		if (this.data.sessions[id]) {
			delete this.data.sessions[id];
			this.onPrune?.(id);
			await this.persist();
		}
	}

	/** Keeps the session list from growing forever; oldest sessions beyond the cap are dropped (their temp-memory is pruned by the caller via onPrune). */
	private async prune(): Promise<void> {
		const all = this.list();
		if (all.length <= ChatSessionStore.MAX_SESSIONS) return;
		const overflow = all.slice(ChatSessionStore.MAX_SESSIONS);
		for (const session of overflow) {
			delete this.data.sessions[session.id];
			this.onPrune?.(session.id);
		}
	}
}
