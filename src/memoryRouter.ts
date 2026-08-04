import { OllamaClient, cosineSimilarity } from "./ollamaClient";
import { OllamaOrchestratorSettings } from "./settings";
import { MemoryTopic } from "./memoryStore";

export interface RoutedTopic {
	topic: MemoryTopic;
	score: number;
	reason?: string;
}

function extractJsonArray(raw: string): string[] | null {
	const match = raw.match(/\[[\s\S]*\]/);
	if (!match) return null;
	try {
		const arr = JSON.parse(match[0]);
		return Array.isArray(arr) ? arr.map(String) : null;
	} catch {
		return null;
	}
}

/** LLM-based routing: show the model every topic overview and ask it to pick relevant ids. */
async function routeByLlm(
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	query: string,
	candidates: MemoryTopic[]
): Promise<RoutedTopic[]> {
	if (candidates.length === 0) return [];

	const listing = candidates.map((t) => `- id: ${t.id}\n  name: ${t.name}\n  overview: ${t.overview}`).join("\n");
	const prompt = `A user asked: "${query}"

Here are memory topics available, each with a short overview:
${listing}

List the ids of the topics (at most ${settings.maxMemoriesPerQuery}) that are actually relevant to answering or informing a response to this question. Order them from most to least relevant. If none are relevant, return an empty array.

Respond with ONLY a JSON array of id strings, nothing else.`;

	const raw = await client.generate(settings.summaryModel, prompt, { temperature: 0.1 });
	const ids = extractJsonArray(raw) ?? [];

	const byId = new Map(candidates.map((t) => [t.id, t]));
	const result: RoutedTopic[] = [];
	for (const id of ids) {
		const t = byId.get(id);
		if (t) result.push({ topic: t, score: 1 });
	}
	return result.slice(0, settings.maxMemoriesPerQuery);
}

/** Embedding-based routing: cosine similarity between the query and each topic overview. */
async function routeByEmbedding(
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	query: string,
	candidates: MemoryTopic[],
	overviewEmbeddings: Map<string, number[]>
): Promise<RoutedTopic[]> {
	if (candidates.length === 0) return [];
	const queryVec = await client.embed(settings.embeddingModel, query);

	const scored: RoutedTopic[] = [];
	for (const t of candidates) {
		let vec = overviewEmbeddings.get(t.id);
		if (!vec) {
			vec = await client.embed(settings.embeddingModel, t.overview);
			overviewEmbeddings.set(t.id, vec);
		}
		const score = cosineSimilarity(queryVec, vec);
		if (score >= settings.similarityThreshold) {
			scored.push({ topic: t, score });
		}
	}

	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, settings.maxMemoriesPerQuery);
}

/**
 * Selects which memory topics (max settings.maxMemoriesPerQuery) are relevant
 * to a given chat query, using the configured routing method:
 *  - "embedding": fast, scales to many topics, no LLM round trip
 *  - "llm": most semantically flexible, costs one generation call
 *  - "hybrid": embeddings shortlist candidates (2x the cap), then the LLM
 *    re-ranks/filters that shortlist — good balance once topic count grows.
 */
export async function routeMemories(
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	query: string,
	allTopics: MemoryTopic[],
	overviewEmbeddings: Map<string, number[]>
): Promise<RoutedTopic[]> {
	if (allTopics.length === 0) return [];

	if (settings.routingMethod === "embedding") {
		return routeByEmbedding(client, settings, query, allTopics, overviewEmbeddings);
	}

	if (settings.routingMethod === "llm") {
		return routeByLlm(client, settings, query, allTopics);
	}

	// hybrid
	const shortlistSize = Math.max(settings.maxMemoriesPerQuery * 2, settings.maxMemoriesPerQuery + 2);
	const shortlisted = await routeByEmbedding(
		client,
		{ ...settings, maxMemoriesPerQuery: shortlistSize, similarityThreshold: 0 },
		query,
		allTopics,
		overviewEmbeddings
	);
	if (shortlisted.length === 0) return [];
	return routeByLlm(client, settings, query, shortlisted.map((s) => s.topic));
}

function extractJsonObj<T>(raw: string): T | null {
	const match = raw.match(/\{[\s\S]*\}/);
	if (!match) return null;
	try {
		return JSON.parse(match[0]) as T;
	} catch {
		return null;
	}
}

/**
 * Decides whether a new piece of content (a file being ingested, an
 * explicit "remember this", an auto-detected fact) belongs under an
 * existing topic, or should become its own new topic.
 *
 * This used to ask the LLM to freely type back an exact topic id from a
 * list — small local models are unreliable at that, so a valid match would
 * silently come back as "no match" and fragment memory into duplicate
 * topics instead of actually extending the right one. Embedding similarity
 * is used as the primary, deterministic signal instead:
 *  - a strong match (>= similarityThreshold) is taken directly, no LLM call;
 *  - a borderline match asks the LLM to confirm against a short list, but
 *    the id it returns is always validated against the real candidates —
 *    an invalid/hallucinated id is treated as "no match" rather than
 *    silently misfiling content under the wrong topic;
 *  - nothing close enough means it's genuinely a new topic.
 */
export async function findBestMatchingTopic(
	client: OllamaClient,
	settings: OllamaOrchestratorSettings,
	candidateOverview: string,
	candidateName: string,
	allTopics: MemoryTopic[],
	overviewEmbeddings: Map<string, number[]>
): Promise<MemoryTopic | undefined> {
	if (allTopics.length === 0) return undefined;

	const queryVec = await client.embed(settings.embeddingModel, candidateOverview);
	const scored: { topic: MemoryTopic; score: number }[] = [];
	for (const t of allTopics) {
		let vec = overviewEmbeddings.get(t.id);
		if (!vec) {
			vec = await client.embed(settings.embeddingModel, t.overview);
			overviewEmbeddings.set(t.id, vec);
		}
		scored.push({ topic: t, score: cosineSimilarity(queryVec, vec) });
	}
	scored.sort((a, b) => b.score - a.score);

	const best = scored[0];
	if (!best) return undefined;
	if (best.score >= settings.similarityThreshold) return best.topic;

	// Borderline band: close enough to be worth an LLM opinion, but not
	// confident enough to auto-merge.
	const borderlineFloor = Math.max(0, settings.similarityThreshold - 0.15);
	const borderline = scored.filter((s) => s.score >= borderlineFloor).slice(0, 5);
	if (borderline.length === 0) return undefined;

	const listing = borderline.map((s) => `- id: ${s.topic.id}\n  name: ${s.topic.name}\n  overview: ${s.topic.overview}`).join("\n");
	const prompt = `New content overview: "${candidateOverview}" (candidate name: "${candidateName}")

Possibly-related existing topics:
${listing}

Does the new content belong under one of these existing topics (same subject), or is it distinct enough to be its own topic?
Respond with ONLY JSON: {"matchId": "<one of the ids above, or null>"}`;

	const raw = await client.generate(settings.summaryModel, prompt, { temperature: 0.1 });
	const parsed = extractJsonObj<{ matchId: string | null }>(raw);
	if (!parsed?.matchId) return undefined;

	// Validate: only accept an id that was actually offered, never trust it blindly.
	return borderline.find((s) => s.topic.id === parsed.matchId)?.topic;
}
