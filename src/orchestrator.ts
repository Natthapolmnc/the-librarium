import { App, TFile } from "obsidian";
import { OllamaClient, ChatMessage } from "./ollamaClient";
import { OllamaOrchestratorSettings } from "./settings";
import { MemoryStore, MemoryTopic } from "./memoryStore";
import { quickOverview, generateShortTitle, extractQueryIntent, DIRECT_SUMMARIZE_CHAR_CAP } from "./summarizer";
import { resolveFromLayers, resolveAcrossSources, HierarchicalSource } from "./hierarchicalQuery";
import { routeMemories, findBestMatchingTopic, RoutedTopic } from "./memoryRouter";
import { FileSkills } from "./fileSkills";
import { TempMemoryStore, TempMemoryEntry } from "./tempMemoryStore";
import { NoteMemoryStore } from "./noteMemoryStore";
import { ChatHistoryStore } from "./chatHistoryStore";
import { ActiveFileTracker } from "./activeFileTracker";
import { CancellationToken, throwIfCancelled } from "./cancellation";

function extractJson<T>(raw: string): T | null {
	const match = raw.match(/\{[\s\S]*\}/);
	if (!match) return null;
	try {
		return JSON.parse(match[0]) as T;
	} catch {
		return null;
	}
}

export interface ChatTurnResult {
	answer: string;
	usedTopics: RoutedTopic[];
	/** true if `answer` is a clarifying question, not a real answer — the next chat turn should be treated as the user's reply to it. */
	needsClarification?: boolean;
	/** candidate memory updates surfaced this turn, awaiting the user's confirm/discard in the chat panel. Can be more than one — e.g. the clarification answer itself, plus a separately-detected fact from the final answer. */
	pendingEntries?: TempMemoryEntry[];
	/** true if this turn was an explicit "remember this" command that was committed directly (no pending card, nothing left to confirm). */
	memoryCommitted?: { topic: MemoryTopic };
	/** the active note's mirror was used to ground this answer — surfaced so the UI can offer a refresh if it looks stale. */
	noteMemoryUsed?: { filePath: string; fileName: string };
}

export interface HandleQueryOptions {
	/** which chat session this turn belongs to — scopes which temp-memory entries count as live context. */
	sessionId: string;
	/** include the currently active/open note's content as extra context ("reading page" mode). Default false (memory-only). */
	includeActiveNote?: boolean;
	/** internal: skip the ambiguity check and candidate-staging pass (used when re-answering right after a clarification was just supplied). */
	skipClarification?: boolean;
	/** lets the caller cancel this query mid-flight — checked between major steps (routing, per-search-round, before the final chat call). */
	token?: CancellationToken;
}

export const ACTIVE_NOTE_REFERENCE = /\b(this|the current|the open)\s+(note|page|document|file)\b/i;

export interface MemoryCommandIntent {
	content: string;
	topicHint?: string;
}

// Cheap first-pass filter so a normal question never pays for the intent-extraction
// LLM call. Only messages that loosely resemble a memorize command go further.
const MEMORY_COMMAND_HINT = /\b(remember|note (this|that) down|make a memory|save (this|that)|add (this|that) to memory|keep (this|that) in mind|memorize)\b/i;

