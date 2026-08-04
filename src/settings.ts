export type RoutingMethod = "llm" | "embedding" | "hybrid";

export interface OllamaOrchestratorSettings {
	// --- Connection ---
	ollamaBaseUrl: string;
	chatModel: string;
	summaryModel: string; // can be a smaller/faster model than chatModel
	embeddingModel: string;

	// --- Memory store ---
	memoriesFolder: string; // vault-relative folder where confirmed topic notes live (default: "librarium")
	tempMemoryFolder: string; // vault-relative folder for unconfirmed pending memory candidates
	noteMemoryFolder: string; // vault-relative folder for per-note hierarchical mirrors (see noteMemoryStore.ts)
	autoInitNoteMemory: boolean; // offer to build a note's hierarchical mirror (via a chat prompt) the first time a long, not-yet-mirrored note is referenced with "Include note" on
	maxMemoriesPerQuery: number; // adjustable cap on topics pulled into context
	routingMethod: RoutingMethod;
	suggestMemoryUpdates: boolean; // stage a candidate update in temp-memory for the user to confirm/discard in chat
	enableClarification: boolean; // let the orchestrator ask a clarifying question instead of guessing when memory context is insufficient
	similarityThreshold: number; // 0-1, used when routingMethod is "embedding" or "hybrid"

	// --- Merge passes (collapsing chunk-level summaries into one Comprehensive Summary layer) ---
	// Splitting the raw source text itself is now done purely by the LLM
	// (see chunker.ts) and has no size/overlap settings of its own. These
	// remain because they govern a separate step: regrouping and merging
	// the already-summarized parts back together.
	maxChunkMergePasses: number; // safety cap on how many regroup-and-merge passes are allowed while collapsing many chunks into one Comprehensive Summary
	maxConcurrentSummaries: number; // how many chunk/group summaries to run at once, instead of one at a time
	mergeGroupMaxChars: number; // char budget for grouping already-summarized chunks together during a merge pass
	mergeOverlapUnits: number; // whole prior-level units repeated across merge-group boundaries, so context isn't lost at merge-group edges

	// --- Progressive-abstraction memory layers ---
	// Each memory is stored as a fixed, named stack of layers instead of a
	// variable-depth tree: Overview (top, least detail) through Comprehensive
	// Summary (bottom, most detail, built directly from the source chunks),
	// with the raw Original text always available as the last resort. This
	// count is how many compression passes sit ABOVE the Comprehensive
	// Summary — e.g. 3 gives Overview -> High-Level Concepts -> Detailed
	// Concepts -> Comprehensive Summary -> Original.
	numAbstractionLayers: number;

	// --- Query understanding ---
	enableIntentExtraction: boolean; // distill what the user is actually asking before routing/searching/answering, instead of working from the raw message alone

	// --- Chat history digest ---
	trackChatSummary: boolean; // keep a rolling summary + inferred user-intent per chat session, updated one turn at a time
	recentRawTurns: number; // how many most-recent messages (not turn-pairs) to send verbatim to the chat model; older turns are represented only via the rolling summary once one exists

	// --- Misc ---
	debugLogging: boolean;
}

export const DEFAULT_SETTINGS: OllamaOrchestratorSettings = {
	ollamaBaseUrl: "http://localhost:11434",
	chatModel: "gemma4:e4b",
	summaryModel: "gemma4:e4b",
	embeddingModel: "nomic-embed-text",

	memoriesFolder: "librarium",
	tempMemoryFolder: "librarium/temp-memory",
	noteMemoryFolder: "librarium/notes",
	autoInitNoteMemory: true,
	maxMemoriesPerQuery: 3,
	routingMethod: "hybrid",
	suggestMemoryUpdates: true,
	enableClarification: true,
	similarityThreshold: 0.55,

	maxChunkMergePasses: 4,
	maxConcurrentSummaries: 4,
	mergeGroupMaxChars: 20000,
	mergeOverlapUnits: 1,

	numAbstractionLayers: 3,

	enableIntentExtraction: true,

	trackChatSummary: true,
	recentRawTurns: 12,

	debugLogging: false,
};
