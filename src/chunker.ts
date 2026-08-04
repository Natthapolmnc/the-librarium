import { OllamaClient } from "./ollamaClient";
import { OllamaOrchestratorSettings } from "./settings";
import { CancellationToken, throwIfCancelled } from "./cancellation";

/**
 * LLM-driven chunking.
 *
 * The previous version of this file split raw text mechanically on
 * characters/sentences (with configurable ceilings and overlap). That's
 * gone: splitting is now left entirely up to the LLM, which is asked to
 * mark where it would naturally break the text (topic shifts, scene/section
 * boundaries) rather than us counting characters or sentences. There are
 * deliberately no user-facing size/overlap settings for this anymore — it's
 * a placeholder for a chunking approach that's still very much expected to
 * change.
 */

export interface Chunk {
	index: number;
	text: string;
}

const CHUNK_MARKER = "<<<CHUNK_BREAK>>>";

// Purely a technical ceiling on how much raw text goes into a single
// "insert chunk markers" call, so we don't blow past the model's context
// window. This is NOT part of the chunking algorithm itself (it doesn't
// decide where chunks fall — the model does) and isn't exposed as a
// setting; it's just how large a pre-split group can be before it's handed
// to the model. Oversized text is pre-split on blank lines (the simplest
// content-agnostic split available) purely so each piece fits.
const MAX_LLM_CHUNK_INPUT_CHARS = 12000;

const LLM_CHUNK_PROMPT =
	`Split the text below into topically coherent chunks — each chunk should cover one continuous scene, section, or topic, and shouldn't cut off mid-thought. Insert the exact marker "${CHUNK_MARKER}" on its own line at every point you'd split, and nowhere else. Reproduce the ENTIRE original text exactly as given — do not alter, summarize, omit, or add to it in any way; only insert marker lines. No preamble, no commentary — output only the original text with the markers inserted.`;

/**
 * Naive, content-agnostic split used only to keep a single LLM chunking
 * call within a safe input size for oversized documents — not a semantic
 * chunking decision, just a technical pre-split so chunkTextWithLLM() can
 * be applied piece by piece.
 */
function splitForInputBudget(text: string, maxChars: number): string[] {
	if (text.length <= maxChars) return [text];

	const paragraphs = text.split(/\n{2,}/);
	const groups: string[] = [];
	let current = "";

	for (const p of paragraphs) {
		const candidate = current ? `${current}\n\n${p}` : p;
		if (candidate.length > maxChars && current) {
			groups.push(current);
			current = p;
		} else {
			current = candidate;
		}
	}
	if (current) groups.push(current);

	// A single paragraph longer than the whole budget (no blank lines to
	// split on at all) — fall back to a hard character cut so we still
	// make forward progress instead of sending one giant call.
	return groups.flatMap((g) => {
		if (g.length <= maxChars) return [g];
		const pieces: string[] = [];
		for (let i = 0; i < g.length; i += maxChars) pieces.push(g.slice(i, i + maxChars));
		return pieces;
	});
}

/**
 * Asks the model to mark natural break points in one piece of text (already
 * within the input budget) and splits on those markers. If the model
 * ignores the instruction, mangles the text, or drops a large fraction of
 * it, this falls back to treating the whole piece as a single chunk rather
 * than silently losing content.
 */
async function markChunksWithLLM(
	text: string,
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	token?: CancellationToken
): Promise<string[]> {
	const prompt = `${LLM_CHUNK_PROMPT}\n\n---\n${text}\n---`;
	const raw = (await client.generate(settings.summaryModel, prompt, { temperature: 0 })).trim();
	throwIfCancelled(token);

	const parts = raw
		.split(CHUNK_MARKER)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);

	const reproducedLength = parts.reduce((sum, p) => sum + p.length, 0);
	const lostTooMuch = reproducedLength < text.length * 0.5;

	if (parts.length <= 1 || lostTooMuch) {
		return [text];
	}
	return parts;
}

/**
 * Splits raw source text into chunks purely via the LLM: pre-splits only as
 * far as needed to respect the model's context window (see
 * splitForInputBudget), asks the model to mark break points within each
 * piece, and flattens the result into a single ordered chunk list.
 */
export async function chunkTextWithLLM(
	text: string,
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	token?: CancellationToken
): Promise<Chunk[]> {
	const inputGroups = splitForInputBudget(text, MAX_LLM_CHUNK_INPUT_CHARS);

	const allParts: string[] = [];
	for (const group of inputGroups) {
		throwIfCancelled(token);
		const parts = await markChunksWithLLM(group, client, settings, token);
		allParts.push(...parts);
	}

	return allParts.map((t, i) => ({ index: i, text: t }));
}

export interface UnitChunk {
	index: number;
	sourceIndices: number[]; // indices into the input `units` array that compose this chunk
	text: string;
}

export interface UnitChunkParams {
	maxChars: number;
	maxUnits: number;
	overlapUnits: number;
}

/**
 * Groups whole pre-formed text units (e.g. prior-level summaries) together
 * by a character budget, with unit-level overlap across group boundaries.
 * Used to batch already-summarized parts back together during merge passes
 * — a distinct, still-mechanical concern from chunkTextWithLLM() above
 * (which splits raw source text), so it keeps its char-budget/overlap
 * grouping rather than going through the LLM itself.
 */
export function chunkUnits(units: string[], params: UnitChunkParams): UnitChunk[] {
	const { maxChars, maxUnits, overlapUnits } = params;
	const chunks: UnitChunk[] = [];

	let i = 0;
	while (i < units.length) {
		const current: number[] = [];
		let charCount = 0;
		let j = i;

		while (j < units.length) {
			const u = units[j];
			const addedLen = u.length + 2; // separator allowance

			if (charCount + addedLen > maxChars && current.length > 0) break;
			if (current.length >= maxUnits) break;

			current.push(j);
			charCount += addedLen;
			j++;

			// Don't double-increment `j` here, or nextStart overshoots and a
			// unit gets silently dropped whenever overlapUnits is small.
			if (charCount > maxChars) break;
		}

		const text = current.map((idx) => units[idx]).join("\n\n");
		chunks.push({ index: chunks.length, sourceIndices: [...current], text });

		const nextStart = Math.max(i + 1, j - overlapUnits);
		if (nextStart <= i) break;
		i = nextStart;
	}

	return chunks;
}