// Keeps answers direct and appropriately sized instead of defaulting to
// broad, over-explained responses — the model is asked to lead with the
// actual answer and match the user's level of detail rather than padding
// every reply with textbook-style exposition. Sized so the answer is
// complete, not so short it leaves out something the question needed.
const RESPONSE_STYLE_GUIDELINES = `You are a thoughtful, conversational AI assistant. Your goal is to give complete, useful answers without being verbose.
- Answer the user's question directly before giving any explanation.
- Use natural, human-like language instead of sounding like a textbook.
- Match the user's tone and level of detail.
- Length should follow the question, not a fixed target: a quick question earns a short answer, but if the question has several parts or genuinely needs support (reasoning, an example, a caveat) to be useful, include it rather than cutting it for brevity's sake. Don't truncate or leave a part of the question unaddressed just to keep the reply short.
- Don't repeat the user's question.
- Don't explain obvious concepts unless they ask.
- Avoid unnecessary bullet points.
- If you're unsure, say so instead of guessing.
- If there are multiple reasonable answers, recommend one and briefly explain why — but mention real alternatives when they matter.
- When the user is chatting casually, respond casually. When they ask technical questions, be precise and thorough enough to actually be useful.
- Prefer one strong answer over a hedge across several possibilities.
- Don't begin with "Certainly!", "Of course!", or "Absolutely!" unless it feels natural.
- Don't summarize what you're about to say. Don't end every response with an offer to help further.
- Avoid generic safety disclaimers unless they're actually relevant.
- Don't write like documentation. Write like an experienced colleague — one who finishes their thought instead of trailing off.`;

export class Orchestrator {
	private overviewEmbeddings = new Map<string, number[]>();
	public files: FileSkills;

	constructor(
		private app: App,
		public client: OllamaClient,
		public settings: OllamaOrchestratorSettings,
		public memory: MemoryStore,
		public tempMemory: TempMemoryStore,
		public noteMemory: NoteMemoryStore,
		public chatHistory: ChatHistoryStore,
		activeFileTracker?: ActiveFileTracker
	) {
		this.files = new FileSkills(app, activeFileTracker);
	}

	// ---- Ingestion: turn a vault file into (or into a growth of) a memory topic ----
	// Every memory topic, whether it started from a file or a chat fact, is
	// always backed by a fixed stack of named abstraction layers — the
	// topic's files are always regenerated from that layered memory, never
	// written by hand.

	async ingestFile(file: TFile, onProgress?: (msg: string) => void, token?: CancellationToken): Promise<MemoryTopic> {
		const content = await this.app.vault.read(file);

		onProgress?.(`Checking whether "${file.basename}" belongs to an existing topic...`);
		const quick = await quickOverview(this.client, this.settings, content);
		throwIfCancelled(token);
		const existing = await this.matchExistingTopic(file.basename, quick);

		const reportProgress = (p: { phase: string; status: "starting" | "done" }) =>
			onProgress?.(p.status === "starting" ? `${p.phase}...` : `${p.phase} — done`);

		if (existing) {
			onProgress?.(`Growing existing topic "${existing.name}"...`);
			return this.memory.appendRawContent(existing.id, content, this.client, this.settings, reportProgress, token);
		}

		onProgress?.(`Building new topic "${file.basename}"...`);
		return this.memory.createTopicFromText(file.basename, content, this.client, this.settings, reportProgress, token);
	}

	/** Embedding-first, LLM-confirmed-only-when-borderline topic matching (see memoryRouter.findBestMatchingTopic for why). */
	private async matchExistingTopic(candidateName: string, overview: string): Promise<MemoryTopic | undefined> {
		const topics = this.memory.listTopics();
		return findBestMatchingTopic(this.client, this.settings, overview, candidateName, topics, this.overviewEmbeddings);
	}

	// ---- Explicit "remember this" / "make a memory about X" commands ----
	// Recognized commands bypass the confirm-before-write staging entirely:
	// the user already gave explicit consent by asking, so the note is
	// created/extended right away instead of sitting in temp-memory.

