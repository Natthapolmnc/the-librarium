import { OllamaClient } from "./ollamaClient";
import { OllamaOrchestratorSettings } from "./settings";
import { chunkTextWithLLM, chunkUnits } from "./chunker";
import { CancellationToken, throwIfCancelled } from "./cancellation";

/** One named tier of a memory's progressive-abstraction stack. index 0 = Overview (least detail); the highest index = Comprehensive Summary (most detail, built directly from the source). */
export interface MemoryLayer {
	index: number;
	name: string;
	text: string;
}

/** A memory stored as a fixed stack of named layers, plus the raw source it was built from. layers[0] = Overview ... layers[last] = Comprehensive Summary. */
export interface LayeredMemory {
	layers: MemoryLayer[];
	original: string;
	builtAt: number;
}

export interface BuildProgress {
	/** -1 while still building the base Comprehensive Summary from raw chunks; otherwise the target layer's index. */
	layerIndex: number;
	layerName: string;
	phase: string;
	status: "starting" | "done";
}

export interface LayerRole {
	name: string;
	/** what this layer's summary should contain, phrased for the prompt. */
	targetDescription: string;
}

/**
 * Defines the semantic role of each layer in the stack. Named exactly as
 * specified for the default 3-layer case (Overview / High-Level Concepts /
 * Detailed Concepts / Comprehensive Summary); other configured layer counts
 * get a generic name with a target description interpolated between
 * "high-level" (near the Overview) and "detailed" (near the Comprehensive
 * Summary).
 */
export function layerRole(index: number, numAbstractionLayers: number): LayerRole {
	if (index === 0) {
		return { name: "Overview", targetDescription: "a few sentences giving a quick understanding of the content" };
	}
	if (index === numAbstractionLayers) {
		return { name: "Comprehensive Summary", targetDescription: "a near-complete summary that preserves most of the original information" };
	}
	if (numAbstractionLayers === 3) {
		if (index === 1) return { name: "High-Level Concepts", targetDescription: "the main ideas, themes, and relationships" };
		if (index === 2) return { name: "Detailed Concepts", targetDescription: "more specific explanations, important details, and supporting context" };
	}
	const t = index / numAbstractionLayers;
	const targetDescription = t <= 0.5
		? "the main ideas, themes, and relationships, in somewhat more detail than the layer above"
		: "specific explanations, important details, and supporting context, while staying more compact than the layer below";
	return { name: `Layer ${index} of ${numAbstractionLayers}`, targetDescription };
}

function layerPrompt(role: LayerRole, sourceLayerName: string): string {
	return `The text below is the "${sourceLayerName}" layer of a piece of content. Produce the "${role.name}" layer from it: ${role.targetDescription}. It must stay fully consistent with the text below and must not introduce any information that isn't already in it — only select, condense, or reorganize what's already there, never invent new facts. No preamble, just the summary itself.`;
}

const FACT_EXTRACTION_PROMPT =
	"You are carefully reading one part of a longer piece of writing, building an accurate, near-complete factual record. From the excerpt below, capture explicit information — named people/characters, places, dates or timeline points, concrete events, relationships, objects, and explicit factual or worldbuilding claims — preserving as much detail and nuance as you reasonably can rather than compressing aggressively. Do not infer motivations, themes, or symbolism yet. No preamble, just the record itself.";

const COMPREHENSIVE_MERGE_PROMPT =
	"You are merging several summaries of consecutive parts of the same longer piece of writing into one continuous summary. This must stay near-complete: carry over every distinct fact — named people/characters, places, dates, events, relationships, and explicit claims — from every part. Only shorten where two parts state the literal same fact; fold that single duplicate mention into one, and trim prose that is pure filler with no informational content. Do NOT generalize, compress, or drop details for the sake of brevity — the merged summary should read as the union of everything in the parts, not a condensed digest of it. Explicitly reconcile anything where a later part changes, contradicts, or reveals new meaning in an earlier one (a reveal, twist, unreliable narration, hidden identity, or similar) — state the resolved version once, not both versions. No preamble, just the merged summary.";

