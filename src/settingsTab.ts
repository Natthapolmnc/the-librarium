import { App, PluginSettingTab, Setting } from "obsidian";
import type OllamaOrchestratorPlugin from "./main";

/**
 * Uses the imperative display() API rather than the declarative
 * getSettingDefinitions() API introduced in Obsidian 1.13 — this plugin's
 * minAppVersion (1.7.2) is below that, and getSettingDefinitions() isn't
 * available to fall back on there. Settings won't show up in Obsidian's
 * settings search on 1.13+ until minAppVersion is raised and this is
 * migrated to the declarative API.
 */
export class OllamaOrchestratorSettingTab extends PluginSettingTab {
	plugin: OllamaOrchestratorPlugin;

	constructor(app: App, plugin: OllamaOrchestratorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		const s = this.plugin.settings;

		new Setting(containerEl).setName("Connection").setHeading();

		new Setting(containerEl)
			.setName("Ollama base URL")
			.addText((t) => t.setValue(s.ollamaBaseUrl).onChange(async (v) => { s.ollamaBaseUrl = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Chat model")
			.addText((t) => t.setValue(s.chatModel).onChange(async (v) => { s.chatModel = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Summary model")
			.setDesc("Used for chunk summarization, routing, and update decisions. Can be a smaller/faster model.")
			.addText((t) => t.setValue(s.summaryModel).onChange(async (v) => { s.summaryModel = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Embedding model")
			.setDesc("Used when routing method is 'embedding' or 'hybrid'. Must be a different, embeddings-capable model (e.g. nomic-embed-text) — an embeddings-only model can't also be used as the Chat or Summary model, and vice versa; mixing them up is the most common cause of 404/500 errors from Ollama.")
			.addText((t) => t.setValue(s.embeddingModel).onChange(async (v) => { s.embeddingModel = v; await this.plugin.saveSettings(); }));

		const testRow = new Setting(containerEl)
			.setName("Test connection")
			.setDesc("Checks that Ollama is reachable, that all three configured models are actually pulled, and flags the chat/embedding model mix-up that causes 404 or 500 errors.");
		const resultEl = containerEl.createDiv({ cls: "ooc-settings-test-result" });
		testRow.addButton((btn) => btn.setButtonText("Test connection").onClick(async () => {
			btn.setDisabled(true);
			resultEl.setText("Testing...");
			const lines: string[] = [];
			let hasWarning = false;

			if (s.embeddingModel === s.chatModel || s.embeddingModel === s.summaryModel) {
				lines.push("⚠ Embedding model is set to the same model as Chat/Summary — embeddings-only models can't chat/generate and vice versa. This alone is enough to cause 404/500 errors, especially with hybrid routing (which uses both).");
				hasWarning = true;
			}

			const pulled = await this.plugin.client.listModels();
			if (pulled.length === 0) {
				lines.push(`⚠ Couldn't reach Ollama at "${s.ollamaBaseUrl}", or it reported no models — check the base URL and that "ollama serve" is running.`);
				hasWarning = true;
			} else {
				for (const [label, model] of [["Chat", s.chatModel], ["Summary", s.summaryModel], ["Embedding", s.embeddingModel]] as const) {
					const found = pulled.some((m) => m === model || m.startsWith(`${model}:`));
					lines.push(found ? `✓ ${label} model "${model}" is pulled.` : `⚠ ${label} model "${model}" was NOT found — try "ollama pull ${model}".`);
					if (!found) hasWarning = true;
				}
			}

			if (!hasWarning) lines.push("All good.");
			resultEl.setText(lines.join("\n"));
			btn.setDisabled(false);
		}));

		new Setting(containerEl).setName("Memory retrieval").setHeading();

		new Setting(containerEl)
			.setName("Memories folder")
			.setDesc("Vault folder where confirmed, permanent memory-topic notes live. Everything the plugin creates lives under here.")
			.addText((t) => t.setValue(s.memoriesFolder).onChange(async (v) => { s.memoriesFolder = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Temp-memory folder")
			.setDesc("Vault folder for unconfirmed candidate memory notes. These are always transient: deleted the moment they're confirmed or discarded, and wiped whenever their chat session's temp-memory is cleared.")
			.addText((t) => t.setValue(s.tempMemoryFolder).onChange(async (v) => { s.tempMemoryFolder = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Note-memory folder")
			.setDesc("Vault folder for per-note hierarchical mirrors, used when 'Include current note' pulls in the active note instead of dumping its full text.")
			.addText((t) => t.setValue(s.noteMemoryFolder).onChange(async (v) => { s.noteMemoryFolder = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Offer to build note memory")
			.setDesc("When a long note referenced with 'Include note' doesn't have a memory mirror yet, ask (in chat) whether to build one before answering. If off, always falls back to a capped raw read instead of asking.")
			.addToggle((tg) => tg.setValue(s.autoInitNoteMemory).onChange(async (v) => { s.autoInitNoteMemory = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Max memories per query")
			.setDesc("Upper bound on how many memory topics get pulled into context for a single chat query.")
			.addSlider((sl) => sl.setLimits(1, 15, 1).setValue(s.maxMemoriesPerQuery).setDynamicTooltip()
				.onChange(async (v) => { s.maxMemoriesPerQuery = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Routing method")
			.addDropdown((dd) => dd
				.addOption("llm", "LLM classification")
				.addOption("embedding", "Embedding similarity")
				.addOption("hybrid", "Hybrid (embedding shortlist + LLM re-rank)")
				.setValue(s.routingMethod)
				.onChange(async (v) => { s.routingMethod = v as typeof s.routingMethod; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Similarity threshold")
			.setDesc("Minimum cosine similarity for embedding-based routing (0-1).")
			.addSlider((sl) => sl.setLimits(0, 1, 0.05).setValue(s.similarityThreshold).setDynamicTooltip()
				.onChange(async (v) => { s.similarityThreshold = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Suggest memory updates")
			.setDesc("After each chat turn, stage any new durable fact as a pending temp-memory entry for you to confirm or discard in the chat panel — nothing is written to permanent memory automatically.")
			.addToggle((tg) => tg.setValue(s.suggestMemoryUpdates).onChange(async (v) => { s.suggestMemoryUpdates = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Ask for clarification")
			.setDesc("If a question depends on personal context that memory and temp-memory don't sufficiently cover, ask you for more detail instead of guessing.")
			.addToggle((tg) => tg.setValue(s.enableClarification).onChange(async (v) => { s.enableClarification = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Extract query intent")
			.setDesc("Before routing/searching and answering, distill exactly what you're asking for (resolving 'this'/'that' from recent conversation). Sharpens both retrieval and the final answer; costs one extra small-model call per query.")
			.addToggle((tg) => tg.setValue(s.enableIntentExtraction).onChange(async (v) => { s.enableIntentExtraction = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl).setName("Chat history digest").setHeading();
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Instead of re-sending the entire growing transcript on every turn, the plugin keeps a compact rolling summary of the conversation and the user's overall intent, updated one turn at a time. Older turns are represented by that summary; only the most recent turns are still sent verbatim.",
		});

		new Setting(containerEl)
			.setName("Track chat summary")
			.setDesc("Maintain a rolling summary + inferred user intent per chat session, and use it (alongside the capped recent messages below) so the model stays aware of earlier turns without needing the full transcript. Costs one extra small-model call per turn.")
			.addToggle((tg) => tg.setValue(s.trackChatSummary).onChange(async (v) => { s.trackChatSummary = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Recent raw turns to include verbatim")
			.setDesc("How many of the most recent messages (not turn-pairs) are sent to the model word-for-word. Older messages beyond this are dropped from the raw transcript and relied on only via the rolling summary above. Ignored (full history sent) if 'Track chat summary' is off.")
			.addSlider((sl) => sl.setLimits(2, 40, 2).setValue(s.recentRawTurns).setDynamicTooltip()
				.onChange(async (v) => { s.recentRawTurns = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl).setName("Memory layers (progressive abstraction)").setHeading();
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Every memory is stored as a fixed stack of named layers instead of a variable-depth tree: Overview (top, least detail) down through as many compression passes as configured below, ending at the Comprehensive Summary (most detail, built from the source) — with the raw Original always available as a last resort. Search always starts at the Overview and only loads a deeper layer when the one above wasn't enough.",
		});

		new Setting(containerEl)
			.setName("Abstraction layers")
			.setDesc("How many compression passes sit above the Comprehensive Summary. 3 (default) gives Overview → High-Level Concepts → Detailed Concepts → Comprehensive Summary. Lower is cheaper to build and search; higher gives finer-grained detail control for long documents.")
			.addSlider((sl) => sl.setLimits(1, 6, 1).setValue(s.numAbstractionLayers).setDynamicTooltip()
				.onChange(async (v) => { s.numAbstractionLayers = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl).setName("Merge passes (used to build the Comprehensive Summary)").setHeading();
		containerEl.createEl("p", {
			cls: "setting-item-description",
			text: "Splitting raw source text into chunks is now handled entirely by the LLM itself and has no size/overlap settings here. The settings below only govern the separate step of regrouping and merging the already-summarized chunks back together into one Comprehensive Summary.",
		});

		new Setting(containerEl)
			.setName("Max chunk-merge passes")
			.setDesc("Safety cap on how many regroup-and-merge passes are allowed while collapsing many chunks down into one Comprehensive Summary. Only matters for documents needing more chunks than fit in one merge round.")
			.addText((t) => t.setValue(String(s.maxChunkMergePasses)).onChange(async (v) => { s.maxChunkMergePasses = Number(v) || s.maxChunkMergePasses; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Merge group max characters")
			.setDesc("Char budget for grouping already-summarized chunks together during a merge pass. Should generally be large enough that several summarized chunks can combine into one group at a time — too small and merge passes barely shrink the part count.")
			.addText((t) => t.setValue(String(s.mergeGroupMaxChars)).onChange(async (v) => { s.mergeGroupMaxChars = Number(v) || s.mergeGroupMaxChars; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Merge overlap units")
			.setDesc("How many prior-level units are repeated across merge-group boundaries for continuity. Keep this small relative to the group size above — too large an overlap stalls merge progress to roughly one unit advanced per pass.")
			.addText((t) => t.setValue(String(s.mergeOverlapUnits)).onChange(async (v) => { s.mergeOverlapUnits = Math.max(0, Number(v) || 0); await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Concurrent summaries")
			.setDesc("How many chunk/group summaries to run at once per level instead of one at a time. Higher is faster but sends more simultaneous requests to Ollama.")
			.addSlider((sl) => sl.setLimits(1, 8, 1).setValue(s.maxConcurrentSummaries).setDynamicTooltip()
				.onChange(async (v) => { s.maxConcurrentSummaries = v; await this.plugin.saveSettings(); }));

		new Setting(containerEl)
			.setName("Debug logging")
			.addToggle((tg) => tg.setValue(s.debugLogging).onChange(async (v) => { s.debugLogging = v; await this.plugin.saveSettings(); }));
	}
}