	/**
	 * Cheap regex pre-filter, then (only if it hits) one LLM call to decide
	 * for real and extract clean content to remember. Returns null for any
	 * ordinary question, so normal chat pays no extra latency.
	 */
	async detectMemoryCommand(message: string, recentHistory: ChatMessage[] = [], sessionSummary?: string): Promise<MemoryCommandIntent | null> {
		if (!MEMORY_COMMAND_HINT.test(message)) return null;

		const historyText = recentHistory
			.slice(-6)
			.map((m) => `${m.role}: ${m.content}`)
			.join("\n");
		const summaryText = sessionSummary ? `${sessionSummary}\n\n` : "";

		const prompt = `${summaryText}Recent conversation (may be empty):
${historyText || "(none)"}

Latest message: "${message}"

Is the latest message an explicit request to remember/save/note something down for later (not just a question)? If yes, extract the actual content to remember — pull in relevant detail from the recent conversation above if the message refers back to it (e.g. "remember that" pointing at something just discussed) — and a short topic name hint if one is obvious.

Respond with ONLY JSON: {"isMemoryCommand": true|false, "content": "<the fact/content to remember, or null>", "topicHint": "<short topic name, or null>"}`;

		const raw = await this.client.generate(this.settings.summaryModel, prompt, { temperature: 0.1 });
		const parsed = extractJson<{ isMemoryCommand: boolean; content?: string | null; topicHint?: string | null }>(raw);
		if (!parsed?.isMemoryCommand || !parsed.content) return null;

		return { content: parsed.content, topicHint: parsed.topicHint ?? undefined };
	}

	/** Commits an explicit memory command directly — matches against ALL topics (not just this turn's routed ones), then extends or creates. No staging, no confirm card. */
	async createOrUpdateMemoryDirectly(content: string, topicHint?: string, token?: CancellationToken): Promise<MemoryTopic> {
		const quick = await quickOverview(this.client, this.settings, content);
		throwIfCancelled(token);
		const candidateName = topicHint ?? quick.slice(0, 60);
		const existing = await this.matchExistingTopic(candidateName, quick);

		if (existing) {
			return this.memory.appendRawContent(existing.id, content, this.client, this.settings, undefined, token);
		}
		return this.memory.createTopicFromText(candidateName, content, this.client, this.settings, undefined, token);
	}

	// ---- Query-time: extract intent, route, search layer-by-layer, answer ----

