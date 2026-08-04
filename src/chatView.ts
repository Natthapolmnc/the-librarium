import { ItemView, MarkdownRenderer, Notice, TFile, WorkspaceLeaf, setIcon } from "obsidian";
import type OllamaOrchestratorPlugin from "./main";
import { ChatMessage } from "./ollamaClient";
import { TempMemoryEntry } from "./tempMemoryStore";
import { ChatSession } from "./chatSessionStore";
import { BuildProgress, DIRECT_SUMMARIZE_CHAR_CAP } from "./summarizer";
import { CancellationSource, isCancelledError } from "./cancellation";
import { ACTIVE_NOTE_REFERENCE } from "./orchestrator";

export const CHAT_VIEW_TYPE = "ollama-orchestrator-chat";

const NEAR_BOTTOM_THRESHOLD_PX = 80;
const INPUT_MAX_HEIGHT_PX = 160;

// A note shorter than this is cheap enough to just read raw every time —
// not worth interrupting the user with a "build note memory?" prompt for.
const LONG_NOTE_PROMPT_THRESHOLD_CHARS = DIRECT_SUMMARIZE_CHAR_CAP;

export class ChatView extends ItemView {
	private plugin: OllamaOrchestratorPlugin;
	private session!: ChatSession;
	/** Set to the original question while we're waiting for the user's answer to a clarifying question. */
	private awaitingClarificationFor: string | null = null;
	/** "Reading page" mode (active note included) vs "memories only". Defaults to including the active note. */
	private includeActiveNote = true;
	/** true while a request to the LLM is in flight — blocks sending another one. */
	private busy = false;
	private historyVisible = false;
	/** whichever long-running operation is currently in flight, if any — the send/cancel button targets this. */
	private currentCancellation: CancellationSource | null = null;

	private toolbar!: HTMLElement;
	private historyPanel!: HTMLElement;
	private messagesEl!: HTMLElement;
	private scrollBtn!: HTMLElement;
	private statusEl!: HTMLElement;
	private inputEl!: HTMLTextAreaElement;
	private sendBtn!: HTMLButtonElement;