/**
 * A rough, non-chunking-related size threshold used for a couple of small
 * "is this short enough to just do in one call" decisions elsewhere (merging
 * two comprehensive summaries directly, capping a quick-overview read, and
 * capping a raw-note fallback read). Deliberately not tied to the (now
 * LLM-driven) chunking algorithm — this is just a sane default for "small
 * enough to hand to the model directly without any splitting."
 */
export const DIRECT_SUMMARIZE_CHAR_CAP = 6000;

const MERGE_TWO_COMPREHENSIVE_PROMPT =
	"You are merging two summaries of the SAME evolving subject: one representing everything known before, one representing new information just learned. Merge them into one continuous summary that stays near-complete — keep every distinct fact from both. Only shorten where something is restated in both (fold that into one mention) or is pure filler with no informational content; do NOT generalize, compress, or drop details otherwise. If the new information updates, corrects, or contradicts something in the old summary, state the resolved (new) version once rather than keeping both. No preamble, just the merged summary.";

async function summarizeText(client: OllamaClient, settings: OllamaOrchestratorSettings, text: string, instruction: string): Promise<string> {
	const prompt = `${instruction}\n\n---\n${text}\n---\n\nSummary:`;

	let out = (await client.generate(settings.summaryModel, prompt, { temperature: 0.2 })).trim();
	if (!out) {
		// Small local models occasionally return an empty completion — retry
		// once with slightly higher temperature before giving up, rather than
		// silently leaving a blank layer.
		out = (await client.generate(settings.summaryModel, prompt, { temperature: 0.5 })).trim();
	}
	if (!out) {
		out = text.length > 240 ? `${text.slice(0, 240)}…` : text;
	}
	return out;
}

/**
 * Runs `fn` over every item, never more than `limit` calls in flight at
 * once — chunks/groups within one pass are independent of each other, so
 * running them concurrently (rather than one at a time) is the main lever
 * for keeping this whole process quick on longer documents.
 */
async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>,
	token?: CancellationToken
): Promise<R[]> {
	const results: R[] = new Array<R>(items.length);
	let next = 0;
	const effectiveLimit = Math.max(1, Math.min(limit, items.length || 1));

	async function worker(): Promise<void> {
		for (;;) {
			if (token?.isCancelled()) return; // stop picking up new work; whatever's already in flight still finishes, but nothing new is queued behind it
			const i = next++;
			if (i >= items.length) return;
			results[i] = await fn(items[i], i);
		}
	}

	await Promise.all(Array.from({ length: effectiveLimit }, () => worker()));
	throwIfCancelled(token); // don't hand back a partially-filled array as if it were complete
	return results;
}

/**
 * Builds the Comprehensive Summary — the base, most-detailed named layer —
 * directly from raw source text. If the text already fits in one chunk, it
 * IS the comprehensive summary (no LLM call needed: nothing is more
 * "near-complete" than the original itself). Otherwise: read every chunk
 * carefully (preserving detail, not compressing hard), then repeatedly
 * regroup and merge those readings — reconciling overlaps and any later
 * parts that change the meaning of earlier ones — until one continuous
 * summary remains.
 */
