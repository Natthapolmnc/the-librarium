import { OllamaClient } from "./ollamaClient";
import { OllamaOrchestratorSettings } from "./settings";
import { LayeredMemory, MemoryLayer } from "./summarizer";
import { CancellationToken, throwIfCancelled } from "./cancellation";

function extractJson<T>(raw: string): T | null {
	const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
	if (!match) return null;
	try {
		return JSON.parse(match[0]) as T;
	} catch {
		return null;
	}
}

export interface HierarchicalAnswerResult {
	text: string;
	layerUsed: string; // layer name, or "Original" if it fell all the way through
}

/**
 * Resolves a single memory's layer stack in ONE LLM call instead of walking
 * it layer by layer: the model is shown every layer at once (Overview
 * through Comprehensive Summary) and asked to pick the lowest-detail layer
 * that's sufficient to answer the query — using both the raw question and
 * its distilled intent, so a vaguely phrased question doesn't get matched
 * to a summary just because it sounds broadly related — or to say
 * `need_original` if none of the named layers are enough.
 *
 * This replaces the old sequential, top-down walk (one round trip per
 * layer, up to `numAbstractionLayers + 1` calls) with a single round trip
 * regardless of how many layers the memory has.
 */
export async function resolveFromLayers(
	memory: LayeredMemory,
	query: string,
	intent: string,
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	token?: CancellationToken
): Promise<HierarchicalAnswerResult> {
	if (memory.layers.length === 0) {
		return { text: memory.original, layerUsed: "Original" };
	}

	throwIfCancelled(token);

	const listing = memory.layers
		.map((layer) => `- layer index: ${layer.index}\n  name: "${layer.name}"\n  text: ${layer.text}`)
		.join("\n");

	const prompt = `Question: "${query}"
What the user specifically needs: ${intent}

Here are ALL the abstraction layers of a source, from least detailed (layer index 0, the Overview) to most detailed (layer index ${memory.layers.length - 1}, the Comprehensive Summary):
${listing}

Choose the LOWEST-numbered layer index that, on its own, is detailed enough to fully address what the user specifically needs. Only move to a higher (more detailed) layer index if the lower ones genuinely lack the needed detail. If even the most detailed layer above still isn't enough, respond with "need_original" instead — that pulls in the complete, unmodified source text.

Respond with ONLY JSON: {"choice": <layer index number>} or {"choice": "need_original"}.`;

	const raw = await client.generate(settings.summaryModel, prompt, { temperature: 0.1 });
	const parsed = extractJson<{ choice?: number | string }>(raw);

	const layer = selectLayer(memory.layers, parsed?.choice);
	if (layer) {
		return { text: layer.text, layerUsed: layer.name };
	}

	// "need_original", an unparseable/missing response, or an out-of-range
	// index all fall through to the raw Original — the safe default
	// whenever the single call didn't produce a clean, valid layer choice.
	return { text: memory.original, layerUsed: "Original" };
}

function selectLayer(layers: MemoryLayer[], choice: number | string | undefined): MemoryLayer | undefined {
	if (choice === undefined) return undefined;
	if (typeof choice === "number") {
		return layers.find((l) => l.index === choice);
	}
	if (choice === "need_original") return undefined;
	const n = Number(choice);
	return Number.isNaN(n) ? undefined : layers.find((l) => l.index === n);
}

export interface HierarchicalSource {
	key: string; // stable id for this source, e.g. "topic:<id>"
	label: string; // display name shown in context blocks
	memory: LayeredMemory;
}

export interface ResolvedSource {
	key: string;
	label: string;
	text: string;
	layerUsed: string;
}

interface FrontierItem {
	source: HierarchicalSource;
	layerIndex: number; // index into source.memory.layers, or -1 to mean "fell through to Original"
}

type FrontierVerdict = "irrelevant" | "sufficient" | "descend";

function frontierKey(item: FrontierItem): string {
	return `${item.source.key}::${item.layerIndex}`;
}