	async handleQuery(query: string, history: ChatMessage[] = [], opts: HandleQueryOptions): Promise<ChatTurnResult> {
		// A rolling digest of the whole session (summary + inferred user
		// intent), kept up to date one turn at a time — lets every LLM call
		// below stay aware of earlier turns even once the raw transcript is
		// capped for token-efficiency (see recentRawTurns below).
		const sessionSummaryText = this.settings.trackChatSummary ? this.chatHistory.inlineText(opts.sessionId) : undefined;
		const sessionSummaryBlock = this.settings.trackChatSummary ? this.chatHistory.contextBlock(opts.sessionId) : undefined;

		// Older turns are represented by the rolling summary above once one
		// exists; only the most recent messages are still sent verbatim, so a
		// long-running chat doesn't keep re-paying for its entire transcript
		// on every single turn.
		const cappedHistory =
			this.settings.trackChatSummary && sessionSummaryBlock
				? history.slice(-Math.max(2, this.settings.recentRawTurns))
				: history;

		// Note-memory init is no longer done silently here — the chat UI asks
		// before building (see ChatView.maybeOfferNoteMemoryBuild), since a
		// first-time build on a long note can take far longer than an
		// ordinary reply and shouldn't just happen without the user knowing.
		// By the time this runs, either a mirror already exists (built just
		// now via that prompt, or from an earlier turn) or it doesn't — this
		// only ever reads whatever's already there.
		const wantsActiveNote = opts.includeActiveNote || ACTIVE_NOTE_REFERENCE.test(query);
		const activeNoteFile = wantsActiveNote ? this.files.getActiveFile() : null;
		const noteMirror = activeNoteFile ? this.noteMemory.get(activeNoteFile.path) : undefined;

		// A natural "note this down" / "remember that..." command is handled
		// as its own thing — commit directly, confirm in plain language, and
		// skip routing/clarification/staging entirely for this turn.
		if (!opts.skipClarification) {
			const memoryIntent = await this.detectMemoryCommand(query, cappedHistory, sessionSummaryText);
			if (memoryIntent) {
				const topic = await this.createOrUpdateMemoryDirectly(memoryIntent.content, memoryIntent.topicHint, opts.token);
				return {
					answer: `Got it — saved to memory under "${topic.name}".`,
					usedTopics: [],
					memoryCommitted: { topic },
				};
			}
		}

		// Distill what's actually being asked — resolving pronouns/context
		// from recent history — so both retrieval and the final answer stay
		// aimed at the specific question instead of drifting broad on a
		// loosely-phrased or context-dependent one.
		const intent = this.settings.enableIntentExtraction
			? await extractQueryIntent(this.client, this.settings, query, cappedHistory, sessionSummaryText)
			: query;
		throwIfCancelled(opts.token);

		const topics = this.memory.listTopics();
		const routed = await routeMemories(this.client, this.settings, query, topics, this.overviewEmbeddings);
		throwIfCancelled(opts.token);

		const contextBlocks: string[] = [];

		// The rolling session digest goes in first — it's the cheapest, most
		// load-bearing context for a long-running chat, and is what lets the
		// model stay grounded in earlier turns once the raw transcript below
		// is capped.
		if (sessionSummaryBlock) contextBlocks.push(sessionSummaryBlock);

		// Routing already narrowed things down to `routed`; resolving their
		// detail is done as ONE joint, layer-by-layer search across all of
		// them together (see resolveAcrossSources) instead of resolving each
		// topic independently. Every topic starts at its Overview (cheapest
		// layer) in the same round; only topics still judged relevant-but-
		// insufficient descend into a deeper, pricier layer — so irrelevant
		// topics never cost more than their Overview, and the number of LLM
		// calls scales with layer depth, not with how many topics were routed.
		const layeredSources: HierarchicalSource[] = [];
		for (const r of routed) {
			const memory = this.memory.getMemory(r.topic.id);
			if (memory) layeredSources.push({ key: r.topic.id, label: r.topic.name, memory });
		}
		if (layeredSources.length > 0) {
			const resolved = await resolveAcrossSources(layeredSources, query, intent, this.client, this.settings, this.settings.maxMemoriesPerQuery, opts.token);
			for (const r of resolved) contextBlocks.push(`### ${r.label} (${r.layerUsed})\n${r.text}`);
		}
		throwIfCancelled(opts.token);

		// Unconfirmed temp-memory for THIS chat session only — newest first,
		// with an explicit instruction to weight the most recent higher if
		// notes conflict. This is what makes temp-memory behave like a running,
		// recency-weighted scratchpad rather than a flat, order-agnostic list
		// the way permanent memory is.
		const sessionEntries = this.tempMemory.listForSession(opts.sessionId); // already newest-first
		if (sessionEntries.length > 0) {
			const lines = sessionEntries.map((e, i) => `${i === 0 ? "[most recent] " : ""}- ${e.fact}`);
			contextBlocks.push(
				`### Notes from this chat (not yet saved to memory — newest first; if they conflict with older notes or with permanent memory, trust the newest)\n${lines.join("\n")}`
			);
		}

		// "Reading page" mode: fold in the currently open note — via its
		// layered mirror (auto-built on first use if missing), not a raw
		// dump, so only the relevant layer of detail is pulled in even for a
		// long note. Also triggers automatically if the question explicitly
		// says "this note"/"the current note" even when the toggle is off,
		// so pronoun resolution doesn't depend on the user remembering to
		// flip a switch first.
		let noteMemoryUsed: ChatTurnResult["noteMemoryUsed"];
		if (wantsActiveNote && activeNoteFile) {
			if (noteMirror) {
				const resolved = await resolveFromLayers(noteMirror.memory, query, intent, this.client, this.settings, opts.token);
				contextBlocks.push(
					`### The note currently open in Obsidian, "${activeNoteFile.basename}" (${resolved.layerUsed}) — the user may call it "this note" or "the current note"\n${resolved.text}`
				);
				noteMemoryUsed = { filePath: activeNoteFile.path, fileName: activeNoteFile.basename };
			} else {
				// No mirror yet (a short note the UI never prompted for, or the
				// user skipped building one) — fall back to a capped raw read
				// rather than silently answering with no note context at all.
				const raw = await this.app.vault.read(activeNoteFile);
				const cap = DIRECT_SUMMARIZE_CHAR_CAP * 3;
				const text = raw.length > cap ? `${raw.slice(0, cap)}\n...[truncated]` : raw;
				contextBlocks.push(`### The note currently open in Obsidian, "${activeNoteFile.basename}"\n${text}`);
				noteMemoryUsed = { filePath: activeNoteFile.path, fileName: activeNoteFile.basename };
			}
		}
		throwIfCancelled(opts.token);

		if (this.settings.enableClarification && !opts.skipClarification) {
			const ambiguity = await this.checkAmbiguity(query, intent, contextBlocks);
			if (ambiguity.needsClarification && ambiguity.clarifyingQuestion) {
				return { answer: ambiguity.clarifyingQuestion, usedTopics: routed, needsClarification: true };
			}
		}

		const intentLine = this.settings.enableIntentExtraction ? `\n\nWhat the user is specifically asking for right now: ${intent}` : "";
		const systemPrompt = contextBlocks.length
			? `${RESPONSE_STYLE_GUIDELINES}${intentLine}\n\nYou also have access to the user's memory notes below. Use them if useful to answer precisely and specifically; ignore anything irrelevant. If the user says "this note" or "the current note", they mean the note context block below, if one is present.\n\n${contextBlocks.join("\n\n")}`
			: `${RESPONSE_STYLE_GUIDELINES}${intentLine}`;

		const messages: ChatMessage[] = [
			{ role: "system", content: systemPrompt },
			...cappedHistory,
			{ role: "user", content: query },
		];

		throwIfCancelled(opts.token);
		const answer = await this.client.chat(this.settings.chatModel, messages);
		throwIfCancelled(opts.token); // don't stage/return a result the user already cancelled on, even though the network call itself couldn't be aborted mid-flight

		let pendingEntry: TempMemoryEntry | undefined;
		if (this.settings.suggestMemoryUpdates) {
			pendingEntry = await this.stageMemoryCandidate(query, answer, routed, opts.sessionId);
		}

		return { answer, usedTopics: routed, pendingEntries: pendingEntry ? [pendingEntry] : undefined, noteMemoryUsed };
	}