	constructor(leaf: WorkspaceLeaf, plugin: OllamaOrchestratorPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string { return CHAT_VIEW_TYPE; }
	getDisplayText(): string { return "The Librarium"; }
	getIcon(): string { return "message-circle"; }

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("ollama-orchestrator-chat");

		this.toolbar = container.createDiv({ cls: "ooc-toolbar" });
		this.historyPanel = container.createDiv({ cls: "ooc-history-panel" });
		this.buildToolbar();

		const messagesWrapper = container.createDiv({ cls: "ooc-messages-wrapper" });
		this.messagesEl = messagesWrapper.createDiv({ cls: "ooc-messages" });
		this.messagesEl.addEventListener("scroll", () => this.updateScrollButtonVisibility());

		this.scrollBtn = messagesWrapper.createDiv({ cls: "ooc-scroll-btn" });
		setIcon(this.scrollBtn, "arrow-down");
		this.scrollBtn.setAttr("title", "Jump to latest");
		this.scrollBtn.addEventListener("click", () => this.scrollToBottom(true));

		this.statusEl = container.createDiv({ cls: "ooc-status" });

		const inputRow = container.createDiv({ cls: "ooc-input-row" });
		this.inputEl = inputRow.createEl("textarea", {
			attr: { rows: "1", placeholder: "Ask something, or say \"remember that...\" to note something down." },
		});
		this.sendBtn = inputRow.createEl("button", { cls: "ooc-send-btn" });
		setIcon(this.sendBtn, "send");
		this.sendBtn.setAttr("aria-label", "Send");

		container.createDiv({ cls: "ooc-input-hint", text: "Enter to send · Shift+Enter for a new line" });

		this.sendBtn.addEventListener("click", () => {
			if (this.busy) {
				this.requestCancel();
			} else {
				void this.send();
			}
		});
		this.inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				void this.send();
			}
		});
		this.inputEl.addEventListener("input", () => this.autoResizeInput());

		const existing = this.plugin.chatSessionStore.list()[0];
		this.session = existing ?? this.plugin.chatSessionStore.create();
		this.loadSessionIntoView();
		this.inputEl.focus();
	}

	/** Wraps an async handler so it can be passed anywhere a void-returning callback is expected (event listeners, onClick props) without leaving its promise dangling for the caller. */
	private toVoidHandler<Args extends unknown[]>(handler: (...args: Args) => Promise<void>): (...args: Args) => void {
		return (...args: Args) => {
			void handler(...args);
		};
	}

	private iconButton(container: HTMLElement, icon: string, label: string, onClick: () => void): HTMLButtonElement {
		const btn = container.createEl("button", { cls: "ooc-icon-btn" });
		setIcon(btn, icon);
		btn.setAttr("title", label);
		btn.setAttr("aria-label", label);
		btn.addEventListener("click", onClick);
		return btn;
	}

	/**
	 * Same action either way (a full rebuild from scratch), but the icon and
	 * label make clear up front whether this is building the active note's
	 * memory for the FIRST time or REBUILDING an existing one — otherwise
	 * "Init/rebuild" reads as one ambiguous action. Recomputed on hover
	 * (rather than once at toolbar build time) since the active note, and
	 * whether it has a mirror yet, can both change without the toolbar
	 * itself being rebuilt.
	 */
	private buildNoteMemoryButton(container: HTMLElement): HTMLButtonElement {
		const btn = container.createEl("button", { cls: "ooc-icon-btn" });

		const refreshLabel = () => {
			const file = this.plugin.activeFileTracker.getFile();
			const hasMemory = !!(file && this.plugin.noteMemoryStore.get(file.path));
			const label = !file
				? "Build note memory for the active note"
				: hasMemory
					? `Rebuild note memory for "${file.basename}" (already built)`
					: `Build note memory for "${file.basename}" (not built yet)`;
			setIcon(btn, hasMemory ? "refresh-cw" : "database");
			btn.setAttr("title", label);
			btn.setAttr("aria-label", label);
		};

		refreshLabel();
		btn.addEventListener("mouseenter", refreshLabel);
		btn.addEventListener("click", () => {
			const file = this.plugin.activeFileTracker.getFile();
			if (!file) { new Notice("No note is currently open."); return; }
			void this.runNoteMemorySync(file, "full");
		});
		return btn;
	}

	private buildToolbar(): void {
		this.toolbar.empty();

		this.iconButton(this.toolbar, "plus", "New chat", () => this.startNewChat());
		this.iconButton(this.toolbar, "history", "Chat history", () => this.toggleHistoryPanel());
		this.iconButton(this.toolbar, "trash-2", "Clear this chat's temp-memory (keeps the conversation)", this.toVoidHandler(() => this.clearTempMemory()));
		this.buildNoteMemoryButton(this.toolbar);

		const modeLabel = this.toolbar.createEl("label", { cls: "ooc-mode-toggle" });
		modeLabel.setAttr("title", "Include the currently open note as context for this chat.");
		const modeCheckbox = modeLabel.createEl("input", { attr: { type: "checkbox" } });
		modeCheckbox.checked = this.includeActiveNote;
		modeLabel.createSpan({ text: "Include note" });
		modeCheckbox.addEventListener("change", () => { this.includeActiveNote = modeCheckbox.checked; });
	}

	// ---- Chat history: list, switch, delete, auto-title ----

	private toggleHistoryPanel(): void {
		this.historyVisible = !this.historyVisible;
		this.historyPanel.toggleClass("ooc-history-panel-visible", this.historyVisible);
		if (this.historyVisible) this.renderHistoryPanel();
	}

	private renderHistoryPanel(): void {
		this.historyPanel.empty();
		const sessions = this.plugin.chatSessionStore.list();
		if (sessions.length === 0) {
			this.historyPanel.createDiv({ cls: "ooc-history-empty", text: "No saved chats yet — send a message to start one." });
			return;
		}
		for (const s of sessions) {
			const row = this.historyPanel.createDiv({ cls: "ooc-history-row" + (s.id === this.session.id ? " ooc-history-active" : "") });
			const titleWrap = row.createDiv({ cls: "ooc-history-title" });
			titleWrap.addEventListener("click", () => {
				this.switchSession(s.id);
				this.toggleHistoryPanel();
			});
			titleWrap.createDiv({ cls: "ooc-history-title-text", text: s.title });
			const lastMessage = s.messages[s.messages.length - 1];
			if (lastMessage) {
				const preview = lastMessage.content.length > 64 ? `${lastMessage.content.slice(0, 64)}…` : lastMessage.content;
				titleWrap.createDiv({ cls: "ooc-history-preview", text: preview });
			}
			row.createDiv({ cls: "ooc-history-time", text: this.relativeTime(s.updatedAt) });
			const delBtn = row.createEl("button", { cls: "ooc-history-delete" });
			setIcon(delBtn, "x");
			delBtn.setAttr("title", "Delete this chat");
			delBtn.addEventListener("click", this.toVoidHandler(async (e: MouseEvent) => {
				e.stopPropagation();
				await this.deleteSession(s.id);
			}));
		}
	}

	private relativeTime(ts: number): string {
		const mins = Math.round((Date.now() - ts) / 60000);
		if (mins < 1) return "just now";
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.round(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.round(hours / 24)}d ago`;
	}

	private loadSessionIntoView(): void {
		this.messagesEl.empty();
		this.awaitingClarificationFor = null;
		this.statusEl.setText('Chatting with memories only. Check "Include note" to also read the active page.');

		if (this.session.messages.length === 0) {
			this.renderEmptyState();
		}
		for (const m of this.session.messages) this.appendMessage(m.role, m.content);

		// Re-surface any still-pending temp-memory cards for this session so
		// revisiting an old chat shows exactly what was live in it, not just
		// the plain transcript.
		for (const entry of this.plugin.tempMemoryStore.listForSession(this.session.id).reverse()) {
			this.renderPendingCard(entry);
		}

		if (this.historyVisible) this.renderHistoryPanel();
		this.scrollToBottom(true);
	}

	private renderEmptyState(): void {
		const empty = this.messagesEl.createDiv({ cls: "ooc-empty-state" });
		empty.createDiv({ cls: "ooc-empty-state-title", text: "Start chatting" });
		empty.createDiv({
			cls: "ooc-empty-state-sub",
			text: 'Ask something, or say "remember that..." to note something down. Your memories, and the current note if included, ground every answer.',
		});
	}

	/** Switches to a fresh draft session — invisible in history and never persisted unless a message is actually sent in it. */
	private startNewChat(): void {
		if (this.busy) return;
		this.session = this.plugin.chatSessionStore.create();
		this.loadSessionIntoView();
		this.inputEl.focus();
	}

	private switchSession(id: string): void {
		if (this.busy) return;
		const target = this.plugin.chatSessionStore.get(id);
		if (!target) return;
		this.session = target;
		this.loadSessionIntoView();
	}

	private async deleteSession(id: string): Promise<void> {
		if (this.busy) return;
		this.setBusy(true);
		try {
			const wasActive = this.session.id === id;
			await this.plugin.chatSessionStore.deleteSession(id);
			if (wasActive) {
				const next = this.plugin.chatSessionStore.list()[0];
				this.session = next ?? this.plugin.chatSessionStore.create();
				this.loadSessionIntoView();
			} else {
				this.renderHistoryPanel();
			}
		} finally {
			this.setBusy(false);
		}
	}

	private async clearTempMemory(): Promise<void> {
		if (this.busy) return;
		this.setBusy(true);
		try {
			await this.plugin.orchestrator.clearSessionTempMemory(this.session.id);
			this.loadSessionIntoView();
			this.statusEl.setText("This chat's temp-memory was cleared. Conversation history is untouched.");
		} catch (err) {
			this.statusEl.setText(`Error clearing temp-memory: ${(err as Error).message}`);
		} finally {
			this.setBusy(false);
		}
	}

	// ---- Busy / loading state ----

	private setBusy(busy: boolean): void {
		this.busy = busy;
		this.inputEl.disabled = busy;
		// The send button never disables while busy — it becomes the Cancel
		// button instead, so there's always an obvious way to stop whatever's
		// running rather than just waiting it out.
		this.sendBtn.disabled = false;
		setIcon(this.sendBtn, busy ? "square" : "send");
		this.sendBtn.setAttr("title", busy ? "Cancel" : "Send");
		this.sendBtn.setAttr("aria-label", busy ? "Cancel" : "Send");
		this.sendBtn.toggleClass("ooc-send-btn-busy", busy);
		this.messagesEl.toggleClass("ooc-busy", busy);
		this.toolbar.toggleClass("ooc-toolbar-busy", busy);
		this.toolbar.querySelectorAll("button, input").forEach((el) => {
			(el as HTMLButtonElement | HTMLInputElement).disabled = busy;
		});
		this.historyPanel.toggleClass("ooc-history-busy", busy);
		this.historyPanel.querySelectorAll("button").forEach((el) => {
			el.disabled = busy;
		});
	}

	/** Can't truly abort an in-flight HTTP call to Ollama (no signal support), but this stops any further steps of a multi-step build/search from starting, and the UI discards whatever single call is still finishing in the background instead of acting on it. */
	private requestCancel(): void {
		if (!this.currentCancellation || this.currentCancellation.isCancelled) return;
		this.currentCancellation.cancel();
		this.statusEl.setText("Cancelling…");
	}

	// ---- Scrolling ----

	private isNearBottom(): boolean {
		const el = this.messagesEl;
		return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD_PX;
	}

	private updateScrollButtonVisibility(): void {
		this.scrollBtn.toggleClass("ooc-scroll-btn-visible", !this.isNearBottom());
	}

	/** Scrolls to the newest message — but only if the user hasn't scrolled up to reread something, unless `force` (e.g. they just sent a message, or switched chats). */
	private scrollToBottom(force = false): void {
		if (force || this.isNearBottom()) {
			this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
		}
		this.updateScrollButtonVisibility();
	}

	// ---- Input ----

	private autoResizeInput(): void {
		this.inputEl.setCssStyles({ height: "auto" });
		this.inputEl.setCssStyles({ height: `${Math.min(this.inputEl.scrollHeight, INPUT_MAX_HEIGHT_PX)}px` });
	}

	private formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	}

	// ---- Message rendering ----

	private appendMessage(role: "user" | "assistant", text: string): HTMLElement {
		const row = this.messagesEl.createDiv({ cls: `ooc-msg ooc-${role}` });
		const header = row.createDiv({ cls: "ooc-msg-header" });
		header.createSpan({ cls: "ooc-role", text: role === "user" ? "You" : "Assistant" });
		header.createSpan({ cls: "ooc-timestamp", text: this.formatTime(Date.now()) });

		const textEl = row.createDiv({ cls: "ooc-text" });

		if (role === "assistant") {
			// Markdown-render the answer (headings, lists, code blocks, links,
			// bold/italic) instead of dumping raw text — re-checks scroll
			// position once rendering finishes, since content height can grow
			// (e.g. a code block) after the initial synchronous scroll below.
			MarkdownRenderer.render(this.app, text, textEl, "", this)
				.then(() => this.scrollToBottom())
				.catch((err) => console.error("The Librarium: failed to render markdown message", err));

			const copyBtn = row.createEl("button", { cls: "ooc-copy-btn" });
			setIcon(copyBtn, "copy");
			copyBtn.setAttr("title", "Copy response");
			copyBtn.setAttr("aria-label", "Copy response");
			copyBtn.addEventListener("click", this.toVoidHandler(async () => {
				try {
					await navigator.clipboard.writeText(text);
					setIcon(copyBtn, "check");
					window.setTimeout(() => setIcon(copyBtn, "copy"), 1200);
				} catch {
					new Notice("Couldn't copy to clipboard.");
				}
			}));
		} else {
			textEl.setText(text);
		}

		this.scrollToBottom(role === "user");
		return row;
	}

	private appendSystemNote(text: string): void {
		this.messagesEl.createDiv({ cls: "ooc-system-note", text });
		this.scrollToBottom();
	}

	private appendLoadingBubble(): HTMLElement {
		const row = this.messagesEl.createDiv({ cls: "ooc-msg ooc-assistant ooc-loading" });
		const header = row.createDiv({ cls: "ooc-msg-header" });
		header.createSpan({ cls: "ooc-role", text: "Assistant" });
		const dots = row.createDiv({ cls: "ooc-text ooc-loading-dots" });
		dots.createSpan({ text: "●" });
		dots.createSpan({ text: "●" });
		dots.createSpan({ text: "●" });
		this.scrollToBottom(true);
		return row;
	}

	// ---- Note-memory: live "thinking" trace while building/refreshing ----

	private renderProgressLog(titleText: string): { onProgress: (p: BuildProgress) => void; finish: (text: string) => void } {
		const container = this.messagesEl.createDiv({ cls: "ooc-progress-log" });
		const titleRow = container.createDiv({ cls: "ooc-progress-title-row" });
		titleRow.createDiv({ cls: "ooc-progress-title", text: titleText });
		const cancelBtn = titleRow.createEl("button", { cls: "ooc-progress-cancel", text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.requestCancel());
		const linesEl = container.createDiv({ cls: "ooc-progress-lines" });
		this.scrollToBottom();

		const onProgress = (p: BuildProgress) => {
			if (p.status === "starting") {
				const line = linesEl.createDiv({ cls: "ooc-progress-line ooc-progress-active", text: `${p.phase}…` });
				line.dataset.layer = String(p.layerIndex);
			} else {
				const active = linesEl.querySelector<HTMLElement>(`.ooc-progress-active[data-layer="${p.layerIndex}"]`);
				if (active) {
					active.removeClass("ooc-progress-active");
					active.setText(`${p.phase} ✓`);
				} else {
					linesEl.createDiv({ cls: "ooc-progress-line", text: `${p.phase} ✓` });
				}
			}
			this.scrollToBottom();
		};

		const finish = (text: string) => {
			cancelBtn.remove();
			container.createDiv({ cls: "ooc-progress-done", text });
			this.scrollToBottom();
		};

		return { onProgress, finish };
	}

	private async runNoteMemorySync(file: TFile, mode: "full" | "incremental"): Promise<void> {
		if (this.busy) return;
		this.currentCancellation = new CancellationSource();
		this.setBusy(true);
		const hadMemory = !!this.plugin.noteMemoryStore.get(file.path);
		const label =
			mode === "incremental"
				? `Updating note memory for "${file.basename}"`
				: hadMemory
					? `Rebuilding note memory for "${file.basename}"`
					: `Building note memory for "${file.basename}"`;
		const { onProgress, finish } = this.renderProgressLog(label);
		try {
			if (mode === "incremental") {
				const { fellBackToFull } = await this.plugin.noteMemoryStore.refreshIncremental(
					file, this.plugin.client, this.plugin.settings, onProgress, this.currentCancellation.token
				);
				finish(fellBackToFull ? "Wasn't a clean append since last sync — did a full rebuild instead." : "Updated.");
			} else {
				await this.plugin.noteMemoryStore.refreshFull(file, this.plugin.client, this.plugin.settings, onProgress, this.currentCancellation.token);
				finish("Done.");
			}
		} catch (err) {
			if (isCancelledError(err)) {
				finish("Cancelled.");
			} else {
				finish(`Error: ${(err as Error).message}`);
				new Notice(`Note memory sync failed: ${(err as Error).message}`);
			}
		} finally {
			this.currentCancellation = null;
			this.setBusy(false);
		}
	}

	private renderNoteMemoryHint(filePath: string, fileName: string): void {
		const bar = this.messagesEl.createDiv({ cls: "ooc-notemem-hint" });
		bar.createSpan({ text: `Answered using the note memory for "${fileName}". ` });
		const refreshBtn = bar.createEl("button", { text: "Refresh (full)" });
		const incrementalBtn = bar.createEl("button", { text: "Update (incremental)" });

		const file = this.app.vault.getAbstractFileByPath(filePath);
		const asFile = file instanceof TFile ? file : null;

		refreshBtn.addEventListener("click", this.toVoidHandler(async () => {
			if (this.busy) { new Notice("Something else is already running — wait for it to finish or cancel it first."); return; }
			refreshBtn.disabled = true;
			incrementalBtn.disabled = true;
			if (asFile) await this.runNoteMemorySync(asFile, "full");
		}));
		incrementalBtn.addEventListener("click", this.toVoidHandler(async () => {
			if (this.busy) { new Notice("Something else is already running — wait for it to finish or cancel it first."); return; }
			refreshBtn.disabled = true;
			incrementalBtn.disabled = true;
			if (asFile) await this.runNoteMemorySync(asFile, "incremental");
		}));
	}

	// ---- Pending memory confirm/discard cards ----

	private renderPendingCard(entry: TempMemoryEntry): void {
		const card = this.messagesEl.createDiv({ cls: "ooc-pending-card" });
		const label = entry.action === "extend"
			? `Save to memory — add to "${entry.topicName}"?`
			: `Save to memory — new topic "${entry.topicName}"?`;
		card.createDiv({ cls: "ooc-pending-label", text: label });
		card.createDiv({ cls: "ooc-pending-fact", text: entry.fact });

		const actions = card.createDiv({ cls: "ooc-pending-actions" });
		const confirmBtn = actions.createEl("button", { text: "Save" });
		const discardBtn = actions.createEl("button", { text: "Discard" });

		const disableBoth = () => { confirmBtn.disabled = true; discardBtn.disabled = true; };

		confirmBtn.addEventListener("click", this.toVoidHandler(async () => {
			if (this.busy) return;
			disableBoth();
			this.currentCancellation = new CancellationSource();
			this.setBusy(true);
			try {
				const topic = await this.plugin.orchestrator.confirmTempEntry(entry.id, this.currentCancellation.token);
				card.empty();
				card.createDiv({ cls: "ooc-pending-resolved", text: `Saved to "${topic.name}".` });
			} catch (err) {
				confirmBtn.disabled = false;
				discardBtn.disabled = false;
				if (isCancelledError(err)) {
					card.createDiv({ cls: "ooc-pending-resolved", text: "Cancelled — still pending." });
				} else {
					new Notice(`Couldn't save: ${(err as Error).message}`);
					card.createDiv({ cls: "ooc-pending-resolved", text: `Error: ${(err as Error).message}` });
				}
			} finally {
				this.currentCancellation = null;
				this.setBusy(false);
			}
		}));

		discardBtn.addEventListener("click", this.toVoidHandler(async () => {
			if (this.busy) return;
			disableBoth();
			this.setBusy(true);
			try {
				await this.plugin.orchestrator.discardTempEntry(entry.id);
				card.empty();
				card.createDiv({ cls: "ooc-pending-resolved", text: "Discarded." });
			} finally {
				this.setBusy(false);
			}
		}));

		this.scrollToBottom();
	}

	private renderPendingEntries(entries?: TempMemoryEntry[]): void {
		if (!entries) return;
		for (const entry of entries) this.renderPendingCard(entry);
	}

	// ---- Sending ----

	private get history(): ChatMessage[] {
		return this.session.messages.map((m) => ({ role: m.role, content: m.content }));
	}

	private async recordTurn(userText: string, assistantText: string): Promise<void> {
		const isFirstTurn = this.session.messages.length === 0;

		await this.plugin.chatSessionStore.appendMessage(this.session.id, { role: "user", content: userText });
		await this.plugin.chatSessionStore.appendMessage(this.session.id, { role: "assistant", content: assistantText });
		if (this.historyVisible) this.renderHistoryPanel();

		// Fire-and-forget: fold this turn into the session's rolling summary
		// digest without making the user wait on it.
		this.plugin.orchestrator.updateSessionHistory(this.session.id, userText, assistantText).catch(() => void 0);

		if (isFirstTurn) {
			// Automatically rename the chat based on what it's actually about,
			// without blocking the reply the user is already looking at.
			this.plugin.orchestrator
				.generateSessionTitle(userText)
				.then(async (title) => {
					await this.plugin.chatSessionStore.setTitle(this.session.id, title);
					if (this.historyVisible) this.renderHistoryPanel();
				})
				.catch(() => { /* keep the truncated fallback title */ });
		}
	}

	private renderRetry(text: string, wasClarificationReply: boolean, originalQueryForClarification: string | null): void {
		const row = this.messagesEl.createDiv({ cls: "ooc-retry-row" });
		row.createSpan({ text: "That didn't go through. " });
		const retryBtn = row.createEl("button", { text: "Retry" });
		retryBtn.addEventListener("click", () => {
			row.remove();
			if (wasClarificationReply) this.awaitingClarificationFor = originalQueryForClarification;
			this.inputEl.value = text;
			this.autoResizeInput();
			void this.send();
		});
		this.scrollToBottom(true);
	}

	private async send(): Promise<void> {
		if (this.busy) return;
		const text = this.inputEl.value.trim();
		if (!text) return;

		const wasClarificationReply = !!this.awaitingClarificationFor;
		const originalQueryForClarification = this.awaitingClarificationFor;

		this.inputEl.value = "";
		this.autoResizeInput();
		this.appendMessage("user", text);

		if (!wasClarificationReply) {
			const offered = await this.maybeOfferNoteMemoryBuild(text);
			if (offered) return; // waiting on the user's build/skip choice before this turn gets answered
		}

		await this.runQuery(text, wasClarificationReply, originalQueryForClarification);
	}

	/**
	 * If "Include note" (or an explicit "this note" reference) points at a
	 * note that doesn't have a memory mirror yet and is long enough that
	 * building one would actually help, ask before spending the time on it
	 * — rather than silently building it (which can take far longer than an
	 * ordinary reply and used to just happen without warning) or silently
	 * skipping it every time. Short notes are cheap to read raw, so those
	 * are never prompted for. Returns true if a prompt was shown — the
	 * caller should stop and wait for the user's choice instead of
	 * answering this turn immediately.
	 */
	private async maybeOfferNoteMemoryBuild(query: string): Promise<boolean> {
		if (!this.plugin.settings.autoInitNoteMemory) return false;

		const wantsActiveNote = this.includeActiveNote || ACTIVE_NOTE_REFERENCE.test(query);
		if (!wantsActiveNote) return false;

		const file = this.plugin.activeFileTracker.getFile();
		if (!file || file.extension !== "md") return false;
		if (this.plugin.noteMemoryStore.get(file.path)) return false; // already built

		const content = await this.app.vault.read(file);
		if (content.length < LONG_NOTE_PROMPT_THRESHOLD_CHARS) return false; // short enough to just read raw

		this.renderNoteMemoryPrompt(file, query);
		return true;
	}

	private renderNoteMemoryPrompt(file: TFile, query: string): void {
		const card = this.messagesEl.createDiv({ cls: "ooc-pending-card" });
		card.createDiv({
			cls: "ooc-pending-label",
			text: `"${file.basename}" is long and hasn't been added to note memory yet.`,
		});
		card.createDiv({
			cls: "ooc-pending-fact",
			text: "Building it lets me search it in layers of detail instead of reading it raw every time — worth it for a note this size, but takes a bit longer up front.",
		});

		const actions = card.createDiv({ cls: "ooc-pending-actions" });
		const buildBtn = actions.createEl("button", { text: "Build note memory" });
		const skipBtn = actions.createEl("button", { text: "Skip, just answer" });
		const disableBoth = () => { buildBtn.disabled = true; skipBtn.disabled = true; };

		buildBtn.addEventListener("click", this.toVoidHandler(async () => {
			if (this.busy) return;
			disableBoth();
			card.createDiv({ cls: "ooc-pending-resolved", text: "Building note memory…" });

			this.currentCancellation = new CancellationSource();
			this.setBusy(true);
			const { onProgress, finish } = this.renderProgressLog(`Building note memory for "${file.basename}"`);
			try {
				await this.plugin.noteMemoryStore.ensure(file, this.plugin.client, this.plugin.settings, onProgress, this.currentCancellation.token);
				finish("Note memory ready.");
			} catch (err) {
				finish(isCancelledError(err) ? "Cancelled." : `Error: ${(err as Error).message}`);
				if (!isCancelledError(err)) new Notice(`Note memory build failed: ${(err as Error).message}`);
			} finally {
				this.currentCancellation = null;
				this.setBusy(false);
			}

			await this.runQuery(query, false, null);
		}));

		skipBtn.addEventListener("click", this.toVoidHandler(async () => {
			if (this.busy) return;
			disableBoth();
			card.createDiv({ cls: "ooc-pending-resolved", text: "Skipped — answering without it." });
			await this.runQuery(query, false, null);
		}));

		this.scrollToBottom();
	}

	private async runQuery(text: string, wasClarificationReply: boolean, originalQueryForClarification: string | null): Promise<void> {
		this.currentCancellation = new CancellationSource();
		this.setBusy(true);

		const loadingBubble = this.appendLoadingBubble();
		this.statusEl.setText("Routing memories and thinking...");

		try {
			if (wasClarificationReply) {
				this.awaitingClarificationFor = null;

				const result = await this.plugin.orchestrator.provideClarification(
					originalQueryForClarification!,
					text,
					this.history,
					this.session.id,
					this.currentCancellation.token
				);
				loadingBubble.remove();
				this.appendMessage("assistant", result.answer);
				await this.recordTurn(originalQueryForClarification!, result.answer);

				const usedNames = result.usedTopics.map((r) => r.topic.name).join(", ");
				this.statusEl.setText(usedNames ? `Used memories: ${usedNames}` : "No memories used");
				this.renderPendingEntries(result.pendingEntries);
				return;
			}

			const result = await this.plugin.orchestrator.handleQuery(text, this.history, {
				sessionId: this.session.id,
				includeActiveNote: this.includeActiveNote,
				token: this.currentCancellation.token,
			});
			loadingBubble.remove();
			this.appendMessage("assistant", result.answer);

			if (result.needsClarification) {
				this.awaitingClarificationFor = text;
				this.statusEl.setText("Waiting for a bit more detail...");
				return;
			}

			await this.recordTurn(text, result.answer);

			if (result.memoryCommitted) {
				this.appendSystemNote(`✓ Saved to memory: "${result.memoryCommitted.topic.name}"`);
				this.statusEl.setText("Memory saved.");
				return;
			}

			const usedNames = result.usedTopics.map((r) => r.topic.name).join(", ");
			this.statusEl.setText(usedNames ? `Used memories: ${usedNames}` : "No memories used");
			if (result.noteMemoryUsed) this.renderNoteMemoryHint(result.noteMemoryUsed.filePath, result.noteMemoryUsed.fileName);
			this.renderPendingEntries(result.pendingEntries);
		} catch (err) {
			loadingBubble.remove();
			if (isCancelledError(err)) {
				this.appendSystemNote("Cancelled.");
				this.statusEl.setText("Cancelled.");
				if (wasClarificationReply) this.awaitingClarificationFor = originalQueryForClarification;
			} else {
				this.statusEl.setText(`Error: ${(err as Error).message}`);
				new Notice(`The Librarium error: ${(err as Error).message}`);
				if (wasClarificationReply) this.awaitingClarificationFor = originalQueryForClarification;
				this.renderRetry(text, wasClarificationReply, originalQueryForClarification);
			}
		} finally {
			this.currentCancellation = null;
			this.setBusy(false);
			this.inputEl.focus();
		}
	}
}