async function buildComprehensiveSummary(
	sourceText: string,
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	onProgress?: (p: BuildProgress) => void,
	token?: CancellationToken
): Promise<string> {
	const chunks = await chunkTextWithLLM(sourceText, client, settings, token);
	throwIfCancelled(token);

	if (chunks.length <= 1) {
		// The LLM didn't find a natural break point (or the text was tiny to
		// begin with) — nothing more "near-complete" than the original itself.
		return sourceText.trim();
	}

	onProgress?.({ layerIndex: -1, layerName: "Comprehensive Summary", phase: `Reading ${chunks.length} chunk(s) and extracting facts`, status: "starting" });
	let currentTexts = await mapWithConcurrency(chunks, settings.maxConcurrentSummaries, (c) => summarizeText(client, settings, c.text, FACT_EXTRACTION_PROMPT), token);
	onProgress?.({ layerIndex: -1, layerName: "Comprehensive Summary", phase: `Read ${chunks.length} chunk(s)`, status: "done" });

	let pass = 0;
	while (currentTexts.length > 1 && pass < settings.maxChunkMergePasses) {
		throwIfCancelled(token);
		pass++;
		const grouped = chunkUnits(currentTexts, {
			// mergeGroupMaxChars is the real gate here — units are grouped
			// purely by character budget, with no separate cap on how many
			// units can land in one group (a fact-extracted unit's length
			// varies a lot, so an arbitrary unit-count ceiling doesn't add
			// anything the char budget doesn't already control).
			maxChars: settings.mergeGroupMaxChars,
			maxUnits: Number.MAX_SAFE_INTEGER,
			overlapUnits: settings.mergeOverlapUnits,
		});
		onProgress?.({ layerIndex: -1, layerName: "Comprehensive Summary", phase: `Merge pass ${pass}: combining ${currentTexts.length} part(s) into ${grouped.length}`, status: "starting" });
		currentTexts = await mapWithConcurrency(grouped, settings.maxConcurrentSummaries, (g) => summarizeText(client, settings, g.text, COMPREHENSIVE_MERGE_PROMPT), token);
		onProgress?.({ layerIndex: -1, layerName: "Comprehensive Summary", phase: `Merge pass ${pass} done — ${currentTexts.length} part(s) left`, status: "done" });
	}

	if (currentTexts.length > 1) {
		// Safety-cap fallback: force one final merge regardless of remaining size.
		return summarizeText(client, settings, currentTexts.join("\n\n"), COMPREHENSIVE_MERGE_PROMPT);
	}

	return currentTexts[0];
}

/**
 * Cascades UP from the Comprehensive Summary through `numAbstractionLayers`
 * further compression passes, each one deriving strictly from the layer
 * directly below it (never from the raw source again), so every layer stays
 * a faithful, non-hallucinated abstraction of the one beneath it. Returns
 * layers indexed 0 (Overview) through numAbstractionLayers-1.
 */
async function cascadeLayersUpward(
	comprehensiveText: string,
	numAbstractionLayers: number,
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	onProgress?: (p: BuildProgress) => void,
	token?: CancellationToken
): Promise<MemoryLayer[]> {
	const layers: MemoryLayer[] = [];
	let current = comprehensiveText;
	let currentName = "Comprehensive Summary";

	for (let i = numAbstractionLayers - 1; i >= 0; i--) {
		throwIfCancelled(token);
		const role = layerRole(i, numAbstractionLayers);
		onProgress?.({ layerIndex: i, layerName: role.name, phase: `Distilling ${role.name}`, status: "starting" });
		const text = await summarizeText(client, settings, current, layerPrompt(role, currentName));
		layers[i] = { index: i, name: role.name, text };
		onProgress?.({ layerIndex: i, layerName: role.name, phase: `Distilled ${role.name}`, status: "done" });
		current = text;
		currentName = role.name;
	}

	return layers;
}

/** Builds a brand-new layered memory from raw source text: the Comprehensive Summary first, then the named layers cascading up to the Overview. */
export async function buildLayeredMemory(
	sourceText: string,
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	onProgress?: (p: BuildProgress) => void,
	token?: CancellationToken
): Promise<LayeredMemory> {
	const numLayers = Math.max(1, settings.numAbstractionLayers);
	const comprehensive = await buildComprehensiveSummary(sourceText, client, settings, onProgress, token);
	const upperLayers = await cascadeLayersUpward(comprehensive, numLayers, client, settings, onProgress, token);
	const layers = [...upperLayers, { index: numLayers, name: "Comprehensive Summary", text: comprehensive }];
	return { layers, original: sourceText, builtAt: Date.now() };
}

/**
 * Grows an existing layered memory with new raw text: builds a comprehensive
 * summary of just the new text, merges it with the existing Comprehensive
 * Summary (preferring new information if the two disagree, but keeping both
 * rather than silently dropping old context), then recascades every layer
 * above it from that merged text.
 */