async function evaluateFrontier(
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	query: string,
	intent: string,
	frontier: FrontierItem[]
): Promise<Map<string, FrontierVerdict>> {
	const listing = frontier
		.map((item) => {
			const layer = item.source.memory.layers[item.layerIndex];
			return `- key: ${frontierKey(item)}\n  source: ${item.source.label}\n  layer: ${layer.name}\n  summary: ${layer.text}`;
		})
		.join("\n");

	const prompt = `You are searching several sources at once, each shown at its LEAST detailed available layer for this round.

Question: "${query}"
What the user specifically needs: ${intent}

Items:
${listing}

For EACH item, decide one of:
- "irrelevant" — this source has nothing to do with what the user specifically needs; skip it entirely.
- "sufficient" — this layer alone is detailed enough to address what the user specifically needs; keep it as-is.
- "descend" — this source seems relevant but this layer isn't detailed enough; fetch the next, more detailed layer of this SAME source.

Respond with ONLY a JSON array covering every item above: [{"key": "<key>", "verdict": "irrelevant"|"sufficient"|"descend"}, ...]`;

	const raw = await client.generate(settings.summaryModel, prompt, { temperature: 0.1 });
	const map = new Map<string, FrontierVerdict>();
	const arr = extractJson<{ key?: string; verdict?: string }[]>(raw);
	if (Array.isArray(arr)) {
		for (const entry of arr) {
			if (entry.key && (entry.verdict === "irrelevant" || entry.verdict === "sufficient" || entry.verdict === "descend")) {
				map.set(entry.key, entry.verdict);
			}
		}
	}
	return map;
}

/**
 * Searches multiple layered memories TOGETHER, one round per layer tier:
 * every source starts at layer 0 (Overview). A single batched LLM call
 * evaluates the whole current tier at once and decides, per source, whether
 * to discard it, accept its current (cheap) layer as sufficient, or descend
 * one layer for that source only — only sources still marked "descend"
 * continue into the next, more detailed (and more token-heavy) tier, all
 * the way down to the Comprehensive Summary and, as an absolute last
 * resort, the raw Original text.
 *
 * This is what makes "search the least-detailed layer first, then
 * propagate down only where needed" a property of the whole memory search
 * rather than of one source's stack in isolation: total LLM calls scale
 * with layer depth (bounded by `numAbstractionLayers`), not with how many
 * sources were being searched, and irrelevant sources never cost more than
 * their Overview.
 */
export async function resolveAcrossSources(
	sources: HierarchicalSource[],
	query: string,
	intent: string,
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	maxResults: number,
	token?: CancellationToken
): Promise<ResolvedSource[]> {
	let frontier: FrontierItem[] = sources
		.filter((s) => s.memory.layers.length > 0)
		.map((s) => ({ source: s, layerIndex: 0 }));

	const results: ResolvedSource[] = [];

	while (frontier.length > 0) {
		throwIfCancelled(token);
		const verdicts = await evaluateFrontier(client, settings, query, intent, frontier);
		const nextFrontier: FrontierItem[] = [];

		for (const item of frontier) {
			const layer = item.source.memory.layers[item.layerIndex];
			const atDeepestLayer = item.layerIndex === item.source.memory.layers.length - 1;
			const verdict = verdicts.get(frontierKey(item)) ?? "descend"; // missing from the response defaults to descend, not silently dropped

			if (verdict === "irrelevant") continue;

			if (verdict === "sufficient") {
				results.push({ key: item.source.key, label: item.source.label, text: layer.text, layerUsed: layer.name });
				continue;
			}

			// verdict === "descend"
			if (atDeepestLayer) {
				// Nothing more detailed than the Comprehensive Summary except
				// the raw Original — worth it only because this source was
				// explicitly judged relevant-but-insufficient, not just routed.
				results.push({ key: item.source.key, label: item.source.label, text: item.source.memory.original, layerUsed: "Original" });
				continue;
			}

			nextFrontier.push({ source: item.source, layerIndex: item.layerIndex + 1 });
		}

		frontier = nextFrontier;
		if (results.length >= maxResults) break;
	}

	// Merge multiple hits from the same source into one block, then cap.
	const merged = new Map<string, ResolvedSource>();
	for (const r of results) {
		const existing = merged.get(r.key);
		if (existing) {
			existing.text = `${existing.text}\n${r.text}`;
		} else {
			merged.set(r.key, { ...r });
		}
	}

	return Array.from(merged.values()).slice(0, maxResults);
}