	/**
	 * Called when the user replies to a clarifying question. The reply is
	 * staged into temp-memory (visible, but not yet permanent) and
	 * immediately used as context to actually answer the original query.
	 */
	async provideClarification(
		originalQuery: string,
		clarificationText: string,
		history: ChatMessage[],
		sessionId: string,
		token?: CancellationToken
	): Promise<ChatTurnResult> {
		const quick = await quickOverview(this.client, this.settings, clarificationText);
		throwIfCancelled(token);
		const matched = await this.matchExistingTopic("Clarification", quick);

		const entry = await this.tempMemory.create({
			sessionId,
			action: matched ? "extend" : "new",
			topicId: matched?.id,
			topicName: matched ? matched.name : quick.slice(0, 60),
			fact: clarificationText,
			sourceQuery: originalQuery,
		});

		const result = await this.handleQuery(originalQuery, history, { sessionId, skipClarification: true, token });
		result.pendingEntries = [entry, ...(result.pendingEntries ?? [])];
		return result;
	}

	/**
	 * Decides whether a query depends on personal/contextual information
	 * ("my project", "that thing I mentioned", "update the plan") that the
	 * gathered context doesn't sufficiently cover — in which case it's better
	 * to ask the user than to guess.
	 */
	private async checkAmbiguity(
		query: string,
		intent: string,
		contextBlocks: string[]
	): Promise<{ needsClarification: boolean; clarifyingQuestion?: string }> {
		// contextBlocks already includes the rolling session-summary block
		// (pushed first in handleQuery), so ambiguity is judged with full
		// awareness of the conversation so far, not just this turn's memory hits.
		const contextText = contextBlocks.length ? contextBlocks.join("\n\n") : "(no memory context available)";
		const prompt = `Context available:
${contextText}

User question: "${query}"
What the user specifically needs: ${intent}

Does answering what the user specifically needs require personal or contextual information (e.g. "my project", "that thing", "the plan") that the context above does NOT sufficiently cover, making it ambiguous or hard to answer well without asking for more detail? A standalone general-knowledge question, or one already covered by the context, does NOT need clarification.

Respond with ONLY JSON: {"needsClarification": true|false, "clarifyingQuestion": "<question to ask, or null>"}`;

		const raw = await this.client.generate(this.settings.summaryModel, prompt, { temperature: 0.1 });
		const parsed = extractJson<{ needsClarification: boolean; clarifyingQuestion?: string | null }>(raw);
		if (!parsed) return { needsClarification: false };
		return { needsClarification: !!parsed.needsClarification, clarifyingQuestion: parsed.clarifyingQuestion ?? undefined };
	}