export async function extendLayeredMemory(
	existing: LayeredMemory,
	newText: string,
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	onProgress?: (p: BuildProgress) => void,
	token?: CancellationToken
): Promise<LayeredMemory> {
	const numLayers = Math.max(1, settings.numAbstractionLayers);
	const existingComprehensive = existing.layers[existing.layers.length - 1]?.text ?? "";
	const newComprehensive = await buildComprehensiveSummary(newText, client, settings, onProgress, token);

	const combinedForMerge = `PREVIOUS:\n${existingComprehensive}\n\nNEW:\n${newComprehensive}`;
	throwIfCancelled(token);
	const mergedComprehensive =
		combinedForMerge.length <= DIRECT_SUMMARIZE_CHAR_CAP
			? await summarizeText(client, settings, combinedForMerge, MERGE_TWO_COMPREHENSIVE_PROMPT)
			: await buildComprehensiveSummary(combinedForMerge, client, settings, onProgress, token);

	const upperLayers = await cascadeLayersUpward(mergedComprehensive, numLayers, client, settings, onProgress, token);
	const layers = [...upperLayers, { index: numLayers, name: "Comprehensive Summary", text: mergedComprehensive }];

	return { layers, original: `${existing.original}\n\n${newText}`, builtAt: Date.now() };
}

export function overviewLayer(memory: LayeredMemory): MemoryLayer {
	return memory.layers[0];
}

export function comprehensiveLayer(memory: LayeredMemory): MemoryLayer {
	return memory.layers[memory.layers.length - 1];
}

/**
 * A single cheap LLM call to get a provisional 1-2 sentence overview of a
 * piece of text, used only to decide topic matching BEFORE committing to a
 * full build/extend (so that work isn't done twice when the content turns
 * out to belong to an existing topic).
 */
export async function quickOverview(client: OllamaClient, settings: OllamaOrchestratorSettings, text: string): Promise<string> {
	const capped = text.length > DIRECT_SUMMARIZE_CHAR_CAP * 2 ? text.slice(0, DIRECT_SUMMARIZE_CHAR_CAP * 2) : text;
	return summarizeText(
		client,
		settings,
		capped,
		"Summarize the following text in exactly 1-2 short sentences describing what it is about overall. No preamble, no bullet points, just the sentence(s)."
	);
}

/** A single cheap LLM call to produce a short (3-6 word) chat-session title from its first message. */
export async function generateShortTitle(client: OllamaClient, settings: OllamaOrchestratorSettings, firstMessage: string): Promise<string> {
	const capped = firstMessage.length > 600 ? firstMessage.slice(0, 600) : firstMessage;
	const prompt = `Give a short, plain 3-6 word title (no punctuation at the end, no quotes) for a conversation that starts with this message:\n\n"${capped}"\n\nRespond with ONLY the title.`;
	const raw = (await client.generate(settings.summaryModel, prompt, { temperature: 0.3 })).trim();
	const cleaned = raw.replace(/^["'\s]+|["'\s.]+$/g, "");
	return cleaned || (capped.length > 40 ? `${capped.slice(0, 40)}…` : capped) || "New chat";
}

/**
 * Distills what the user is ACTUALLY asking — resolving pronouns/context
 * from recent history, stripping conversational filler — into one crisp
 * sentence. Used to sharpen both retrieval (routing/frontier decisions) and
 * the final answer, so the model searches and answers precisely instead of
 * drifting broad on a loosely-phrased or context-dependent question.
 */
export async function extractQueryIntent(
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	query: string,
	recentHistory: { role: string; content: string }[] = [],
	sessionSummary?: string
): Promise<string> {
	const historyText = recentHistory
		.slice(-4)
		.map((m) => `${m.role}: ${m.content}`)
		.join("\n");
	const summaryText = sessionSummary ? `${sessionSummary}\n\n` : "";

	const prompt = `${summaryText}Recent conversation (may be empty):
${historyText || "(none)"}

Latest message: "${query}"

In ONE crisp sentence, state exactly what specific information or outcome the user is asking for right now — resolve any pronouns or "that"/"this" references using the recent conversation above, and strip away greetings or filler. Don't answer the question, just restate its precise intent.

Respond with ONLY that one sentence.`;

	const raw = (await client.generate(settings.summaryModel, prompt, { temperature: 0.1 })).trim();
	return raw || query;
}
