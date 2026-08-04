import { requestUrl } from "obsidian";

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

/** Extracts Ollama's own {"error": "..."} message from a response body when present. */
function extractOllamaError(bodyText: string): string | undefined {
	try {
		const parsed = JSON.parse(bodyText) as { error?: string };
		return parsed.error;
	} catch {
		return bodyText.trim() ? bodyText.trim().slice(0, 300) : undefined;
	}
}

export class OllamaClient {
	constructor(private baseUrl: string) {}

	setBaseUrl(url: string) {
		this.baseUrl = url;
	}

	private url(path: string): string {
		return this.baseUrl.replace(/\/+$/, "") + path;
	}

	/**
	 * POSTs to an Ollama endpoint and produces a clear, actionable error if
	 * anything goes wrong — naming the endpoint and model involved instead of
	 * an opaque "status 404"/"status 500". The two most common real-world
	 * causes of exactly those two codes are covered explicitly: the model
	 * hasn't been pulled (404), or the model doesn't support this kind of
	 * call at all — e.g. an embeddings-only model like nomic-embed-text can't
	 * be used for /api/generate or /api/chat, and vice versa (500).
	 */
	private async post(path: string, body: Record<string, unknown>, opDescription: string, model: string): Promise<any> {
		let res;
		try {
			res = await requestUrl({
				url: this.url(path),
				method: "POST",
				contentType: "application/json",
				body: JSON.stringify(body),
				throw: false,
			});
		} catch (err) {
			throw new Error(
				`Couldn't reach Ollama at "${this.baseUrl}" for ${opDescription} (model "${model}"): ${(err as Error).message}. Check the Ollama base URL in settings and that "ollama serve" is running.`
			);
		}

		if (res.status < 200 || res.status >= 300) {
			const detail = extractOllamaError(res.text ?? "");
			let guidance = "";
			if (res.status === 404) {
				guidance = ` Model "${model}" may not be pulled yet — try "ollama pull ${model}".`;
			} else if (res.status === 500) {
				guidance = ` This often means model "${model}" doesn't support ${opDescription} — for example, an embeddings-only model (like nomic-embed-text) can't be used to chat/generate, and a chat model can't be used for embeddings. Double-check your Chat/Summary model and Embedding model settings aren't pointing at the wrong kind of model.`;
			}
			throw new Error(`Ollama returned ${res.status} for ${opDescription} using model "${model}"${detail ? `: ${detail}` : ""}.${guidance}`);
		}

		return res.json;
	}

	/** Single-shot prompt completion (used heavily for summarization chunks). */
	async generate(model: string, prompt: string, options?: Record<string, unknown>): Promise<string> {
		const data = (await this.post("/api/generate", { model, prompt, stream: false, options }, "text generation", model)) as { response?: string };
		return (data.response ?? "").trim();
	}

	/** Multi-turn chat completion. */
	async chat(model: string, messages: ChatMessage[], options?: Record<string, unknown>): Promise<string> {
		const data = (await this.post("/api/chat", { model, messages, stream: false, options }, "chat", model)) as { message?: { content?: string } };
		return (data.message?.content ?? "").trim();
	}

	/** Embedding vector for a string, used for embedding-based memory routing. */
	async embed(model: string, input: string): Promise<number[]> {
		const data = (await this.post("/api/embeddings", { model, prompt: input }, "embeddings", model)) as { embedding?: number[] };
		return data.embedding ?? [];
	}

	async listModels(): Promise<string[]> {
		try {
			const res = await requestUrl({ url: this.url("/api/tags"), method: "GET", throw: false });
			if (res.status < 200 || res.status >= 300) return [];
			const data = res.json as { models?: { name: string }[] };
			return (data.models ?? []).map((m) => m.name);
		} catch {
			return [];
		}
	}
}

export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
	let dot = 0, magA = 0, magB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		magA += a[i] * a[i];
		magB += b[i] * b[i];
	}
	if (magA === 0 || magB === 0) return 0;
	return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