	/**
	 * Loose duplicate check: token-overlap (Jaccard-style) similarity, used
	 * as a programmatic safety net on top of the LLM's own "already known?"
	 * judgment, so a fact that just restates something already remembered
	 * (or already staged this chat) doesn't get suggested again turn after
	 * turn even if the model's instruction-following slips.
	 */
	private factsAreSimilar(a: string, b: string): boolean {
		const tokenize = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).filter(Boolean));
		const sa = tokenize(a);
		const sb = tokenize(b);
		if (sa.size === 0 || sb.size === 0) return false;
		let overlap = 0;
		for (const w of sa) if (sb.has(w)) overlap++;
		const union = new Set([...sa, ...sb]).size;
		return union > 0 && overlap / union >= 0.6;
	}

	/**
	 * After answering, check whether the exchange revealed a durable fact
	 * worth staging — but only if it's actually NEW or CHANGED relative to
	 * what's already remembered, not something that's already captured in
	 * permanent memory or already sitting as a pending (unconfirmed) entry
	 * for this chat. Without this, the same fact could get re-suggested on
	 * every turn a topic comes up, training the user to reflexively dismiss
	 * the prompt instead of it being a meaningful signal.
	 */
	private async stageMemoryCandidate(
		query: string,
		answer: string,
		routed: RoutedTopic[],
		sessionId: string
	): Promise<TempMemoryEntry | undefined> {
		const pendingThisSession = this.tempMemory.listForSession(sessionId);

		const topicList = routed
			.map((r) => {
				const alreadyPending = pendingThisSession
					.filter((e) => e.action === "extend" && e.topicId === r.topic.id)
					.map((e) => `  - (already staged, unconfirmed) ${e.fact}`)
					.join("\n");
				return `- id: ${r.topic.id}\n  name: ${r.topic.name}\n  already known (existing memory overview): ${r.topic.overview}${alreadyPending ? `\n${alreadyPending}` : ""}`;
			})
			.join("\n");

		const pendingNewTopics = pendingThisSession
			.filter((e) => e.action === "new")
			.map((e) => `- "${e.topicName}": ${e.fact}`)
			.join("\n");

		const prompt = `Conversation turn:
User: ${query}
Assistant: ${answer}

Candidate memory topics this turn touched, with what's already captured about each one (from permanent memory, and from facts already staged-but-unconfirmed earlier in this chat):
${topicList || "(none)"}

Other new topics already staged this chat, not yet confirmed:
${pendingNewTopics || "(none)"}

Does this turn contain a durable fact worth remembering that is NOT already captured above — i.e. it adds genuinely new information, or updates/corrects something already known? If it just restates, rephrases, or is already covered by what's listed above, that does NOT count.
- If it's new/changed info that fits one of the candidate topics above, respond: {"action": "extend", "topicId": "<id>", "fact": "<the fact, one or two sentences>"}
- If it's new/changed info that doesn't fit any candidate topic, respond: {"action": "new", "topicName": "<short topic name>", "fact": "<the fact, one or two sentences>"}
- If nothing new or changed came up, respond: {"action": "none"}
Respond with ONLY the JSON, nothing else.`;

		const raw = await this.client.generate(this.settings.summaryModel, prompt, { temperature: 0.1 });
		const parsed = extractJson<{ action: "extend" | "new" | "none"; topicId?: string; topicName?: string; fact?: string }>(raw);
		if (!parsed || parsed.action === "none" || !parsed.fact) return undefined;

		// Validate the id like everywhere else: an invalid/hallucinated id
		// becomes "no topic", not a silent misfire onto the wrong note.
		if (parsed.action === "extend" && parsed.topicId) {
			const topic = routed.find((r) => r.topic.id === parsed.topicId)?.topic ?? this.memory.getTopic(parsed.topicId);
			if (!topic) return undefined;

			const alreadyKnown = [
				topic.overview,
				...pendingThisSession.filter((e) => e.action === "extend" && e.topicId === topic.id).map((e) => e.fact),
			];
			if (alreadyKnown.some((known) => this.factsAreSimilar(known, parsed.fact!))) return undefined;

			return this.tempMemory.create({
				sessionId,
				action: "extend",
				topicId: topic.id,
				topicName: topic.name,
				fact: parsed.fact,
				sourceQuery: query,
			});
		}

		if (parsed.action === "new" && parsed.topicName) {
			const alreadyStagedForSameTopic = pendingThisSession
				.filter((e) => e.action === "new" && e.topicName?.toLowerCase() === parsed.topicName?.toLowerCase())
				.map((e) => e.fact);
			if (alreadyStagedForSameTopic.some((known) => this.factsAreSimilar(known, parsed.fact!))) return undefined;

			return this.tempMemory.create({
				sessionId,
				action: "new",
				topicName: parsed.topicName,
				fact: parsed.fact,
				sourceQuery: query,
			});
		}

		return undefined;
	}

	/** Commits a pending temp-memory entry into permanent, layered memory, then removes it. */
	async confirmTempEntry(id: string, token?: CancellationToken): Promise<MemoryTopic> {
		const entry = this.tempMemory.get(id);
		if (!entry) throw new Error("This pending memory entry no longer exists.");

		let topic: MemoryTopic;
		if (entry.action === "extend" && entry.topicId && this.memory.getTopic(entry.topicId)) {
			topic = await this.memory.appendRawContent(entry.topicId, entry.fact, this.client, this.settings, undefined, token);
		} else {
			topic = await this.memory.createTopicFromText(entry.topicName ?? "New topic", entry.fact, this.client, this.settings, undefined, token);
		}

		await this.tempMemory.discard(id);
		return topic;
	}

	async discardTempEntry(id: string): Promise<void> {
		await this.tempMemory.discard(id);
	}

	/** Wraps summarizer.generateShortTitle so ChatView doesn't need its own reference to client/settings for this. */
	async generateSessionTitle(firstMessage: string): Promise<string> {
		return generateShortTitle(this.client, this.settings, firstMessage);
	}

	/**
	 * Folds one completed user/assistant turn into that session's rolling
	 * summary + inferred-user-intent digest (see ChatHistoryStore). Called
	 * once a turn is actually recorded — not on a clarifying question, which
	 * isn't a finished exchange yet. Best-effort: a failed digest update
	 * never surfaces as a chat error, since the chat itself already succeeded.
	 */
	async updateSessionHistory(sessionId: string, userText: string, assistantText: string): Promise<void> {
		if (!this.settings.trackChatSummary) return;
		try {
			await this.chatHistory.update(sessionId, userText, assistantText, this.client, this.settings);
		} catch {
			// scratch context only — never worth interrupting the chat over
		}
	}

	/** Explicit "clear/restart temp-memory" for one chat session — distinct from starting a whole new chat. */
	async clearSessionTempMemory(sessionId: string): Promise<void> {
		await this.tempMemory.clearSession(sessionId);
	}

	/** Called when a chat session is pruned from history entirely, so its temp-memory doesn't linger forever either. */
	async clearPrunedSessionTempMemory(sessionId: string): Promise<void> {
		await this.tempMemory.clearSession(sessionId);
	}
}
