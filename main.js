/* Ollama Orchestrator - built 2026-08-04T03:33:08.959Z */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => OllamaOrchestratorPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian9 = require("obsidian");

// src/settings.ts
var DEFAULT_SETTINGS = {
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
  mergeGroupMaxChars: 2e4,
  mergeOverlapUnits: 1,
  numAbstractionLayers: 3,
  enableIntentExtraction: true,
  trackChatSummary: true,
  recentRawTurns: 12,
  debugLogging: false
};

// src/settingsTab.ts
var import_obsidian = require("obsidian");
var OllamaOrchestratorSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    containerEl.createEl("h2", { text: "Connection" });
    new import_obsidian.Setting(containerEl).setName("Ollama base URL").addText((t) => t.setValue(s.ollamaBaseUrl).onChange(async (v) => {
      s.ollamaBaseUrl = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Chat model").addText((t) => t.setValue(s.chatModel).onChange(async (v) => {
      s.chatModel = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Summary model").setDesc("Used for chunk summarization, routing, and update decisions. Can be a smaller/faster model.").addText((t) => t.setValue(s.summaryModel).onChange(async (v) => {
      s.summaryModel = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Embedding model").setDesc("Used when routing method is 'embedding' or 'hybrid'. Must be a different, embeddings-capable model (e.g. nomic-embed-text) \u2014 an embeddings-only model can't also be used as the Chat or Summary model, and vice versa; mixing them up is the most common cause of 404/500 errors from Ollama.").addText((t) => t.setValue(s.embeddingModel).onChange(async (v) => {
      s.embeddingModel = v;
      await this.plugin.saveSettings();
    }));
    const testRow = new import_obsidian.Setting(containerEl).setName("Test connection").setDesc("Checks that Ollama is reachable, that all three configured models are actually pulled, and flags the chat/embedding model mix-up that causes 404 or 500 errors.");
    const resultEl = containerEl.createDiv({ cls: "ooc-settings-test-result" });
    testRow.addButton((btn) => btn.setButtonText("Test connection").onClick(async () => {
      btn.setDisabled(true);
      resultEl.setText("Testing...");
      const lines = [];
      let hasWarning = false;
      if (s.embeddingModel === s.chatModel || s.embeddingModel === s.summaryModel) {
        lines.push("\u26A0 Embedding model is set to the same model as Chat/Summary \u2014 embeddings-only models can't chat/generate and vice versa. This alone is enough to cause 404/500 errors, especially with hybrid routing (which uses both).");
        hasWarning = true;
      }
      const pulled = await this.plugin.client.listModels();
      if (pulled.length === 0) {
        lines.push(`\u26A0 Couldn't reach Ollama at "${s.ollamaBaseUrl}", or it reported no models \u2014 check the base URL and that "ollama serve" is running.`);
        hasWarning = true;
      } else {
        for (const [label, model] of [["Chat", s.chatModel], ["Summary", s.summaryModel], ["Embedding", s.embeddingModel]]) {
          const found = pulled.some((m) => m === model || m.startsWith(`${model}:`));
          lines.push(found ? `\u2713 ${label} model "${model}" is pulled.` : `\u26A0 ${label} model "${model}" was NOT found \u2014 try "ollama pull ${model}".`);
          if (!found)
            hasWarning = true;
        }
      }
      if (!hasWarning)
        lines.push("All good.");
      resultEl.setText(lines.join("\n"));
      btn.setDisabled(false);
    }));
    containerEl.createEl("h2", { text: "Memory retrieval" });
    new import_obsidian.Setting(containerEl).setName("Memories folder").setDesc("Vault folder where confirmed, permanent memory-topic notes live. Everything the plugin creates lives under here.").addText((t) => t.setValue(s.memoriesFolder).onChange(async (v) => {
      s.memoriesFolder = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Temp-memory folder").setDesc("Vault folder for unconfirmed candidate memory notes. These are always transient: deleted the moment they're confirmed or discarded, and wiped whenever their chat session's temp-memory is cleared.").addText((t) => t.setValue(s.tempMemoryFolder).onChange(async (v) => {
      s.tempMemoryFolder = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Note-memory folder").setDesc("Vault folder for per-note hierarchical mirrors, used when 'Include current note' pulls in the active note instead of dumping its full text.").addText((t) => t.setValue(s.noteMemoryFolder).onChange(async (v) => {
      s.noteMemoryFolder = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Offer to build note memory").setDesc("When a long note referenced with 'Include note' doesn't have a memory mirror yet, ask (in chat) whether to build one before answering. If off, always falls back to a capped raw read instead of asking.").addToggle((tg) => tg.setValue(s.autoInitNoteMemory).onChange(async (v) => {
      s.autoInitNoteMemory = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Max memories per query").setDesc("Upper bound on how many memory topics get pulled into context for a single chat query.").addSlider((sl) => sl.setLimits(1, 15, 1).setValue(s.maxMemoriesPerQuery).setDynamicTooltip().onChange(async (v) => {
      s.maxMemoriesPerQuery = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Routing method").addDropdown((dd) => dd.addOption("llm", "LLM classification").addOption("embedding", "Embedding similarity").addOption("hybrid", "Hybrid (embedding shortlist + LLM re-rank)").setValue(s.routingMethod).onChange(async (v) => {
      s.routingMethod = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Similarity threshold").setDesc("Minimum cosine similarity for embedding-based routing (0-1).").addSlider((sl) => sl.setLimits(0, 1, 0.05).setValue(s.similarityThreshold).setDynamicTooltip().onChange(async (v) => {
      s.similarityThreshold = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Suggest memory updates").setDesc("After each chat turn, stage any new durable fact as a pending temp-memory entry for you to confirm or discard in the chat panel \u2014 nothing is written to permanent memory automatically.").addToggle((tg) => tg.setValue(s.suggestMemoryUpdates).onChange(async (v) => {
      s.suggestMemoryUpdates = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Ask for clarification").setDesc("If a question depends on personal context that memory and temp-memory don't sufficiently cover, ask you for more detail instead of guessing.").addToggle((tg) => tg.setValue(s.enableClarification).onChange(async (v) => {
      s.enableClarification = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Extract query intent").setDesc("Before routing/searching and answering, distill exactly what you're asking for (resolving 'this'/'that' from recent conversation). Sharpens both retrieval and the final answer; costs one extra small-model call per query.").addToggle((tg) => tg.setValue(s.enableIntentExtraction).onChange(async (v) => {
      s.enableIntentExtraction = v;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h2", { text: "Chat history digest" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Instead of re-sending the entire growing transcript on every turn, the plugin keeps a compact rolling summary of the conversation and the user's overall intent, updated one turn at a time. Older turns are represented by that summary; only the most recent turns are still sent verbatim."
    });
    new import_obsidian.Setting(containerEl).setName("Track chat summary").setDesc("Maintain a rolling summary + inferred user intent per chat session, and use it (alongside the capped recent messages below) so the model stays aware of earlier turns without needing the full transcript. Costs one extra small-model call per turn.").addToggle((tg) => tg.setValue(s.trackChatSummary).onChange(async (v) => {
      s.trackChatSummary = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Recent raw turns to include verbatim").setDesc("How many of the most recent messages (not turn-pairs) are sent to the model word-for-word. Older messages beyond this are dropped from the raw transcript and relied on only via the rolling summary above. Ignored (full history sent) if 'Track chat summary' is off.").addSlider((sl) => sl.setLimits(2, 40, 2).setValue(s.recentRawTurns).setDynamicTooltip().onChange(async (v) => {
      s.recentRawTurns = v;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h2", { text: "Memory layers (progressive abstraction)" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Every memory is stored as a fixed stack of named layers instead of a variable-depth tree: Overview (top, least detail) down through as many compression passes as configured below, ending at the Comprehensive Summary (most detail, built from the source) \u2014 with the raw Original always available as a last resort. Search always starts at the Overview and only loads a deeper layer when the one above wasn't enough."
    });
    new import_obsidian.Setting(containerEl).setName("Abstraction layers").setDesc("How many compression passes sit above the Comprehensive Summary. 3 (default) gives Overview \u2192 High-Level Concepts \u2192 Detailed Concepts \u2192 Comprehensive Summary. Lower is cheaper to build and search; higher gives finer-grained detail control for long documents.").addSlider((sl) => sl.setLimits(1, 6, 1).setValue(s.numAbstractionLayers).setDynamicTooltip().onChange(async (v) => {
      s.numAbstractionLayers = v;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h2", { text: "Merge passes (used to build the Comprehensive Summary)" });
    containerEl.createEl("p", {
      cls: "setting-item-description",
      text: "Splitting raw source text into chunks is now handled entirely by the LLM itself and has no size/overlap settings here. The settings below only govern the separate step of regrouping and merging the already-summarized chunks back together into one Comprehensive Summary."
    });
    new import_obsidian.Setting(containerEl).setName("Max chunk-merge passes").setDesc("Safety cap on how many regroup-and-merge passes are allowed while collapsing many chunks down into one Comprehensive Summary. Only matters for documents needing more chunks than fit in one merge round.").addText((t) => t.setValue(String(s.maxChunkMergePasses)).onChange(async (v) => {
      s.maxChunkMergePasses = Number(v) || s.maxChunkMergePasses;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Merge group max characters").setDesc("Char budget for grouping already-summarized chunks together during a merge pass. Should generally be large enough that several summarized chunks can combine into one group at a time \u2014 too small and merge passes barely shrink the part count.").addText((t) => t.setValue(String(s.mergeGroupMaxChars)).onChange(async (v) => {
      s.mergeGroupMaxChars = Number(v) || s.mergeGroupMaxChars;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Merge overlap units").setDesc("How many prior-level units are repeated across merge-group boundaries for continuity. Keep this small relative to the group size above \u2014 too large an overlap stalls merge progress to roughly one unit advanced per pass.").addText((t) => t.setValue(String(s.mergeOverlapUnits)).onChange(async (v) => {
      s.mergeOverlapUnits = Math.max(0, Number(v) || 0);
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Concurrent summaries").setDesc("How many chunk/group summaries to run at once per level instead of one at a time. Higher is faster but sends more simultaneous requests to Ollama.").addSlider((sl) => sl.setLimits(1, 8, 1).setValue(s.maxConcurrentSummaries).setDynamicTooltip().onChange(async (v) => {
      s.maxConcurrentSummaries = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Debug logging").addToggle((tg) => tg.setValue(s.debugLogging).onChange(async (v) => {
      s.debugLogging = v;
      await this.plugin.saveSettings();
    }));
  }
};

// src/ollamaClient.ts
var import_obsidian2 = require("obsidian");
function extractOllamaError(bodyText) {
  try {
    const parsed = JSON.parse(bodyText);
    return parsed.error;
  } catch {
    return bodyText.trim() ? bodyText.trim().slice(0, 300) : void 0;
  }
}
var OllamaClient = class {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }
  setBaseUrl(url) {
    this.baseUrl = url;
  }
  url(path) {
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
  async post(path, body, opDescription, model) {
    let res;
    try {
      res = await (0, import_obsidian2.requestUrl)({
        url: this.url(path),
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(body),
        throw: false
      });
    } catch (err) {
      throw new Error(
        `Couldn't reach Ollama at "${this.baseUrl}" for ${opDescription} (model "${model}"): ${err.message}. Check the Ollama base URL in settings and that "ollama serve" is running.`
      );
    }
    if (res.status < 200 || res.status >= 300) {
      const detail = extractOllamaError(res.text ?? "");
      let guidance = "";
      if (res.status === 404) {
        guidance = ` Model "${model}" may not be pulled yet \u2014 try "ollama pull ${model}".`;
      } else if (res.status === 500) {
        guidance = ` This often means model "${model}" doesn't support ${opDescription} \u2014 for example, an embeddings-only model (like nomic-embed-text) can't be used to chat/generate, and a chat model can't be used for embeddings. Double-check your Chat/Summary model and Embedding model settings aren't pointing at the wrong kind of model.`;
      }
      throw new Error(`Ollama returned ${res.status} for ${opDescription} using model "${model}"${detail ? `: ${detail}` : ""}.${guidance}`);
    }
    return res.json;
  }
  /** Single-shot prompt completion (used heavily for summarization chunks). */
  async generate(model, prompt, options) {
    const data = await this.post("/api/generate", { model, prompt, stream: false, options }, "text generation", model);
    return (data.response ?? "").trim();
  }
  /** Multi-turn chat completion. */
  async chat(model, messages, options) {
    const data = await this.post("/api/chat", { model, messages, stream: false, options }, "chat", model);
    return (data.message?.content ?? "").trim();
  }
  /** Embedding vector for a string, used for embedding-based memory routing. */
  async embed(model, input) {
    const data = await this.post("/api/embeddings", { model, prompt: input }, "embeddings", model);
    return data.embedding ?? [];
  }
  async listModels() {
    try {
      const res = await (0, import_obsidian2.requestUrl)({ url: this.url("/api/tags"), method: "GET", throw: false });
      if (res.status < 200 || res.status >= 300)
        return [];
      const data = res.json;
      return (data.models ?? []).map((m) => m.name);
    } catch {
      return [];
    }
  }
};
function cosineSimilarity(a, b) {
  if (a.length === 0 || b.length === 0 || a.length !== b.length)
    return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0)
    return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// src/memoryStore.ts
var import_obsidian3 = require("obsidian");

// src/cancellation.ts
var CancelledError = class extends Error {
  constructor() {
    super("Cancelled");
    this.name = "CancelledError";
  }
};
function isCancelledError(err) {
  return err instanceof CancelledError;
}
var CancellationSource = class {
  constructor() {
    this._cancelled = false;
    this.token = {
      isCancelled: () => this._cancelled
    };
  }
  cancel() {
    this._cancelled = true;
  }
  get isCancelled() {
    return this._cancelled;
  }
};
function throwIfCancelled(token) {
  if (token?.isCancelled())
    throw new CancelledError();
}

// src/chunker.ts
var CHUNK_MARKER = "<<<CHUNK_BREAK>>>";
var MAX_LLM_CHUNK_INPUT_CHARS = 12e3;
var LLM_CHUNK_PROMPT = `Split the text below into topically coherent chunks \u2014 each chunk should cover one continuous scene, section, or topic, and shouldn't cut off mid-thought. Insert the exact marker "${CHUNK_MARKER}" on its own line at every point you'd split, and nowhere else. Reproduce the ENTIRE original text exactly as given \u2014 do not alter, summarize, omit, or add to it in any way; only insert marker lines. No preamble, no commentary \u2014 output only the original text with the markers inserted.`;
function splitForInputBudget(text, maxChars) {
  if (text.length <= maxChars)
    return [text];
  const paragraphs = text.split(/\n{2,}/);
  const groups = [];
  let current = "";
  for (const p of paragraphs) {
    const candidate = current ? `${current}

${p}` : p;
    if (candidate.length > maxChars && current) {
      groups.push(current);
      current = p;
    } else {
      current = candidate;
    }
  }
  if (current)
    groups.push(current);
  return groups.flatMap((g) => {
    if (g.length <= maxChars)
      return [g];
    const pieces = [];
    for (let i = 0; i < g.length; i += maxChars)
      pieces.push(g.slice(i, i + maxChars));
    return pieces;
  });
}
async function markChunksWithLLM(text, client, settings, token) {
  const prompt = `${LLM_CHUNK_PROMPT}

---
${text}
---`;
  const raw = (await client.generate(settings.summaryModel, prompt, { temperature: 0 })).trim();
  throwIfCancelled(token);
  const parts = raw.split(CHUNK_MARKER).map((p) => p.trim()).filter((p) => p.length > 0);
  const reproducedLength = parts.reduce((sum, p) => sum + p.length, 0);
  const lostTooMuch = reproducedLength < text.length * 0.5;
  if (parts.length <= 1 || lostTooMuch) {
    return [text];
  }
  return parts;
}
async function chunkTextWithLLM(text, client, settings, token) {
  const inputGroups = splitForInputBudget(text, MAX_LLM_CHUNK_INPUT_CHARS);
  const allParts = [];
  for (const group of inputGroups) {
    throwIfCancelled(token);
    const parts = await markChunksWithLLM(group, client, settings, token);
    allParts.push(...parts);
  }
  return allParts.map((t, i) => ({ index: i, text: t }));
}
function chunkUnits(units, params) {
  const { maxChars, maxUnits, overlapUnits } = params;
  const chunks = [];
  let i = 0;
  while (i < units.length) {
    const current = [];
    let charCount = 0;
    let j = i;
    while (j < units.length) {
      const u = units[j];
      const addedLen = u.length + 2;
      if (charCount + addedLen > maxChars && current.length > 0)
        break;
      if (current.length >= maxUnits)
        break;
      current.push(j);
      charCount += addedLen;
      j++;
      if (charCount > maxChars)
        break;
    }
    const text = current.map((idx) => units[idx]).join("\n\n");
    chunks.push({ index: chunks.length, sourceIndices: [...current], text });
    const nextStart = Math.max(i + 1, j - overlapUnits);
    if (nextStart <= i)
      break;
    i = nextStart;
  }
  return chunks;
}

// src/summarizer.ts
function layerRole(index, numAbstractionLayers) {
  if (index === 0) {
    return { name: "Overview", targetDescription: "a few sentences giving a quick understanding of the content" };
  }
  if (index === numAbstractionLayers) {
    return { name: "Comprehensive Summary", targetDescription: "a near-complete summary that preserves most of the original information" };
  }
  if (numAbstractionLayers === 3) {
    if (index === 1)
      return { name: "High-Level Concepts", targetDescription: "the main ideas, themes, and relationships" };
    if (index === 2)
      return { name: "Detailed Concepts", targetDescription: "more specific explanations, important details, and supporting context" };
  }
  const t = index / numAbstractionLayers;
  const targetDescription = t <= 0.5 ? "the main ideas, themes, and relationships, in somewhat more detail than the layer above" : "specific explanations, important details, and supporting context, while staying more compact than the layer below";
  return { name: `Layer ${index} of ${numAbstractionLayers}`, targetDescription };
}
function layerPrompt(role, sourceLayerName) {
  return `The text below is the "${sourceLayerName}" layer of a piece of content. Produce the "${role.name}" layer from it: ${role.targetDescription}. It must stay fully consistent with the text below and must not introduce any information that isn't already in it \u2014 only select, condense, or reorganize what's already there, never invent new facts. No preamble, just the summary itself.`;
}
var FACT_EXTRACTION_PROMPT = "You are carefully reading one part of a longer piece of writing, building an accurate, near-complete factual record. From the excerpt below, capture explicit information \u2014 named people/characters, places, dates or timeline points, concrete events, relationships, objects, and explicit factual or worldbuilding claims \u2014 preserving as much detail and nuance as you reasonably can rather than compressing aggressively. Do not infer motivations, themes, or symbolism yet. No preamble, just the record itself.";
var COMPREHENSIVE_MERGE_PROMPT = "You are merging several summaries of consecutive parts of the same longer piece of writing into one continuous summary. This must stay near-complete: carry over every distinct fact \u2014 named people/characters, places, dates, events, relationships, and explicit claims \u2014 from every part. Only shorten where two parts state the literal same fact; fold that single duplicate mention into one, and trim prose that is pure filler with no informational content. Do NOT generalize, compress, or drop details for the sake of brevity \u2014 the merged summary should read as the union of everything in the parts, not a condensed digest of it. Explicitly reconcile anything where a later part changes, contradicts, or reveals new meaning in an earlier one (a reveal, twist, unreliable narration, hidden identity, or similar) \u2014 state the resolved version once, not both versions. No preamble, just the merged summary.";
var DIRECT_SUMMARIZE_CHAR_CAP = 6e3;
var MERGE_TWO_COMPREHENSIVE_PROMPT = "You are merging two summaries of the SAME evolving subject: one representing everything known before, one representing new information just learned. Merge them into one continuous summary that stays near-complete \u2014 keep every distinct fact from both. Only shorten where something is restated in both (fold that into one mention) or is pure filler with no informational content; do NOT generalize, compress, or drop details otherwise. If the new information updates, corrects, or contradicts something in the old summary, state the resolved (new) version once rather than keeping both. No preamble, just the merged summary.";
async function summarizeText(client, settings, text, instruction) {
  const prompt = `${instruction}

---
${text}
---

Summary:`;
  let out = (await client.generate(settings.summaryModel, prompt, { temperature: 0.2 })).trim();
  if (!out) {
    out = (await client.generate(settings.summaryModel, prompt, { temperature: 0.5 })).trim();
  }
  if (!out) {
    out = text.length > 240 ? `${text.slice(0, 240)}\u2026` : text;
  }
  return out;
}
async function mapWithConcurrency(items, limit, fn, token) {
  const results = new Array(items.length);
  let next = 0;
  const effectiveLimit = Math.max(1, Math.min(limit, items.length || 1));
  async function worker() {
    for (; ; ) {
      if (token?.isCancelled())
        return;
      const i = next++;
      if (i >= items.length)
        return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: effectiveLimit }, () => worker()));
  throwIfCancelled(token);
  return results;
}
async function buildComprehensiveSummary(sourceText, client, settings, onProgress, token) {
  const chunks = await chunkTextWithLLM(sourceText, client, settings, token);
  throwIfCancelled(token);
  if (chunks.length <= 1) {
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
      overlapUnits: settings.mergeOverlapUnits
    });
    onProgress?.({ layerIndex: -1, layerName: "Comprehensive Summary", phase: `Merge pass ${pass}: combining ${currentTexts.length} part(s) into ${grouped.length}`, status: "starting" });
    currentTexts = await mapWithConcurrency(grouped, settings.maxConcurrentSummaries, (g) => summarizeText(client, settings, g.text, COMPREHENSIVE_MERGE_PROMPT), token);
    onProgress?.({ layerIndex: -1, layerName: "Comprehensive Summary", phase: `Merge pass ${pass} done \u2014 ${currentTexts.length} part(s) left`, status: "done" });
  }
  if (currentTexts.length > 1) {
    return summarizeText(client, settings, currentTexts.join("\n\n"), COMPREHENSIVE_MERGE_PROMPT);
  }
  return currentTexts[0];
}
async function cascadeLayersUpward(comprehensiveText, numAbstractionLayers, client, settings, onProgress, token) {
  const layers = [];
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
async function buildLayeredMemory(sourceText, client, settings, onProgress, token) {
  const numLayers = Math.max(1, settings.numAbstractionLayers);
  const comprehensive = await buildComprehensiveSummary(sourceText, client, settings, onProgress, token);
  const upperLayers = await cascadeLayersUpward(comprehensive, numLayers, client, settings, onProgress, token);
  const layers = [...upperLayers, { index: numLayers, name: "Comprehensive Summary", text: comprehensive }];
  return { layers, original: sourceText, builtAt: Date.now() };
}
async function extendLayeredMemory(existing, newText, client, settings, onProgress, token) {
  const numLayers = Math.max(1, settings.numAbstractionLayers);
  const existingComprehensive = existing.layers[existing.layers.length - 1]?.text ?? "";
  const newComprehensive = await buildComprehensiveSummary(newText, client, settings, onProgress, token);
  const combinedForMerge = `PREVIOUS:
${existingComprehensive}

NEW:
${newComprehensive}`;
  throwIfCancelled(token);
  const mergedComprehensive = combinedForMerge.length <= DIRECT_SUMMARIZE_CHAR_CAP ? await summarizeText(client, settings, combinedForMerge, MERGE_TWO_COMPREHENSIVE_PROMPT) : await buildComprehensiveSummary(combinedForMerge, client, settings, onProgress, token);
  const upperLayers = await cascadeLayersUpward(mergedComprehensive, numLayers, client, settings, onProgress, token);
  const layers = [...upperLayers, { index: numLayers, name: "Comprehensive Summary", text: mergedComprehensive }];
  return { layers, original: `${existing.original}

${newText}`, builtAt: Date.now() };
}
async function quickOverview(client, settings, text) {
  const capped = text.length > DIRECT_SUMMARIZE_CHAR_CAP * 2 ? text.slice(0, DIRECT_SUMMARIZE_CHAR_CAP * 2) : text;
  return summarizeText(
    client,
    settings,
    capped,
    "Summarize the following text in exactly 1-2 short sentences describing what it is about overall. No preamble, no bullet points, just the sentence(s)."
  );
}
async function generateShortTitle(client, settings, firstMessage) {
  const capped = firstMessage.length > 600 ? firstMessage.slice(0, 600) : firstMessage;
  const prompt = `Give a short, plain 3-6 word title (no punctuation at the end, no quotes) for a conversation that starts with this message:

"${capped}"

Respond with ONLY the title.`;
  const raw = (await client.generate(settings.summaryModel, prompt, { temperature: 0.3 })).trim();
  const cleaned = raw.replace(/^["'\s]+|["'\s.]+$/g, "");
  return cleaned || (capped.length > 40 ? `${capped.slice(0, 40)}\u2026` : capped) || "New chat";
}
async function extractQueryIntent(client, settings, query, recentHistory = [], sessionSummary) {
  const historyText = recentHistory.slice(-4).map((m) => `${m.role}: ${m.content}`).join("\n");
  const summaryText = sessionSummary ? `${sessionSummary}

` : "";
  const prompt = `${summaryText}Recent conversation (may be empty):
${historyText || "(none)"}

Latest message: "${query}"

In ONE crisp sentence, state exactly what specific information or outcome the user is asking for right now \u2014 resolve any pronouns or "that"/"this" references using the recent conversation above, and strip away greetings or filler. Don't answer the question, just restate its precise intent.

Respond with ONLY that one sentence.`;
  const raw = (await client.generate(settings.summaryModel, prompt, { temperature: 0.1 })).trim();
  return raw || query;
}

// src/memoryStore.ts
function emptyStoreData() {
  return { topics: {}, memories: {} };
}
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "topic";
}
function layerFileName(layer) {
  return `${String(layer.index).padStart(2, "0")}-${slugify(layer.name)}.md`;
}
function renderMainNote(topic, memory) {
  const lines = [];
  lines.push("---");
  lines.push(`topic_id: ${topic.id}`);
  lines.push(`updated: ${new Date(topic.updatedAt).toISOString()}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${topic.name}`);
  lines.push("");
  lines.push("## Overview");
  lines.push(memory.layers[0].text.trim());
  if (memory.layers.length > 1) {
    lines.push("");
    lines.push("## More detail");
    lines.push(
      "_Each link below expands on the one above it without changing its meaning \u2014 pulled in only as needed, when a question this Overview alone can't answer needs it._"
    );
    lines.push("");
    for (let i = 1; i < memory.layers.length; i++) {
      const layer = memory.layers[i];
      lines.push(`- [[${topic.folderPath}/${layerFileName(layer)}|${layer.name}]]`);
    }
    lines.push(`- [[${topic.folderPath}/original.md|Original source text]]`);
  }
  lines.push("");
  return lines.join("\n");
}
function renderLayerFile(topic, layer) {
  const lines = [];
  lines.push("---");
  lines.push(`topic_id: ${topic.id}`);
  lines.push(`layer_index: ${layer.index}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${topic.name} \u2014 ${layer.name}`);
  lines.push("");
  lines.push(`_Part of [[${topic.notePath}|${topic.name}]]. This layer expands on the one above it without changing its meaning._`);
  lines.push("");
  lines.push(layer.text.trim());
  lines.push("");
  return lines.join("\n");
}
function renderOriginalFile(topic, memory) {
  const lines = [];
  lines.push("---");
  lines.push(`topic_id: ${topic.id}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${topic.name} \u2014 Original source text`);
  lines.push("");
  lines.push(`_Part of [[${topic.notePath}|${topic.name}]]. Only loaded when even the Comprehensive Summary isn't detailed enough._`);
  lines.push("");
  lines.push(memory.original.trim());
  lines.push("");
  return lines.join("\n");
}
var MemoryStore = class {
  constructor(app, data, folder, persist) {
    this.app = app;
    this.data = data;
    this.folder = folder;
    this.persist = persist;
  }
  async ensureFolder(path) {
    const normalized = (0, import_obsidian3.normalizePath)(path);
    if (!this.app.vault.getAbstractFileByPath(normalized)) {
      await this.app.vault.createFolder(normalized).catch(() => void 0);
    }
  }
  listTopics() {
    return Object.values(this.data.topics).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  getTopic(id) {
    return this.data.topics[id];
  }
  getMemory(topicId) {
    return this.data.memories[topicId];
  }
  /** Create a brand-new topic by building a full layered memory from raw text. */
  async createTopicFromText(name, text, client, settings, onProgress, token) {
    const memory = await buildLayeredMemory(text, client, settings, onProgress, token);
    return this.createTopic(name, memory);
  }
  /**
   * Grows an existing topic with new raw text. Extends the layered memory
   * (merging into the existing Comprehensive Summary, then recascading the
   * layers above it) rather than editing files directly, so every layer
   * file always stays derived from the memory, never hand-patched.
   */
  async appendRawContent(id, text, client, settings, onProgress, token) {
    const existing = this.data.memories[id];
    const memory = existing ? await extendLayeredMemory(existing, text, client, settings, onProgress, token) : await buildLayeredMemory(text, client, settings, onProgress, token);
    return this.updateTopic(id, memory);
  }
  async createTopic(name, memory) {
    await this.ensureFolder(this.folder);
    const id = `${slugify(name)}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
    const slugBase = `${slugify(name)}-${id.slice(-8)}`;
    const notePath = (0, import_obsidian3.normalizePath)(`${this.folder}/${slugBase}.md`);
    const folderPath = (0, import_obsidian3.normalizePath)(`${this.folder}/${slugBase}`);
    const topic = { id, name, overview: memory.layers[0].text, notePath, folderPath, updatedAt: Date.now() };
    this.data.topics[id] = topic;
    this.data.memories[id] = memory;
    await this.writeAllFiles(topic, memory);
    await this.persist();
    return topic;
  }
  async updateTopic(id, memory) {
    const topic = this.data.topics[id];
    if (!topic)
      throw new Error(`Unknown memory topic: ${id}`);
    topic.overview = memory.layers[0].text;
    topic.updatedAt = Date.now();
    this.data.memories[id] = memory;
    await this.writeAllFiles(topic, memory);
    await this.persist();
    return topic;
  }
  async writeAllFiles(topic, memory) {
    await this.writeFile(topic.notePath, renderMainNote(topic, memory));
    if (memory.layers.length > 1) {
      await this.ensureFolder(topic.folderPath);
      for (let i = 1; i < memory.layers.length; i++) {
        const layer = memory.layers[i];
        await this.writeFile((0, import_obsidian3.normalizePath)(`${topic.folderPath}/${layerFileName(layer)}`), renderLayerFile(topic, layer));
      }
      await this.writeFile((0, import_obsidian3.normalizePath)(`${topic.folderPath}/original.md`), renderOriginalFile(topic, memory));
    }
  }
  async writeFile(path, content) {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian3.TFile) {
      await this.app.vault.modify(existing, content);
      return;
    }
    try {
      await this.app.vault.create(path, content);
    } catch (err) {
      const retry = this.app.vault.getAbstractFileByPath(path);
      if (retry instanceof import_obsidian3.TFile) {
        await this.app.vault.modify(retry, content);
      } else {
        throw err;
      }
    }
  }
};

// src/tempMemoryStore.ts
var import_obsidian4 = require("obsidian");
function emptyTempMemoryData() {
  return {};
}
function renderTempNote(entry) {
  const lines = [];
  lines.push("---");
  lines.push(`temp_id: ${entry.id}`);
  lines.push("status: pending");
  lines.push(`action: ${entry.action}`);
  if (entry.topicId)
    lines.push(`related_topic_id: ${entry.topicId}`);
  if (entry.topicName)
    lines.push(`topic_name: ${entry.topicName}`);
  lines.push(`created: ${new Date(entry.createdAt).toISOString()}`);
  lines.push("---");
  lines.push("");
  lines.push("# Pending memory update");
  lines.push("");
  lines.push(`**From query:** ${entry.sourceQuery}`);
  lines.push("");
  lines.push(`**Proposed fact:** ${entry.fact}`);
  lines.push("");
  lines.push(
    entry.action === "extend" ? `Would extend existing topic **${entry.topicName ?? entry.topicId}**.` : `Would create a new topic **${entry.topicName}**.`
  );
  lines.push("");
  lines.push(
    "Confirm or discard this from The Librarium chat panel. Clearing that chat's temp-memory (or letting the chat get pruned) removes unconfirmed entries too."
  );
  lines.push("");
  return lines.join("\n");
}
var TempMemoryStore = class {
  constructor(app, data, folder, persist) {
    this.app = app;
    this.data = data;
    this.folder = folder;
    this.persist = persist;
  }
  async ensureFolder() {
    const path = (0, import_obsidian4.normalizePath)(this.folder);
    if (!this.app.vault.getAbstractFileByPath(path)) {
      await this.app.vault.createFolder(path).catch(() => void 0);
    }
  }
  list() {
    return Object.values(this.data).sort((a, b) => b.createdAt - a.createdAt);
  }
  /** Entries belonging to one chat session, most recent first (recency is what gives them more weight in context). */
  listForSession(sessionId) {
    return Object.values(this.data).filter((e) => e.sessionId === sessionId).sort((a, b) => b.createdAt - a.createdAt);
  }
  get(id) {
    return this.data[id];
  }
  async create(partial) {
    await this.ensureFolder();
    const id = `temp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const label = partial.topicName ?? partial.topicId ?? "topic";
    const notePath = (0, import_obsidian4.normalizePath)(`${this.folder}/${slugify(label)}-${id}.md`);
    const entry = { ...partial, id, notePath, createdAt: Date.now() };
    this.data[id] = entry;
    await this.app.vault.create(notePath, renderTempNote(entry));
    await this.persist();
    return entry;
  }
  async discard(id) {
    const entry = this.data[id];
    if (!entry)
      return;
    const file = this.app.vault.getAbstractFileByPath(entry.notePath);
    if (file instanceof import_obsidian4.TFile)
      await this.app.vault.delete(file);
    delete this.data[id];
    await this.persist();
  }
  /** Explicit "restart temp-memory" for one chat, without touching other sessions' pending entries. */
  async clearSession(sessionId) {
    const ids = Object.values(this.data).filter((e) => e.sessionId === sessionId).map((e) => e.id);
    for (const id of ids)
      await this.discard(id);
  }
  /** Wipes every pending entry across every session. Rarely needed directly — prefer clearSession(). */
  async clearAll() {
    for (const id of Object.keys(this.data)) {
      await this.discard(id);
    }
  }
};

// src/noteMemoryStore.ts
var import_obsidian5 = require("obsidian");
function emptyNoteMemoryData() {
  return { entries: {} };
}
function layerFileName2(layer) {
  return `${String(layer.index).padStart(2, "0")}-${slugify(layer.name)}.md`;
}
function renderMirrorNote(entry) {
  const lines = [];
  lines.push("---");
  lines.push(`source_path: ${entry.filePath}`);
  lines.push(`synced: ${new Date(entry.updatedAt).toISOString()}`);
  lines.push("---");
  lines.push("");
  lines.push(`# Note memory: ${entry.fileName}`);
  lines.push("");
  lines.push(
    `_Layered mirror of [[${entry.filePath}|${entry.fileName}]], used when "Include current note" is on so a query only pulls in the level of detail it needs instead of the whole file. Refresh from the chat panel or the command palette \u2014 this doesn't update on its own._`
  );
  lines.push("");
  lines.push("## Overview");
  lines.push(entry.memory.layers[0].text.trim());
  if (entry.memory.layers.length > 1) {
    lines.push("");
    lines.push("## More detail");
    for (let i = 1; i < entry.memory.layers.length; i++) {
      const layer = entry.memory.layers[i];
      lines.push(`- [[${entry.mirrorFolderPath}/${layerFileName2(layer)}|${layer.name}]]`);
    }
    lines.push(`- [[${entry.mirrorFolderPath}/original.md|Original note text]]`);
  }
  lines.push("");
  return lines.join("\n");
}
function renderLayerFile2(entry, layer) {
  const lines = [];
  lines.push("---");
  lines.push(`source_path: ${entry.filePath}`);
  lines.push(`layer_index: ${layer.index}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${entry.fileName} \u2014 ${layer.name}`);
  lines.push("");
  lines.push(`_Part of [[${entry.mirrorNotePath}|${entry.fileName}'s note memory]]. Expands on the layer above it without changing its meaning._`);
  lines.push("");
  lines.push(layer.text.trim());
  lines.push("");
  return lines.join("\n");
}
function renderOriginalFile2(entry) {
  const lines = [];
  lines.push("---");
  lines.push(`source_path: ${entry.filePath}`);
  lines.push("---");
  lines.push("");
  lines.push(`# ${entry.fileName} \u2014 Original note text`);
  lines.push("");
  lines.push(`_Snapshot as of the last sync. Part of [[${entry.mirrorNotePath}|${entry.fileName}'s note memory]]._`);
  lines.push("");
  lines.push(entry.memory.original.trim());
  lines.push("");
  return lines.join("\n");
}
var NoteMemoryStore = class {
  constructor(app, data, folder, persist) {
    this.app = app;
    this.data = data;
    this.folder = folder;
    this.persist = persist;
  }
  async ensureFolder(path) {
    const normalized = (0, import_obsidian5.normalizePath)(path);
    if (!this.app.vault.getAbstractFileByPath(normalized)) {
      await this.app.vault.createFolder(normalized).catch(() => void 0);
    }
  }
  get(filePath) {
    return this.data.entries[filePath];
  }
  list() {
    return Object.values(this.data.entries).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  /** Returns the existing mirror for this file, building it fresh if it doesn't exist yet. Never auto-refreshes a stale one. */
  async ensure(file, client, settings, onProgress, token) {
    const existing = this.data.entries[file.path];
    if (existing)
      return existing;
    const content = await this.app.vault.read(file);
    return this.rebuildFull(file, content, client, settings, onProgress, token);
  }
  /** Whether this note's mirror is out of date relative to its current on-disk content — surfaced in the UI, never acted on automatically. */
  async isStale(file) {
    const existing = this.data.entries[file.path];
    if (!existing)
      return false;
    const content = await this.app.vault.read(file);
    return content !== existing.sourceText;
  }
  /** Full rebuild from scratch — always correct, costs a fresh summarization pass over the whole note. */
  async refreshFull(file, client, settings, onProgress, token) {
    const content = await this.app.vault.read(file);
    return this.rebuildFull(file, content, client, settings, onProgress, token);
  }
  /**
   * Incremental refresh: if the note's current content still starts with
   * exactly what was last synced (the common append-only case — journal
   * entries, running notes, logs), only the new suffix is chunked and
   * summarized, and the layered memory is extended rather than rebuilt. If
   * the note was edited in the middle instead, an append-only diff isn't
   * meaningful, so this safely falls back to a full rebuild instead of
   * producing layers that no longer match the note.
   */
  async refreshIncremental(file, client, settings, onProgress, token) {
    const content = await this.app.vault.read(file);
    const existing = this.data.entries[file.path];
    if (!existing) {
      return { entry: await this.rebuildFull(file, content, client, settings, onProgress, token), fellBackToFull: true };
    }
    if (content === existing.sourceText) {
      return { entry: existing, fellBackToFull: false };
    }
    if (!content.startsWith(existing.sourceText)) {
      return { entry: await this.rebuildFull(file, content, client, settings, onProgress, token), fellBackToFull: true };
    }
    const addedText = content.slice(existing.sourceText.length);
    if (!addedText.trim()) {
      return { entry: existing, fellBackToFull: false };
    }
    const memory = await extendLayeredMemory(existing.memory, addedText, client, settings, onProgress, token);
    const entry = { ...existing, sourceText: content, memory, updatedAt: Date.now() };
    this.data.entries[file.path] = entry;
    await this.writeAllFiles(entry);
    await this.persist();
    return { entry, fellBackToFull: false };
  }
  async rebuildFull(file, content, client, settings, onProgress, token) {
    const memory = await buildLayeredMemory(content, client, settings, onProgress, token);
    const existing = this.data.entries[file.path];
    const slug = existing ? void 0 : this.uniqueSlug(file);
    const mirrorNotePath = existing?.mirrorNotePath ?? (0, import_obsidian5.normalizePath)(`${this.folder}/${slug}.md`);
    const mirrorFolderPath = existing?.mirrorFolderPath ?? (0, import_obsidian5.normalizePath)(`${this.folder}/${slug}`);
    const entry = {
      filePath: file.path,
      fileName: file.basename,
      sourceText: content,
      memory,
      mirrorFolderPath,
      mirrorNotePath,
      updatedAt: Date.now()
    };
    this.data.entries[file.path] = entry;
    await this.writeAllFiles(entry);
    await this.persist();
    return entry;
  }
  /**
   * Basename-derived slug, disambiguated against every other tracked
   * file's mirror folder so two vault files with the same name (a common
   * Obsidian occurrence — same filename in different folders) don't
   * silently share, and overwrite, the same mirror. Deterministic given
   * the current set of entries: the first note to claim a name gets the
   * plain slug, later ones get "-2", "-3", etc.
   */
  uniqueSlug(file) {
    const base = slugify(file.basename);
    const taken = new Set(
      Object.values(this.data.entries).filter((e) => e.filePath !== file.path).map((e) => e.mirrorFolderPath)
    );
    let candidate = base;
    for (let n = 2; taken.has((0, import_obsidian5.normalizePath)(`${this.folder}/${candidate}`)); n++) {
      candidate = `${base}-${n}`;
    }
    return candidate;
  }
  async writeAllFiles(entry) {
    await this.ensureFolder(this.folder);
    await this.writeFile(entry.mirrorNotePath, renderMirrorNote(entry));
    if (entry.memory.layers.length > 1) {
      await this.ensureFolder(entry.mirrorFolderPath);
      for (let i = 1; i < entry.memory.layers.length; i++) {
        const layer = entry.memory.layers[i];
        await this.writeFile((0, import_obsidian5.normalizePath)(`${entry.mirrorFolderPath}/${layerFileName2(layer)}`), renderLayerFile2(entry, layer));
      }
      await this.writeFile((0, import_obsidian5.normalizePath)(`${entry.mirrorFolderPath}/original.md`), renderOriginalFile2(entry));
    }
  }
  async writeFile(path, content) {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian5.TFile) {
      await this.app.vault.modify(existing, content);
      return;
    }
    try {
      await this.app.vault.create(path, content);
    } catch (err) {
      const retry = this.app.vault.getAbstractFileByPath(path);
      if (retry instanceof import_obsidian5.TFile) {
        await this.app.vault.modify(retry, content);
      } else {
        throw err;
      }
    }
  }
};

// src/chatSessionStore.ts
function emptyChatSessionData() {
  return { sessions: {} };
}
function fallbackTitle(text) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 48 ? `${clean.slice(0, 48)}\u2026` : clean || "New chat";
}
var _ChatSessionStore = class _ChatSessionStore {
  constructor(data, persist, onPrune) {
    this.data = data;
    this.persist = persist;
    this.onPrune = onPrune;
    this.drafts = /* @__PURE__ */ new Map();
  }
  list() {
    return Object.values(this.data.sessions).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  get(id) {
    return this.data.sessions[id] ?? this.drafts.get(id);
  }
  isDraft(id) {
    return this.drafts.has(id);
  }
  /** Creates a new session, but only in memory — nothing is persisted or listed until its first message. */
  create() {
    const id = `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();
    const session = { id, title: "New chat", createdAt: now, updatedAt: now, messages: [] };
    this.drafts.set(id, session);
    return session;
  }
  async appendMessage(id, message) {
    const session = this.get(id);
    if (!session)
      return;
    session.messages.push(message);
    session.updatedAt = Date.now();
    if (session.messages.length === 1 && message.role === "user") {
      session.title = fallbackTitle(message.content);
    }
    if (this.drafts.has(id)) {
      this.drafts.delete(id);
      this.data.sessions[id] = session;
      await this.prune();
    }
    await this.persist();
  }
  async setTitle(id, title) {
    const session = this.get(id);
    if (!session)
      return;
    session.title = title.trim() || session.title;
    if (this.data.sessions[id])
      await this.persist();
  }
  /** Deletes a session outright — its temp-memory is cleared via onPrune, same as natural pruning. */
  async deleteSession(id) {
    this.drafts.delete(id);
    if (this.data.sessions[id]) {
      delete this.data.sessions[id];
      this.onPrune?.(id);
      await this.persist();
    }
  }
  /** Keeps the session list from growing forever; oldest sessions beyond the cap are dropped (their temp-memory is pruned by the caller via onPrune). */
  async prune() {
    const all = this.list();
    if (all.length <= _ChatSessionStore.MAX_SESSIONS)
      return;
    const overflow = all.slice(_ChatSessionStore.MAX_SESSIONS);
    for (const session of overflow) {
      delete this.data.sessions[session.id];
      this.onPrune?.(session.id);
    }
  }
};
_ChatSessionStore.MAX_SESSIONS = 30;
var ChatSessionStore = _ChatSessionStore;

// src/chatHistoryStore.ts
function emptyChatHistoryData() {
  return {};
}
function extractJson(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match)
    return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
var UPDATE_PROMPT = (prevSummary, prevIntent, userText, assistantText) => `You are maintaining a running digest of an ongoing chat conversation, updated one turn at a time.

Summary so far (may be empty, if this is the first turn):
${prevSummary || "(none yet)"}

Current read of what the user is overall trying to accomplish in this chat (may be empty):
${prevIntent || "(none yet)"}

New turn just exchanged:
User: ${userText}
Assistant: ${assistantText}

Update both fields to fold in this new turn:
- "summary": a compact, continuous narrative of the conversation so far (not a transcript) \u2014 keep it concise but preserve facts, decisions, names, and context that later turns might depend on. Remove nothing that's still relevant, but don't just append the new turn verbatim; integrate it.
- "userIntent": the user's current overall goal or what they're trying to accomplish in this chat, as best understood right now. If this turn clarifies, changes, or completes their intent, revise it rather than just appending the old one.

Respond with ONLY JSON: {"summary": "...", "userIntent": "..."}`;
var ChatHistoryStore = class {
  constructor(data, persist) {
    this.data = data;
    this.persist = persist;
  }
  get(sessionId) {
    return this.data[sessionId];
  }
  /** Renders the digest as a couple of context blocks, or undefined if nothing's been summarized yet. */
  contextBlock(sessionId) {
    const s = this.data[sessionId];
    if (!s || !s.summary && !s.userIntent)
      return void 0;
    const lines = [];
    if (s.summary)
      lines.push(`### Summary of this conversation so far
${s.summary}`);
    if (s.userIntent)
      lines.push(`### What the user has been trying to accomplish in this chat
${s.userIntent}`);
    if (s.lastUserText || s.lastAssistantText) {
      lines.push(
        `### Most recent exchange (verbatim, in case exact wording matters)
User: ${s.lastUserText || "(none)"}
Assistant: ${s.lastAssistantText || "(none)"}`
      );
    }
    return lines.join("\n\n");
  }
  /** Short plain-text form for feeding into other small prompts (intent extraction, memory-command detection, ambiguity checks) without an extra JSON layer. */
  inlineText(sessionId) {
    const s = this.data[sessionId];
    if (!s || !s.summary && !s.userIntent)
      return void 0;
    const parts = [];
    if (s.summary)
      parts.push(`Conversation so far: ${s.summary}`);
    if (s.userIntent)
      parts.push(`User's overall goal so far: ${s.userIntent}`);
    if (s.lastUserText || s.lastAssistantText) {
      parts.push(`Most recent exchange \u2014 User: ${s.lastUserText || "(none)"} | Assistant: ${s.lastAssistantText || "(none)"}`);
    }
    return parts.join("\n");
  }
  async update(sessionId, userText, assistantText, client, settings) {
    const prev = this.data[sessionId];
    const prompt = UPDATE_PROMPT(prev?.summary ?? "", prev?.userIntent ?? "", userText, assistantText);
    const raw = await client.generate(settings.summaryModel, prompt, { temperature: 0.2 });
    const parsed = extractJson(raw);
    const next = {
      sessionId,
      // If the model call failed to parse, keep the previous digest rather
      // than losing it, and fall back to a plain append so the turn isn't
      // silently dropped from the running context.
      summary: parsed?.summary?.trim() || `${prev?.summary ?? ""}${prev?.summary ? " " : ""}${userText}`.trim(),
      userIntent: parsed?.userIntent?.trim() || prev?.userIntent || "",
      // Stored as-is (no LLM round trip) so the most recent question and
      // answer are always available verbatim, independent of how well
      // the narrative `summary` above captured them.
      lastUserText: userText,
      lastAssistantText: assistantText,
      turnsSummarized: (prev?.turnsSummarized ?? 0) + 1,
      updatedAt: Date.now()
    };
    this.data[sessionId] = next;
    await this.persist();
    return next;
  }
  async clearSession(sessionId) {
    if (!this.data[sessionId])
      return;
    delete this.data[sessionId];
    await this.persist();
  }
  async clearAll() {
    for (const id of Object.keys(this.data))
      delete this.data[id];
    await this.persist();
  }
};

// src/activeFileTracker.ts
var import_obsidian6 = require("obsidian");
var ActiveFileTracker = class {
  constructor(app) {
    this.app = app;
    this.lastFile = null;
    this.lastFile = app.workspace.getActiveViewOfType(import_obsidian6.MarkdownView)?.file ?? null;
  }
  /** Wire this to `workspace.on("active-leaf-change", ...)` in onload(). */
  handleActiveLeafChange(leaf) {
    if (leaf?.view instanceof import_obsidian6.MarkdownView && leaf.view.file) {
      this.lastFile = leaf.view.file;
    }
  }
  /**
   * The file Obsidian currently reports as active if it has one (the
   * common case — an actual note is focused); otherwise the last note that
   * was genuinely focused before focus moved elsewhere (e.g. into the
   * chat panel). Never returns a file that's since been deleted/renamed
   * away out from under the cache.
   */
  getFile() {
    const active = this.app.workspace.getActiveFile();
    if (active)
      return active;
    if (this.lastFile && this.app.vault.getAbstractFileByPath(this.lastFile.path) === this.lastFile) {
      return this.lastFile;
    }
    return null;
  }
};

// src/hierarchicalQuery.ts
function extractJson2(raw) {
  const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match)
    return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
async function resolveFromLayers(memory, query, intent, client, settings, token) {
  if (memory.layers.length === 0) {
    return { text: memory.original, layerUsed: "Original" };
  }
  throwIfCancelled(token);
  const listing = memory.layers.map((layer2) => `- layer index: ${layer2.index}
  name: "${layer2.name}"
  text: ${layer2.text}`).join("\n");
  const prompt = `Question: "${query}"
What the user specifically needs: ${intent}

Here are ALL the abstraction layers of a source, from least detailed (layer index 0, the Overview) to most detailed (layer index ${memory.layers.length - 1}, the Comprehensive Summary):
${listing}

Choose the LOWEST-numbered layer index that, on its own, is detailed enough to fully address what the user specifically needs. Only move to a higher (more detailed) layer index if the lower ones genuinely lack the needed detail. If even the most detailed layer above still isn't enough, respond with "need_original" instead \u2014 that pulls in the complete, unmodified source text.

Respond with ONLY JSON: {"choice": <layer index number>} or {"choice": "need_original"}.`;
  const raw = await client.generate(settings.summaryModel, prompt, { temperature: 0.1 });
  const parsed = extractJson2(raw);
  const layer = selectLayer(memory.layers, parsed?.choice);
  if (layer) {
    return { text: layer.text, layerUsed: layer.name };
  }
  return { text: memory.original, layerUsed: "Original" };
}
function selectLayer(layers, choice) {
  if (choice === void 0)
    return void 0;
  if (typeof choice === "number") {
    return layers.find((l) => l.index === choice);
  }
  if (choice === "need_original")
    return void 0;
  const n = Number(choice);
  return Number.isNaN(n) ? void 0 : layers.find((l) => l.index === n);
}
function frontierKey(item) {
  return `${item.source.key}::${item.layerIndex}`;
}
async function evaluateFrontier(client, settings, query, intent, frontier) {
  const listing = frontier.map((item) => {
    const layer = item.source.memory.layers[item.layerIndex];
    return `- key: ${frontierKey(item)}
  source: ${item.source.label}
  layer: ${layer.name}
  summary: ${layer.text}`;
  }).join("\n");
  const prompt = `You are searching several sources at once, each shown at its LEAST detailed available layer for this round.

Question: "${query}"
What the user specifically needs: ${intent}

Items:
${listing}

For EACH item, decide one of:
- "irrelevant" \u2014 this source has nothing to do with what the user specifically needs; skip it entirely.
- "sufficient" \u2014 this layer alone is detailed enough to address what the user specifically needs; keep it as-is.
- "descend" \u2014 this source seems relevant but this layer isn't detailed enough; fetch the next, more detailed layer of this SAME source.

Respond with ONLY a JSON array covering every item above: [{"key": "<key>", "verdict": "irrelevant"|"sufficient"|"descend"}, ...]`;
  const raw = await client.generate(settings.summaryModel, prompt, { temperature: 0.1 });
  const map = /* @__PURE__ */ new Map();
  const arr = extractJson2(raw);
  if (Array.isArray(arr)) {
    for (const entry of arr) {
      if (entry.key && (entry.verdict === "irrelevant" || entry.verdict === "sufficient" || entry.verdict === "descend")) {
        map.set(entry.key, entry.verdict);
      }
    }
  }
  return map;
}
async function resolveAcrossSources(sources, query, intent, client, settings, maxResults, token) {
  let frontier = sources.filter((s) => s.memory.layers.length > 0).map((s) => ({ source: s, layerIndex: 0 }));
  const results = [];
  while (frontier.length > 0) {
    throwIfCancelled(token);
    const verdicts = await evaluateFrontier(client, settings, query, intent, frontier);
    const nextFrontier = [];
    for (const item of frontier) {
      const layer = item.source.memory.layers[item.layerIndex];
      const atDeepestLayer = item.layerIndex === item.source.memory.layers.length - 1;
      const verdict = verdicts.get(frontierKey(item)) ?? "descend";
      if (verdict === "irrelevant")
        continue;
      if (verdict === "sufficient") {
        results.push({ key: item.source.key, label: item.source.label, text: layer.text, layerUsed: layer.name });
        continue;
      }
      if (atDeepestLayer) {
        results.push({ key: item.source.key, label: item.source.label, text: item.source.memory.original, layerUsed: "Original" });
        continue;
      }
      nextFrontier.push({ source: item.source, layerIndex: item.layerIndex + 1 });
    }
    frontier = nextFrontier;
    if (results.length >= maxResults)
      break;
  }
  const merged = /* @__PURE__ */ new Map();
  for (const r of results) {
    const existing = merged.get(r.key);
    if (existing) {
      existing.text = `${existing.text}
${r.text}`;
    } else {
      merged.set(r.key, { ...r });
    }
  }
  return Array.from(merged.values()).slice(0, maxResults);
}

// src/memoryRouter.ts
function extractJsonArray(raw) {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match)
    return null;
  try {
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr) ? arr.map(String) : null;
  } catch {
    return null;
  }
}
async function routeByLlm(client, settings, query, candidates) {
  if (candidates.length === 0)
    return [];
  const listing = candidates.map((t) => `- id: ${t.id}
  name: ${t.name}
  overview: ${t.overview}`).join("\n");
  const prompt = `A user asked: "${query}"

Here are memory topics available, each with a short overview:
${listing}

List the ids of the topics (at most ${settings.maxMemoriesPerQuery}) that are actually relevant to answering or informing a response to this question. Order them from most to least relevant. If none are relevant, return an empty array.

Respond with ONLY a JSON array of id strings, nothing else.`;
  const raw = await client.generate(settings.summaryModel, prompt, { temperature: 0.1 });
  const ids = extractJsonArray(raw) ?? [];
  const byId = new Map(candidates.map((t) => [t.id, t]));
  const result = [];
  for (const id of ids) {
    const t = byId.get(id);
    if (t)
      result.push({ topic: t, score: 1 });
  }
  return result.slice(0, settings.maxMemoriesPerQuery);
}
async function routeByEmbedding(client, settings, query, candidates, overviewEmbeddings) {
  if (candidates.length === 0)
    return [];
  const queryVec = await client.embed(settings.embeddingModel, query);
  const scored = [];
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
async function routeMemories(client, settings, query, allTopics, overviewEmbeddings) {
  if (allTopics.length === 0)
    return [];
  if (settings.routingMethod === "embedding") {
    return routeByEmbedding(client, settings, query, allTopics, overviewEmbeddings);
  }
  if (settings.routingMethod === "llm") {
    return routeByLlm(client, settings, query, allTopics);
  }
  const shortlistSize = Math.max(settings.maxMemoriesPerQuery * 2, settings.maxMemoriesPerQuery + 2);
  const shortlisted = await routeByEmbedding(
    client,
    { ...settings, maxMemoriesPerQuery: shortlistSize, similarityThreshold: 0 },
    query,
    allTopics,
    overviewEmbeddings
  );
  if (shortlisted.length === 0)
    return [];
  return routeByLlm(client, settings, query, shortlisted.map((s) => s.topic));
}
function extractJsonObj(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match)
    return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
async function findBestMatchingTopic(client, settings, candidateOverview, candidateName, allTopics, overviewEmbeddings) {
  if (allTopics.length === 0)
    return void 0;
  const queryVec = await client.embed(settings.embeddingModel, candidateOverview);
  const scored = [];
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
  if (!best)
    return void 0;
  if (best.score >= settings.similarityThreshold)
    return best.topic;
  const borderlineFloor = Math.max(0, settings.similarityThreshold - 0.15);
  const borderline = scored.filter((s) => s.score >= borderlineFloor).slice(0, 5);
  if (borderline.length === 0)
    return void 0;
  const listing = borderline.map((s) => `- id: ${s.topic.id}
  name: ${s.topic.name}
  overview: ${s.topic.overview}`).join("\n");
  const prompt = `New content overview: "${candidateOverview}" (candidate name: "${candidateName}")

Possibly-related existing topics:
${listing}

Does the new content belong under one of these existing topics (same subject), or is it distinct enough to be its own topic?
Respond with ONLY JSON: {"matchId": "<one of the ids above, or null>"}`;
  const raw = await client.generate(settings.summaryModel, prompt, { temperature: 0.1 });
  const parsed = extractJsonObj(raw);
  if (!parsed?.matchId)
    return void 0;
  return borderline.find((s) => s.topic.id === parsed.matchId)?.topic;
}

// src/fileSkills.ts
var import_obsidian7 = require("obsidian");
var FileSkills = class {
  constructor(app, activeFileTracker) {
    this.app = app;
    this.activeFileTracker = activeFileTracker;
  }
  async readFile(path) {
    const file = this.app.vault.getAbstractFileByPath((0, import_obsidian7.normalizePath)(path));
    if (!(file instanceof import_obsidian7.TFile))
      throw new Error(`Not a file: ${path}`);
    return this.app.vault.read(file);
  }
  async writeFile(path, content) {
    const normalized = (0, import_obsidian7.normalizePath)(path);
    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (existing instanceof import_obsidian7.TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(normalized, content);
    }
  }
  async appendToFile(path, content) {
    const normalized = (0, import_obsidian7.normalizePath)(path);
    const existing = this.app.vault.getAbstractFileByPath(normalized);
    if (existing instanceof import_obsidian7.TFile) {
      await this.app.vault.append(existing, content);
    } else {
      await this.app.vault.create(normalized, content);
    }
  }
  async listMarkdownFiles(folder) {
    const all = this.app.vault.getMarkdownFiles();
    if (!folder)
      return all;
    const prefix = (0, import_obsidian7.normalizePath)(folder) + "/";
    return all.filter((f) => f.path.startsWith(prefix));
  }
  getActiveFile() {
    return this.activeFileTracker?.getFile() ?? this.app.workspace.getActiveFile();
  }
};

// src/orchestrator.ts
function extractJson3(raw) {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match)
    return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
var ACTIVE_NOTE_REFERENCE = /\b(this|the current|the open)\s+(note|page|document|file)\b/i;
var MEMORY_COMMAND_HINT = /\b(remember|note (this|that) down|make a memory|save (this|that)|add (this|that) to memory|keep (this|that) in mind|memorize)\b/i;
var RESPONSE_STYLE_GUIDELINES = `You are a thoughtful, conversational AI assistant. Your goal is to give complete, useful answers without being verbose.
- Answer the user's question directly before giving any explanation.
- Use natural, human-like language instead of sounding like a textbook.
- Match the user's tone and level of detail.
- Length should follow the question, not a fixed target: a quick question earns a short answer, but if the question has several parts or genuinely needs support (reasoning, an example, a caveat) to be useful, include it rather than cutting it for brevity's sake. Don't truncate or leave a part of the question unaddressed just to keep the reply short.
- Don't repeat the user's question.
- Don't explain obvious concepts unless they ask.
- Avoid unnecessary bullet points.
- If you're unsure, say so instead of guessing.
- If there are multiple reasonable answers, recommend one and briefly explain why \u2014 but mention real alternatives when they matter.
- When the user is chatting casually, respond casually. When they ask technical questions, be precise and thorough enough to actually be useful.
- Prefer one strong answer over a hedge across several possibilities.
- Don't begin with "Certainly!", "Of course!", or "Absolutely!" unless it feels natural.
- Don't summarize what you're about to say. Don't end every response with an offer to help further.
- Avoid generic safety disclaimers unless they're actually relevant.
- Don't write like documentation. Write like an experienced colleague \u2014 one who finishes their thought instead of trailing off.`;
var Orchestrator = class {
  constructor(app, client, settings, memory, tempMemory, noteMemory, chatHistory, activeFileTracker) {
    this.app = app;
    this.client = client;
    this.settings = settings;
    this.memory = memory;
    this.tempMemory = tempMemory;
    this.noteMemory = noteMemory;
    this.chatHistory = chatHistory;
    this.overviewEmbeddings = /* @__PURE__ */ new Map();
    this.files = new FileSkills(app, activeFileTracker);
  }
  // ---- Ingestion: turn a vault file into (or into a growth of) a memory topic ----
  // Every memory topic, whether it started from a file or a chat fact, is
  // always backed by a fixed stack of named abstraction layers — the
  // topic's files are always regenerated from that layered memory, never
  // written by hand.
  async ingestFile(file, onProgress, token) {
    const content = await this.app.vault.read(file);
    onProgress?.(`Checking whether "${file.basename}" belongs to an existing topic...`);
    const quick = await quickOverview(this.client, this.settings, content);
    throwIfCancelled(token);
    const existing = await this.matchExistingTopic(file.basename, quick);
    const reportProgress = (p) => onProgress?.(p.status === "starting" ? `${p.phase}...` : `${p.phase} \u2014 done`);
    if (existing) {
      onProgress?.(`Growing existing topic "${existing.name}"...`);
      return this.memory.appendRawContent(existing.id, content, this.client, this.settings, reportProgress, token);
    }
    onProgress?.(`Building new topic "${file.basename}"...`);
    return this.memory.createTopicFromText(file.basename, content, this.client, this.settings, reportProgress, token);
  }
  /** Embedding-first, LLM-confirmed-only-when-borderline topic matching (see memoryRouter.findBestMatchingTopic for why). */
  async matchExistingTopic(candidateName, overview) {
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
  async detectMemoryCommand(message, recentHistory = [], sessionSummary) {
    if (!MEMORY_COMMAND_HINT.test(message))
      return null;
    const historyText = recentHistory.slice(-6).map((m) => `${m.role}: ${m.content}`).join("\n");
    const summaryText = sessionSummary ? `${sessionSummary}

` : "";
    const prompt = `${summaryText}Recent conversation (may be empty):
${historyText || "(none)"}

Latest message: "${message}"

Is the latest message an explicit request to remember/save/note something down for later (not just a question)? If yes, extract the actual content to remember \u2014 pull in relevant detail from the recent conversation above if the message refers back to it (e.g. "remember that" pointing at something just discussed) \u2014 and a short topic name hint if one is obvious.

Respond with ONLY JSON: {"isMemoryCommand": true|false, "content": "<the fact/content to remember, or null>", "topicHint": "<short topic name, or null>"}`;
    const raw = await this.client.generate(this.settings.summaryModel, prompt, { temperature: 0.1 });
    const parsed = extractJson3(raw);
    if (!parsed?.isMemoryCommand || !parsed.content)
      return null;
    return { content: parsed.content, topicHint: parsed.topicHint ?? void 0 };
  }
  /** Commits an explicit memory command directly — matches against ALL topics (not just this turn's routed ones), then extends or creates. No staging, no confirm card. */
  async createOrUpdateMemoryDirectly(content, topicHint, token) {
    const quick = await quickOverview(this.client, this.settings, content);
    throwIfCancelled(token);
    const candidateName = topicHint ?? quick.slice(0, 60);
    const existing = await this.matchExistingTopic(candidateName, quick);
    if (existing) {
      return this.memory.appendRawContent(existing.id, content, this.client, this.settings, void 0, token);
    }
    return this.memory.createTopicFromText(candidateName, content, this.client, this.settings, void 0, token);
  }
  // ---- Query-time: extract intent, route, search layer-by-layer, answer ----
  async handleQuery(query, history = [], opts) {
    const sessionSummaryText = this.settings.trackChatSummary ? this.chatHistory.inlineText(opts.sessionId) : void 0;
    const sessionSummaryBlock = this.settings.trackChatSummary ? this.chatHistory.contextBlock(opts.sessionId) : void 0;
    const cappedHistory = this.settings.trackChatSummary && sessionSummaryBlock ? history.slice(-Math.max(2, this.settings.recentRawTurns)) : history;
    const wantsActiveNote = opts.includeActiveNote || ACTIVE_NOTE_REFERENCE.test(query);
    const activeNoteFile = wantsActiveNote ? this.files.getActiveFile() : null;
    const noteMirror = activeNoteFile ? this.noteMemory.get(activeNoteFile.path) : void 0;
    if (!opts.skipClarification) {
      const memoryIntent = await this.detectMemoryCommand(query, cappedHistory, sessionSummaryText);
      if (memoryIntent) {
        const topic = await this.createOrUpdateMemoryDirectly(memoryIntent.content, memoryIntent.topicHint, opts.token);
        return {
          answer: `Got it \u2014 saved to memory under "${topic.name}".`,
          usedTopics: [],
          memoryCommitted: { topic }
        };
      }
    }
    const intent = this.settings.enableIntentExtraction ? await extractQueryIntent(this.client, this.settings, query, cappedHistory, sessionSummaryText) : query;
    throwIfCancelled(opts.token);
    const topics = this.memory.listTopics();
    const routed = await routeMemories(this.client, this.settings, query, topics, this.overviewEmbeddings);
    throwIfCancelled(opts.token);
    const contextBlocks = [];
    if (sessionSummaryBlock)
      contextBlocks.push(sessionSummaryBlock);
    const layeredSources = [];
    for (const r of routed) {
      const memory = this.memory.getMemory(r.topic.id);
      if (memory)
        layeredSources.push({ key: r.topic.id, label: r.topic.name, memory });
    }
    if (layeredSources.length > 0) {
      const resolved = await resolveAcrossSources(layeredSources, query, intent, this.client, this.settings, this.settings.maxMemoriesPerQuery, opts.token);
      for (const r of resolved)
        contextBlocks.push(`### ${r.label} (${r.layerUsed})
${r.text}`);
    }
    throwIfCancelled(opts.token);
    const sessionEntries = this.tempMemory.listForSession(opts.sessionId);
    if (sessionEntries.length > 0) {
      const lines = sessionEntries.map((e, i) => `${i === 0 ? "[most recent] " : ""}- ${e.fact}`);
      contextBlocks.push(
        `### Notes from this chat (not yet saved to memory \u2014 newest first; if they conflict with older notes or with permanent memory, trust the newest)
${lines.join("\n")}`
      );
    }
    let noteMemoryUsed;
    if (wantsActiveNote && activeNoteFile) {
      if (noteMirror) {
        const resolved = await resolveFromLayers(noteMirror.memory, query, intent, this.client, this.settings, opts.token);
        contextBlocks.push(
          `### The note currently open in Obsidian, "${activeNoteFile.basename}" (${resolved.layerUsed}) \u2014 the user may call it "this note" or "the current note"
${resolved.text}`
        );
        noteMemoryUsed = { filePath: activeNoteFile.path, fileName: activeNoteFile.basename };
      } else {
        const raw = await this.app.vault.read(activeNoteFile);
        const cap = DIRECT_SUMMARIZE_CHAR_CAP * 3;
        const text = raw.length > cap ? `${raw.slice(0, cap)}
...[truncated]` : raw;
        contextBlocks.push(`### The note currently open in Obsidian, "${activeNoteFile.basename}"
${text}`);
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
    const intentLine = this.settings.enableIntentExtraction ? `

What the user is specifically asking for right now: ${intent}` : "";
    const systemPrompt = contextBlocks.length ? `${RESPONSE_STYLE_GUIDELINES}${intentLine}

You also have access to the user's memory notes below. Use them if useful to answer precisely and specifically; ignore anything irrelevant. If the user says "this note" or "the current note", they mean the note context block below, if one is present.

${contextBlocks.join("\n\n")}` : `${RESPONSE_STYLE_GUIDELINES}${intentLine}`;
    const messages = [
      { role: "system", content: systemPrompt },
      ...cappedHistory,
      { role: "user", content: query }
    ];
    throwIfCancelled(opts.token);
    const answer = await this.client.chat(this.settings.chatModel, messages);
    throwIfCancelled(opts.token);
    let pendingEntry;
    if (this.settings.suggestMemoryUpdates) {
      pendingEntry = await this.stageMemoryCandidate(query, answer, routed, opts.sessionId);
    }
    return { answer, usedTopics: routed, pendingEntries: pendingEntry ? [pendingEntry] : void 0, noteMemoryUsed };
  }
  /**
   * Called when the user replies to a clarifying question. The reply is
   * staged into temp-memory (visible, but not yet permanent) and
   * immediately used as context to actually answer the original query.
   */
  async provideClarification(originalQuery, clarificationText, history, sessionId, token) {
    const quick = await quickOverview(this.client, this.settings, clarificationText);
    throwIfCancelled(token);
    const matched = await this.matchExistingTopic("Clarification", quick);
    const entry = await this.tempMemory.create({
      sessionId,
      action: matched ? "extend" : "new",
      topicId: matched?.id,
      topicName: matched ? matched.name : quick.slice(0, 60),
      fact: clarificationText,
      sourceQuery: originalQuery
    });
    const result = await this.handleQuery(originalQuery, history, { sessionId, skipClarification: true, token });
    result.pendingEntries = [entry, ...result.pendingEntries ?? []];
    return result;
  }
  /**
   * Decides whether a query depends on personal/contextual information
   * ("my project", "that thing I mentioned", "update the plan") that the
   * gathered context doesn't sufficiently cover — in which case it's better
   * to ask the user than to guess.
   */
  async checkAmbiguity(query, intent, contextBlocks) {
    const contextText = contextBlocks.length ? contextBlocks.join("\n\n") : "(no memory context available)";
    const prompt = `Context available:
${contextText}

User question: "${query}"
What the user specifically needs: ${intent}

Does answering what the user specifically needs require personal or contextual information (e.g. "my project", "that thing", "the plan") that the context above does NOT sufficiently cover, making it ambiguous or hard to answer well without asking for more detail? A standalone general-knowledge question, or one already covered by the context, does NOT need clarification.

Respond with ONLY JSON: {"needsClarification": true|false, "clarifyingQuestion": "<question to ask, or null>"}`;
    const raw = await this.client.generate(this.settings.summaryModel, prompt, { temperature: 0.1 });
    const parsed = extractJson3(raw);
    if (!parsed)
      return { needsClarification: false };
    return { needsClarification: !!parsed.needsClarification, clarifyingQuestion: parsed.clarifyingQuestion ?? void 0 };
  }
  /**
   * Loose duplicate check: token-overlap (Jaccard-style) similarity, used
   * as a programmatic safety net on top of the LLM's own "already known?"
   * judgment, so a fact that just restates something already remembered
   * (or already staged this chat) doesn't get suggested again turn after
   * turn even if the model's instruction-following slips.
   */
  factsAreSimilar(a, b) {
    const tokenize = (s) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).filter(Boolean));
    const sa = tokenize(a);
    const sb = tokenize(b);
    if (sa.size === 0 || sb.size === 0)
      return false;
    let overlap = 0;
    for (const w of sa)
      if (sb.has(w))
        overlap++;
    const union = (/* @__PURE__ */ new Set([...sa, ...sb])).size;
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
  async stageMemoryCandidate(query, answer, routed, sessionId) {
    const pendingThisSession = this.tempMemory.listForSession(sessionId);
    const topicList = routed.map((r) => {
      const alreadyPending = pendingThisSession.filter((e) => e.action === "extend" && e.topicId === r.topic.id).map((e) => `  - (already staged, unconfirmed) ${e.fact}`).join("\n");
      return `- id: ${r.topic.id}
  name: ${r.topic.name}
  already known (existing memory overview): ${r.topic.overview}${alreadyPending ? `
${alreadyPending}` : ""}`;
    }).join("\n");
    const pendingNewTopics = pendingThisSession.filter((e) => e.action === "new").map((e) => `- "${e.topicName}": ${e.fact}`).join("\n");
    const prompt = `Conversation turn:
User: ${query}
Assistant: ${answer}

Candidate memory topics this turn touched, with what's already captured about each one (from permanent memory, and from facts already staged-but-unconfirmed earlier in this chat):
${topicList || "(none)"}

Other new topics already staged this chat, not yet confirmed:
${pendingNewTopics || "(none)"}

Does this turn contain a durable fact worth remembering that is NOT already captured above \u2014 i.e. it adds genuinely new information, or updates/corrects something already known? If it just restates, rephrases, or is already covered by what's listed above, that does NOT count.
- If it's new/changed info that fits one of the candidate topics above, respond: {"action": "extend", "topicId": "<id>", "fact": "<the fact, one or two sentences>"}
- If it's new/changed info that doesn't fit any candidate topic, respond: {"action": "new", "topicName": "<short topic name>", "fact": "<the fact, one or two sentences>"}
- If nothing new or changed came up, respond: {"action": "none"}
Respond with ONLY the JSON, nothing else.`;
    const raw = await this.client.generate(this.settings.summaryModel, prompt, { temperature: 0.1 });
    const parsed = extractJson3(raw);
    if (!parsed || parsed.action === "none" || !parsed.fact)
      return void 0;
    if (parsed.action === "extend" && parsed.topicId) {
      const topic = routed.find((r) => r.topic.id === parsed.topicId)?.topic ?? this.memory.getTopic(parsed.topicId);
      if (!topic)
        return void 0;
      const alreadyKnown = [
        topic.overview,
        ...pendingThisSession.filter((e) => e.action === "extend" && e.topicId === topic.id).map((e) => e.fact)
      ];
      if (alreadyKnown.some((known) => this.factsAreSimilar(known, parsed.fact)))
        return void 0;
      return this.tempMemory.create({
        sessionId,
        action: "extend",
        topicId: topic.id,
        topicName: topic.name,
        fact: parsed.fact,
        sourceQuery: query
      });
    }
    if (parsed.action === "new" && parsed.topicName) {
      const alreadyStagedForSameTopic = pendingThisSession.filter((e) => e.action === "new" && e.topicName?.toLowerCase() === parsed.topicName?.toLowerCase()).map((e) => e.fact);
      if (alreadyStagedForSameTopic.some((known) => this.factsAreSimilar(known, parsed.fact)))
        return void 0;
      return this.tempMemory.create({
        sessionId,
        action: "new",
        topicName: parsed.topicName,
        fact: parsed.fact,
        sourceQuery: query
      });
    }
    return void 0;
  }
  /** Commits a pending temp-memory entry into permanent, layered memory, then removes it. */
  async confirmTempEntry(id, token) {
    const entry = this.tempMemory.get(id);
    if (!entry)
      throw new Error("This pending memory entry no longer exists.");
    let topic;
    if (entry.action === "extend" && entry.topicId && this.memory.getTopic(entry.topicId)) {
      topic = await this.memory.appendRawContent(entry.topicId, entry.fact, this.client, this.settings, void 0, token);
    } else {
      topic = await this.memory.createTopicFromText(entry.topicName ?? "New topic", entry.fact, this.client, this.settings, void 0, token);
    }
    await this.tempMemory.discard(id);
    return topic;
  }
  async discardTempEntry(id) {
    await this.tempMemory.discard(id);
  }
  /** Wraps summarizer.generateShortTitle so ChatView doesn't need its own reference to client/settings for this. */
  async generateSessionTitle(firstMessage) {
    return generateShortTitle(this.client, this.settings, firstMessage);
  }
  /**
   * Folds one completed user/assistant turn into that session's rolling
   * summary + inferred-user-intent digest (see ChatHistoryStore). Called
   * once a turn is actually recorded — not on a clarifying question, which
   * isn't a finished exchange yet. Best-effort: a failed digest update
   * never surfaces as a chat error, since the chat itself already succeeded.
   */
  async updateSessionHistory(sessionId, userText, assistantText) {
    if (!this.settings.trackChatSummary)
      return;
    try {
      await this.chatHistory.update(sessionId, userText, assistantText, this.client, this.settings);
    } catch {
    }
  }
  /** Explicit "clear/restart temp-memory" for one chat session — distinct from starting a whole new chat. */
  async clearSessionTempMemory(sessionId) {
    await this.tempMemory.clearSession(sessionId);
  }
  /** Called when a chat session is pruned from history entirely, so its temp-memory doesn't linger forever either. */
  async clearPrunedSessionTempMemory(sessionId) {
    await this.tempMemory.clearSession(sessionId);
  }
};

// src/chatView.ts
var import_obsidian8 = require("obsidian");
var CHAT_VIEW_TYPE = "ollama-orchestrator-chat";
var NEAR_BOTTOM_THRESHOLD_PX = 80;
var INPUT_MAX_HEIGHT_PX = 160;
var LONG_NOTE_PROMPT_THRESHOLD_CHARS = DIRECT_SUMMARIZE_CHAR_CAP;
var ChatView = class extends import_obsidian8.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    /** Set to the original question while we're waiting for the user's answer to a clarifying question. */
    this.awaitingClarificationFor = null;
    /** "Reading page" mode (active note included) vs "memories only". Defaults to including the active note. */
    this.includeActiveNote = true;
    /** true while a request to the LLM is in flight — blocks sending another one. */
    this.busy = false;
    this.historyVisible = false;
    /** whichever long-running operation is currently in flight, if any — the send/cancel button targets this. */
    this.currentCancellation = null;
    this.plugin = plugin;
  }
  getViewType() {
    return CHAT_VIEW_TYPE;
  }
  getDisplayText() {
    return "The Librarium";
  }
  getIcon() {
    return "message-circle";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("ollama-orchestrator-chat");
    this.toolbar = container.createDiv({ cls: "ooc-toolbar" });
    this.historyPanel = container.createDiv({ cls: "ooc-history-panel" });
    this.historyPanel.style.display = "none";
    this.buildToolbar();
    const messagesWrapper = container.createDiv({ cls: "ooc-messages-wrapper" });
    this.messagesEl = messagesWrapper.createDiv({ cls: "ooc-messages" });
    this.messagesEl.addEventListener("scroll", () => this.updateScrollButtonVisibility());
    this.scrollBtn = messagesWrapper.createDiv({ cls: "ooc-scroll-btn" });
    (0, import_obsidian8.setIcon)(this.scrollBtn, "arrow-down");
    this.scrollBtn.setAttr("title", "Jump to latest");
    this.scrollBtn.addEventListener("click", () => this.scrollToBottom(true));
    this.statusEl = container.createDiv({ cls: "ooc-status" });
    const inputRow = container.createDiv({ cls: "ooc-input-row" });
    this.inputEl = inputRow.createEl("textarea", {
      attr: { rows: "1", placeholder: 'Ask something, or say "remember that..." to note something down.' }
    });
    this.sendBtn = inputRow.createEl("button", { cls: "ooc-send-btn" });
    (0, import_obsidian8.setIcon)(this.sendBtn, "send");
    this.sendBtn.setAttr("aria-label", "Send");
    container.createDiv({ cls: "ooc-input-hint", text: "Enter to send \xB7 Shift+Enter for a new line" });
    this.sendBtn.addEventListener("click", () => {
      if (this.busy) {
        this.requestCancel();
      } else {
        this.send();
      }
    });
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.send();
      }
    });
    this.inputEl.addEventListener("input", () => this.autoResizeInput());
    const existing = this.plugin.chatSessionStore.list()[0];
    this.session = existing ?? this.plugin.chatSessionStore.create();
    this.loadSessionIntoView();
    this.inputEl.focus();
  }
  iconButton(container, icon, label, onClick) {
    const btn = container.createEl("button", { cls: "ooc-icon-btn" });
    (0, import_obsidian8.setIcon)(btn, icon);
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
  buildNoteMemoryButton(container) {
    const btn = container.createEl("button", { cls: "ooc-icon-btn" });
    const refreshLabel = () => {
      const file = this.plugin.activeFileTracker.getFile();
      const hasMemory = !!(file && this.plugin.noteMemoryStore.get(file.path));
      const label = !file ? "Build note memory for the active note" : hasMemory ? `Rebuild note memory for "${file.basename}" (already built)` : `Build note memory for "${file.basename}" (not built yet)`;
      (0, import_obsidian8.setIcon)(btn, hasMemory ? "refresh-cw" : "database");
      btn.setAttr("title", label);
      btn.setAttr("aria-label", label);
    };
    refreshLabel();
    btn.addEventListener("mouseenter", refreshLabel);
    btn.addEventListener("click", () => {
      const file = this.plugin.activeFileTracker.getFile();
      if (!file) {
        new import_obsidian8.Notice("No note is currently open.");
        return;
      }
      this.runNoteMemorySync(file, "full");
    });
    return btn;
  }
  buildToolbar() {
    this.toolbar.empty();
    this.iconButton(this.toolbar, "plus", "New chat", () => this.startNewChat());
    this.iconButton(this.toolbar, "history", "Chat history", () => this.toggleHistoryPanel());
    this.iconButton(this.toolbar, "trash-2", "Clear this chat's temp-memory (keeps the conversation)", () => this.clearTempMemory());
    this.buildNoteMemoryButton(this.toolbar);
    const modeLabel = this.toolbar.createEl("label", { cls: "ooc-mode-toggle" });
    modeLabel.setAttr("title", "Include the currently open note as context for this chat.");
    const modeCheckbox = modeLabel.createEl("input", { attr: { type: "checkbox" } });
    modeCheckbox.checked = this.includeActiveNote;
    modeLabel.createSpan({ text: "Include note" });
    modeCheckbox.addEventListener("change", () => {
      this.includeActiveNote = modeCheckbox.checked;
    });
  }
  // ---- Chat history: list, switch, delete, auto-title ----
  toggleHistoryPanel() {
    this.historyVisible = !this.historyVisible;
    this.historyPanel.style.display = this.historyVisible ? "flex" : "none";
    if (this.historyVisible)
      this.renderHistoryPanel();
  }
  renderHistoryPanel() {
    this.historyPanel.empty();
    const sessions = this.plugin.chatSessionStore.list();
    if (sessions.length === 0) {
      this.historyPanel.createDiv({ cls: "ooc-history-empty", text: "No saved chats yet \u2014 send a message to start one." });
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
        const preview = lastMessage.content.length > 64 ? `${lastMessage.content.slice(0, 64)}\u2026` : lastMessage.content;
        titleWrap.createDiv({ cls: "ooc-history-preview", text: preview });
      }
      row.createDiv({ cls: "ooc-history-time", text: this.relativeTime(s.updatedAt) });
      const delBtn = row.createEl("button", { cls: "ooc-history-delete" });
      (0, import_obsidian8.setIcon)(delBtn, "x");
      delBtn.setAttr("title", "Delete this chat");
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this.deleteSession(s.id);
      });
    }
  }
  relativeTime(ts) {
    const mins = Math.round((Date.now() - ts) / 6e4);
    if (mins < 1)
      return "just now";
    if (mins < 60)
      return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24)
      return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }
  loadSessionIntoView() {
    this.messagesEl.empty();
    this.awaitingClarificationFor = null;
    this.statusEl.setText('Chatting with memories only. Check "Include note" to also read the active page.');
    if (this.session.messages.length === 0) {
      this.renderEmptyState();
    }
    for (const m of this.session.messages)
      this.appendMessage(m.role, m.content);
    for (const entry of this.plugin.tempMemoryStore.listForSession(this.session.id).reverse()) {
      this.renderPendingCard(entry);
    }
    if (this.historyVisible)
      this.renderHistoryPanel();
    this.scrollToBottom(true);
  }
  renderEmptyState() {
    const empty = this.messagesEl.createDiv({ cls: "ooc-empty-state" });
    empty.createDiv({ cls: "ooc-empty-state-title", text: "Start chatting" });
    empty.createDiv({
      cls: "ooc-empty-state-sub",
      text: 'Ask something, or say "remember that..." to note something down. Your memories, and the current note if included, ground every answer.'
    });
  }
  /** Switches to a fresh draft session — invisible in history and never persisted unless a message is actually sent in it. */
  startNewChat() {
    if (this.busy)
      return;
    this.session = this.plugin.chatSessionStore.create();
    this.loadSessionIntoView();
    this.inputEl.focus();
  }
  switchSession(id) {
    if (this.busy)
      return;
    const target = this.plugin.chatSessionStore.get(id);
    if (!target)
      return;
    this.session = target;
    this.loadSessionIntoView();
  }
  async deleteSession(id) {
    if (this.busy)
      return;
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
  async clearTempMemory() {
    if (this.busy)
      return;
    this.setBusy(true);
    try {
      await this.plugin.orchestrator.clearSessionTempMemory(this.session.id);
      this.loadSessionIntoView();
      this.statusEl.setText("This chat's temp-memory was cleared. Conversation history is untouched.");
    } catch (err) {
      this.statusEl.setText(`Error clearing temp-memory: ${err.message}`);
    } finally {
      this.setBusy(false);
    }
  }
  // ---- Busy / loading state ----
  setBusy(busy) {
    this.busy = busy;
    this.inputEl.disabled = busy;
    this.sendBtn.disabled = false;
    (0, import_obsidian8.setIcon)(this.sendBtn, busy ? "square" : "send");
    this.sendBtn.setAttr("title", busy ? "Cancel" : "Send");
    this.sendBtn.setAttr("aria-label", busy ? "Cancel" : "Send");
    this.sendBtn.toggleClass("ooc-send-btn-busy", busy);
    this.messagesEl.toggleClass("ooc-busy", busy);
    this.toolbar.toggleClass("ooc-toolbar-busy", busy);
    this.toolbar.querySelectorAll("button, input").forEach((el) => {
      el.disabled = busy;
    });
    this.historyPanel.toggleClass("ooc-history-busy", busy);
    this.historyPanel.querySelectorAll("button").forEach((el) => {
      el.disabled = busy;
    });
  }
  /** Can't truly abort an in-flight HTTP call to Ollama (no signal support), but this stops any further steps of a multi-step build/search from starting, and the UI discards whatever single call is still finishing in the background instead of acting on it. */
  requestCancel() {
    if (!this.currentCancellation || this.currentCancellation.isCancelled)
      return;
    this.currentCancellation.cancel();
    this.statusEl.setText("Cancelling\u2026");
  }
  // ---- Scrolling ----
  isNearBottom() {
    const el = this.messagesEl;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD_PX;
  }
  updateScrollButtonVisibility() {
    this.scrollBtn.style.display = this.isNearBottom() ? "none" : "flex";
  }
  /** Scrolls to the newest message — but only if the user hasn't scrolled up to reread something, unless `force` (e.g. they just sent a message, or switched chats). */
  scrollToBottom(force = false) {
    if (force || this.isNearBottom()) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
    this.updateScrollButtonVisibility();
  }
  // ---- Input ----
  autoResizeInput() {
    this.inputEl.style.height = "auto";
    this.inputEl.style.height = `${Math.min(this.inputEl.scrollHeight, INPUT_MAX_HEIGHT_PX)}px`;
  }
  formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  // ---- Message rendering ----
  appendMessage(role, text) {
    const row = this.messagesEl.createDiv({ cls: `ooc-msg ooc-${role}` });
    const header = row.createDiv({ cls: "ooc-msg-header" });
    header.createSpan({ cls: "ooc-role", text: role === "user" ? "You" : "Assistant" });
    header.createSpan({ cls: "ooc-timestamp", text: this.formatTime(Date.now()) });
    const textEl = row.createDiv({ cls: "ooc-text" });
    if (role === "assistant") {
      import_obsidian8.MarkdownRenderer.render(this.app, text, textEl, "", this).then(() => this.scrollToBottom());
      const copyBtn = row.createEl("button", { cls: "ooc-copy-btn" });
      (0, import_obsidian8.setIcon)(copyBtn, "copy");
      copyBtn.setAttr("title", "Copy response");
      copyBtn.setAttr("aria-label", "Copy response");
      copyBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(text);
          (0, import_obsidian8.setIcon)(copyBtn, "check");
          setTimeout(() => (0, import_obsidian8.setIcon)(copyBtn, "copy"), 1200);
        } catch {
          new import_obsidian8.Notice("Couldn't copy to clipboard.");
        }
      });
    } else {
      textEl.setText(text);
    }
    this.scrollToBottom(role === "user");
    return row;
  }
  appendSystemNote(text) {
    this.messagesEl.createDiv({ cls: "ooc-system-note", text });
    this.scrollToBottom();
  }
  appendLoadingBubble() {
    const row = this.messagesEl.createDiv({ cls: "ooc-msg ooc-assistant ooc-loading" });
    const header = row.createDiv({ cls: "ooc-msg-header" });
    header.createSpan({ cls: "ooc-role", text: "Assistant" });
    const dots = row.createDiv({ cls: "ooc-text ooc-loading-dots" });
    dots.createSpan({ text: "\u25CF" });
    dots.createSpan({ text: "\u25CF" });
    dots.createSpan({ text: "\u25CF" });
    this.scrollToBottom(true);
    return row;
  }
  // ---- Note-memory: live "thinking" trace while building/refreshing ----
  renderProgressLog(titleText) {
    const container = this.messagesEl.createDiv({ cls: "ooc-progress-log" });
    const titleRow = container.createDiv({ cls: "ooc-progress-title-row" });
    titleRow.createDiv({ cls: "ooc-progress-title", text: titleText });
    const cancelBtn = titleRow.createEl("button", { cls: "ooc-progress-cancel", text: "Cancel" });
    cancelBtn.addEventListener("click", () => this.requestCancel());
    const linesEl = container.createDiv({ cls: "ooc-progress-lines" });
    this.scrollToBottom();
    const onProgress = (p) => {
      if (p.status === "starting") {
        const line = linesEl.createDiv({ cls: "ooc-progress-line ooc-progress-active", text: `${p.phase}\u2026` });
        line.dataset.layer = String(p.layerIndex);
      } else {
        const active = linesEl.querySelector(`.ooc-progress-active[data-layer="${p.layerIndex}"]`);
        if (active) {
          active.removeClass("ooc-progress-active");
          active.setText(`${p.phase} \u2713`);
        } else {
          linesEl.createDiv({ cls: "ooc-progress-line", text: `${p.phase} \u2713` });
        }
      }
      this.scrollToBottom();
    };
    const finish = (text) => {
      cancelBtn.remove();
      container.createDiv({ cls: "ooc-progress-done", text });
      this.scrollToBottom();
    };
    return { onProgress, finish };
  }
  async runNoteMemorySync(file, mode) {
    if (this.busy)
      return;
    this.currentCancellation = new CancellationSource();
    this.setBusy(true);
    const hadMemory = !!this.plugin.noteMemoryStore.get(file.path);
    const label = mode === "incremental" ? `Updating note memory for "${file.basename}"` : hadMemory ? `Rebuilding note memory for "${file.basename}"` : `Building note memory for "${file.basename}"`;
    const { onProgress, finish } = this.renderProgressLog(label);
    try {
      if (mode === "incremental") {
        const { fellBackToFull } = await this.plugin.noteMemoryStore.refreshIncremental(
          file,
          this.plugin.client,
          this.plugin.settings,
          onProgress,
          this.currentCancellation.token
        );
        finish(fellBackToFull ? "Wasn't a clean append since last sync \u2014 did a full rebuild instead." : "Updated.");
      } else {
        await this.plugin.noteMemoryStore.refreshFull(file, this.plugin.client, this.plugin.settings, onProgress, this.currentCancellation.token);
        finish("Done.");
      }
    } catch (err) {
      if (isCancelledError(err)) {
        finish("Cancelled.");
      } else {
        finish(`Error: ${err.message}`);
        new import_obsidian8.Notice(`Note memory sync failed: ${err.message}`);
      }
    } finally {
      this.currentCancellation = null;
      this.setBusy(false);
    }
  }
  renderNoteMemoryHint(filePath, fileName) {
    const bar = this.messagesEl.createDiv({ cls: "ooc-notemem-hint" });
    bar.createSpan({ text: `Answered using the note memory for "${fileName}". ` });
    const refreshBtn = bar.createEl("button", { text: "Refresh (full)" });
    const incrementalBtn = bar.createEl("button", { text: "Update (incremental)" });
    const file = this.app.vault.getAbstractFileByPath(filePath);
    const asFile = file instanceof import_obsidian8.TFile ? file : null;
    refreshBtn.addEventListener("click", async () => {
      if (this.busy) {
        new import_obsidian8.Notice("Something else is already running \u2014 wait for it to finish or cancel it first.");
        return;
      }
      refreshBtn.disabled = true;
      incrementalBtn.disabled = true;
      if (asFile)
        await this.runNoteMemorySync(asFile, "full");
    });
    incrementalBtn.addEventListener("click", async () => {
      if (this.busy) {
        new import_obsidian8.Notice("Something else is already running \u2014 wait for it to finish or cancel it first.");
        return;
      }
      refreshBtn.disabled = true;
      incrementalBtn.disabled = true;
      if (asFile)
        await this.runNoteMemorySync(asFile, "incremental");
    });
  }
  // ---- Pending memory confirm/discard cards ----
  renderPendingCard(entry) {
    const card = this.messagesEl.createDiv({ cls: "ooc-pending-card" });
    const label = entry.action === "extend" ? `Save to memory \u2014 add to "${entry.topicName}"?` : `Save to memory \u2014 new topic "${entry.topicName}"?`;
    card.createDiv({ cls: "ooc-pending-label", text: label });
    card.createDiv({ cls: "ooc-pending-fact", text: entry.fact });
    const actions = card.createDiv({ cls: "ooc-pending-actions" });
    const confirmBtn = actions.createEl("button", { text: "Save" });
    const discardBtn = actions.createEl("button", { text: "Discard" });
    const disableBoth = () => {
      confirmBtn.disabled = true;
      discardBtn.disabled = true;
    };
    confirmBtn.addEventListener("click", async () => {
      if (this.busy)
        return;
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
          card.createDiv({ cls: "ooc-pending-resolved", text: "Cancelled \u2014 still pending." });
        } else {
          new import_obsidian8.Notice(`Couldn't save: ${err.message}`);
          card.createDiv({ cls: "ooc-pending-resolved", text: `Error: ${err.message}` });
        }
      } finally {
        this.currentCancellation = null;
        this.setBusy(false);
      }
    });
    discardBtn.addEventListener("click", async () => {
      if (this.busy)
        return;
      disableBoth();
      this.setBusy(true);
      try {
        await this.plugin.orchestrator.discardTempEntry(entry.id);
        card.empty();
        card.createDiv({ cls: "ooc-pending-resolved", text: "Discarded." });
      } finally {
        this.setBusy(false);
      }
    });
    this.scrollToBottom();
  }
  renderPendingEntries(entries) {
    if (!entries)
      return;
    for (const entry of entries)
      this.renderPendingCard(entry);
  }
  // ---- Sending ----
  get history() {
    return this.session.messages.map((m) => ({ role: m.role, content: m.content }));
  }
  async recordTurn(userText, assistantText) {
    const isFirstTurn = this.session.messages.length === 0;
    await this.plugin.chatSessionStore.appendMessage(this.session.id, { role: "user", content: userText });
    await this.plugin.chatSessionStore.appendMessage(this.session.id, { role: "assistant", content: assistantText });
    if (this.historyVisible)
      this.renderHistoryPanel();
    this.plugin.orchestrator.updateSessionHistory(this.session.id, userText, assistantText).catch(() => void 0);
    if (isFirstTurn) {
      this.plugin.orchestrator.generateSessionTitle(userText).then(async (title) => {
        await this.plugin.chatSessionStore.setTitle(this.session.id, title);
        if (this.historyVisible)
          this.renderHistoryPanel();
      }).catch(() => {
      });
    }
  }
  renderRetry(text, wasClarificationReply, originalQueryForClarification) {
    const row = this.messagesEl.createDiv({ cls: "ooc-retry-row" });
    row.createSpan({ text: "That didn't go through. " });
    const retryBtn = row.createEl("button", { text: "Retry" });
    retryBtn.addEventListener("click", () => {
      row.remove();
      if (wasClarificationReply)
        this.awaitingClarificationFor = originalQueryForClarification;
      this.inputEl.value = text;
      this.autoResizeInput();
      this.send();
    });
    this.scrollToBottom(true);
  }
  async send() {
    if (this.busy)
      return;
    const text = this.inputEl.value.trim();
    if (!text)
      return;
    const wasClarificationReply = !!this.awaitingClarificationFor;
    const originalQueryForClarification = this.awaitingClarificationFor;
    this.inputEl.value = "";
    this.autoResizeInput();
    this.appendMessage("user", text);
    if (!wasClarificationReply) {
      const offered = await this.maybeOfferNoteMemoryBuild(text);
      if (offered)
        return;
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
  async maybeOfferNoteMemoryBuild(query) {
    if (!this.plugin.settings.autoInitNoteMemory)
      return false;
    const wantsActiveNote = this.includeActiveNote || ACTIVE_NOTE_REFERENCE.test(query);
    if (!wantsActiveNote)
      return false;
    const file = this.plugin.activeFileTracker.getFile();
    if (!file || file.extension !== "md")
      return false;
    if (this.plugin.noteMemoryStore.get(file.path))
      return false;
    const content = await this.app.vault.read(file);
    if (content.length < LONG_NOTE_PROMPT_THRESHOLD_CHARS)
      return false;
    this.renderNoteMemoryPrompt(file, query);
    return true;
  }
  renderNoteMemoryPrompt(file, query) {
    const card = this.messagesEl.createDiv({ cls: "ooc-pending-card" });
    card.createDiv({
      cls: "ooc-pending-label",
      text: `"${file.basename}" is long and hasn't been added to note memory yet.`
    });
    card.createDiv({
      cls: "ooc-pending-fact",
      text: "Building it lets me search it in layers of detail instead of reading it raw every time \u2014 worth it for a note this size, but takes a bit longer up front."
    });
    const actions = card.createDiv({ cls: "ooc-pending-actions" });
    const buildBtn = actions.createEl("button", { text: "Build note memory" });
    const skipBtn = actions.createEl("button", { text: "Skip, just answer" });
    const disableBoth = () => {
      buildBtn.disabled = true;
      skipBtn.disabled = true;
    };
    buildBtn.addEventListener("click", async () => {
      if (this.busy)
        return;
      disableBoth();
      card.createDiv({ cls: "ooc-pending-resolved", text: "Building note memory\u2026" });
      this.currentCancellation = new CancellationSource();
      this.setBusy(true);
      const { onProgress, finish } = this.renderProgressLog(`Building note memory for "${file.basename}"`);
      try {
        await this.plugin.noteMemoryStore.ensure(file, this.plugin.client, this.plugin.settings, onProgress, this.currentCancellation.token);
        finish("Note memory ready.");
      } catch (err) {
        finish(isCancelledError(err) ? "Cancelled." : `Error: ${err.message}`);
        if (!isCancelledError(err))
          new import_obsidian8.Notice(`Note memory build failed: ${err.message}`);
      } finally {
        this.currentCancellation = null;
        this.setBusy(false);
      }
      await this.runQuery(query, false, null);
    });
    skipBtn.addEventListener("click", async () => {
      if (this.busy)
        return;
      disableBoth();
      card.createDiv({ cls: "ooc-pending-resolved", text: "Skipped \u2014 answering without it." });
      await this.runQuery(query, false, null);
    });
    this.scrollToBottom();
  }
  async runQuery(text, wasClarificationReply, originalQueryForClarification) {
    this.currentCancellation = new CancellationSource();
    this.setBusy(true);
    const loadingBubble = this.appendLoadingBubble();
    this.statusEl.setText("Routing memories and thinking...");
    try {
      if (wasClarificationReply) {
        this.awaitingClarificationFor = null;
        const result2 = await this.plugin.orchestrator.provideClarification(
          originalQueryForClarification,
          text,
          this.history,
          this.session.id,
          this.currentCancellation.token
        );
        loadingBubble.remove();
        this.appendMessage("assistant", result2.answer);
        await this.recordTurn(originalQueryForClarification, result2.answer);
        const usedNames2 = result2.usedTopics.map((r) => r.topic.name).join(", ");
        this.statusEl.setText(usedNames2 ? `Used memories: ${usedNames2}` : "No memories used");
        this.renderPendingEntries(result2.pendingEntries);
        return;
      }
      const result = await this.plugin.orchestrator.handleQuery(text, this.history, {
        sessionId: this.session.id,
        includeActiveNote: this.includeActiveNote,
        token: this.currentCancellation.token
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
        this.appendSystemNote(`\u2713 Saved to memory: "${result.memoryCommitted.topic.name}"`);
        this.statusEl.setText("Memory saved.");
        return;
      }
      const usedNames = result.usedTopics.map((r) => r.topic.name).join(", ");
      this.statusEl.setText(usedNames ? `Used memories: ${usedNames}` : "No memories used");
      if (result.noteMemoryUsed)
        this.renderNoteMemoryHint(result.noteMemoryUsed.filePath, result.noteMemoryUsed.fileName);
      this.renderPendingEntries(result.pendingEntries);
    } catch (err) {
      loadingBubble.remove();
      if (isCancelledError(err)) {
        this.appendSystemNote("Cancelled.");
        this.statusEl.setText("Cancelled.");
        if (wasClarificationReply)
          this.awaitingClarificationFor = originalQueryForClarification;
      } else {
        this.statusEl.setText(`Error: ${err.message}`);
        new import_obsidian8.Notice(`The Librarium error: ${err.message}`);
        if (wasClarificationReply)
          this.awaitingClarificationFor = originalQueryForClarification;
        this.renderRetry(text, wasClarificationReply, originalQueryForClarification);
      }
    } finally {
      this.currentCancellation = null;
      this.setBusy(false);
      this.inputEl.focus();
    }
  }
};

// src/main.ts
function sanitizeMemoryData(raw) {
  const data = raw;
  const topics = data?.topics ?? {};
  const memories = data?.memories ?? {};
  const cleanTopics = {};
  const cleanMemories = {};
  for (const [id, topic] of Object.entries(topics)) {
    const memory = memories[id];
    if (memory && Array.isArray(memory.layers)) {
      cleanTopics[id] = topic;
      cleanMemories[id] = memory;
    }
  }
  return { topics: cleanTopics, memories: cleanMemories };
}
function sanitizeNoteMemoryData(raw) {
  const data = raw;
  const entries = data?.entries ?? {};
  const clean = {};
  for (const [path, entry] of Object.entries(entries)) {
    const memory = entry.memory;
    if (memory && Array.isArray(memory.layers)) {
      clean[path] = entry;
    }
  }
  return { entries: clean };
}
var OllamaOrchestratorPlugin = class extends import_obsidian9.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.memoryData = emptyStoreData();
    this.tempMemoryData = emptyTempMemoryData();
    this.noteMemoryData = emptyNoteMemoryData();
    this.chatSessionData = emptyChatSessionData();
    this.chatHistoryData = emptyChatHistoryData();
  }
  async onload() {
    await this.loadPluginData();
    this.client = new OllamaClient(this.settings.ollamaBaseUrl);
    this.activeFileTracker = new ActiveFileTracker(this.app);
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => this.activeFileTracker.handleActiveLeafChange(leaf))
    );
    this.rebuildStores();
    this.addSettingTab(new OllamaOrchestratorSettingTab(this.app, this));
    this.registerView(CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this));
    this.addRibbonIcon("message-circle", "Open The Librarium chat", () => this.activateChatView());
    this.addCommand({
      id: "open-chat",
      name: "Open chat panel",
      callback: () => this.activateChatView()
    });
    this.addCommand({
      id: "ingest-active-file",
      name: "Ingest active file into memory (as its own topic)",
      checkCallback: (checking) => {
        const file = this.activeFileTracker.getFile();
        if (!file || file.extension !== "md")
          return false;
        if (checking)
          return true;
        this.ingestFile(file);
        return true;
      }
    });
    this.addCommand({
      id: "note-memory-refresh-full",
      name: "Note memory: full rebuild for active note",
      checkCallback: (checking) => {
        const file = this.activeFileTracker.getFile();
        if (!file || file.extension !== "md")
          return false;
        if (checking)
          return true;
        this.refreshNoteMemory(file, "full");
        return true;
      }
    });
    this.addCommand({
      id: "note-memory-refresh-incremental",
      name: "Note memory: incremental update for active note",
      checkCallback: (checking) => {
        const file = this.activeFileTracker.getFile();
        if (!file || file.extension !== "md")
          return false;
        if (checking)
          return true;
        this.refreshNoteMemory(file, "incremental");
        return true;
      }
    });
  }
  async ingestFile(file) {
    new import_obsidian9.Notice(`Ingesting "${file.basename}"...`);
    try {
      const topic = await this.orchestrator.ingestFile(file, (msg) => new import_obsidian9.Notice(msg));
      new import_obsidian9.Notice(`Memory topic ready: ${topic.name}`);
    } catch (err) {
      new import_obsidian9.Notice(`Ingestion failed: ${err.message}`);
    }
  }
  async refreshNoteMemory(file, mode) {
    new import_obsidian9.Notice(`Syncing note memory for "${file.basename}"...`);
    try {
      if (mode === "full") {
        await this.noteMemoryStore.refreshFull(file, this.client, this.settings, (p) => {
          if (p.status === "starting")
            new import_obsidian9.Notice(`${p.phase}...`);
        });
        new import_obsidian9.Notice(`Note memory rebuilt for "${file.basename}".`);
      } else {
        const { fellBackToFull } = await this.noteMemoryStore.refreshIncremental(file, this.client, this.settings, (p) => {
          if (p.status === "starting")
            new import_obsidian9.Notice(`${p.phase}...`);
        });
        new import_obsidian9.Notice(
          fellBackToFull ? `"${file.basename}" wasn't a clean append since last sync \u2014 did a full rebuild instead.` : `Note memory incrementally updated for "${file.basename}".`
        );
      }
    } catch (err) {
      new import_obsidian9.Notice(`Note memory sync failed: ${err.message}`);
    }
  }
  async activateChatView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      await leaf.setViewState({ type: CHAT_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
  rebuildStores() {
    this.memoryStore = new MemoryStore(this.app, this.memoryData, this.settings.memoriesFolder, () => this.savePluginData());
    this.tempMemoryStore = new TempMemoryStore(this.app, this.tempMemoryData, this.settings.tempMemoryFolder, () => this.savePluginData());
    this.noteMemoryStore = new NoteMemoryStore(this.app, this.noteMemoryData, this.settings.noteMemoryFolder, () => this.savePluginData());
    this.chatHistoryStore = new ChatHistoryStore(this.chatHistoryData, () => this.savePluginData());
    this.chatSessionStore = new ChatSessionStore(this.chatSessionData, () => this.savePluginData(), (sessionId) => {
      this.tempMemoryStore.clearSession(sessionId);
      this.chatHistoryStore.clearSession(sessionId);
    });
    if (this.orchestrator) {
      this.orchestrator.settings = this.settings;
      this.orchestrator.memory = this.memoryStore;
      this.orchestrator.tempMemory = this.tempMemoryStore;
      this.orchestrator.noteMemory = this.noteMemoryStore;
      this.orchestrator.chatHistory = this.chatHistoryStore;
    } else {
      this.orchestrator = new Orchestrator(
        this.app,
        this.client,
        this.settings,
        this.memoryStore,
        this.tempMemoryStore,
        this.noteMemoryStore,
        this.chatHistoryStore,
        this.activeFileTracker
      );
    }
  }
  async loadPluginData() {
    const raw = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, raw?.settings ?? {});
    this.memoryData = sanitizeMemoryData(raw?.memory);
    this.tempMemoryData = raw?.tempMemory ?? emptyTempMemoryData();
    this.noteMemoryData = sanitizeNoteMemoryData(raw?.noteMemory);
    this.chatSessionData = raw?.chatSessions ?? emptyChatSessionData();
    this.chatHistoryData = raw?.chatHistory ?? emptyChatHistoryData();
  }
  async savePluginData() {
    const data = {
      settings: this.settings,
      memory: this.memoryData,
      tempMemory: this.tempMemoryData,
      noteMemory: this.noteMemoryData,
      chatSessions: this.chatSessionData,
      chatHistory: this.chatHistoryData
    };
    await this.saveData(data);
  }
  async saveSettings() {
    this.client.setBaseUrl(this.settings.ollamaBaseUrl);
    this.rebuildStores();
    await this.savePluginData();
  }
  onunload() {
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3NldHRpbmdzLnRzIiwgInNyYy9zZXR0aW5nc1RhYi50cyIsICJzcmMvb2xsYW1hQ2xpZW50LnRzIiwgInNyYy9tZW1vcnlTdG9yZS50cyIsICJzcmMvY2FuY2VsbGF0aW9uLnRzIiwgInNyYy9jaHVua2VyLnRzIiwgInNyYy9zdW1tYXJpemVyLnRzIiwgInNyYy90ZW1wTWVtb3J5U3RvcmUudHMiLCAic3JjL25vdGVNZW1vcnlTdG9yZS50cyIsICJzcmMvY2hhdFNlc3Npb25TdG9yZS50cyIsICJzcmMvY2hhdEhpc3RvcnlTdG9yZS50cyIsICJzcmMvYWN0aXZlRmlsZVRyYWNrZXIudHMiLCAic3JjL2hpZXJhcmNoaWNhbFF1ZXJ5LnRzIiwgInNyYy9tZW1vcnlSb3V0ZXIudHMiLCAic3JjL2ZpbGVTa2lsbHMudHMiLCAic3JjL29yY2hlc3RyYXRvci50cyIsICJzcmMvY2hhdFZpZXcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IE5vdGljZSwgUGx1Z2luLCBURmlsZSwgV29ya3NwYWNlTGVhZiB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgREVGQVVMVF9TRVRUSU5HUywgT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xuaW1wb3J0IHsgT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ1RhYiB9IGZyb20gXCIuL3NldHRpbmdzVGFiXCI7XG5pbXBvcnQgeyBPbGxhbWFDbGllbnQgfSBmcm9tIFwiLi9vbGxhbWFDbGllbnRcIjtcbmltcG9ydCB7IE1lbW9yeVN0b3JlLCBNZW1vcnlTdG9yZURhdGEsIGVtcHR5U3RvcmVEYXRhIH0gZnJvbSBcIi4vbWVtb3J5U3RvcmVcIjtcbmltcG9ydCB7IFRlbXBNZW1vcnlTdG9yZSwgVGVtcE1lbW9yeURhdGEsIGVtcHR5VGVtcE1lbW9yeURhdGEgfSBmcm9tIFwiLi90ZW1wTWVtb3J5U3RvcmVcIjtcbmltcG9ydCB7IE5vdGVNZW1vcnlTdG9yZSwgTm90ZU1lbW9yeVN0b3JlRGF0YSwgZW1wdHlOb3RlTWVtb3J5RGF0YSB9IGZyb20gXCIuL25vdGVNZW1vcnlTdG9yZVwiO1xuaW1wb3J0IHsgQ2hhdFNlc3Npb25TdG9yZSwgQ2hhdFNlc3Npb25TdG9yZURhdGEsIGVtcHR5Q2hhdFNlc3Npb25EYXRhIH0gZnJvbSBcIi4vY2hhdFNlc3Npb25TdG9yZVwiO1xuaW1wb3J0IHsgQ2hhdEhpc3RvcnlTdG9yZSwgQ2hhdEhpc3RvcnlEYXRhLCBlbXB0eUNoYXRIaXN0b3J5RGF0YSB9IGZyb20gXCIuL2NoYXRIaXN0b3J5U3RvcmVcIjtcbmltcG9ydCB7IEFjdGl2ZUZpbGVUcmFja2VyIH0gZnJvbSBcIi4vYWN0aXZlRmlsZVRyYWNrZXJcIjtcbmltcG9ydCB7IE9yY2hlc3RyYXRvciB9IGZyb20gXCIuL29yY2hlc3RyYXRvclwiO1xuaW1wb3J0IHsgQ2hhdFZpZXcsIENIQVRfVklFV19UWVBFIH0gZnJvbSBcIi4vY2hhdFZpZXdcIjtcblxuaW50ZXJmYWNlIFBsdWdpbkRhdGEge1xuXHRzZXR0aW5nczogT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3M7XG5cdG1lbW9yeTogTWVtb3J5U3RvcmVEYXRhO1xuXHR0ZW1wTWVtb3J5OiBUZW1wTWVtb3J5RGF0YTtcblx0bm90ZU1lbW9yeTogTm90ZU1lbW9yeVN0b3JlRGF0YTtcblx0Y2hhdFNlc3Npb25zOiBDaGF0U2Vzc2lvblN0b3JlRGF0YTtcblx0Y2hhdEhpc3Rvcnk6IENoYXRIaXN0b3J5RGF0YTtcbn1cblxuLyoqXG4gKiBNZW1vcnkgbW92ZWQgZnJvbSBhIHZhcmlhYmxlLWRlcHRoIGNvbXByZXNzaW9uIHRyZWUgdG8gYSBmaXhlZCBzdGFjayBvZlxuICogbmFtZWQgbGF5ZXJzIFx1MjAxNCBhbiBvbGRlciB2YXVsdCdzIHBlcnNpc3RlZCBkYXRhIG1heSBzdGlsbCBiZSBpbiB0aGUgb2xkXG4gKiBzaGFwZSAoYSBcInRyZWVzXCIgbWFwIGluc3RlYWQgb2YgXCJtZW1vcmllc1wiLCBlYWNoIGVudHJ5IG1pc3NpbmcgYSBgLmxheWVyc2BcbiAqIGFycmF5KS4gUmF0aGVyIHRoYW4gY3Jhc2ggb24gdGhhdCBzdHJ1Y3R1cmFsIG1pc21hdGNoLCBkcm9wIGFueXRoaW5nIHRoYXRcbiAqIGRvZXNuJ3QgbG9vayBsaWtlIGEgdmFsaWQgbGF5ZXJlZCBtZW1vcnkgKGFuZCB0aGUgdG9waWMgdGhhdCBwb2ludGVkIHRvXG4gKiBpdCkgc28gdGhlIHBsdWdpbiBzdGFydHMgY2xlYW4gaW5zdGVhZCBvZiB0aHJvd2luZy4gRXhpc3RpbmcgdG9waWMvbm90ZVxuICogRklMRVMgaW4gdGhlIHZhdWx0IGFyZSB1bnRvdWNoZWQgZWl0aGVyIHdheSBcdTIwMTQgb25seSB0aGUgaW50ZXJuYWwgY2FjaGVcbiAqIHRoYXQgY2FuJ3QgYmUgcmV1c2VkIGlzIGRpc2NhcmRlZDsgcmUtaW5nZXN0aW5nIG9yIHJlLXJlZmVyZW5jaW5nIHJlYnVpbGRzXG4gKiBpdCBpbiB0aGUgbmV3IGZvcm1hdC5cbiAqL1xuZnVuY3Rpb24gc2FuaXRpemVNZW1vcnlEYXRhKHJhdzogdW5rbm93bik6IE1lbW9yeVN0b3JlRGF0YSB7XG5cdGNvbnN0IGRhdGEgPSByYXcgYXMgUGFydGlhbDxNZW1vcnlTdG9yZURhdGE+IHwgdW5kZWZpbmVkO1xuXHRjb25zdCB0b3BpY3MgPSBkYXRhPy50b3BpY3MgPz8ge307XG5cdGNvbnN0IG1lbW9yaWVzID0gKGRhdGEgYXMgeyBtZW1vcmllcz86IFJlY29yZDxzdHJpbmcsIHsgbGF5ZXJzPzogdW5rbm93biB9PiB9IHwgdW5kZWZpbmVkKT8ubWVtb3JpZXMgPz8ge307XG5cblx0Y29uc3QgY2xlYW5Ub3BpY3M6IE1lbW9yeVN0b3JlRGF0YVtcInRvcGljc1wiXSA9IHt9O1xuXHRjb25zdCBjbGVhbk1lbW9yaWVzOiBNZW1vcnlTdG9yZURhdGFbXCJtZW1vcmllc1wiXSA9IHt9O1xuXHRmb3IgKGNvbnN0IFtpZCwgdG9waWNdIG9mIE9iamVjdC5lbnRyaWVzKHRvcGljcykpIHtcblx0XHRjb25zdCBtZW1vcnkgPSBtZW1vcmllc1tpZF07XG5cdFx0aWYgKG1lbW9yeSAmJiBBcnJheS5pc0FycmF5KG1lbW9yeS5sYXllcnMpKSB7XG5cdFx0XHRjbGVhblRvcGljc1tpZF0gPSB0b3BpYztcblx0XHRcdGNsZWFuTWVtb3JpZXNbaWRdID0gbWVtb3J5IGFzIE1lbW9yeVN0b3JlRGF0YVtcIm1lbW9yaWVzXCJdW3N0cmluZ107XG5cdFx0fVxuXHR9XG5cdHJldHVybiB7IHRvcGljczogY2xlYW5Ub3BpY3MsIG1lbW9yaWVzOiBjbGVhbk1lbW9yaWVzIH07XG59XG5cbmZ1bmN0aW9uIHNhbml0aXplTm90ZU1lbW9yeURhdGEocmF3OiB1bmtub3duKTogTm90ZU1lbW9yeVN0b3JlRGF0YSB7XG5cdGNvbnN0IGRhdGEgPSByYXcgYXMgUGFydGlhbDxOb3RlTWVtb3J5U3RvcmVEYXRhPiB8IHVuZGVmaW5lZDtcblx0Y29uc3QgZW50cmllcyA9IGRhdGE/LmVudHJpZXMgPz8ge307XG5cdGNvbnN0IGNsZWFuOiBOb3RlTWVtb3J5U3RvcmVEYXRhW1wiZW50cmllc1wiXSA9IHt9O1xuXHRmb3IgKGNvbnN0IFtwYXRoLCBlbnRyeV0gb2YgT2JqZWN0LmVudHJpZXMoZW50cmllcykpIHtcblx0XHRjb25zdCBtZW1vcnkgPSAoZW50cnkgYXMgeyBtZW1vcnk/OiB7IGxheWVycz86IHVua25vd24gfSB9KS5tZW1vcnk7XG5cdFx0aWYgKG1lbW9yeSAmJiBBcnJheS5pc0FycmF5KG1lbW9yeS5sYXllcnMpKSB7XG5cdFx0XHRjbGVhbltwYXRoXSA9IGVudHJ5O1xuXHRcdH1cblx0fVxuXHRyZXR1cm4geyBlbnRyaWVzOiBjbGVhbiB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBPbGxhbWFPcmNoZXN0cmF0b3JQbHVnaW4gZXh0ZW5kcyBQbHVnaW4ge1xuXHRzZXR0aW5nczogT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MgPSBERUZBVUxUX1NFVFRJTkdTO1xuXHRtZW1vcnlEYXRhOiBNZW1vcnlTdG9yZURhdGEgPSBlbXB0eVN0b3JlRGF0YSgpO1xuXHR0ZW1wTWVtb3J5RGF0YTogVGVtcE1lbW9yeURhdGEgPSBlbXB0eVRlbXBNZW1vcnlEYXRhKCk7XG5cdG5vdGVNZW1vcnlEYXRhOiBOb3RlTWVtb3J5U3RvcmVEYXRhID0gZW1wdHlOb3RlTWVtb3J5RGF0YSgpO1xuXHRjaGF0U2Vzc2lvbkRhdGE6IENoYXRTZXNzaW9uU3RvcmVEYXRhID0gZW1wdHlDaGF0U2Vzc2lvbkRhdGEoKTtcblx0Y2hhdEhpc3RvcnlEYXRhOiBDaGF0SGlzdG9yeURhdGEgPSBlbXB0eUNoYXRIaXN0b3J5RGF0YSgpO1xuXG5cdGNsaWVudCE6IE9sbGFtYUNsaWVudDtcblx0bWVtb3J5U3RvcmUhOiBNZW1vcnlTdG9yZTtcblx0dGVtcE1lbW9yeVN0b3JlITogVGVtcE1lbW9yeVN0b3JlO1xuXHRub3RlTWVtb3J5U3RvcmUhOiBOb3RlTWVtb3J5U3RvcmU7XG5cdGNoYXRTZXNzaW9uU3RvcmUhOiBDaGF0U2Vzc2lvblN0b3JlO1xuXHRjaGF0SGlzdG9yeVN0b3JlITogQ2hhdEhpc3RvcnlTdG9yZTtcblx0b3JjaGVzdHJhdG9yITogT3JjaGVzdHJhdG9yO1xuXHRhY3RpdmVGaWxlVHJhY2tlciE6IEFjdGl2ZUZpbGVUcmFja2VyO1xuXG5cdGFzeW5jIG9ubG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLmxvYWRQbHVnaW5EYXRhKCk7XG5cblx0XHR0aGlzLmNsaWVudCA9IG5ldyBPbGxhbWFDbGllbnQodGhpcy5zZXR0aW5ncy5vbGxhbWFCYXNlVXJsKTtcblx0XHR0aGlzLmFjdGl2ZUZpbGVUcmFja2VyID0gbmV3IEFjdGl2ZUZpbGVUcmFja2VyKHRoaXMuYXBwKTtcblx0XHR0aGlzLnJlZ2lzdGVyRXZlbnQoXG5cdFx0XHR0aGlzLmFwcC53b3Jrc3BhY2Uub24oXCJhY3RpdmUtbGVhZi1jaGFuZ2VcIiwgKGxlYWYpID0+IHRoaXMuYWN0aXZlRmlsZVRyYWNrZXIuaGFuZGxlQWN0aXZlTGVhZkNoYW5nZShsZWFmKSlcblx0XHQpO1xuXHRcdHRoaXMucmVidWlsZFN0b3JlcygpO1xuXG5cdFx0dGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBPbGxhbWFPcmNoZXN0cmF0b3JTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyVmlldyhDSEFUX1ZJRVdfVFlQRSwgKGxlYWY6IFdvcmtzcGFjZUxlYWYpID0+IG5ldyBDaGF0VmlldyhsZWFmLCB0aGlzKSk7XG5cblx0XHR0aGlzLmFkZFJpYmJvbkljb24oXCJtZXNzYWdlLWNpcmNsZVwiLCBcIk9wZW4gVGhlIExpYnJhcml1bSBjaGF0XCIsICgpID0+IHRoaXMuYWN0aXZhdGVDaGF0VmlldygpKTtcblxuXHRcdHRoaXMuYWRkQ29tbWFuZCh7XG5cdFx0XHRpZDogXCJvcGVuLWNoYXRcIixcblx0XHRcdG5hbWU6IFwiT3BlbiBjaGF0IHBhbmVsXCIsXG5cdFx0XHRjYWxsYmFjazogKCkgPT4gdGhpcy5hY3RpdmF0ZUNoYXRWaWV3KCksXG5cdFx0fSk7XG5cblx0XHR0aGlzLmFkZENvbW1hbmQoe1xuXHRcdFx0aWQ6IFwiaW5nZXN0LWFjdGl2ZS1maWxlXCIsXG5cdFx0XHRuYW1lOiBcIkluZ2VzdCBhY3RpdmUgZmlsZSBpbnRvIG1lbW9yeSAoYXMgaXRzIG93biB0b3BpYylcIixcblx0XHRcdGNoZWNrQ2FsbGJhY2s6IChjaGVja2luZykgPT4ge1xuXHRcdFx0XHRjb25zdCBmaWxlID0gdGhpcy5hY3RpdmVGaWxlVHJhY2tlci5nZXRGaWxlKCk7XG5cdFx0XHRcdGlmICghZmlsZSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSByZXR1cm4gZmFsc2U7XG5cdFx0XHRcdGlmIChjaGVja2luZykgcmV0dXJuIHRydWU7XG5cdFx0XHRcdHRoaXMuaW5nZXN0RmlsZShmaWxlKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9LFxuXHRcdH0pO1xuXG5cdFx0dGhpcy5hZGRDb21tYW5kKHtcblx0XHRcdGlkOiBcIm5vdGUtbWVtb3J5LXJlZnJlc2gtZnVsbFwiLFxuXHRcdFx0bmFtZTogXCJOb3RlIG1lbW9yeTogZnVsbCByZWJ1aWxkIGZvciBhY3RpdmUgbm90ZVwiLFxuXHRcdFx0Y2hlY2tDYWxsYmFjazogKGNoZWNraW5nKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGZpbGUgPSB0aGlzLmFjdGl2ZUZpbGVUcmFja2VyLmdldEZpbGUoKTtcblx0XHRcdFx0aWYgKCFmaWxlIHx8IGZpbGUuZXh0ZW5zaW9uICE9PSBcIm1kXCIpIHJldHVybiBmYWxzZTtcblx0XHRcdFx0aWYgKGNoZWNraW5nKSByZXR1cm4gdHJ1ZTtcblx0XHRcdFx0dGhpcy5yZWZyZXNoTm90ZU1lbW9yeShmaWxlLCBcImZ1bGxcIik7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSxcblx0XHR9KTtcblxuXHRcdHRoaXMuYWRkQ29tbWFuZCh7XG5cdFx0XHRpZDogXCJub3RlLW1lbW9yeS1yZWZyZXNoLWluY3JlbWVudGFsXCIsXG5cdFx0XHRuYW1lOiBcIk5vdGUgbWVtb3J5OiBpbmNyZW1lbnRhbCB1cGRhdGUgZm9yIGFjdGl2ZSBub3RlXCIsXG5cdFx0XHRjaGVja0NhbGxiYWNrOiAoY2hlY2tpbmcpID0+IHtcblx0XHRcdFx0Y29uc3QgZmlsZSA9IHRoaXMuYWN0aXZlRmlsZVRyYWNrZXIuZ2V0RmlsZSgpO1xuXHRcdFx0XHRpZiAoIWZpbGUgfHwgZmlsZS5leHRlbnNpb24gIT09IFwibWRcIikgcmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRpZiAoY2hlY2tpbmcpIHJldHVybiB0cnVlO1xuXHRcdFx0XHR0aGlzLnJlZnJlc2hOb3RlTWVtb3J5KGZpbGUsIFwiaW5jcmVtZW50YWxcIik7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIGluZ2VzdEZpbGUoZmlsZTogVEZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRuZXcgTm90aWNlKGBJbmdlc3RpbmcgXCIke2ZpbGUuYmFzZW5hbWV9XCIuLi5gKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdG9waWMgPSBhd2FpdCB0aGlzLm9yY2hlc3RyYXRvci5pbmdlc3RGaWxlKGZpbGUsIChtc2cpID0+IG5ldyBOb3RpY2UobXNnKSk7XG5cdFx0XHRuZXcgTm90aWNlKGBNZW1vcnkgdG9waWMgcmVhZHk6ICR7dG9waWMubmFtZX1gKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdG5ldyBOb3RpY2UoYEluZ2VzdGlvbiBmYWlsZWQ6ICR7KGVyciBhcyBFcnJvcikubWVzc2FnZX1gKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZWZyZXNoTm90ZU1lbW9yeShmaWxlOiBURmlsZSwgbW9kZTogXCJmdWxsXCIgfCBcImluY3JlbWVudGFsXCIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRuZXcgTm90aWNlKGBTeW5jaW5nIG5vdGUgbWVtb3J5IGZvciBcIiR7ZmlsZS5iYXNlbmFtZX1cIi4uLmApO1xuXHRcdHRyeSB7XG5cdFx0XHRpZiAobW9kZSA9PT0gXCJmdWxsXCIpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5ub3RlTWVtb3J5U3RvcmUucmVmcmVzaEZ1bGwoZmlsZSwgdGhpcy5jbGllbnQsIHRoaXMuc2V0dGluZ3MsIChwKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHAuc3RhdHVzID09PSBcInN0YXJ0aW5nXCIpIG5ldyBOb3RpY2UoYCR7cC5waGFzZX0uLi5gKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdG5ldyBOb3RpY2UoYE5vdGUgbWVtb3J5IHJlYnVpbHQgZm9yIFwiJHtmaWxlLmJhc2VuYW1lfVwiLmApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgeyBmZWxsQmFja1RvRnVsbCB9ID0gYXdhaXQgdGhpcy5ub3RlTWVtb3J5U3RvcmUucmVmcmVzaEluY3JlbWVudGFsKGZpbGUsIHRoaXMuY2xpZW50LCB0aGlzLnNldHRpbmdzLCAocCkgPT4ge1xuXHRcdFx0XHRcdGlmIChwLnN0YXR1cyA9PT0gXCJzdGFydGluZ1wiKSBuZXcgTm90aWNlKGAke3AucGhhc2V9Li4uYCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRuZXcgTm90aWNlKFxuXHRcdFx0XHRcdGZlbGxCYWNrVG9GdWxsXG5cdFx0XHRcdFx0XHQ/IGBcIiR7ZmlsZS5iYXNlbmFtZX1cIiB3YXNuJ3QgYSBjbGVhbiBhcHBlbmQgc2luY2UgbGFzdCBzeW5jIFx1MjAxNCBkaWQgYSBmdWxsIHJlYnVpbGQgaW5zdGVhZC5gXG5cdFx0XHRcdFx0XHQ6IGBOb3RlIG1lbW9yeSBpbmNyZW1lbnRhbGx5IHVwZGF0ZWQgZm9yIFwiJHtmaWxlLmJhc2VuYW1lfVwiLmBcblx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdG5ldyBOb3RpY2UoYE5vdGUgbWVtb3J5IHN5bmMgZmFpbGVkOiAkeyhlcnIgYXMgRXJyb3IpLm1lc3NhZ2V9YCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgYWN0aXZhdGVDaGF0VmlldygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB7IHdvcmtzcGFjZSB9ID0gdGhpcy5hcHA7XG5cdFx0bGV0IGxlYWYgPSB3b3Jrc3BhY2UuZ2V0TGVhdmVzT2ZUeXBlKENIQVRfVklFV19UWVBFKVswXTtcblx0XHRpZiAoIWxlYWYpIHtcblx0XHRcdGxlYWYgPSB3b3Jrc3BhY2UuZ2V0UmlnaHRMZWFmKGZhbHNlKSE7XG5cdFx0XHRhd2FpdCBsZWFmLnNldFZpZXdTdGF0ZSh7IHR5cGU6IENIQVRfVklFV19UWVBFLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0fVxuXHRcdHdvcmtzcGFjZS5yZXZlYWxMZWFmKGxlYWYpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWJ1aWxkU3RvcmVzKCk6IHZvaWQge1xuXHRcdHRoaXMubWVtb3J5U3RvcmUgPSBuZXcgTWVtb3J5U3RvcmUodGhpcy5hcHAsIHRoaXMubWVtb3J5RGF0YSwgdGhpcy5zZXR0aW5ncy5tZW1vcmllc0ZvbGRlciwgKCkgPT4gdGhpcy5zYXZlUGx1Z2luRGF0YSgpKTtcblx0XHR0aGlzLnRlbXBNZW1vcnlTdG9yZSA9IG5ldyBUZW1wTWVtb3J5U3RvcmUodGhpcy5hcHAsIHRoaXMudGVtcE1lbW9yeURhdGEsIHRoaXMuc2V0dGluZ3MudGVtcE1lbW9yeUZvbGRlciwgKCkgPT4gdGhpcy5zYXZlUGx1Z2luRGF0YSgpKTtcblx0XHR0aGlzLm5vdGVNZW1vcnlTdG9yZSA9IG5ldyBOb3RlTWVtb3J5U3RvcmUodGhpcy5hcHAsIHRoaXMubm90ZU1lbW9yeURhdGEsIHRoaXMuc2V0dGluZ3Mubm90ZU1lbW9yeUZvbGRlciwgKCkgPT4gdGhpcy5zYXZlUGx1Z2luRGF0YSgpKTtcblx0XHR0aGlzLmNoYXRIaXN0b3J5U3RvcmUgPSBuZXcgQ2hhdEhpc3RvcnlTdG9yZSh0aGlzLmNoYXRIaXN0b3J5RGF0YSwgKCkgPT4gdGhpcy5zYXZlUGx1Z2luRGF0YSgpKTtcblx0XHR0aGlzLmNoYXRTZXNzaW9uU3RvcmUgPSBuZXcgQ2hhdFNlc3Npb25TdG9yZSh0aGlzLmNoYXRTZXNzaW9uRGF0YSwgKCkgPT4gdGhpcy5zYXZlUGx1Z2luRGF0YSgpLCAoc2Vzc2lvbklkKSA9PiB7XG5cdFx0XHR0aGlzLnRlbXBNZW1vcnlTdG9yZS5jbGVhclNlc3Npb24oc2Vzc2lvbklkKTtcblx0XHRcdHRoaXMuY2hhdEhpc3RvcnlTdG9yZS5jbGVhclNlc3Npb24oc2Vzc2lvbklkKTtcblx0XHR9KTtcblxuXHRcdGlmICh0aGlzLm9yY2hlc3RyYXRvcikge1xuXHRcdFx0dGhpcy5vcmNoZXN0cmF0b3Iuc2V0dGluZ3MgPSB0aGlzLnNldHRpbmdzO1xuXHRcdFx0dGhpcy5vcmNoZXN0cmF0b3IubWVtb3J5ID0gdGhpcy5tZW1vcnlTdG9yZTtcblx0XHRcdHRoaXMub3JjaGVzdHJhdG9yLnRlbXBNZW1vcnkgPSB0aGlzLnRlbXBNZW1vcnlTdG9yZTtcblx0XHRcdHRoaXMub3JjaGVzdHJhdG9yLm5vdGVNZW1vcnkgPSB0aGlzLm5vdGVNZW1vcnlTdG9yZTtcblx0XHRcdHRoaXMub3JjaGVzdHJhdG9yLmNoYXRIaXN0b3J5ID0gdGhpcy5jaGF0SGlzdG9yeVN0b3JlO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm9yY2hlc3RyYXRvciA9IG5ldyBPcmNoZXN0cmF0b3IoXG5cdFx0XHRcdHRoaXMuYXBwLFxuXHRcdFx0XHR0aGlzLmNsaWVudCxcblx0XHRcdFx0dGhpcy5zZXR0aW5ncyxcblx0XHRcdFx0dGhpcy5tZW1vcnlTdG9yZSxcblx0XHRcdFx0dGhpcy50ZW1wTWVtb3J5U3RvcmUsXG5cdFx0XHRcdHRoaXMubm90ZU1lbW9yeVN0b3JlLFxuXHRcdFx0XHR0aGlzLmNoYXRIaXN0b3J5U3RvcmUsXG5cdFx0XHRcdHRoaXMuYWN0aXZlRmlsZVRyYWNrZXJcblx0XHRcdCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBsb2FkUGx1Z2luRGF0YSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCByYXcgPSAoYXdhaXQgdGhpcy5sb2FkRGF0YSgpKSBhcyBQYXJ0aWFsPFBsdWdpbkRhdGE+IHwgbnVsbDtcblx0XHR0aGlzLnNldHRpbmdzID0gT2JqZWN0LmFzc2lnbih7fSwgREVGQVVMVF9TRVRUSU5HUywgcmF3Py5zZXR0aW5ncyA/PyB7fSk7XG5cdFx0dGhpcy5tZW1vcnlEYXRhID0gc2FuaXRpemVNZW1vcnlEYXRhKHJhdz8ubWVtb3J5KTtcblx0XHR0aGlzLnRlbXBNZW1vcnlEYXRhID0gcmF3Py50ZW1wTWVtb3J5ID8/IGVtcHR5VGVtcE1lbW9yeURhdGEoKTtcblx0XHR0aGlzLm5vdGVNZW1vcnlEYXRhID0gc2FuaXRpemVOb3RlTWVtb3J5RGF0YShyYXc/Lm5vdGVNZW1vcnkpO1xuXHRcdHRoaXMuY2hhdFNlc3Npb25EYXRhID0gcmF3Py5jaGF0U2Vzc2lvbnMgPz8gZW1wdHlDaGF0U2Vzc2lvbkRhdGEoKTtcblx0XHR0aGlzLmNoYXRIaXN0b3J5RGF0YSA9IHJhdz8uY2hhdEhpc3RvcnkgPz8gZW1wdHlDaGF0SGlzdG9yeURhdGEoKTtcblx0fVxuXG5cdGFzeW5jIHNhdmVQbHVnaW5EYXRhKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGRhdGE6IFBsdWdpbkRhdGEgPSB7XG5cdFx0XHRzZXR0aW5nczogdGhpcy5zZXR0aW5ncyxcblx0XHRcdG1lbW9yeTogdGhpcy5tZW1vcnlEYXRhLFxuXHRcdFx0dGVtcE1lbW9yeTogdGhpcy50ZW1wTWVtb3J5RGF0YSxcblx0XHRcdG5vdGVNZW1vcnk6IHRoaXMubm90ZU1lbW9yeURhdGEsXG5cdFx0XHRjaGF0U2Vzc2lvbnM6IHRoaXMuY2hhdFNlc3Npb25EYXRhLFxuXHRcdFx0Y2hhdEhpc3Rvcnk6IHRoaXMuY2hhdEhpc3RvcnlEYXRhLFxuXHRcdH07XG5cdFx0YXdhaXQgdGhpcy5zYXZlRGF0YShkYXRhKTtcblx0fVxuXG5cdGFzeW5jIHNhdmVTZXR0aW5ncygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmNsaWVudC5zZXRCYXNlVXJsKHRoaXMuc2V0dGluZ3Mub2xsYW1hQmFzZVVybCk7XG5cdFx0dGhpcy5yZWJ1aWxkU3RvcmVzKCk7XG5cdFx0YXdhaXQgdGhpcy5zYXZlUGx1Z2luRGF0YSgpO1xuXHR9XG5cblx0b251bmxvYWQoKTogdm9pZCB7XG5cdFx0Ly8gbGVhdmVzIGFyZSBjbGVhbmVkIHVwIGJ5IE9ic2lkaWFuIGF1dG9tYXRpY2FsbHlcblx0fVxufVxuIiwgImV4cG9ydCB0eXBlIFJvdXRpbmdNZXRob2QgPSBcImxsbVwiIHwgXCJlbWJlZGRpbmdcIiB8IFwiaHlicmlkXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3Mge1xuXHQvLyAtLS0gQ29ubmVjdGlvbiAtLS1cblx0b2xsYW1hQmFzZVVybDogc3RyaW5nO1xuXHRjaGF0TW9kZWw6IHN0cmluZztcblx0c3VtbWFyeU1vZGVsOiBzdHJpbmc7IC8vIGNhbiBiZSBhIHNtYWxsZXIvZmFzdGVyIG1vZGVsIHRoYW4gY2hhdE1vZGVsXG5cdGVtYmVkZGluZ01vZGVsOiBzdHJpbmc7XG5cblx0Ly8gLS0tIE1lbW9yeSBzdG9yZSAtLS1cblx0bWVtb3JpZXNGb2xkZXI6IHN0cmluZzsgLy8gdmF1bHQtcmVsYXRpdmUgZm9sZGVyIHdoZXJlIGNvbmZpcm1lZCB0b3BpYyBub3RlcyBsaXZlIChkZWZhdWx0OiBcImxpYnJhcml1bVwiKVxuXHR0ZW1wTWVtb3J5Rm9sZGVyOiBzdHJpbmc7IC8vIHZhdWx0LXJlbGF0aXZlIGZvbGRlciBmb3IgdW5jb25maXJtZWQgcGVuZGluZyBtZW1vcnkgY2FuZGlkYXRlc1xuXHRub3RlTWVtb3J5Rm9sZGVyOiBzdHJpbmc7IC8vIHZhdWx0LXJlbGF0aXZlIGZvbGRlciBmb3IgcGVyLW5vdGUgaGllcmFyY2hpY2FsIG1pcnJvcnMgKHNlZSBub3RlTWVtb3J5U3RvcmUudHMpXG5cdGF1dG9Jbml0Tm90ZU1lbW9yeTogYm9vbGVhbjsgLy8gb2ZmZXIgdG8gYnVpbGQgYSBub3RlJ3MgaGllcmFyY2hpY2FsIG1pcnJvciAodmlhIGEgY2hhdCBwcm9tcHQpIHRoZSBmaXJzdCB0aW1lIGEgbG9uZywgbm90LXlldC1taXJyb3JlZCBub3RlIGlzIHJlZmVyZW5jZWQgd2l0aCBcIkluY2x1ZGUgbm90ZVwiIG9uXG5cdG1heE1lbW9yaWVzUGVyUXVlcnk6IG51bWJlcjsgLy8gYWRqdXN0YWJsZSBjYXAgb24gdG9waWNzIHB1bGxlZCBpbnRvIGNvbnRleHRcblx0cm91dGluZ01ldGhvZDogUm91dGluZ01ldGhvZDtcblx0c3VnZ2VzdE1lbW9yeVVwZGF0ZXM6IGJvb2xlYW47IC8vIHN0YWdlIGEgY2FuZGlkYXRlIHVwZGF0ZSBpbiB0ZW1wLW1lbW9yeSBmb3IgdGhlIHVzZXIgdG8gY29uZmlybS9kaXNjYXJkIGluIGNoYXRcblx0ZW5hYmxlQ2xhcmlmaWNhdGlvbjogYm9vbGVhbjsgLy8gbGV0IHRoZSBvcmNoZXN0cmF0b3IgYXNrIGEgY2xhcmlmeWluZyBxdWVzdGlvbiBpbnN0ZWFkIG9mIGd1ZXNzaW5nIHdoZW4gbWVtb3J5IGNvbnRleHQgaXMgaW5zdWZmaWNpZW50XG5cdHNpbWlsYXJpdHlUaHJlc2hvbGQ6IG51bWJlcjsgLy8gMC0xLCB1c2VkIHdoZW4gcm91dGluZ01ldGhvZCBpcyBcImVtYmVkZGluZ1wiIG9yIFwiaHlicmlkXCJcblxuXHQvLyAtLS0gTWVyZ2UgcGFzc2VzIChjb2xsYXBzaW5nIGNodW5rLWxldmVsIHN1bW1hcmllcyBpbnRvIG9uZSBDb21wcmVoZW5zaXZlIFN1bW1hcnkgbGF5ZXIpIC0tLVxuXHQvLyBTcGxpdHRpbmcgdGhlIHJhdyBzb3VyY2UgdGV4dCBpdHNlbGYgaXMgbm93IGRvbmUgcHVyZWx5IGJ5IHRoZSBMTE1cblx0Ly8gKHNlZSBjaHVua2VyLnRzKSBhbmQgaGFzIG5vIHNpemUvb3ZlcmxhcCBzZXR0aW5ncyBvZiBpdHMgb3duLiBUaGVzZVxuXHQvLyByZW1haW4gYmVjYXVzZSB0aGV5IGdvdmVybiBhIHNlcGFyYXRlIHN0ZXA6IHJlZ3JvdXBpbmcgYW5kIG1lcmdpbmdcblx0Ly8gdGhlIGFscmVhZHktc3VtbWFyaXplZCBwYXJ0cyBiYWNrIHRvZ2V0aGVyLlxuXHRtYXhDaHVua01lcmdlUGFzc2VzOiBudW1iZXI7IC8vIHNhZmV0eSBjYXAgb24gaG93IG1hbnkgcmVncm91cC1hbmQtbWVyZ2UgcGFzc2VzIGFyZSBhbGxvd2VkIHdoaWxlIGNvbGxhcHNpbmcgbWFueSBjaHVua3MgaW50byBvbmUgQ29tcHJlaGVuc2l2ZSBTdW1tYXJ5XG5cdG1heENvbmN1cnJlbnRTdW1tYXJpZXM6IG51bWJlcjsgLy8gaG93IG1hbnkgY2h1bmsvZ3JvdXAgc3VtbWFyaWVzIHRvIHJ1biBhdCBvbmNlLCBpbnN0ZWFkIG9mIG9uZSBhdCBhIHRpbWVcblx0bWVyZ2VHcm91cE1heENoYXJzOiBudW1iZXI7IC8vIGNoYXIgYnVkZ2V0IGZvciBncm91cGluZyBhbHJlYWR5LXN1bW1hcml6ZWQgY2h1bmtzIHRvZ2V0aGVyIGR1cmluZyBhIG1lcmdlIHBhc3Ncblx0bWVyZ2VPdmVybGFwVW5pdHM6IG51bWJlcjsgLy8gd2hvbGUgcHJpb3ItbGV2ZWwgdW5pdHMgcmVwZWF0ZWQgYWNyb3NzIG1lcmdlLWdyb3VwIGJvdW5kYXJpZXMsIHNvIGNvbnRleHQgaXNuJ3QgbG9zdCBhdCBtZXJnZS1ncm91cCBlZGdlc1xuXG5cdC8vIC0tLSBQcm9ncmVzc2l2ZS1hYnN0cmFjdGlvbiBtZW1vcnkgbGF5ZXJzIC0tLVxuXHQvLyBFYWNoIG1lbW9yeSBpcyBzdG9yZWQgYXMgYSBmaXhlZCwgbmFtZWQgc3RhY2sgb2YgbGF5ZXJzIGluc3RlYWQgb2YgYVxuXHQvLyB2YXJpYWJsZS1kZXB0aCB0cmVlOiBPdmVydmlldyAodG9wLCBsZWFzdCBkZXRhaWwpIHRocm91Z2ggQ29tcHJlaGVuc2l2ZVxuXHQvLyBTdW1tYXJ5IChib3R0b20sIG1vc3QgZGV0YWlsLCBidWlsdCBkaXJlY3RseSBmcm9tIHRoZSBzb3VyY2UgY2h1bmtzKSxcblx0Ly8gd2l0aCB0aGUgcmF3IE9yaWdpbmFsIHRleHQgYWx3YXlzIGF2YWlsYWJsZSBhcyB0aGUgbGFzdCByZXNvcnQuIFRoaXNcblx0Ly8gY291bnQgaXMgaG93IG1hbnkgY29tcHJlc3Npb24gcGFzc2VzIHNpdCBBQk9WRSB0aGUgQ29tcHJlaGVuc2l2ZVxuXHQvLyBTdW1tYXJ5IFx1MjAxNCBlLmcuIDMgZ2l2ZXMgT3ZlcnZpZXcgLT4gSGlnaC1MZXZlbCBDb25jZXB0cyAtPiBEZXRhaWxlZFxuXHQvLyBDb25jZXB0cyAtPiBDb21wcmVoZW5zaXZlIFN1bW1hcnkgLT4gT3JpZ2luYWwuXG5cdG51bUFic3RyYWN0aW9uTGF5ZXJzOiBudW1iZXI7XG5cblx0Ly8gLS0tIFF1ZXJ5IHVuZGVyc3RhbmRpbmcgLS0tXG5cdGVuYWJsZUludGVudEV4dHJhY3Rpb246IGJvb2xlYW47IC8vIGRpc3RpbGwgd2hhdCB0aGUgdXNlciBpcyBhY3R1YWxseSBhc2tpbmcgYmVmb3JlIHJvdXRpbmcvc2VhcmNoaW5nL2Fuc3dlcmluZywgaW5zdGVhZCBvZiB3b3JraW5nIGZyb20gdGhlIHJhdyBtZXNzYWdlIGFsb25lXG5cblx0Ly8gLS0tIENoYXQgaGlzdG9yeSBkaWdlc3QgLS0tXG5cdHRyYWNrQ2hhdFN1bW1hcnk6IGJvb2xlYW47IC8vIGtlZXAgYSByb2xsaW5nIHN1bW1hcnkgKyBpbmZlcnJlZCB1c2VyLWludGVudCBwZXIgY2hhdCBzZXNzaW9uLCB1cGRhdGVkIG9uZSB0dXJuIGF0IGEgdGltZVxuXHRyZWNlbnRSYXdUdXJuczogbnVtYmVyOyAvLyBob3cgbWFueSBtb3N0LXJlY2VudCBtZXNzYWdlcyAobm90IHR1cm4tcGFpcnMpIHRvIHNlbmQgdmVyYmF0aW0gdG8gdGhlIGNoYXQgbW9kZWw7IG9sZGVyIHR1cm5zIGFyZSByZXByZXNlbnRlZCBvbmx5IHZpYSB0aGUgcm9sbGluZyBzdW1tYXJ5IG9uY2Ugb25lIGV4aXN0c1xuXG5cdC8vIC0tLSBNaXNjIC0tLVxuXHRkZWJ1Z0xvZ2dpbmc6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX1NFVFRJTkdTOiBPbGxhbWFPcmNoZXN0cmF0b3JTZXR0aW5ncyA9IHtcblx0b2xsYW1hQmFzZVVybDogXCJodHRwOi8vbG9jYWxob3N0OjExNDM0XCIsXG5cdGNoYXRNb2RlbDogXCJnZW1tYTQ6ZTRiXCIsXG5cdHN1bW1hcnlNb2RlbDogXCJnZW1tYTQ6ZTRiXCIsXG5cdGVtYmVkZGluZ01vZGVsOiBcIm5vbWljLWVtYmVkLXRleHRcIixcblxuXHRtZW1vcmllc0ZvbGRlcjogXCJsaWJyYXJpdW1cIixcblx0dGVtcE1lbW9yeUZvbGRlcjogXCJsaWJyYXJpdW0vdGVtcC1tZW1vcnlcIixcblx0bm90ZU1lbW9yeUZvbGRlcjogXCJsaWJyYXJpdW0vbm90ZXNcIixcblx0YXV0b0luaXROb3RlTWVtb3J5OiB0cnVlLFxuXHRtYXhNZW1vcmllc1BlclF1ZXJ5OiAzLFxuXHRyb3V0aW5nTWV0aG9kOiBcImh5YnJpZFwiLFxuXHRzdWdnZXN0TWVtb3J5VXBkYXRlczogdHJ1ZSxcblx0ZW5hYmxlQ2xhcmlmaWNhdGlvbjogdHJ1ZSxcblx0c2ltaWxhcml0eVRocmVzaG9sZDogMC41NSxcblxuXHRtYXhDaHVua01lcmdlUGFzc2VzOiA0LFxuXHRtYXhDb25jdXJyZW50U3VtbWFyaWVzOiA0LFxuXHRtZXJnZUdyb3VwTWF4Q2hhcnM6IDIwMDAwLFxuXHRtZXJnZU92ZXJsYXBVbml0czogMSxcblxuXHRudW1BYnN0cmFjdGlvbkxheWVyczogMyxcblxuXHRlbmFibGVJbnRlbnRFeHRyYWN0aW9uOiB0cnVlLFxuXG5cdHRyYWNrQ2hhdFN1bW1hcnk6IHRydWUsXG5cdHJlY2VudFJhd1R1cm5zOiAxMixcblxuXHRkZWJ1Z0xvZ2dpbmc6IGZhbHNlLFxufTtcbiIsICJpbXBvcnQgeyBBcHAsIFBsdWdpblNldHRpbmdUYWIsIFNldHRpbmcgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIE9sbGFtYU9yY2hlc3RyYXRvclBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5cbmV4cG9ydCBjbGFzcyBPbGxhbWFPcmNoZXN0cmF0b3JTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG5cdHBsdWdpbjogT2xsYW1hT3JjaGVzdHJhdG9yUGx1Z2luO1xuXG5cdGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IE9sbGFtYU9yY2hlc3RyYXRvclBsdWdpbikge1xuXHRcdHN1cGVyKGFwcCwgcGx1Z2luKTtcblx0XHR0aGlzLnBsdWdpbiA9IHBsdWdpbjtcblx0fVxuXG5cdGRpc3BsYXkoKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcblx0XHRjb250YWluZXJFbC5lbXB0eSgpO1xuXHRcdGNvbnN0IHMgPSB0aGlzLnBsdWdpbi5zZXR0aW5ncztcblxuXHRcdGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIkNvbm5lY3Rpb25cIiB9KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJPbGxhbWEgYmFzZSBVUkxcIilcblx0XHRcdC5hZGRUZXh0KCh0KSA9PiB0LnNldFZhbHVlKHMub2xsYW1hQmFzZVVybCkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHsgcy5vbGxhbWFCYXNlVXJsID0gdjsgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7IH0pKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJDaGF0IG1vZGVsXCIpXG5cdFx0XHQuYWRkVGV4dCgodCkgPT4gdC5zZXRWYWx1ZShzLmNoYXRNb2RlbCkub25DaGFuZ2UoYXN5bmMgKHYpID0+IHsgcy5jaGF0TW9kZWwgPSB2OyBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTsgfSkpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIlN1bW1hcnkgbW9kZWxcIilcblx0XHRcdC5zZXREZXNjKFwiVXNlZCBmb3IgY2h1bmsgc3VtbWFyaXphdGlvbiwgcm91dGluZywgYW5kIHVwZGF0ZSBkZWNpc2lvbnMuIENhbiBiZSBhIHNtYWxsZXIvZmFzdGVyIG1vZGVsLlwiKVxuXHRcdFx0LmFkZFRleHQoKHQpID0+IHQuc2V0VmFsdWUocy5zdW1tYXJ5TW9kZWwpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7IHMuc3VtbWFyeU1vZGVsID0gdjsgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7IH0pKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJFbWJlZGRpbmcgbW9kZWxcIilcblx0XHRcdC5zZXREZXNjKFwiVXNlZCB3aGVuIHJvdXRpbmcgbWV0aG9kIGlzICdlbWJlZGRpbmcnIG9yICdoeWJyaWQnLiBNdXN0IGJlIGEgZGlmZmVyZW50LCBlbWJlZGRpbmdzLWNhcGFibGUgbW9kZWwgKGUuZy4gbm9taWMtZW1iZWQtdGV4dCkgXHUyMDE0IGFuIGVtYmVkZGluZ3Mtb25seSBtb2RlbCBjYW4ndCBhbHNvIGJlIHVzZWQgYXMgdGhlIENoYXQgb3IgU3VtbWFyeSBtb2RlbCwgYW5kIHZpY2UgdmVyc2E7IG1peGluZyB0aGVtIHVwIGlzIHRoZSBtb3N0IGNvbW1vbiBjYXVzZSBvZiA0MDQvNTAwIGVycm9ycyBmcm9tIE9sbGFtYS5cIilcblx0XHRcdC5hZGRUZXh0KCh0KSA9PiB0LnNldFZhbHVlKHMuZW1iZWRkaW5nTW9kZWwpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7IHMuZW1iZWRkaW5nTW9kZWwgPSB2OyBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTsgfSkpO1xuXG5cdFx0Y29uc3QgdGVzdFJvdyA9IG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJUZXN0IGNvbm5lY3Rpb25cIilcblx0XHRcdC5zZXREZXNjKFwiQ2hlY2tzIHRoYXQgT2xsYW1hIGlzIHJlYWNoYWJsZSwgdGhhdCBhbGwgdGhyZWUgY29uZmlndXJlZCBtb2RlbHMgYXJlIGFjdHVhbGx5IHB1bGxlZCwgYW5kIGZsYWdzIHRoZSBjaGF0L2VtYmVkZGluZyBtb2RlbCBtaXgtdXAgdGhhdCBjYXVzZXMgNDA0IG9yIDUwMCBlcnJvcnMuXCIpO1xuXHRcdGNvbnN0IHJlc3VsdEVsID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1zZXR0aW5ncy10ZXN0LXJlc3VsdFwiIH0pO1xuXHRcdHRlc3RSb3cuYWRkQnV0dG9uKChidG4pID0+IGJ0bi5zZXRCdXR0b25UZXh0KFwiVGVzdCBjb25uZWN0aW9uXCIpLm9uQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0YnRuLnNldERpc2FibGVkKHRydWUpO1xuXHRcdFx0cmVzdWx0RWwuc2V0VGV4dChcIlRlc3RpbmcuLi5cIik7XG5cdFx0XHRjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcblx0XHRcdGxldCBoYXNXYXJuaW5nID0gZmFsc2U7XG5cblx0XHRcdGlmIChzLmVtYmVkZGluZ01vZGVsID09PSBzLmNoYXRNb2RlbCB8fCBzLmVtYmVkZGluZ01vZGVsID09PSBzLnN1bW1hcnlNb2RlbCkge1xuXHRcdFx0XHRsaW5lcy5wdXNoKFwiXHUyNkEwIEVtYmVkZGluZyBtb2RlbCBpcyBzZXQgdG8gdGhlIHNhbWUgbW9kZWwgYXMgQ2hhdC9TdW1tYXJ5IFx1MjAxNCBlbWJlZGRpbmdzLW9ubHkgbW9kZWxzIGNhbid0IGNoYXQvZ2VuZXJhdGUgYW5kIHZpY2UgdmVyc2EuIFRoaXMgYWxvbmUgaXMgZW5vdWdoIHRvIGNhdXNlIDQwNC81MDAgZXJyb3JzLCBlc3BlY2lhbGx5IHdpdGggaHlicmlkIHJvdXRpbmcgKHdoaWNoIHVzZXMgYm90aCkuXCIpO1xuXHRcdFx0XHRoYXNXYXJuaW5nID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcHVsbGVkID0gYXdhaXQgdGhpcy5wbHVnaW4uY2xpZW50Lmxpc3RNb2RlbHMoKTtcblx0XHRcdGlmIChwdWxsZWQubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdGxpbmVzLnB1c2goYFx1MjZBMCBDb3VsZG4ndCByZWFjaCBPbGxhbWEgYXQgXCIke3Mub2xsYW1hQmFzZVVybH1cIiwgb3IgaXQgcmVwb3J0ZWQgbm8gbW9kZWxzIFx1MjAxNCBjaGVjayB0aGUgYmFzZSBVUkwgYW5kIHRoYXQgXCJvbGxhbWEgc2VydmVcIiBpcyBydW5uaW5nLmApO1xuXHRcdFx0XHRoYXNXYXJuaW5nID0gdHJ1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZvciAoY29uc3QgW2xhYmVsLCBtb2RlbF0gb2YgW1tcIkNoYXRcIiwgcy5jaGF0TW9kZWxdLCBbXCJTdW1tYXJ5XCIsIHMuc3VtbWFyeU1vZGVsXSwgW1wiRW1iZWRkaW5nXCIsIHMuZW1iZWRkaW5nTW9kZWxdXSBhcyBjb25zdCkge1xuXHRcdFx0XHRcdGNvbnN0IGZvdW5kID0gcHVsbGVkLnNvbWUoKG0pID0+IG0gPT09IG1vZGVsIHx8IG0uc3RhcnRzV2l0aChgJHttb2RlbH06YCkpO1xuXHRcdFx0XHRcdGxpbmVzLnB1c2goZm91bmQgPyBgXHUyNzEzICR7bGFiZWx9IG1vZGVsIFwiJHttb2RlbH1cIiBpcyBwdWxsZWQuYCA6IGBcdTI2QTAgJHtsYWJlbH0gbW9kZWwgXCIke21vZGVsfVwiIHdhcyBOT1QgZm91bmQgXHUyMDE0IHRyeSBcIm9sbGFtYSBwdWxsICR7bW9kZWx9XCIuYCk7XG5cdFx0XHRcdFx0aWYgKCFmb3VuZCkgaGFzV2FybmluZyA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCFoYXNXYXJuaW5nKSBsaW5lcy5wdXNoKFwiQWxsIGdvb2QuXCIpO1xuXHRcdFx0cmVzdWx0RWwuc2V0VGV4dChsaW5lcy5qb2luKFwiXFxuXCIpKTtcblx0XHRcdGJ0bi5zZXREaXNhYmxlZChmYWxzZSk7XG5cdFx0fSkpO1xuXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiTWVtb3J5IHJldHJpZXZhbFwiIH0pO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIk1lbW9yaWVzIGZvbGRlclwiKVxuXHRcdFx0LnNldERlc2MoXCJWYXVsdCBmb2xkZXIgd2hlcmUgY29uZmlybWVkLCBwZXJtYW5lbnQgbWVtb3J5LXRvcGljIG5vdGVzIGxpdmUuIEV2ZXJ5dGhpbmcgdGhlIHBsdWdpbiBjcmVhdGVzIGxpdmVzIHVuZGVyIGhlcmUuXCIpXG5cdFx0XHQuYWRkVGV4dCgodCkgPT4gdC5zZXRWYWx1ZShzLm1lbW9yaWVzRm9sZGVyKS5vbkNoYW5nZShhc3luYyAodikgPT4geyBzLm1lbW9yaWVzRm9sZGVyID0gdjsgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7IH0pKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJUZW1wLW1lbW9yeSBmb2xkZXJcIilcblx0XHRcdC5zZXREZXNjKFwiVmF1bHQgZm9sZGVyIGZvciB1bmNvbmZpcm1lZCBjYW5kaWRhdGUgbWVtb3J5IG5vdGVzLiBUaGVzZSBhcmUgYWx3YXlzIHRyYW5zaWVudDogZGVsZXRlZCB0aGUgbW9tZW50IHRoZXkncmUgY29uZmlybWVkIG9yIGRpc2NhcmRlZCwgYW5kIHdpcGVkIHdoZW5ldmVyIHRoZWlyIGNoYXQgc2Vzc2lvbidzIHRlbXAtbWVtb3J5IGlzIGNsZWFyZWQuXCIpXG5cdFx0XHQuYWRkVGV4dCgodCkgPT4gdC5zZXRWYWx1ZShzLnRlbXBNZW1vcnlGb2xkZXIpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7IHMudGVtcE1lbW9yeUZvbGRlciA9IHY7IGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpOyB9KSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwiTm90ZS1tZW1vcnkgZm9sZGVyXCIpXG5cdFx0XHQuc2V0RGVzYyhcIlZhdWx0IGZvbGRlciBmb3IgcGVyLW5vdGUgaGllcmFyY2hpY2FsIG1pcnJvcnMsIHVzZWQgd2hlbiAnSW5jbHVkZSBjdXJyZW50IG5vdGUnIHB1bGxzIGluIHRoZSBhY3RpdmUgbm90ZSBpbnN0ZWFkIG9mIGR1bXBpbmcgaXRzIGZ1bGwgdGV4dC5cIilcblx0XHRcdC5hZGRUZXh0KCh0KSA9PiB0LnNldFZhbHVlKHMubm90ZU1lbW9yeUZvbGRlcikub25DaGFuZ2UoYXN5bmMgKHYpID0+IHsgcy5ub3RlTWVtb3J5Rm9sZGVyID0gdjsgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7IH0pKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJPZmZlciB0byBidWlsZCBub3RlIG1lbW9yeVwiKVxuXHRcdFx0LnNldERlc2MoXCJXaGVuIGEgbG9uZyBub3RlIHJlZmVyZW5jZWQgd2l0aCAnSW5jbHVkZSBub3RlJyBkb2Vzbid0IGhhdmUgYSBtZW1vcnkgbWlycm9yIHlldCwgYXNrIChpbiBjaGF0KSB3aGV0aGVyIHRvIGJ1aWxkIG9uZSBiZWZvcmUgYW5zd2VyaW5nLiBJZiBvZmYsIGFsd2F5cyBmYWxscyBiYWNrIHRvIGEgY2FwcGVkIHJhdyByZWFkIGluc3RlYWQgb2YgYXNraW5nLlwiKVxuXHRcdFx0LmFkZFRvZ2dsZSgodGcpID0+IHRnLnNldFZhbHVlKHMuYXV0b0luaXROb3RlTWVtb3J5KS5vbkNoYW5nZShhc3luYyAodikgPT4geyBzLmF1dG9Jbml0Tm90ZU1lbW9yeSA9IHY7IGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpOyB9KSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwiTWF4IG1lbW9yaWVzIHBlciBxdWVyeVwiKVxuXHRcdFx0LnNldERlc2MoXCJVcHBlciBib3VuZCBvbiBob3cgbWFueSBtZW1vcnkgdG9waWNzIGdldCBwdWxsZWQgaW50byBjb250ZXh0IGZvciBhIHNpbmdsZSBjaGF0IHF1ZXJ5LlwiKVxuXHRcdFx0LmFkZFNsaWRlcigoc2wpID0+IHNsLnNldExpbWl0cygxLCAxNSwgMSkuc2V0VmFsdWUocy5tYXhNZW1vcmllc1BlclF1ZXJ5KS5zZXREeW5hbWljVG9vbHRpcCgpXG5cdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodikgPT4geyBzLm1heE1lbW9yaWVzUGVyUXVlcnkgPSB2OyBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTsgfSkpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIlJvdXRpbmcgbWV0aG9kXCIpXG5cdFx0XHQuYWRkRHJvcGRvd24oKGRkKSA9PiBkZFxuXHRcdFx0XHQuYWRkT3B0aW9uKFwibGxtXCIsIFwiTExNIGNsYXNzaWZpY2F0aW9uXCIpXG5cdFx0XHRcdC5hZGRPcHRpb24oXCJlbWJlZGRpbmdcIiwgXCJFbWJlZGRpbmcgc2ltaWxhcml0eVwiKVxuXHRcdFx0XHQuYWRkT3B0aW9uKFwiaHlicmlkXCIsIFwiSHlicmlkIChlbWJlZGRpbmcgc2hvcnRsaXN0ICsgTExNIHJlLXJhbmspXCIpXG5cdFx0XHRcdC5zZXRWYWx1ZShzLnJvdXRpbmdNZXRob2QpXG5cdFx0XHRcdC5vbkNoYW5nZShhc3luYyAodikgPT4geyBzLnJvdXRpbmdNZXRob2QgPSB2IGFzIHR5cGVvZiBzLnJvdXRpbmdNZXRob2Q7IGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpOyB9KSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwiU2ltaWxhcml0eSB0aHJlc2hvbGRcIilcblx0XHRcdC5zZXREZXNjKFwiTWluaW11bSBjb3NpbmUgc2ltaWxhcml0eSBmb3IgZW1iZWRkaW5nLWJhc2VkIHJvdXRpbmcgKDAtMSkuXCIpXG5cdFx0XHQuYWRkU2xpZGVyKChzbCkgPT4gc2wuc2V0TGltaXRzKDAsIDEsIDAuMDUpLnNldFZhbHVlKHMuc2ltaWxhcml0eVRocmVzaG9sZCkuc2V0RHluYW1pY1Rvb2x0aXAoKVxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHYpID0+IHsgcy5zaW1pbGFyaXR5VGhyZXNob2xkID0gdjsgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7IH0pKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJTdWdnZXN0IG1lbW9yeSB1cGRhdGVzXCIpXG5cdFx0XHQuc2V0RGVzYyhcIkFmdGVyIGVhY2ggY2hhdCB0dXJuLCBzdGFnZSBhbnkgbmV3IGR1cmFibGUgZmFjdCBhcyBhIHBlbmRpbmcgdGVtcC1tZW1vcnkgZW50cnkgZm9yIHlvdSB0byBjb25maXJtIG9yIGRpc2NhcmQgaW4gdGhlIGNoYXQgcGFuZWwgXHUyMDE0IG5vdGhpbmcgaXMgd3JpdHRlbiB0byBwZXJtYW5lbnQgbWVtb3J5IGF1dG9tYXRpY2FsbHkuXCIpXG5cdFx0XHQuYWRkVG9nZ2xlKCh0ZykgPT4gdGcuc2V0VmFsdWUocy5zdWdnZXN0TWVtb3J5VXBkYXRlcykub25DaGFuZ2UoYXN5bmMgKHYpID0+IHsgcy5zdWdnZXN0TWVtb3J5VXBkYXRlcyA9IHY7IGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpOyB9KSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwiQXNrIGZvciBjbGFyaWZpY2F0aW9uXCIpXG5cdFx0XHQuc2V0RGVzYyhcIklmIGEgcXVlc3Rpb24gZGVwZW5kcyBvbiBwZXJzb25hbCBjb250ZXh0IHRoYXQgbWVtb3J5IGFuZCB0ZW1wLW1lbW9yeSBkb24ndCBzdWZmaWNpZW50bHkgY292ZXIsIGFzayB5b3UgZm9yIG1vcmUgZGV0YWlsIGluc3RlYWQgb2YgZ3Vlc3NpbmcuXCIpXG5cdFx0XHQuYWRkVG9nZ2xlKCh0ZykgPT4gdGcuc2V0VmFsdWUocy5lbmFibGVDbGFyaWZpY2F0aW9uKS5vbkNoYW5nZShhc3luYyAodikgPT4geyBzLmVuYWJsZUNsYXJpZmljYXRpb24gPSB2OyBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTsgfSkpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIkV4dHJhY3QgcXVlcnkgaW50ZW50XCIpXG5cdFx0XHQuc2V0RGVzYyhcIkJlZm9yZSByb3V0aW5nL3NlYXJjaGluZyBhbmQgYW5zd2VyaW5nLCBkaXN0aWxsIGV4YWN0bHkgd2hhdCB5b3UncmUgYXNraW5nIGZvciAocmVzb2x2aW5nICd0aGlzJy8ndGhhdCcgZnJvbSByZWNlbnQgY29udmVyc2F0aW9uKS4gU2hhcnBlbnMgYm90aCByZXRyaWV2YWwgYW5kIHRoZSBmaW5hbCBhbnN3ZXI7IGNvc3RzIG9uZSBleHRyYSBzbWFsbC1tb2RlbCBjYWxsIHBlciBxdWVyeS5cIilcblx0XHRcdC5hZGRUb2dnbGUoKHRnKSA9PiB0Zy5zZXRWYWx1ZShzLmVuYWJsZUludGVudEV4dHJhY3Rpb24pLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7IHMuZW5hYmxlSW50ZW50RXh0cmFjdGlvbiA9IHY7IGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpOyB9KSk7XG5cblx0XHRjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJDaGF0IGhpc3RvcnkgZGlnZXN0XCIgfSk7XG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHtcblx0XHRcdGNsczogXCJzZXR0aW5nLWl0ZW0tZGVzY3JpcHRpb25cIixcblx0XHRcdHRleHQ6IFwiSW5zdGVhZCBvZiByZS1zZW5kaW5nIHRoZSBlbnRpcmUgZ3Jvd2luZyB0cmFuc2NyaXB0IG9uIGV2ZXJ5IHR1cm4sIHRoZSBwbHVnaW4ga2VlcHMgYSBjb21wYWN0IHJvbGxpbmcgc3VtbWFyeSBvZiB0aGUgY29udmVyc2F0aW9uIGFuZCB0aGUgdXNlcidzIG92ZXJhbGwgaW50ZW50LCB1cGRhdGVkIG9uZSB0dXJuIGF0IGEgdGltZS4gT2xkZXIgdHVybnMgYXJlIHJlcHJlc2VudGVkIGJ5IHRoYXQgc3VtbWFyeTsgb25seSB0aGUgbW9zdCByZWNlbnQgdHVybnMgYXJlIHN0aWxsIHNlbnQgdmVyYmF0aW0uXCIsXG5cdFx0fSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwiVHJhY2sgY2hhdCBzdW1tYXJ5XCIpXG5cdFx0XHQuc2V0RGVzYyhcIk1haW50YWluIGEgcm9sbGluZyBzdW1tYXJ5ICsgaW5mZXJyZWQgdXNlciBpbnRlbnQgcGVyIGNoYXQgc2Vzc2lvbiwgYW5kIHVzZSBpdCAoYWxvbmdzaWRlIHRoZSBjYXBwZWQgcmVjZW50IG1lc3NhZ2VzIGJlbG93KSBzbyB0aGUgbW9kZWwgc3RheXMgYXdhcmUgb2YgZWFybGllciB0dXJucyB3aXRob3V0IG5lZWRpbmcgdGhlIGZ1bGwgdHJhbnNjcmlwdC4gQ29zdHMgb25lIGV4dHJhIHNtYWxsLW1vZGVsIGNhbGwgcGVyIHR1cm4uXCIpXG5cdFx0XHQuYWRkVG9nZ2xlKCh0ZykgPT4gdGcuc2V0VmFsdWUocy50cmFja0NoYXRTdW1tYXJ5KS5vbkNoYW5nZShhc3luYyAodikgPT4geyBzLnRyYWNrQ2hhdFN1bW1hcnkgPSB2OyBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTsgfSkpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIlJlY2VudCByYXcgdHVybnMgdG8gaW5jbHVkZSB2ZXJiYXRpbVwiKVxuXHRcdFx0LnNldERlc2MoXCJIb3cgbWFueSBvZiB0aGUgbW9zdCByZWNlbnQgbWVzc2FnZXMgKG5vdCB0dXJuLXBhaXJzKSBhcmUgc2VudCB0byB0aGUgbW9kZWwgd29yZC1mb3Itd29yZC4gT2xkZXIgbWVzc2FnZXMgYmV5b25kIHRoaXMgYXJlIGRyb3BwZWQgZnJvbSB0aGUgcmF3IHRyYW5zY3JpcHQgYW5kIHJlbGllZCBvbiBvbmx5IHZpYSB0aGUgcm9sbGluZyBzdW1tYXJ5IGFib3ZlLiBJZ25vcmVkIChmdWxsIGhpc3Rvcnkgc2VudCkgaWYgJ1RyYWNrIGNoYXQgc3VtbWFyeScgaXMgb2ZmLlwiKVxuXHRcdFx0LmFkZFNsaWRlcigoc2wpID0+IHNsLnNldExpbWl0cygyLCA0MCwgMikuc2V0VmFsdWUocy5yZWNlbnRSYXdUdXJucykuc2V0RHluYW1pY1Rvb2x0aXAoKVxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHYpID0+IHsgcy5yZWNlbnRSYXdUdXJucyA9IHY7IGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpOyB9KSk7XG5cblx0XHRjb250YWluZXJFbC5jcmVhdGVFbChcImgyXCIsIHsgdGV4dDogXCJNZW1vcnkgbGF5ZXJzIChwcm9ncmVzc2l2ZSBhYnN0cmFjdGlvbilcIiB9KTtcblx0XHRjb250YWluZXJFbC5jcmVhdGVFbChcInBcIiwge1xuXHRcdFx0Y2xzOiBcInNldHRpbmctaXRlbS1kZXNjcmlwdGlvblwiLFxuXHRcdFx0dGV4dDogXCJFdmVyeSBtZW1vcnkgaXMgc3RvcmVkIGFzIGEgZml4ZWQgc3RhY2sgb2YgbmFtZWQgbGF5ZXJzIGluc3RlYWQgb2YgYSB2YXJpYWJsZS1kZXB0aCB0cmVlOiBPdmVydmlldyAodG9wLCBsZWFzdCBkZXRhaWwpIGRvd24gdGhyb3VnaCBhcyBtYW55IGNvbXByZXNzaW9uIHBhc3NlcyBhcyBjb25maWd1cmVkIGJlbG93LCBlbmRpbmcgYXQgdGhlIENvbXByZWhlbnNpdmUgU3VtbWFyeSAobW9zdCBkZXRhaWwsIGJ1aWx0IGZyb20gdGhlIHNvdXJjZSkgXHUyMDE0IHdpdGggdGhlIHJhdyBPcmlnaW5hbCBhbHdheXMgYXZhaWxhYmxlIGFzIGEgbGFzdCByZXNvcnQuIFNlYXJjaCBhbHdheXMgc3RhcnRzIGF0IHRoZSBPdmVydmlldyBhbmQgb25seSBsb2FkcyBhIGRlZXBlciBsYXllciB3aGVuIHRoZSBvbmUgYWJvdmUgd2Fzbid0IGVub3VnaC5cIixcblx0XHR9KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJBYnN0cmFjdGlvbiBsYXllcnNcIilcblx0XHRcdC5zZXREZXNjKFwiSG93IG1hbnkgY29tcHJlc3Npb24gcGFzc2VzIHNpdCBhYm92ZSB0aGUgQ29tcHJlaGVuc2l2ZSBTdW1tYXJ5LiAzIChkZWZhdWx0KSBnaXZlcyBPdmVydmlldyBcdTIxOTIgSGlnaC1MZXZlbCBDb25jZXB0cyBcdTIxOTIgRGV0YWlsZWQgQ29uY2VwdHMgXHUyMTkyIENvbXByZWhlbnNpdmUgU3VtbWFyeS4gTG93ZXIgaXMgY2hlYXBlciB0byBidWlsZCBhbmQgc2VhcmNoOyBoaWdoZXIgZ2l2ZXMgZmluZXItZ3JhaW5lZCBkZXRhaWwgY29udHJvbCBmb3IgbG9uZyBkb2N1bWVudHMuXCIpXG5cdFx0XHQuYWRkU2xpZGVyKChzbCkgPT4gc2wuc2V0TGltaXRzKDEsIDYsIDEpLnNldFZhbHVlKHMubnVtQWJzdHJhY3Rpb25MYXllcnMpLnNldER5bmFtaWNUb29sdGlwKClcblx0XHRcdFx0Lm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7IHMubnVtQWJzdHJhY3Rpb25MYXllcnMgPSB2OyBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTsgfSkpO1xuXG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJoMlwiLCB7IHRleHQ6IFwiTWVyZ2UgcGFzc2VzICh1c2VkIHRvIGJ1aWxkIHRoZSBDb21wcmVoZW5zaXZlIFN1bW1hcnkpXCIgfSk7XG5cdFx0Y29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHtcblx0XHRcdGNsczogXCJzZXR0aW5nLWl0ZW0tZGVzY3JpcHRpb25cIixcblx0XHRcdHRleHQ6IFwiU3BsaXR0aW5nIHJhdyBzb3VyY2UgdGV4dCBpbnRvIGNodW5rcyBpcyBub3cgaGFuZGxlZCBlbnRpcmVseSBieSB0aGUgTExNIGl0c2VsZiBhbmQgaGFzIG5vIHNpemUvb3ZlcmxhcCBzZXR0aW5ncyBoZXJlLiBUaGUgc2V0dGluZ3MgYmVsb3cgb25seSBnb3Zlcm4gdGhlIHNlcGFyYXRlIHN0ZXAgb2YgcmVncm91cGluZyBhbmQgbWVyZ2luZyB0aGUgYWxyZWFkeS1zdW1tYXJpemVkIGNodW5rcyBiYWNrIHRvZ2V0aGVyIGludG8gb25lIENvbXByZWhlbnNpdmUgU3VtbWFyeS5cIixcblx0XHR9KTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJNYXggY2h1bmstbWVyZ2UgcGFzc2VzXCIpXG5cdFx0XHQuc2V0RGVzYyhcIlNhZmV0eSBjYXAgb24gaG93IG1hbnkgcmVncm91cC1hbmQtbWVyZ2UgcGFzc2VzIGFyZSBhbGxvd2VkIHdoaWxlIGNvbGxhcHNpbmcgbWFueSBjaHVua3MgZG93biBpbnRvIG9uZSBDb21wcmVoZW5zaXZlIFN1bW1hcnkuIE9ubHkgbWF0dGVycyBmb3IgZG9jdW1lbnRzIG5lZWRpbmcgbW9yZSBjaHVua3MgdGhhbiBmaXQgaW4gb25lIG1lcmdlIHJvdW5kLlwiKVxuXHRcdFx0LmFkZFRleHQoKHQpID0+IHQuc2V0VmFsdWUoU3RyaW5nKHMubWF4Q2h1bmtNZXJnZVBhc3NlcykpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7IHMubWF4Q2h1bmtNZXJnZVBhc3NlcyA9IE51bWJlcih2KSB8fCBzLm1heENodW5rTWVyZ2VQYXNzZXM7IGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpOyB9KSk7XG5cblx0XHRuZXcgU2V0dGluZyhjb250YWluZXJFbClcblx0XHRcdC5zZXROYW1lKFwiTWVyZ2UgZ3JvdXAgbWF4IGNoYXJhY3RlcnNcIilcblx0XHRcdC5zZXREZXNjKFwiQ2hhciBidWRnZXQgZm9yIGdyb3VwaW5nIGFscmVhZHktc3VtbWFyaXplZCBjaHVua3MgdG9nZXRoZXIgZHVyaW5nIGEgbWVyZ2UgcGFzcy4gU2hvdWxkIGdlbmVyYWxseSBiZSBsYXJnZSBlbm91Z2ggdGhhdCBzZXZlcmFsIHN1bW1hcml6ZWQgY2h1bmtzIGNhbiBjb21iaW5lIGludG8gb25lIGdyb3VwIGF0IGEgdGltZSBcdTIwMTQgdG9vIHNtYWxsIGFuZCBtZXJnZSBwYXNzZXMgYmFyZWx5IHNocmluayB0aGUgcGFydCBjb3VudC5cIilcblx0XHRcdC5hZGRUZXh0KCh0KSA9PiB0LnNldFZhbHVlKFN0cmluZyhzLm1lcmdlR3JvdXBNYXhDaGFycykpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7IHMubWVyZ2VHcm91cE1heENoYXJzID0gTnVtYmVyKHYpIHx8IHMubWVyZ2VHcm91cE1heENoYXJzOyBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTsgfSkpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIk1lcmdlIG92ZXJsYXAgdW5pdHNcIilcblx0XHRcdC5zZXREZXNjKFwiSG93IG1hbnkgcHJpb3ItbGV2ZWwgdW5pdHMgYXJlIHJlcGVhdGVkIGFjcm9zcyBtZXJnZS1ncm91cCBib3VuZGFyaWVzIGZvciBjb250aW51aXR5LiBLZWVwIHRoaXMgc21hbGwgcmVsYXRpdmUgdG8gdGhlIGdyb3VwIHNpemUgYWJvdmUgXHUyMDE0IHRvbyBsYXJnZSBhbiBvdmVybGFwIHN0YWxscyBtZXJnZSBwcm9ncmVzcyB0byByb3VnaGx5IG9uZSB1bml0IGFkdmFuY2VkIHBlciBwYXNzLlwiKVxuXHRcdFx0LmFkZFRleHQoKHQpID0+IHQuc2V0VmFsdWUoU3RyaW5nKHMubWVyZ2VPdmVybGFwVW5pdHMpKS5vbkNoYW5nZShhc3luYyAodikgPT4geyBzLm1lcmdlT3ZlcmxhcFVuaXRzID0gTWF0aC5tYXgoMCwgTnVtYmVyKHYpIHx8IDApOyBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTsgfSkpO1xuXG5cdFx0bmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG5cdFx0XHQuc2V0TmFtZShcIkNvbmN1cnJlbnQgc3VtbWFyaWVzXCIpXG5cdFx0XHQuc2V0RGVzYyhcIkhvdyBtYW55IGNodW5rL2dyb3VwIHN1bW1hcmllcyB0byBydW4gYXQgb25jZSBwZXIgbGV2ZWwgaW5zdGVhZCBvZiBvbmUgYXQgYSB0aW1lLiBIaWdoZXIgaXMgZmFzdGVyIGJ1dCBzZW5kcyBtb3JlIHNpbXVsdGFuZW91cyByZXF1ZXN0cyB0byBPbGxhbWEuXCIpXG5cdFx0XHQuYWRkU2xpZGVyKChzbCkgPT4gc2wuc2V0TGltaXRzKDEsIDgsIDEpLnNldFZhbHVlKHMubWF4Q29uY3VycmVudFN1bW1hcmllcykuc2V0RHluYW1pY1Rvb2x0aXAoKVxuXHRcdFx0XHQub25DaGFuZ2UoYXN5bmMgKHYpID0+IHsgcy5tYXhDb25jdXJyZW50U3VtbWFyaWVzID0gdjsgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7IH0pKTtcblxuXHRcdG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuXHRcdFx0LnNldE5hbWUoXCJEZWJ1ZyBsb2dnaW5nXCIpXG5cdFx0XHQuYWRkVG9nZ2xlKCh0ZykgPT4gdGcuc2V0VmFsdWUocy5kZWJ1Z0xvZ2dpbmcpLm9uQ2hhbmdlKGFzeW5jICh2KSA9PiB7IHMuZGVidWdMb2dnaW5nID0gdjsgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7IH0pKTtcblx0fVxufVxuIiwgImltcG9ydCB7IHJlcXVlc3RVcmwgfSBmcm9tIFwib2JzaWRpYW5cIjtcblxuZXhwb3J0IGludGVyZmFjZSBDaGF0TWVzc2FnZSB7XG5cdHJvbGU6IFwic3lzdGVtXCIgfCBcInVzZXJcIiB8IFwiYXNzaXN0YW50XCI7XG5cdGNvbnRlbnQ6IHN0cmluZztcbn1cblxuLyoqIEV4dHJhY3RzIE9sbGFtYSdzIG93biB7XCJlcnJvclwiOiBcIi4uLlwifSBtZXNzYWdlIGZyb20gYSByZXNwb25zZSBib2R5IHdoZW4gcHJlc2VudC4gKi9cbmZ1bmN0aW9uIGV4dHJhY3RPbGxhbWFFcnJvcihib2R5VGV4dDogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0dHJ5IHtcblx0XHRjb25zdCBwYXJzZWQgPSBKU09OLnBhcnNlKGJvZHlUZXh0KSBhcyB7IGVycm9yPzogc3RyaW5nIH07XG5cdFx0cmV0dXJuIHBhcnNlZC5lcnJvcjtcblx0fSBjYXRjaCB7XG5cdFx0cmV0dXJuIGJvZHlUZXh0LnRyaW0oKSA/IGJvZHlUZXh0LnRyaW0oKS5zbGljZSgwLCAzMDApIDogdW5kZWZpbmVkO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBPbGxhbWFDbGllbnQge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGJhc2VVcmw6IHN0cmluZykge31cblxuXHRzZXRCYXNlVXJsKHVybDogc3RyaW5nKSB7XG5cdFx0dGhpcy5iYXNlVXJsID0gdXJsO1xuXHR9XG5cblx0cHJpdmF0ZSB1cmwocGF0aDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5iYXNlVXJsLnJlcGxhY2UoL1xcLyskLywgXCJcIikgKyBwYXRoO1xuXHR9XG5cblx0LyoqXG5cdCAqIFBPU1RzIHRvIGFuIE9sbGFtYSBlbmRwb2ludCBhbmQgcHJvZHVjZXMgYSBjbGVhciwgYWN0aW9uYWJsZSBlcnJvciBpZlxuXHQgKiBhbnl0aGluZyBnb2VzIHdyb25nIFx1MjAxNCBuYW1pbmcgdGhlIGVuZHBvaW50IGFuZCBtb2RlbCBpbnZvbHZlZCBpbnN0ZWFkIG9mXG5cdCAqIGFuIG9wYXF1ZSBcInN0YXR1cyA0MDRcIi9cInN0YXR1cyA1MDBcIi4gVGhlIHR3byBtb3N0IGNvbW1vbiByZWFsLXdvcmxkXG5cdCAqIGNhdXNlcyBvZiBleGFjdGx5IHRob3NlIHR3byBjb2RlcyBhcmUgY292ZXJlZCBleHBsaWNpdGx5OiB0aGUgbW9kZWxcblx0ICogaGFzbid0IGJlZW4gcHVsbGVkICg0MDQpLCBvciB0aGUgbW9kZWwgZG9lc24ndCBzdXBwb3J0IHRoaXMga2luZCBvZlxuXHQgKiBjYWxsIGF0IGFsbCBcdTIwMTQgZS5nLiBhbiBlbWJlZGRpbmdzLW9ubHkgbW9kZWwgbGlrZSBub21pYy1lbWJlZC10ZXh0IGNhbid0XG5cdCAqIGJlIHVzZWQgZm9yIC9hcGkvZ2VuZXJhdGUgb3IgL2FwaS9jaGF0LCBhbmQgdmljZSB2ZXJzYSAoNTAwKS5cblx0ICovXG5cdHByaXZhdGUgYXN5bmMgcG9zdChwYXRoOiBzdHJpbmcsIGJvZHk6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBvcERlc2NyaXB0aW9uOiBzdHJpbmcsIG1vZGVsOiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xuXHRcdGxldCByZXM7XG5cdFx0dHJ5IHtcblx0XHRcdHJlcyA9IGF3YWl0IHJlcXVlc3RVcmwoe1xuXHRcdFx0XHR1cmw6IHRoaXMudXJsKHBhdGgpLFxuXHRcdFx0XHRtZXRob2Q6IFwiUE9TVFwiLFxuXHRcdFx0XHRjb250ZW50VHlwZTogXCJhcHBsaWNhdGlvbi9qc29uXCIsXG5cdFx0XHRcdGJvZHk6IEpTT04uc3RyaW5naWZ5KGJvZHkpLFxuXHRcdFx0XHR0aHJvdzogZmFsc2UsXG5cdFx0XHR9KTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihcblx0XHRcdFx0YENvdWxkbid0IHJlYWNoIE9sbGFtYSBhdCBcIiR7dGhpcy5iYXNlVXJsfVwiIGZvciAke29wRGVzY3JpcHRpb259IChtb2RlbCBcIiR7bW9kZWx9XCIpOiAkeyhlcnIgYXMgRXJyb3IpLm1lc3NhZ2V9LiBDaGVjayB0aGUgT2xsYW1hIGJhc2UgVVJMIGluIHNldHRpbmdzIGFuZCB0aGF0IFwib2xsYW1hIHNlcnZlXCIgaXMgcnVubmluZy5gXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGlmIChyZXMuc3RhdHVzIDwgMjAwIHx8IHJlcy5zdGF0dXMgPj0gMzAwKSB7XG5cdFx0XHRjb25zdCBkZXRhaWwgPSBleHRyYWN0T2xsYW1hRXJyb3IocmVzLnRleHQgPz8gXCJcIik7XG5cdFx0XHRsZXQgZ3VpZGFuY2UgPSBcIlwiO1xuXHRcdFx0aWYgKHJlcy5zdGF0dXMgPT09IDQwNCkge1xuXHRcdFx0XHRndWlkYW5jZSA9IGAgTW9kZWwgXCIke21vZGVsfVwiIG1heSBub3QgYmUgcHVsbGVkIHlldCBcdTIwMTQgdHJ5IFwib2xsYW1hIHB1bGwgJHttb2RlbH1cIi5gO1xuXHRcdFx0fSBlbHNlIGlmIChyZXMuc3RhdHVzID09PSA1MDApIHtcblx0XHRcdFx0Z3VpZGFuY2UgPSBgIFRoaXMgb2Z0ZW4gbWVhbnMgbW9kZWwgXCIke21vZGVsfVwiIGRvZXNuJ3Qgc3VwcG9ydCAke29wRGVzY3JpcHRpb259IFx1MjAxNCBmb3IgZXhhbXBsZSwgYW4gZW1iZWRkaW5ncy1vbmx5IG1vZGVsIChsaWtlIG5vbWljLWVtYmVkLXRleHQpIGNhbid0IGJlIHVzZWQgdG8gY2hhdC9nZW5lcmF0ZSwgYW5kIGEgY2hhdCBtb2RlbCBjYW4ndCBiZSB1c2VkIGZvciBlbWJlZGRpbmdzLiBEb3VibGUtY2hlY2sgeW91ciBDaGF0L1N1bW1hcnkgbW9kZWwgYW5kIEVtYmVkZGluZyBtb2RlbCBzZXR0aW5ncyBhcmVuJ3QgcG9pbnRpbmcgYXQgdGhlIHdyb25nIGtpbmQgb2YgbW9kZWwuYDtcblx0XHRcdH1cblx0XHRcdHRocm93IG5ldyBFcnJvcihgT2xsYW1hIHJldHVybmVkICR7cmVzLnN0YXR1c30gZm9yICR7b3BEZXNjcmlwdGlvbn0gdXNpbmcgbW9kZWwgXCIke21vZGVsfVwiJHtkZXRhaWwgPyBgOiAke2RldGFpbH1gIDogXCJcIn0uJHtndWlkYW5jZX1gKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzLmpzb247XG5cdH1cblxuXHQvKiogU2luZ2xlLXNob3QgcHJvbXB0IGNvbXBsZXRpb24gKHVzZWQgaGVhdmlseSBmb3Igc3VtbWFyaXphdGlvbiBjaHVua3MpLiAqL1xuXHRhc3luYyBnZW5lcmF0ZShtb2RlbDogc3RyaW5nLCBwcm9tcHQ6IHN0cmluZywgb3B0aW9ucz86IFJlY29yZDxzdHJpbmcsIHVua25vd24+KTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBkYXRhID0gKGF3YWl0IHRoaXMucG9zdChcIi9hcGkvZ2VuZXJhdGVcIiwgeyBtb2RlbCwgcHJvbXB0LCBzdHJlYW06IGZhbHNlLCBvcHRpb25zIH0sIFwidGV4dCBnZW5lcmF0aW9uXCIsIG1vZGVsKSkgYXMgeyByZXNwb25zZT86IHN0cmluZyB9O1xuXHRcdHJldHVybiAoZGF0YS5yZXNwb25zZSA/PyBcIlwiKS50cmltKCk7XG5cdH1cblxuXHQvKiogTXVsdGktdHVybiBjaGF0IGNvbXBsZXRpb24uICovXG5cdGFzeW5jIGNoYXQobW9kZWw6IHN0cmluZywgbWVzc2FnZXM6IENoYXRNZXNzYWdlW10sIG9wdGlvbnM/OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPik6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3QgZGF0YSA9IChhd2FpdCB0aGlzLnBvc3QoXCIvYXBpL2NoYXRcIiwgeyBtb2RlbCwgbWVzc2FnZXMsIHN0cmVhbTogZmFsc2UsIG9wdGlvbnMgfSwgXCJjaGF0XCIsIG1vZGVsKSkgYXMgeyBtZXNzYWdlPzogeyBjb250ZW50Pzogc3RyaW5nIH0gfTtcblx0XHRyZXR1cm4gKGRhdGEubWVzc2FnZT8uY29udGVudCA/PyBcIlwiKS50cmltKCk7XG5cdH1cblxuXHQvKiogRW1iZWRkaW5nIHZlY3RvciBmb3IgYSBzdHJpbmcsIHVzZWQgZm9yIGVtYmVkZGluZy1iYXNlZCBtZW1vcnkgcm91dGluZy4gKi9cblx0YXN5bmMgZW1iZWQobW9kZWw6IHN0cmluZywgaW5wdXQ6IHN0cmluZyk6IFByb21pc2U8bnVtYmVyW10+IHtcblx0XHRjb25zdCBkYXRhID0gKGF3YWl0IHRoaXMucG9zdChcIi9hcGkvZW1iZWRkaW5nc1wiLCB7IG1vZGVsLCBwcm9tcHQ6IGlucHV0IH0sIFwiZW1iZWRkaW5nc1wiLCBtb2RlbCkpIGFzIHsgZW1iZWRkaW5nPzogbnVtYmVyW10gfTtcblx0XHRyZXR1cm4gZGF0YS5lbWJlZGRpbmcgPz8gW107XG5cdH1cblxuXHRhc3luYyBsaXN0TW9kZWxzKCk6IFByb21pc2U8c3RyaW5nW10+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzID0gYXdhaXQgcmVxdWVzdFVybCh7IHVybDogdGhpcy51cmwoXCIvYXBpL3RhZ3NcIiksIG1ldGhvZDogXCJHRVRcIiwgdGhyb3c6IGZhbHNlIH0pO1xuXHRcdFx0aWYgKHJlcy5zdGF0dXMgPCAyMDAgfHwgcmVzLnN0YXR1cyA+PSAzMDApIHJldHVybiBbXTtcblx0XHRcdGNvbnN0IGRhdGEgPSByZXMuanNvbiBhcyB7IG1vZGVscz86IHsgbmFtZTogc3RyaW5nIH1bXSB9O1xuXHRcdFx0cmV0dXJuIChkYXRhLm1vZGVscyA/PyBbXSkubWFwKChtKSA9PiBtLm5hbWUpO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29zaW5lU2ltaWxhcml0eShhOiBudW1iZXJbXSwgYjogbnVtYmVyW10pOiBudW1iZXIge1xuXHRpZiAoYS5sZW5ndGggPT09IDAgfHwgYi5sZW5ndGggPT09IDAgfHwgYS5sZW5ndGggIT09IGIubGVuZ3RoKSByZXR1cm4gMDtcblx0bGV0IGRvdCA9IDAsIG1hZ0EgPSAwLCBtYWdCID0gMDtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhLmxlbmd0aDsgaSsrKSB7XG5cdFx0ZG90ICs9IGFbaV0gKiBiW2ldO1xuXHRcdG1hZ0EgKz0gYVtpXSAqIGFbaV07XG5cdFx0bWFnQiArPSBiW2ldICogYltpXTtcblx0fVxuXHRpZiAobWFnQSA9PT0gMCB8fCBtYWdCID09PSAwKSByZXR1cm4gMDtcblx0cmV0dXJuIGRvdCAvIChNYXRoLnNxcnQobWFnQSkgKiBNYXRoLnNxcnQobWFnQikpO1xufVxuIiwgImltcG9ydCB7IEFwcCwgVEZpbGUsIG5vcm1hbGl6ZVBhdGggfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IE9sbGFtYUNsaWVudCB9IGZyb20gXCIuL29sbGFtYUNsaWVudFwiO1xuaW1wb3J0IHsgT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xuaW1wb3J0IHsgTGF5ZXJlZE1lbW9yeSwgYnVpbGRMYXllcmVkTWVtb3J5LCBleHRlbmRMYXllcmVkTWVtb3J5LCBCdWlsZFByb2dyZXNzIH0gZnJvbSBcIi4vc3VtbWFyaXplclwiO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tIFwiLi9jYW5jZWxsYXRpb25cIjtcblxuZXhwb3J0IGludGVyZmFjZSBNZW1vcnlUb3BpYyB7XG5cdGlkOiBzdHJpbmc7XG5cdG5hbWU6IHN0cmluZztcblx0b3ZlcnZpZXc6IHN0cmluZzsgLy8gY29udmVuaWVuY2UgY2FjaGUgb2YgdGhlIG1lbW9yeSdzIE92ZXJ2aWV3IGxheWVyLCBhbHdheXMga2VwdCBpbiBzeW5jXG5cdG5vdGVQYXRoOiBzdHJpbmc7IC8vIHRoZSBtYWluIG5vdGU6IE92ZXJ2aWV3ICsgbGlua3MgdG8gdGhlIGRlZXBlciBsYXllcnNcblx0Zm9sZGVyUGF0aDogc3RyaW5nOyAvLyBjb21wYW5pb24gZm9sZGVyIGhvbGRpbmcgb25lIGZpbGUgcGVyIGRlZXBlciBsYXllciwgcGx1cyB0aGUgT3JpZ2luYWxcblx0dXBkYXRlZEF0OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWVtb3J5U3RvcmVEYXRhIHtcblx0dG9waWNzOiBSZWNvcmQ8c3RyaW5nLCBNZW1vcnlUb3BpYz47XG5cdG1lbW9yaWVzOiBSZWNvcmQ8c3RyaW5nLCBMYXllcmVkTWVtb3J5PjsgLy8ga2V5ZWQgYnkgdG9waWMgaWRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVtcHR5U3RvcmVEYXRhKCk6IE1lbW9yeVN0b3JlRGF0YSB7XG5cdHJldHVybiB7IHRvcGljczoge30sIG1lbW9yaWVzOiB7fSB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2x1Z2lmeShuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRyZXR1cm4gKFxuXHRcdG5hbWVcblx0XHRcdC50b0xvd2VyQ2FzZSgpXG5cdFx0XHQucmVwbGFjZSgvW15hLXowLTldKy9nLCBcIi1cIilcblx0XHRcdC5yZXBsYWNlKC8oXi18LSQpL2csIFwiXCIpXG5cdFx0XHQuc2xpY2UoMCwgNjApIHx8IFwidG9waWNcIlxuXHQpO1xufVxuXG5mdW5jdGlvbiBsYXllckZpbGVOYW1lKGxheWVyOiB7IGluZGV4OiBudW1iZXI7IG5hbWU6IHN0cmluZyB9KTogc3RyaW5nIHtcblx0cmV0dXJuIGAke1N0cmluZyhsYXllci5pbmRleCkucGFkU3RhcnQoMiwgXCIwXCIpfS0ke3NsdWdpZnkobGF5ZXIubmFtZSl9Lm1kYDtcbn1cblxuZnVuY3Rpb24gcmVuZGVyTWFpbk5vdGUodG9waWM6IE1lbW9yeVRvcGljLCBtZW1vcnk6IExheWVyZWRNZW1vcnkpOiBzdHJpbmcge1xuXHRjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcblx0bGluZXMucHVzaChcIi0tLVwiKTtcblx0bGluZXMucHVzaChgdG9waWNfaWQ6ICR7dG9waWMuaWR9YCk7XG5cdGxpbmVzLnB1c2goYHVwZGF0ZWQ6ICR7bmV3IERhdGUodG9waWMudXBkYXRlZEF0KS50b0lTT1N0cmluZygpfWApO1xuXHRsaW5lcy5wdXNoKFwiLS0tXCIpO1xuXHRsaW5lcy5wdXNoKFwiXCIpO1xuXHRsaW5lcy5wdXNoKGAjICR7dG9waWMubmFtZX1gKTtcblx0bGluZXMucHVzaChcIlwiKTtcblx0bGluZXMucHVzaChcIiMjIE92ZXJ2aWV3XCIpO1xuXHRsaW5lcy5wdXNoKG1lbW9yeS5sYXllcnNbMF0udGV4dC50cmltKCkpO1xuXG5cdGlmIChtZW1vcnkubGF5ZXJzLmxlbmd0aCA+IDEpIHtcblx0XHRsaW5lcy5wdXNoKFwiXCIpO1xuXHRcdGxpbmVzLnB1c2goXCIjIyBNb3JlIGRldGFpbFwiKTtcblx0XHRsaW5lcy5wdXNoKFxuXHRcdFx0XCJfRWFjaCBsaW5rIGJlbG93IGV4cGFuZHMgb24gdGhlIG9uZSBhYm92ZSBpdCB3aXRob3V0IGNoYW5naW5nIGl0cyBtZWFuaW5nIFx1MjAxNCBwdWxsZWQgaW4gb25seSBhcyBuZWVkZWQsIHdoZW4gYSBxdWVzdGlvbiB0aGlzIE92ZXJ2aWV3IGFsb25lIGNhbid0IGFuc3dlciBuZWVkcyBpdC5fXCJcblx0XHQpO1xuXHRcdGxpbmVzLnB1c2goXCJcIik7XG5cdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBtZW1vcnkubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBsYXllciA9IG1lbW9yeS5sYXllcnNbaV07XG5cdFx0XHRsaW5lcy5wdXNoKGAtIFtbJHt0b3BpYy5mb2xkZXJQYXRofS8ke2xheWVyRmlsZU5hbWUobGF5ZXIpfXwke2xheWVyLm5hbWV9XV1gKTtcblx0XHR9XG5cdFx0bGluZXMucHVzaChgLSBbWyR7dG9waWMuZm9sZGVyUGF0aH0vb3JpZ2luYWwubWR8T3JpZ2luYWwgc291cmNlIHRleHRdXWApO1xuXHR9XG5cdGxpbmVzLnB1c2goXCJcIik7XG5cdHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xufVxuXG5mdW5jdGlvbiByZW5kZXJMYXllckZpbGUodG9waWM6IE1lbW9yeVRvcGljLCBsYXllcjogeyBpbmRleDogbnVtYmVyOyBuYW1lOiBzdHJpbmc7IHRleHQ6IHN0cmluZyB9KTogc3RyaW5nIHtcblx0Y29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cdGxpbmVzLnB1c2goXCItLS1cIik7XG5cdGxpbmVzLnB1c2goYHRvcGljX2lkOiAke3RvcGljLmlkfWApO1xuXHRsaW5lcy5wdXNoKGBsYXllcl9pbmRleDogJHtsYXllci5pbmRleH1gKTtcblx0bGluZXMucHVzaChcIi0tLVwiKTtcblx0bGluZXMucHVzaChcIlwiKTtcblx0bGluZXMucHVzaChgIyAke3RvcGljLm5hbWV9IFx1MjAxNCAke2xheWVyLm5hbWV9YCk7XG5cdGxpbmVzLnB1c2goXCJcIik7XG5cdGxpbmVzLnB1c2goYF9QYXJ0IG9mIFtbJHt0b3BpYy5ub3RlUGF0aH18JHt0b3BpYy5uYW1lfV1dLiBUaGlzIGxheWVyIGV4cGFuZHMgb24gdGhlIG9uZSBhYm92ZSBpdCB3aXRob3V0IGNoYW5naW5nIGl0cyBtZWFuaW5nLl9gKTtcblx0bGluZXMucHVzaChcIlwiKTtcblx0bGluZXMucHVzaChsYXllci50ZXh0LnRyaW0oKSk7XG5cdGxpbmVzLnB1c2goXCJcIik7XG5cdHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xufVxuXG5mdW5jdGlvbiByZW5kZXJPcmlnaW5hbEZpbGUodG9waWM6IE1lbW9yeVRvcGljLCBtZW1vcnk6IExheWVyZWRNZW1vcnkpOiBzdHJpbmcge1xuXHRjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcblx0bGluZXMucHVzaChcIi0tLVwiKTtcblx0bGluZXMucHVzaChgdG9waWNfaWQ6ICR7dG9waWMuaWR9YCk7XG5cdGxpbmVzLnB1c2goXCItLS1cIik7XG5cdGxpbmVzLnB1c2goXCJcIik7XG5cdGxpbmVzLnB1c2goYCMgJHt0b3BpYy5uYW1lfSBcdTIwMTQgT3JpZ2luYWwgc291cmNlIHRleHRgKTtcblx0bGluZXMucHVzaChcIlwiKTtcblx0bGluZXMucHVzaChgX1BhcnQgb2YgW1ske3RvcGljLm5vdGVQYXRofXwke3RvcGljLm5hbWV9XV0uIE9ubHkgbG9hZGVkIHdoZW4gZXZlbiB0aGUgQ29tcHJlaGVuc2l2ZSBTdW1tYXJ5IGlzbid0IGRldGFpbGVkIGVub3VnaC5fYCk7XG5cdGxpbmVzLnB1c2goXCJcIik7XG5cdGxpbmVzLnB1c2gobWVtb3J5Lm9yaWdpbmFsLnRyaW0oKSk7XG5cdGxpbmVzLnB1c2goXCJcIik7XG5cdHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xufVxuXG4vKipcbiAqIE1hbmFnZXMgdGhlIG9uLWRpc2sgbWVtb3J5IHRvcGljIGZpbGVzOiBhIG1haW4gbm90ZSAoT3ZlcnZpZXcgKyBsaW5rcylcbiAqIHBsdXMgYSBjb21wYW5pb24gZm9sZGVyIHdpdGggb25lIGZpbGUgcGVyIGRlZXBlciBsYXllciBhbmQgdGhlIHJhd1xuICogT3JpZ2luYWwgXHUyMDE0IGEgcmVhbCwgYnJvd3NhYmxlIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBwcm9ncmVzc2l2ZS1cbiAqIGFic3RyYWN0aW9uIHN0YWNrLCBub3QganVzdCBhbiBvcGFxdWUgaW50ZXJuYWwgYmxvYi4gVGhlIHVuZGVybHlpbmdcbiAqIGBMYXllcmVkTWVtb3J5YCAobmVlZGVkIGZvciBoaWVyYXJjaGljYWwgc2VhcmNoKSBpcyBrZXB0IGluIHBsdWdpbiBkYXRhXG4gKiBzaW5jZSBpdCdzIG5vdCBtZWFudCBmb3IgbWFudWFsIGVkaXRpbmc7IHRoZSB2YXVsdCBmaWxlcyBhcmUgYWx3YXlzXG4gKiByZWdlbmVyYXRlZCBmcm9tIGl0LCBuZXZlciB0aGUgb3RoZXIgd2F5IGFyb3VuZC5cbiAqL1xuZXhwb3J0IGNsYXNzIE1lbW9yeVN0b3JlIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBhcHA6IEFwcCxcblx0XHRwcml2YXRlIGRhdGE6IE1lbW9yeVN0b3JlRGF0YSxcblx0XHRwcml2YXRlIGZvbGRlcjogc3RyaW5nLFxuXHRcdHByaXZhdGUgcGVyc2lzdDogKCkgPT4gUHJvbWlzZTx2b2lkPlxuXHQpIHt9XG5cblx0YXN5bmMgZW5zdXJlRm9sZGVyKHBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuXHRcdGlmICghdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKG5vcm1hbGl6ZWQpKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGVGb2xkZXIobm9ybWFsaXplZCkuY2F0Y2goKCkgPT4gdm9pZCAwKTtcblx0XHR9XG5cdH1cblxuXHRsaXN0VG9waWNzKCk6IE1lbW9yeVRvcGljW10ge1xuXHRcdHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuZGF0YS50b3BpY3MpLnNvcnQoKGEsIGIpID0+IGIudXBkYXRlZEF0IC0gYS51cGRhdGVkQXQpO1xuXHR9XG5cblx0Z2V0VG9waWMoaWQ6IHN0cmluZyk6IE1lbW9yeVRvcGljIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5kYXRhLnRvcGljc1tpZF07XG5cdH1cblxuXHRnZXRNZW1vcnkodG9waWNJZDogc3RyaW5nKTogTGF5ZXJlZE1lbW9yeSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZGF0YS5tZW1vcmllc1t0b3BpY0lkXTtcblx0fVxuXG5cdC8qKiBDcmVhdGUgYSBicmFuZC1uZXcgdG9waWMgYnkgYnVpbGRpbmcgYSBmdWxsIGxheWVyZWQgbWVtb3J5IGZyb20gcmF3IHRleHQuICovXG5cdGFzeW5jIGNyZWF0ZVRvcGljRnJvbVRleHQoXG5cdFx0bmFtZTogc3RyaW5nLFxuXHRcdHRleHQ6IHN0cmluZyxcblx0XHRjbGllbnQ6IE9sbGFtYUNsaWVudCxcblx0XHRzZXR0aW5nczogT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MsXG5cdFx0b25Qcm9ncmVzcz86IChwOiBCdWlsZFByb2dyZXNzKSA9PiB2b2lkLFxuXHRcdHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW5cblx0KTogUHJvbWlzZTxNZW1vcnlUb3BpYz4ge1xuXHRcdGNvbnN0IG1lbW9yeSA9IGF3YWl0IGJ1aWxkTGF5ZXJlZE1lbW9yeSh0ZXh0LCBjbGllbnQsIHNldHRpbmdzLCBvblByb2dyZXNzLCB0b2tlbik7XG5cdFx0cmV0dXJuIHRoaXMuY3JlYXRlVG9waWMobmFtZSwgbWVtb3J5KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHcm93cyBhbiBleGlzdGluZyB0b3BpYyB3aXRoIG5ldyByYXcgdGV4dC4gRXh0ZW5kcyB0aGUgbGF5ZXJlZCBtZW1vcnlcblx0ICogKG1lcmdpbmcgaW50byB0aGUgZXhpc3RpbmcgQ29tcHJlaGVuc2l2ZSBTdW1tYXJ5LCB0aGVuIHJlY2FzY2FkaW5nIHRoZVxuXHQgKiBsYXllcnMgYWJvdmUgaXQpIHJhdGhlciB0aGFuIGVkaXRpbmcgZmlsZXMgZGlyZWN0bHksIHNvIGV2ZXJ5IGxheWVyXG5cdCAqIGZpbGUgYWx3YXlzIHN0YXlzIGRlcml2ZWQgZnJvbSB0aGUgbWVtb3J5LCBuZXZlciBoYW5kLXBhdGNoZWQuXG5cdCAqL1xuXHRhc3luYyBhcHBlbmRSYXdDb250ZW50KFxuXHRcdGlkOiBzdHJpbmcsXG5cdFx0dGV4dDogc3RyaW5nLFxuXHRcdGNsaWVudDogT2xsYW1hQ2xpZW50LFxuXHRcdHNldHRpbmdzOiBPbGxhbWFPcmNoZXN0cmF0b3JTZXR0aW5ncyxcblx0XHRvblByb2dyZXNzPzogKHA6IEJ1aWxkUHJvZ3Jlc3MpID0+IHZvaWQsXG5cdFx0dG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlblxuXHQpOiBQcm9taXNlPE1lbW9yeVRvcGljPiB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLmRhdGEubWVtb3JpZXNbaWRdO1xuXHRcdGNvbnN0IG1lbW9yeSA9IGV4aXN0aW5nXG5cdFx0XHQ/IGF3YWl0IGV4dGVuZExheWVyZWRNZW1vcnkoZXhpc3RpbmcsIHRleHQsIGNsaWVudCwgc2V0dGluZ3MsIG9uUHJvZ3Jlc3MsIHRva2VuKVxuXHRcdFx0OiBhd2FpdCBidWlsZExheWVyZWRNZW1vcnkodGV4dCwgY2xpZW50LCBzZXR0aW5ncywgb25Qcm9ncmVzcywgdG9rZW4pO1xuXHRcdHJldHVybiB0aGlzLnVwZGF0ZVRvcGljKGlkLCBtZW1vcnkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjcmVhdGVUb3BpYyhuYW1lOiBzdHJpbmcsIG1lbW9yeTogTGF5ZXJlZE1lbW9yeSk6IFByb21pc2U8TWVtb3J5VG9waWM+IHtcblx0XHRhd2FpdCB0aGlzLmVuc3VyZUZvbGRlcih0aGlzLmZvbGRlcik7XG5cdFx0Y29uc3QgaWQgPSBgJHtzbHVnaWZ5KG5hbWUpfS0ke0RhdGUubm93KCkudG9TdHJpbmcoMzYpfS0ke01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIDFlNCkudG9TdHJpbmcoMzYpfWA7XG5cdFx0Y29uc3Qgc2x1Z0Jhc2UgPSBgJHtzbHVnaWZ5KG5hbWUpfS0ke2lkLnNsaWNlKC04KX1gO1xuXHRcdGNvbnN0IG5vdGVQYXRoID0gbm9ybWFsaXplUGF0aChgJHt0aGlzLmZvbGRlcn0vJHtzbHVnQmFzZX0ubWRgKTtcblx0XHRjb25zdCBmb2xkZXJQYXRoID0gbm9ybWFsaXplUGF0aChgJHt0aGlzLmZvbGRlcn0vJHtzbHVnQmFzZX1gKTtcblxuXHRcdGNvbnN0IHRvcGljOiBNZW1vcnlUb3BpYyA9IHsgaWQsIG5hbWUsIG92ZXJ2aWV3OiBtZW1vcnkubGF5ZXJzWzBdLnRleHQsIG5vdGVQYXRoLCBmb2xkZXJQYXRoLCB1cGRhdGVkQXQ6IERhdGUubm93KCkgfTtcblx0XHR0aGlzLmRhdGEudG9waWNzW2lkXSA9IHRvcGljO1xuXHRcdHRoaXMuZGF0YS5tZW1vcmllc1tpZF0gPSBtZW1vcnk7XG5cblx0XHRhd2FpdCB0aGlzLndyaXRlQWxsRmlsZXModG9waWMsIG1lbW9yeSk7XG5cdFx0YXdhaXQgdGhpcy5wZXJzaXN0KCk7XG5cdFx0cmV0dXJuIHRvcGljO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVUb3BpYyhpZDogc3RyaW5nLCBtZW1vcnk6IExheWVyZWRNZW1vcnkpOiBQcm9taXNlPE1lbW9yeVRvcGljPiB7XG5cdFx0Y29uc3QgdG9waWMgPSB0aGlzLmRhdGEudG9waWNzW2lkXTtcblx0XHRpZiAoIXRvcGljKSB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gbWVtb3J5IHRvcGljOiAke2lkfWApO1xuXG5cdFx0dG9waWMub3ZlcnZpZXcgPSBtZW1vcnkubGF5ZXJzWzBdLnRleHQ7XG5cdFx0dG9waWMudXBkYXRlZEF0ID0gRGF0ZS5ub3coKTtcblx0XHR0aGlzLmRhdGEubWVtb3JpZXNbaWRdID0gbWVtb3J5O1xuXG5cdFx0YXdhaXQgdGhpcy53cml0ZUFsbEZpbGVzKHRvcGljLCBtZW1vcnkpO1xuXHRcdGF3YWl0IHRoaXMucGVyc2lzdCgpO1xuXHRcdHJldHVybiB0b3BpYztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd3JpdGVBbGxGaWxlcyh0b3BpYzogTWVtb3J5VG9waWMsIG1lbW9yeTogTGF5ZXJlZE1lbW9yeSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMud3JpdGVGaWxlKHRvcGljLm5vdGVQYXRoLCByZW5kZXJNYWluTm90ZSh0b3BpYywgbWVtb3J5KSk7XG5cblx0XHRpZiAobWVtb3J5LmxheWVycy5sZW5ndGggPiAxKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmVuc3VyZUZvbGRlcih0b3BpYy5mb2xkZXJQYXRoKTtcblx0XHRcdGZvciAobGV0IGkgPSAxOyBpIDwgbWVtb3J5LmxheWVycy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBsYXllciA9IG1lbW9yeS5sYXllcnNbaV07XG5cdFx0XHRcdGF3YWl0IHRoaXMud3JpdGVGaWxlKG5vcm1hbGl6ZVBhdGgoYCR7dG9waWMuZm9sZGVyUGF0aH0vJHtsYXllckZpbGVOYW1lKGxheWVyKX1gKSwgcmVuZGVyTGF5ZXJGaWxlKHRvcGljLCBsYXllcikpO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy53cml0ZUZpbGUobm9ybWFsaXplUGF0aChgJHt0b3BpYy5mb2xkZXJQYXRofS9vcmlnaW5hbC5tZGApLCByZW5kZXJPcmlnaW5hbEZpbGUodG9waWMsIG1lbW9yeSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd3JpdGVGaWxlKHBhdGg6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCk7XG5cdFx0aWYgKGV4aXN0aW5nIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShleGlzdGluZywgY29udGVudCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUocGF0aCwgY29udGVudCk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHQvLyBQYXRoIGNvbGxpc2lvbiBkZXNwaXRlIHRoZSB1bmlxdWUgaWQgc3VmZml4IChlLmcuIGEgc3RhbGUgdmF1bHRcblx0XHRcdC8vIGNhY2hlKSBcdTIwMTQgZmFsbCBiYWNrIHRvIG1vZGlmeWluZyB3aGF0ZXZlciBpcyBhY3R1YWxseSB0aGVyZVxuXHRcdFx0Ly8gcmF0aGVyIHRoYW4gc2lsZW50bHkgbG9zaW5nIHRoZSBjb250ZW50LlxuXHRcdFx0Y29uc3QgcmV0cnkgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCk7XG5cdFx0XHRpZiAocmV0cnkgaW5zdGFuY2VvZiBURmlsZSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkocmV0cnksIGNvbnRlbnQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhyb3cgZXJyO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuIiwgIi8qKlxuICogT2JzaWRpYW4ncyBgcmVxdWVzdFVybGAgaGFzIG5vIGFib3J0L3NpZ25hbCBzdXBwb3J0LCBzbyBhbiBpbi1mbGlnaHQgSFRUUFxuICogY2FsbCB0byBPbGxhbWEgY2FuJ3QgdHJ1bHkgYmUga2lsbGVkIG9uY2UgaXQncyBiZWVuIHNlbnQuIENhbmNlbGxhdGlvblxuICogaGVyZSBpcyB0aGVyZWZvcmUgY29vcGVyYXRpdmU6IGxvbmctcnVubmluZyBvcGVyYXRpb25zIGFyZSBidWlsdCBhcyBhXG4gKiBzZXF1ZW5jZSBvZiBkaXNjcmV0ZSBzdGVwcyAoY2h1bmtzLCBsYXllcnMsIHNlYXJjaCByb3VuZHMpLCBhbmQgZWFjaCBzdGVwXG4gKiBjaGVja3MgYSBzaGFyZWQgdG9rZW4gYmVmb3JlIHN0YXJ0aW5nIHRoZSBuZXh0IG9uZS4gQ2xpY2tpbmcgXCJjYW5jZWxcIlxuICogY2FuJ3Qgc3RvcCB3aGljaGV2ZXIgc2luZ2xlIGNhbGwgaXMgYWxyZWFkeSBpbiBmbGlnaHQsIGJ1dCBpdCBkb2VzIHN0b3BcbiAqIGFueSBmdXJ0aGVyIGNhbGxzIGZyb20gYmVpbmcgcXVldWVkIHVwIGJlaGluZCBpdCBcdTIwMTQgd2hpY2ggaXMgd2hhdFxuICogYWN0dWFsbHkgbWF0dGVycyBmb3Igbm90IHN1cmdpbmcgbW9yZSByZXF1ZXN0cyBhdCBPbGxhbWEgdGhhbiB0aGUgdXNlclxuICogc3RpbGwgd2FudHMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ2FuY2VsbGF0aW9uVG9rZW4ge1xuXHRpc0NhbmNlbGxlZCgpOiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgQ2FuY2VsbGVkRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKFwiQ2FuY2VsbGVkXCIpO1xuXHRcdHRoaXMubmFtZSA9IFwiQ2FuY2VsbGVkRXJyb3JcIjtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNDYW5jZWxsZWRFcnJvcihlcnI6IHVua25vd24pOiBlcnIgaXMgQ2FuY2VsbGVkRXJyb3Ige1xuXHRyZXR1cm4gZXJyIGluc3RhbmNlb2YgQ2FuY2VsbGVkRXJyb3I7XG59XG5cbmV4cG9ydCBjbGFzcyBDYW5jZWxsYXRpb25Tb3VyY2Uge1xuXHRwcml2YXRlIF9jYW5jZWxsZWQgPSBmYWxzZTtcblxuXHRjYW5jZWwoKTogdm9pZCB7XG5cdFx0dGhpcy5fY2FuY2VsbGVkID0gdHJ1ZTtcblx0fVxuXG5cdGdldCBpc0NhbmNlbGxlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY2FuY2VsbGVkO1xuXHR9XG5cblx0cmVhZG9ubHkgdG9rZW46IENhbmNlbGxhdGlvblRva2VuID0ge1xuXHRcdGlzQ2FuY2VsbGVkOiAoKSA9PiB0aGlzLl9jYW5jZWxsZWQsXG5cdH07XG59XG5cbi8qKiBUaHJvd3MgQ2FuY2VsbGVkRXJyb3IgaWYgdGhlIHRva2VuIGhhcyBiZWVuIGNhbmNlbGxlZCBcdTIwMTQgY2FsbCBiZXR3ZWVuIHN0ZXBzIG9mIGEgbXVsdGktc3RlcCBvcGVyYXRpb24uICovXG5leHBvcnQgZnVuY3Rpb24gdGhyb3dJZkNhbmNlbGxlZCh0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogdm9pZCB7XG5cdGlmICh0b2tlbj8uaXNDYW5jZWxsZWQoKSkgdGhyb3cgbmV3IENhbmNlbGxlZEVycm9yKCk7XG59XG4iLCAiaW1wb3J0IHsgT2xsYW1hQ2xpZW50IH0gZnJvbSBcIi4vb2xsYW1hQ2xpZW50XCI7XG5pbXBvcnQgeyBPbGxhbWFPcmNoZXN0cmF0b3JTZXR0aW5ncyB9IGZyb20gXCIuL3NldHRpbmdzXCI7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgdGhyb3dJZkNhbmNlbGxlZCB9IGZyb20gXCIuL2NhbmNlbGxhdGlvblwiO1xuXG4vKipcbiAqIExMTS1kcml2ZW4gY2h1bmtpbmcuXG4gKlxuICogVGhlIHByZXZpb3VzIHZlcnNpb24gb2YgdGhpcyBmaWxlIHNwbGl0IHJhdyB0ZXh0IG1lY2hhbmljYWxseSBvblxuICogY2hhcmFjdGVycy9zZW50ZW5jZXMgKHdpdGggY29uZmlndXJhYmxlIGNlaWxpbmdzIGFuZCBvdmVybGFwKS4gVGhhdCdzXG4gKiBnb25lOiBzcGxpdHRpbmcgaXMgbm93IGxlZnQgZW50aXJlbHkgdXAgdG8gdGhlIExMTSwgd2hpY2ggaXMgYXNrZWQgdG9cbiAqIG1hcmsgd2hlcmUgaXQgd291bGQgbmF0dXJhbGx5IGJyZWFrIHRoZSB0ZXh0ICh0b3BpYyBzaGlmdHMsIHNjZW5lL3NlY3Rpb25cbiAqIGJvdW5kYXJpZXMpIHJhdGhlciB0aGFuIHVzIGNvdW50aW5nIGNoYXJhY3RlcnMgb3Igc2VudGVuY2VzLiBUaGVyZSBhcmVcbiAqIGRlbGliZXJhdGVseSBubyB1c2VyLWZhY2luZyBzaXplL292ZXJsYXAgc2V0dGluZ3MgZm9yIHRoaXMgYW55bW9yZSBcdTIwMTQgaXQnc1xuICogYSBwbGFjZWhvbGRlciBmb3IgYSBjaHVua2luZyBhcHByb2FjaCB0aGF0J3Mgc3RpbGwgdmVyeSBtdWNoIGV4cGVjdGVkIHRvXG4gKiBjaGFuZ2UuXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBDaHVuayB7XG5cdGluZGV4OiBudW1iZXI7XG5cdHRleHQ6IHN0cmluZztcbn1cblxuY29uc3QgQ0hVTktfTUFSS0VSID0gXCI8PDxDSFVOS19CUkVBSz4+PlwiO1xuXG4vLyBQdXJlbHkgYSB0ZWNobmljYWwgY2VpbGluZyBvbiBob3cgbXVjaCByYXcgdGV4dCBnb2VzIGludG8gYSBzaW5nbGVcbi8vIFwiaW5zZXJ0IGNodW5rIG1hcmtlcnNcIiBjYWxsLCBzbyB3ZSBkb24ndCBibG93IHBhc3QgdGhlIG1vZGVsJ3MgY29udGV4dFxuLy8gd2luZG93LiBUaGlzIGlzIE5PVCBwYXJ0IG9mIHRoZSBjaHVua2luZyBhbGdvcml0aG0gaXRzZWxmIChpdCBkb2Vzbid0XG4vLyBkZWNpZGUgd2hlcmUgY2h1bmtzIGZhbGwgXHUyMDE0IHRoZSBtb2RlbCBkb2VzKSBhbmQgaXNuJ3QgZXhwb3NlZCBhcyBhXG4vLyBzZXR0aW5nOyBpdCdzIGp1c3QgaG93IGxhcmdlIGEgcHJlLXNwbGl0IGdyb3VwIGNhbiBiZSBiZWZvcmUgaXQncyBoYW5kZWRcbi8vIHRvIHRoZSBtb2RlbC4gT3ZlcnNpemVkIHRleHQgaXMgcHJlLXNwbGl0IG9uIGJsYW5rIGxpbmVzICh0aGUgc2ltcGxlc3Rcbi8vIGNvbnRlbnQtYWdub3N0aWMgc3BsaXQgYXZhaWxhYmxlKSBwdXJlbHkgc28gZWFjaCBwaWVjZSBmaXRzLlxuY29uc3QgTUFYX0xMTV9DSFVOS19JTlBVVF9DSEFSUyA9IDEyMDAwO1xuXG5jb25zdCBMTE1fQ0hVTktfUFJPTVBUID1cblx0YFNwbGl0IHRoZSB0ZXh0IGJlbG93IGludG8gdG9waWNhbGx5IGNvaGVyZW50IGNodW5rcyBcdTIwMTQgZWFjaCBjaHVuayBzaG91bGQgY292ZXIgb25lIGNvbnRpbnVvdXMgc2NlbmUsIHNlY3Rpb24sIG9yIHRvcGljLCBhbmQgc2hvdWxkbid0IGN1dCBvZmYgbWlkLXRob3VnaHQuIEluc2VydCB0aGUgZXhhY3QgbWFya2VyIFwiJHtDSFVOS19NQVJLRVJ9XCIgb24gaXRzIG93biBsaW5lIGF0IGV2ZXJ5IHBvaW50IHlvdSdkIHNwbGl0LCBhbmQgbm93aGVyZSBlbHNlLiBSZXByb2R1Y2UgdGhlIEVOVElSRSBvcmlnaW5hbCB0ZXh0IGV4YWN0bHkgYXMgZ2l2ZW4gXHUyMDE0IGRvIG5vdCBhbHRlciwgc3VtbWFyaXplLCBvbWl0LCBvciBhZGQgdG8gaXQgaW4gYW55IHdheTsgb25seSBpbnNlcnQgbWFya2VyIGxpbmVzLiBObyBwcmVhbWJsZSwgbm8gY29tbWVudGFyeSBcdTIwMTQgb3V0cHV0IG9ubHkgdGhlIG9yaWdpbmFsIHRleHQgd2l0aCB0aGUgbWFya2VycyBpbnNlcnRlZC5gO1xuXG4vKipcbiAqIE5haXZlLCBjb250ZW50LWFnbm9zdGljIHNwbGl0IHVzZWQgb25seSB0byBrZWVwIGEgc2luZ2xlIExMTSBjaHVua2luZ1xuICogY2FsbCB3aXRoaW4gYSBzYWZlIGlucHV0IHNpemUgZm9yIG92ZXJzaXplZCBkb2N1bWVudHMgXHUyMDE0IG5vdCBhIHNlbWFudGljXG4gKiBjaHVua2luZyBkZWNpc2lvbiwganVzdCBhIHRlY2huaWNhbCBwcmUtc3BsaXQgc28gY2h1bmtUZXh0V2l0aExMTSgpIGNhblxuICogYmUgYXBwbGllZCBwaWVjZSBieSBwaWVjZS5cbiAqL1xuZnVuY3Rpb24gc3BsaXRGb3JJbnB1dEJ1ZGdldCh0ZXh0OiBzdHJpbmcsIG1heENoYXJzOiBudW1iZXIpOiBzdHJpbmdbXSB7XG5cdGlmICh0ZXh0Lmxlbmd0aCA8PSBtYXhDaGFycykgcmV0dXJuIFt0ZXh0XTtcblxuXHRjb25zdCBwYXJhZ3JhcGhzID0gdGV4dC5zcGxpdCgvXFxuezIsfS8pO1xuXHRjb25zdCBncm91cHM6IHN0cmluZ1tdID0gW107XG5cdGxldCBjdXJyZW50ID0gXCJcIjtcblxuXHRmb3IgKGNvbnN0IHAgb2YgcGFyYWdyYXBocykge1xuXHRcdGNvbnN0IGNhbmRpZGF0ZSA9IGN1cnJlbnQgPyBgJHtjdXJyZW50fVxcblxcbiR7cH1gIDogcDtcblx0XHRpZiAoY2FuZGlkYXRlLmxlbmd0aCA+IG1heENoYXJzICYmIGN1cnJlbnQpIHtcblx0XHRcdGdyb3Vwcy5wdXNoKGN1cnJlbnQpO1xuXHRcdFx0Y3VycmVudCA9IHA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGN1cnJlbnQgPSBjYW5kaWRhdGU7XG5cdFx0fVxuXHR9XG5cdGlmIChjdXJyZW50KSBncm91cHMucHVzaChjdXJyZW50KTtcblxuXHQvLyBBIHNpbmdsZSBwYXJhZ3JhcGggbG9uZ2VyIHRoYW4gdGhlIHdob2xlIGJ1ZGdldCAobm8gYmxhbmsgbGluZXMgdG9cblx0Ly8gc3BsaXQgb24gYXQgYWxsKSBcdTIwMTQgZmFsbCBiYWNrIHRvIGEgaGFyZCBjaGFyYWN0ZXIgY3V0IHNvIHdlIHN0aWxsXG5cdC8vIG1ha2UgZm9yd2FyZCBwcm9ncmVzcyBpbnN0ZWFkIG9mIHNlbmRpbmcgb25lIGdpYW50IGNhbGwuXG5cdHJldHVybiBncm91cHMuZmxhdE1hcCgoZykgPT4ge1xuXHRcdGlmIChnLmxlbmd0aCA8PSBtYXhDaGFycykgcmV0dXJuIFtnXTtcblx0XHRjb25zdCBwaWVjZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBnLmxlbmd0aDsgaSArPSBtYXhDaGFycykgcGllY2VzLnB1c2goZy5zbGljZShpLCBpICsgbWF4Q2hhcnMpKTtcblx0XHRyZXR1cm4gcGllY2VzO1xuXHR9KTtcbn1cblxuLyoqXG4gKiBBc2tzIHRoZSBtb2RlbCB0byBtYXJrIG5hdHVyYWwgYnJlYWsgcG9pbnRzIGluIG9uZSBwaWVjZSBvZiB0ZXh0IChhbHJlYWR5XG4gKiB3aXRoaW4gdGhlIGlucHV0IGJ1ZGdldCkgYW5kIHNwbGl0cyBvbiB0aG9zZSBtYXJrZXJzLiBJZiB0aGUgbW9kZWxcbiAqIGlnbm9yZXMgdGhlIGluc3RydWN0aW9uLCBtYW5nbGVzIHRoZSB0ZXh0LCBvciBkcm9wcyBhIGxhcmdlIGZyYWN0aW9uIG9mXG4gKiBpdCwgdGhpcyBmYWxscyBiYWNrIHRvIHRyZWF0aW5nIHRoZSB3aG9sZSBwaWVjZSBhcyBhIHNpbmdsZSBjaHVuayByYXRoZXJcbiAqIHRoYW4gc2lsZW50bHkgbG9zaW5nIGNvbnRlbnQuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIG1hcmtDaHVua3NXaXRoTExNKFxuXHR0ZXh0OiBzdHJpbmcsXG5cdGNsaWVudDogT2xsYW1hQ2xpZW50LFxuXHRzZXR0aW5nczogT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MsXG5cdHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW5cbik6IFByb21pc2U8c3RyaW5nW10+IHtcblx0Y29uc3QgcHJvbXB0ID0gYCR7TExNX0NIVU5LX1BST01QVH1cXG5cXG4tLS1cXG4ke3RleHR9XFxuLS0tYDtcblx0Y29uc3QgcmF3ID0gKGF3YWl0IGNsaWVudC5nZW5lcmF0ZShzZXR0aW5ncy5zdW1tYXJ5TW9kZWwsIHByb21wdCwgeyB0ZW1wZXJhdHVyZTogMCB9KSkudHJpbSgpO1xuXHR0aHJvd0lmQ2FuY2VsbGVkKHRva2VuKTtcblxuXHRjb25zdCBwYXJ0cyA9IHJhd1xuXHRcdC5zcGxpdChDSFVOS19NQVJLRVIpXG5cdFx0Lm1hcCgocCkgPT4gcC50cmltKCkpXG5cdFx0LmZpbHRlcigocCkgPT4gcC5sZW5ndGggPiAwKTtcblxuXHRjb25zdCByZXByb2R1Y2VkTGVuZ3RoID0gcGFydHMucmVkdWNlKChzdW0sIHApID0+IHN1bSArIHAubGVuZ3RoLCAwKTtcblx0Y29uc3QgbG9zdFRvb011Y2ggPSByZXByb2R1Y2VkTGVuZ3RoIDwgdGV4dC5sZW5ndGggKiAwLjU7XG5cblx0aWYgKHBhcnRzLmxlbmd0aCA8PSAxIHx8IGxvc3RUb29NdWNoKSB7XG5cdFx0cmV0dXJuIFt0ZXh0XTtcblx0fVxuXHRyZXR1cm4gcGFydHM7XG59XG5cbi8qKlxuICogU3BsaXRzIHJhdyBzb3VyY2UgdGV4dCBpbnRvIGNodW5rcyBwdXJlbHkgdmlhIHRoZSBMTE06IHByZS1zcGxpdHMgb25seSBhc1xuICogZmFyIGFzIG5lZWRlZCB0byByZXNwZWN0IHRoZSBtb2RlbCdzIGNvbnRleHQgd2luZG93IChzZWVcbiAqIHNwbGl0Rm9ySW5wdXRCdWRnZXQpLCBhc2tzIHRoZSBtb2RlbCB0byBtYXJrIGJyZWFrIHBvaW50cyB3aXRoaW4gZWFjaFxuICogcGllY2UsIGFuZCBmbGF0dGVucyB0aGUgcmVzdWx0IGludG8gYSBzaW5nbGUgb3JkZXJlZCBjaHVuayBsaXN0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2h1bmtUZXh0V2l0aExMTShcblx0dGV4dDogc3RyaW5nLFxuXHRjbGllbnQ6IE9sbGFtYUNsaWVudCxcblx0c2V0dGluZ3M6IE9sbGFtYU9yY2hlc3RyYXRvclNldHRpbmdzLFxuXHR0b2tlbj86IENhbmNlbGxhdGlvblRva2VuXG4pOiBQcm9taXNlPENodW5rW10+IHtcblx0Y29uc3QgaW5wdXRHcm91cHMgPSBzcGxpdEZvcklucHV0QnVkZ2V0KHRleHQsIE1BWF9MTE1fQ0hVTktfSU5QVVRfQ0hBUlMpO1xuXG5cdGNvbnN0IGFsbFBhcnRzOiBzdHJpbmdbXSA9IFtdO1xuXHRmb3IgKGNvbnN0IGdyb3VwIG9mIGlucHV0R3JvdXBzKSB7XG5cdFx0dGhyb3dJZkNhbmNlbGxlZCh0b2tlbik7XG5cdFx0Y29uc3QgcGFydHMgPSBhd2FpdCBtYXJrQ2h1bmtzV2l0aExMTShncm91cCwgY2xpZW50LCBzZXR0aW5ncywgdG9rZW4pO1xuXHRcdGFsbFBhcnRzLnB1c2goLi4ucGFydHMpO1xuXHR9XG5cblx0cmV0dXJuIGFsbFBhcnRzLm1hcCgodCwgaSkgPT4gKHsgaW5kZXg6IGksIHRleHQ6IHQgfSkpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFVuaXRDaHVuayB7XG5cdGluZGV4OiBudW1iZXI7XG5cdHNvdXJjZUluZGljZXM6IG51bWJlcltdOyAvLyBpbmRpY2VzIGludG8gdGhlIGlucHV0IGB1bml0c2AgYXJyYXkgdGhhdCBjb21wb3NlIHRoaXMgY2h1bmtcblx0dGV4dDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFVuaXRDaHVua1BhcmFtcyB7XG5cdG1heENoYXJzOiBudW1iZXI7XG5cdG1heFVuaXRzOiBudW1iZXI7XG5cdG92ZXJsYXBVbml0czogbnVtYmVyO1xufVxuXG4vKipcbiAqIEdyb3VwcyB3aG9sZSBwcmUtZm9ybWVkIHRleHQgdW5pdHMgKGUuZy4gcHJpb3ItbGV2ZWwgc3VtbWFyaWVzKSB0b2dldGhlclxuICogYnkgYSBjaGFyYWN0ZXIgYnVkZ2V0LCB3aXRoIHVuaXQtbGV2ZWwgb3ZlcmxhcCBhY3Jvc3MgZ3JvdXAgYm91bmRhcmllcy5cbiAqIFVzZWQgdG8gYmF0Y2ggYWxyZWFkeS1zdW1tYXJpemVkIHBhcnRzIGJhY2sgdG9nZXRoZXIgZHVyaW5nIG1lcmdlIHBhc3Nlc1xuICogXHUyMDE0IGEgZGlzdGluY3QsIHN0aWxsLW1lY2hhbmljYWwgY29uY2VybiBmcm9tIGNodW5rVGV4dFdpdGhMTE0oKSBhYm92ZVxuICogKHdoaWNoIHNwbGl0cyByYXcgc291cmNlIHRleHQpLCBzbyBpdCBrZWVwcyBpdHMgY2hhci1idWRnZXQvb3ZlcmxhcFxuICogZ3JvdXBpbmcgcmF0aGVyIHRoYW4gZ29pbmcgdGhyb3VnaCB0aGUgTExNIGl0c2VsZi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNodW5rVW5pdHModW5pdHM6IHN0cmluZ1tdLCBwYXJhbXM6IFVuaXRDaHVua1BhcmFtcyk6IFVuaXRDaHVua1tdIHtcblx0Y29uc3QgeyBtYXhDaGFycywgbWF4VW5pdHMsIG92ZXJsYXBVbml0cyB9ID0gcGFyYW1zO1xuXHRjb25zdCBjaHVua3M6IFVuaXRDaHVua1tdID0gW107XG5cblx0bGV0IGkgPSAwO1xuXHR3aGlsZSAoaSA8IHVuaXRzLmxlbmd0aCkge1xuXHRcdGNvbnN0IGN1cnJlbnQ6IG51bWJlcltdID0gW107XG5cdFx0bGV0IGNoYXJDb3VudCA9IDA7XG5cdFx0bGV0IGogPSBpO1xuXG5cdFx0d2hpbGUgKGogPCB1bml0cy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IHUgPSB1bml0c1tqXTtcblx0XHRcdGNvbnN0IGFkZGVkTGVuID0gdS5sZW5ndGggKyAyOyAvLyBzZXBhcmF0b3IgYWxsb3dhbmNlXG5cblx0XHRcdGlmIChjaGFyQ291bnQgKyBhZGRlZExlbiA+IG1heENoYXJzICYmIGN1cnJlbnQubGVuZ3RoID4gMCkgYnJlYWs7XG5cdFx0XHRpZiAoY3VycmVudC5sZW5ndGggPj0gbWF4VW5pdHMpIGJyZWFrO1xuXG5cdFx0XHRjdXJyZW50LnB1c2goaik7XG5cdFx0XHRjaGFyQ291bnQgKz0gYWRkZWRMZW47XG5cdFx0XHRqKys7XG5cblx0XHRcdC8vIERvbid0IGRvdWJsZS1pbmNyZW1lbnQgYGpgIGhlcmUsIG9yIG5leHRTdGFydCBvdmVyc2hvb3RzIGFuZCBhXG5cdFx0XHQvLyB1bml0IGdldHMgc2lsZW50bHkgZHJvcHBlZCB3aGVuZXZlciBvdmVybGFwVW5pdHMgaXMgc21hbGwuXG5cdFx0XHRpZiAoY2hhckNvdW50ID4gbWF4Q2hhcnMpIGJyZWFrO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRleHQgPSBjdXJyZW50Lm1hcCgoaWR4KSA9PiB1bml0c1tpZHhdKS5qb2luKFwiXFxuXFxuXCIpO1xuXHRcdGNodW5rcy5wdXNoKHsgaW5kZXg6IGNodW5rcy5sZW5ndGgsIHNvdXJjZUluZGljZXM6IFsuLi5jdXJyZW50XSwgdGV4dCB9KTtcblxuXHRcdGNvbnN0IG5leHRTdGFydCA9IE1hdGgubWF4KGkgKyAxLCBqIC0gb3ZlcmxhcFVuaXRzKTtcblx0XHRpZiAobmV4dFN0YXJ0IDw9IGkpIGJyZWFrO1xuXHRcdGkgPSBuZXh0U3RhcnQ7XG5cdH1cblxuXHRyZXR1cm4gY2h1bmtzO1xufVxuIiwgImltcG9ydCB7IE9sbGFtYUNsaWVudCB9IGZyb20gXCIuL29sbGFtYUNsaWVudFwiO1xuaW1wb3J0IHsgT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xuaW1wb3J0IHsgY2h1bmtUZXh0V2l0aExMTSwgY2h1bmtVbml0cyB9IGZyb20gXCIuL2NodW5rZXJcIjtcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCB0aHJvd0lmQ2FuY2VsbGVkIH0gZnJvbSBcIi4vY2FuY2VsbGF0aW9uXCI7XG5cbi8qKiBPbmUgbmFtZWQgdGllciBvZiBhIG1lbW9yeSdzIHByb2dyZXNzaXZlLWFic3RyYWN0aW9uIHN0YWNrLiBpbmRleCAwID0gT3ZlcnZpZXcgKGxlYXN0IGRldGFpbCk7IHRoZSBoaWdoZXN0IGluZGV4ID0gQ29tcHJlaGVuc2l2ZSBTdW1tYXJ5IChtb3N0IGRldGFpbCwgYnVpbHQgZGlyZWN0bHkgZnJvbSB0aGUgc291cmNlKS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTWVtb3J5TGF5ZXIge1xuXHRpbmRleDogbnVtYmVyO1xuXHRuYW1lOiBzdHJpbmc7XG5cdHRleHQ6IHN0cmluZztcbn1cblxuLyoqIEEgbWVtb3J5IHN0b3JlZCBhcyBhIGZpeGVkIHN0YWNrIG9mIG5hbWVkIGxheWVycywgcGx1cyB0aGUgcmF3IHNvdXJjZSBpdCB3YXMgYnVpbHQgZnJvbS4gbGF5ZXJzWzBdID0gT3ZlcnZpZXcgLi4uIGxheWVyc1tsYXN0XSA9IENvbXByZWhlbnNpdmUgU3VtbWFyeS4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgTGF5ZXJlZE1lbW9yeSB7XG5cdGxheWVyczogTWVtb3J5TGF5ZXJbXTtcblx0b3JpZ2luYWw6IHN0cmluZztcblx0YnVpbHRBdDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJ1aWxkUHJvZ3Jlc3Mge1xuXHQvKiogLTEgd2hpbGUgc3RpbGwgYnVpbGRpbmcgdGhlIGJhc2UgQ29tcHJlaGVuc2l2ZSBTdW1tYXJ5IGZyb20gcmF3IGNodW5rczsgb3RoZXJ3aXNlIHRoZSB0YXJnZXQgbGF5ZXIncyBpbmRleC4gKi9cblx0bGF5ZXJJbmRleDogbnVtYmVyO1xuXHRsYXllck5hbWU6IHN0cmluZztcblx0cGhhc2U6IHN0cmluZztcblx0c3RhdHVzOiBcInN0YXJ0aW5nXCIgfCBcImRvbmVcIjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMYXllclJvbGUge1xuXHRuYW1lOiBzdHJpbmc7XG5cdC8qKiB3aGF0IHRoaXMgbGF5ZXIncyBzdW1tYXJ5IHNob3VsZCBjb250YWluLCBwaHJhc2VkIGZvciB0aGUgcHJvbXB0LiAqL1xuXHR0YXJnZXREZXNjcmlwdGlvbjogc3RyaW5nO1xufVxuXG4vKipcbiAqIERlZmluZXMgdGhlIHNlbWFudGljIHJvbGUgb2YgZWFjaCBsYXllciBpbiB0aGUgc3RhY2suIE5hbWVkIGV4YWN0bHkgYXNcbiAqIHNwZWNpZmllZCBmb3IgdGhlIGRlZmF1bHQgMy1sYXllciBjYXNlIChPdmVydmlldyAvIEhpZ2gtTGV2ZWwgQ29uY2VwdHMgL1xuICogRGV0YWlsZWQgQ29uY2VwdHMgLyBDb21wcmVoZW5zaXZlIFN1bW1hcnkpOyBvdGhlciBjb25maWd1cmVkIGxheWVyIGNvdW50c1xuICogZ2V0IGEgZ2VuZXJpYyBuYW1lIHdpdGggYSB0YXJnZXQgZGVzY3JpcHRpb24gaW50ZXJwb2xhdGVkIGJldHdlZW5cbiAqIFwiaGlnaC1sZXZlbFwiIChuZWFyIHRoZSBPdmVydmlldykgYW5kIFwiZGV0YWlsZWRcIiAobmVhciB0aGUgQ29tcHJlaGVuc2l2ZVxuICogU3VtbWFyeSkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBsYXllclJvbGUoaW5kZXg6IG51bWJlciwgbnVtQWJzdHJhY3Rpb25MYXllcnM6IG51bWJlcik6IExheWVyUm9sZSB7XG5cdGlmIChpbmRleCA9PT0gMCkge1xuXHRcdHJldHVybiB7IG5hbWU6IFwiT3ZlcnZpZXdcIiwgdGFyZ2V0RGVzY3JpcHRpb246IFwiYSBmZXcgc2VudGVuY2VzIGdpdmluZyBhIHF1aWNrIHVuZGVyc3RhbmRpbmcgb2YgdGhlIGNvbnRlbnRcIiB9O1xuXHR9XG5cdGlmIChpbmRleCA9PT0gbnVtQWJzdHJhY3Rpb25MYXllcnMpIHtcblx0XHRyZXR1cm4geyBuYW1lOiBcIkNvbXByZWhlbnNpdmUgU3VtbWFyeVwiLCB0YXJnZXREZXNjcmlwdGlvbjogXCJhIG5lYXItY29tcGxldGUgc3VtbWFyeSB0aGF0IHByZXNlcnZlcyBtb3N0IG9mIHRoZSBvcmlnaW5hbCBpbmZvcm1hdGlvblwiIH07XG5cdH1cblx0aWYgKG51bUFic3RyYWN0aW9uTGF5ZXJzID09PSAzKSB7XG5cdFx0aWYgKGluZGV4ID09PSAxKSByZXR1cm4geyBuYW1lOiBcIkhpZ2gtTGV2ZWwgQ29uY2VwdHNcIiwgdGFyZ2V0RGVzY3JpcHRpb246IFwidGhlIG1haW4gaWRlYXMsIHRoZW1lcywgYW5kIHJlbGF0aW9uc2hpcHNcIiB9O1xuXHRcdGlmIChpbmRleCA9PT0gMikgcmV0dXJuIHsgbmFtZTogXCJEZXRhaWxlZCBDb25jZXB0c1wiLCB0YXJnZXREZXNjcmlwdGlvbjogXCJtb3JlIHNwZWNpZmljIGV4cGxhbmF0aW9ucywgaW1wb3J0YW50IGRldGFpbHMsIGFuZCBzdXBwb3J0aW5nIGNvbnRleHRcIiB9O1xuXHR9XG5cdGNvbnN0IHQgPSBpbmRleCAvIG51bUFic3RyYWN0aW9uTGF5ZXJzO1xuXHRjb25zdCB0YXJnZXREZXNjcmlwdGlvbiA9IHQgPD0gMC41XG5cdFx0PyBcInRoZSBtYWluIGlkZWFzLCB0aGVtZXMsIGFuZCByZWxhdGlvbnNoaXBzLCBpbiBzb21ld2hhdCBtb3JlIGRldGFpbCB0aGFuIHRoZSBsYXllciBhYm92ZVwiXG5cdFx0OiBcInNwZWNpZmljIGV4cGxhbmF0aW9ucywgaW1wb3J0YW50IGRldGFpbHMsIGFuZCBzdXBwb3J0aW5nIGNvbnRleHQsIHdoaWxlIHN0YXlpbmcgbW9yZSBjb21wYWN0IHRoYW4gdGhlIGxheWVyIGJlbG93XCI7XG5cdHJldHVybiB7IG5hbWU6IGBMYXllciAke2luZGV4fSBvZiAke251bUFic3RyYWN0aW9uTGF5ZXJzfWAsIHRhcmdldERlc2NyaXB0aW9uIH07XG59XG5cbmZ1bmN0aW9uIGxheWVyUHJvbXB0KHJvbGU6IExheWVyUm9sZSwgc291cmNlTGF5ZXJOYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRyZXR1cm4gYFRoZSB0ZXh0IGJlbG93IGlzIHRoZSBcIiR7c291cmNlTGF5ZXJOYW1lfVwiIGxheWVyIG9mIGEgcGllY2Ugb2YgY29udGVudC4gUHJvZHVjZSB0aGUgXCIke3JvbGUubmFtZX1cIiBsYXllciBmcm9tIGl0OiAke3JvbGUudGFyZ2V0RGVzY3JpcHRpb259LiBJdCBtdXN0IHN0YXkgZnVsbHkgY29uc2lzdGVudCB3aXRoIHRoZSB0ZXh0IGJlbG93IGFuZCBtdXN0IG5vdCBpbnRyb2R1Y2UgYW55IGluZm9ybWF0aW9uIHRoYXQgaXNuJ3QgYWxyZWFkeSBpbiBpdCBcdTIwMTQgb25seSBzZWxlY3QsIGNvbmRlbnNlLCBvciByZW9yZ2FuaXplIHdoYXQncyBhbHJlYWR5IHRoZXJlLCBuZXZlciBpbnZlbnQgbmV3IGZhY3RzLiBObyBwcmVhbWJsZSwganVzdCB0aGUgc3VtbWFyeSBpdHNlbGYuYDtcbn1cblxuY29uc3QgRkFDVF9FWFRSQUNUSU9OX1BST01QVCA9XG5cdFwiWW91IGFyZSBjYXJlZnVsbHkgcmVhZGluZyBvbmUgcGFydCBvZiBhIGxvbmdlciBwaWVjZSBvZiB3cml0aW5nLCBidWlsZGluZyBhbiBhY2N1cmF0ZSwgbmVhci1jb21wbGV0ZSBmYWN0dWFsIHJlY29yZC4gRnJvbSB0aGUgZXhjZXJwdCBiZWxvdywgY2FwdHVyZSBleHBsaWNpdCBpbmZvcm1hdGlvbiBcdTIwMTQgbmFtZWQgcGVvcGxlL2NoYXJhY3RlcnMsIHBsYWNlcywgZGF0ZXMgb3IgdGltZWxpbmUgcG9pbnRzLCBjb25jcmV0ZSBldmVudHMsIHJlbGF0aW9uc2hpcHMsIG9iamVjdHMsIGFuZCBleHBsaWNpdCBmYWN0dWFsIG9yIHdvcmxkYnVpbGRpbmcgY2xhaW1zIFx1MjAxNCBwcmVzZXJ2aW5nIGFzIG11Y2ggZGV0YWlsIGFuZCBudWFuY2UgYXMgeW91IHJlYXNvbmFibHkgY2FuIHJhdGhlciB0aGFuIGNvbXByZXNzaW5nIGFnZ3Jlc3NpdmVseS4gRG8gbm90IGluZmVyIG1vdGl2YXRpb25zLCB0aGVtZXMsIG9yIHN5bWJvbGlzbSB5ZXQuIE5vIHByZWFtYmxlLCBqdXN0IHRoZSByZWNvcmQgaXRzZWxmLlwiO1xuXG5jb25zdCBDT01QUkVIRU5TSVZFX01FUkdFX1BST01QVCA9XG5cdFwiWW91IGFyZSBtZXJnaW5nIHNldmVyYWwgc3VtbWFyaWVzIG9mIGNvbnNlY3V0aXZlIHBhcnRzIG9mIHRoZSBzYW1lIGxvbmdlciBwaWVjZSBvZiB3cml0aW5nIGludG8gb25lIGNvbnRpbnVvdXMgc3VtbWFyeS4gVGhpcyBtdXN0IHN0YXkgbmVhci1jb21wbGV0ZTogY2Fycnkgb3ZlciBldmVyeSBkaXN0aW5jdCBmYWN0IFx1MjAxNCBuYW1lZCBwZW9wbGUvY2hhcmFjdGVycywgcGxhY2VzLCBkYXRlcywgZXZlbnRzLCByZWxhdGlvbnNoaXBzLCBhbmQgZXhwbGljaXQgY2xhaW1zIFx1MjAxNCBmcm9tIGV2ZXJ5IHBhcnQuIE9ubHkgc2hvcnRlbiB3aGVyZSB0d28gcGFydHMgc3RhdGUgdGhlIGxpdGVyYWwgc2FtZSBmYWN0OyBmb2xkIHRoYXQgc2luZ2xlIGR1cGxpY2F0ZSBtZW50aW9uIGludG8gb25lLCBhbmQgdHJpbSBwcm9zZSB0aGF0IGlzIHB1cmUgZmlsbGVyIHdpdGggbm8gaW5mb3JtYXRpb25hbCBjb250ZW50LiBEbyBOT1QgZ2VuZXJhbGl6ZSwgY29tcHJlc3MsIG9yIGRyb3AgZGV0YWlscyBmb3IgdGhlIHNha2Ugb2YgYnJldml0eSBcdTIwMTQgdGhlIG1lcmdlZCBzdW1tYXJ5IHNob3VsZCByZWFkIGFzIHRoZSB1bmlvbiBvZiBldmVyeXRoaW5nIGluIHRoZSBwYXJ0cywgbm90IGEgY29uZGVuc2VkIGRpZ2VzdCBvZiBpdC4gRXhwbGljaXRseSByZWNvbmNpbGUgYW55dGhpbmcgd2hlcmUgYSBsYXRlciBwYXJ0IGNoYW5nZXMsIGNvbnRyYWRpY3RzLCBvciByZXZlYWxzIG5ldyBtZWFuaW5nIGluIGFuIGVhcmxpZXIgb25lIChhIHJldmVhbCwgdHdpc3QsIHVucmVsaWFibGUgbmFycmF0aW9uLCBoaWRkZW4gaWRlbnRpdHksIG9yIHNpbWlsYXIpIFx1MjAxNCBzdGF0ZSB0aGUgcmVzb2x2ZWQgdmVyc2lvbiBvbmNlLCBub3QgYm90aCB2ZXJzaW9ucy4gTm8gcHJlYW1ibGUsIGp1c3QgdGhlIG1lcmdlZCBzdW1tYXJ5LlwiO1xuXG4vKipcbiAqIEEgcm91Z2gsIG5vbi1jaHVua2luZy1yZWxhdGVkIHNpemUgdGhyZXNob2xkIHVzZWQgZm9yIGEgY291cGxlIG9mIHNtYWxsXG4gKiBcImlzIHRoaXMgc2hvcnQgZW5vdWdoIHRvIGp1c3QgZG8gaW4gb25lIGNhbGxcIiBkZWNpc2lvbnMgZWxzZXdoZXJlIChtZXJnaW5nXG4gKiB0d28gY29tcHJlaGVuc2l2ZSBzdW1tYXJpZXMgZGlyZWN0bHksIGNhcHBpbmcgYSBxdWljay1vdmVydmlldyByZWFkLCBhbmRcbiAqIGNhcHBpbmcgYSByYXctbm90ZSBmYWxsYmFjayByZWFkKS4gRGVsaWJlcmF0ZWx5IG5vdCB0aWVkIHRvIHRoZSAobm93XG4gKiBMTE0tZHJpdmVuKSBjaHVua2luZyBhbGdvcml0aG0gXHUyMDE0IHRoaXMgaXMganVzdCBhIHNhbmUgZGVmYXVsdCBmb3IgXCJzbWFsbFxuICogZW5vdWdoIHRvIGhhbmQgdG8gdGhlIG1vZGVsIGRpcmVjdGx5IHdpdGhvdXQgYW55IHNwbGl0dGluZy5cIlxuICovXG5leHBvcnQgY29uc3QgRElSRUNUX1NVTU1BUklaRV9DSEFSX0NBUCA9IDYwMDA7XG5cbmNvbnN0IE1FUkdFX1RXT19DT01QUkVIRU5TSVZFX1BST01QVCA9XG5cdFwiWW91IGFyZSBtZXJnaW5nIHR3byBzdW1tYXJpZXMgb2YgdGhlIFNBTUUgZXZvbHZpbmcgc3ViamVjdDogb25lIHJlcHJlc2VudGluZyBldmVyeXRoaW5nIGtub3duIGJlZm9yZSwgb25lIHJlcHJlc2VudGluZyBuZXcgaW5mb3JtYXRpb24ganVzdCBsZWFybmVkLiBNZXJnZSB0aGVtIGludG8gb25lIGNvbnRpbnVvdXMgc3VtbWFyeSB0aGF0IHN0YXlzIG5lYXItY29tcGxldGUgXHUyMDE0IGtlZXAgZXZlcnkgZGlzdGluY3QgZmFjdCBmcm9tIGJvdGguIE9ubHkgc2hvcnRlbiB3aGVyZSBzb21ldGhpbmcgaXMgcmVzdGF0ZWQgaW4gYm90aCAoZm9sZCB0aGF0IGludG8gb25lIG1lbnRpb24pIG9yIGlzIHB1cmUgZmlsbGVyIHdpdGggbm8gaW5mb3JtYXRpb25hbCBjb250ZW50OyBkbyBOT1QgZ2VuZXJhbGl6ZSwgY29tcHJlc3MsIG9yIGRyb3AgZGV0YWlscyBvdGhlcndpc2UuIElmIHRoZSBuZXcgaW5mb3JtYXRpb24gdXBkYXRlcywgY29ycmVjdHMsIG9yIGNvbnRyYWRpY3RzIHNvbWV0aGluZyBpbiB0aGUgb2xkIHN1bW1hcnksIHN0YXRlIHRoZSByZXNvbHZlZCAobmV3KSB2ZXJzaW9uIG9uY2UgcmF0aGVyIHRoYW4ga2VlcGluZyBib3RoLiBObyBwcmVhbWJsZSwganVzdCB0aGUgbWVyZ2VkIHN1bW1hcnkuXCI7XG5cbmFzeW5jIGZ1bmN0aW9uIHN1bW1hcml6ZVRleHQoY2xpZW50OiBPbGxhbWFDbGllbnQsIHNldHRpbmdzOiBPbGxhbWFPcmNoZXN0cmF0b3JTZXR0aW5ncywgdGV4dDogc3RyaW5nLCBpbnN0cnVjdGlvbjogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0Y29uc3QgcHJvbXB0ID0gYCR7aW5zdHJ1Y3Rpb259XFxuXFxuLS0tXFxuJHt0ZXh0fVxcbi0tLVxcblxcblN1bW1hcnk6YDtcblxuXHRsZXQgb3V0ID0gKGF3YWl0IGNsaWVudC5nZW5lcmF0ZShzZXR0aW5ncy5zdW1tYXJ5TW9kZWwsIHByb21wdCwgeyB0ZW1wZXJhdHVyZTogMC4yIH0pKS50cmltKCk7XG5cdGlmICghb3V0KSB7XG5cdFx0Ly8gU21hbGwgbG9jYWwgbW9kZWxzIG9jY2FzaW9uYWxseSByZXR1cm4gYW4gZW1wdHkgY29tcGxldGlvbiBcdTIwMTQgcmV0cnlcblx0XHQvLyBvbmNlIHdpdGggc2xpZ2h0bHkgaGlnaGVyIHRlbXBlcmF0dXJlIGJlZm9yZSBnaXZpbmcgdXAsIHJhdGhlciB0aGFuXG5cdFx0Ly8gc2lsZW50bHkgbGVhdmluZyBhIGJsYW5rIGxheWVyLlxuXHRcdG91dCA9IChhd2FpdCBjbGllbnQuZ2VuZXJhdGUoc2V0dGluZ3Muc3VtbWFyeU1vZGVsLCBwcm9tcHQsIHsgdGVtcGVyYXR1cmU6IDAuNSB9KSkudHJpbSgpO1xuXHR9XG5cdGlmICghb3V0KSB7XG5cdFx0b3V0ID0gdGV4dC5sZW5ndGggPiAyNDAgPyBgJHt0ZXh0LnNsaWNlKDAsIDI0MCl9XHUyMDI2YCA6IHRleHQ7XG5cdH1cblx0cmV0dXJuIG91dDtcbn1cblxuLyoqXG4gKiBSdW5zIGBmbmAgb3ZlciBldmVyeSBpdGVtLCBuZXZlciBtb3JlIHRoYW4gYGxpbWl0YCBjYWxscyBpbiBmbGlnaHQgYXRcbiAqIG9uY2UgXHUyMDE0IGNodW5rcy9ncm91cHMgd2l0aGluIG9uZSBwYXNzIGFyZSBpbmRlcGVuZGVudCBvZiBlYWNoIG90aGVyLCBzb1xuICogcnVubmluZyB0aGVtIGNvbmN1cnJlbnRseSAocmF0aGVyIHRoYW4gb25lIGF0IGEgdGltZSkgaXMgdGhlIG1haW4gbGV2ZXJcbiAqIGZvciBrZWVwaW5nIHRoaXMgd2hvbGUgcHJvY2VzcyBxdWljayBvbiBsb25nZXIgZG9jdW1lbnRzLlxuICovXG5hc3luYyBmdW5jdGlvbiBtYXBXaXRoQ29uY3VycmVuY3k8VCwgUj4oXG5cdGl0ZW1zOiBUW10sXG5cdGxpbWl0OiBudW1iZXIsXG5cdGZuOiAoaXRlbTogVCwgaW5kZXg6IG51bWJlcikgPT4gUHJvbWlzZTxSPixcblx0dG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlblxuKTogUHJvbWlzZTxSW10+IHtcblx0Y29uc3QgcmVzdWx0czogUltdID0gbmV3IEFycmF5KGl0ZW1zLmxlbmd0aCk7XG5cdGxldCBuZXh0ID0gMDtcblx0Y29uc3QgZWZmZWN0aXZlTGltaXQgPSBNYXRoLm1heCgxLCBNYXRoLm1pbihsaW1pdCwgaXRlbXMubGVuZ3RoIHx8IDEpKTtcblxuXHRhc3luYyBmdW5jdGlvbiB3b3JrZXIoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Zm9yICg7Oykge1xuXHRcdFx0aWYgKHRva2VuPy5pc0NhbmNlbGxlZCgpKSByZXR1cm47IC8vIHN0b3AgcGlja2luZyB1cCBuZXcgd29yazsgd2hhdGV2ZXIncyBhbHJlYWR5IGluIGZsaWdodCBzdGlsbCBmaW5pc2hlcywgYnV0IG5vdGhpbmcgbmV3IGlzIHF1ZXVlZCBiZWhpbmQgaXRcblx0XHRcdGNvbnN0IGkgPSBuZXh0Kys7XG5cdFx0XHRpZiAoaSA+PSBpdGVtcy5sZW5ndGgpIHJldHVybjtcblx0XHRcdHJlc3VsdHNbaV0gPSBhd2FpdCBmbihpdGVtc1tpXSwgaSk7XG5cdFx0fVxuXHR9XG5cblx0YXdhaXQgUHJvbWlzZS5hbGwoQXJyYXkuZnJvbSh7IGxlbmd0aDogZWZmZWN0aXZlTGltaXQgfSwgKCkgPT4gd29ya2VyKCkpKTtcblx0dGhyb3dJZkNhbmNlbGxlZCh0b2tlbik7IC8vIGRvbid0IGhhbmQgYmFjayBhIHBhcnRpYWxseS1maWxsZWQgYXJyYXkgYXMgaWYgaXQgd2VyZSBjb21wbGV0ZVxuXHRyZXR1cm4gcmVzdWx0cztcbn1cblxuLyoqXG4gKiBCdWlsZHMgdGhlIENvbXByZWhlbnNpdmUgU3VtbWFyeSBcdTIwMTQgdGhlIGJhc2UsIG1vc3QtZGV0YWlsZWQgbmFtZWQgbGF5ZXIgXHUyMDE0XG4gKiBkaXJlY3RseSBmcm9tIHJhdyBzb3VyY2UgdGV4dC4gSWYgdGhlIHRleHQgYWxyZWFkeSBmaXRzIGluIG9uZSBjaHVuaywgaXRcbiAqIElTIHRoZSBjb21wcmVoZW5zaXZlIHN1bW1hcnkgKG5vIExMTSBjYWxsIG5lZWRlZDogbm90aGluZyBpcyBtb3JlXG4gKiBcIm5lYXItY29tcGxldGVcIiB0aGFuIHRoZSBvcmlnaW5hbCBpdHNlbGYpLiBPdGhlcndpc2U6IHJlYWQgZXZlcnkgY2h1bmtcbiAqIGNhcmVmdWxseSAocHJlc2VydmluZyBkZXRhaWwsIG5vdCBjb21wcmVzc2luZyBoYXJkKSwgdGhlbiByZXBlYXRlZGx5XG4gKiByZWdyb3VwIGFuZCBtZXJnZSB0aG9zZSByZWFkaW5ncyBcdTIwMTQgcmVjb25jaWxpbmcgb3ZlcmxhcHMgYW5kIGFueSBsYXRlclxuICogcGFydHMgdGhhdCBjaGFuZ2UgdGhlIG1lYW5pbmcgb2YgZWFybGllciBvbmVzIFx1MjAxNCB1bnRpbCBvbmUgY29udGludW91c1xuICogc3VtbWFyeSByZW1haW5zLlxuICovXG5hc3luYyBmdW5jdGlvbiBidWlsZENvbXByZWhlbnNpdmVTdW1tYXJ5KFxuXHRzb3VyY2VUZXh0OiBzdHJpbmcsXG5cdGNsaWVudDogT2xsYW1hQ2xpZW50LFxuXHRzZXR0aW5nczogT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MsXG5cdG9uUHJvZ3Jlc3M/OiAocDogQnVpbGRQcm9ncmVzcykgPT4gdm9pZCxcblx0dG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlblxuKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0Y29uc3QgY2h1bmtzID0gYXdhaXQgY2h1bmtUZXh0V2l0aExMTShzb3VyY2VUZXh0LCBjbGllbnQsIHNldHRpbmdzLCB0b2tlbik7XG5cdHRocm93SWZDYW5jZWxsZWQodG9rZW4pO1xuXG5cdGlmIChjaHVua3MubGVuZ3RoIDw9IDEpIHtcblx0XHQvLyBUaGUgTExNIGRpZG4ndCBmaW5kIGEgbmF0dXJhbCBicmVhayBwb2ludCAob3IgdGhlIHRleHQgd2FzIHRpbnkgdG9cblx0XHQvLyBiZWdpbiB3aXRoKSBcdTIwMTQgbm90aGluZyBtb3JlIFwibmVhci1jb21wbGV0ZVwiIHRoYW4gdGhlIG9yaWdpbmFsIGl0c2VsZi5cblx0XHRyZXR1cm4gc291cmNlVGV4dC50cmltKCk7XG5cdH1cblxuXHRvblByb2dyZXNzPy4oeyBsYXllckluZGV4OiAtMSwgbGF5ZXJOYW1lOiBcIkNvbXByZWhlbnNpdmUgU3VtbWFyeVwiLCBwaGFzZTogYFJlYWRpbmcgJHtjaHVua3MubGVuZ3RofSBjaHVuayhzKSBhbmQgZXh0cmFjdGluZyBmYWN0c2AsIHN0YXR1czogXCJzdGFydGluZ1wiIH0pO1xuXHRsZXQgY3VycmVudFRleHRzID0gYXdhaXQgbWFwV2l0aENvbmN1cnJlbmN5KGNodW5rcywgc2V0dGluZ3MubWF4Q29uY3VycmVudFN1bW1hcmllcywgKGMpID0+IHN1bW1hcml6ZVRleHQoY2xpZW50LCBzZXR0aW5ncywgYy50ZXh0LCBGQUNUX0VYVFJBQ1RJT05fUFJPTVBUKSwgdG9rZW4pO1xuXHRvblByb2dyZXNzPy4oeyBsYXllckluZGV4OiAtMSwgbGF5ZXJOYW1lOiBcIkNvbXByZWhlbnNpdmUgU3VtbWFyeVwiLCBwaGFzZTogYFJlYWQgJHtjaHVua3MubGVuZ3RofSBjaHVuayhzKWAsIHN0YXR1czogXCJkb25lXCIgfSk7XG5cblx0bGV0IHBhc3MgPSAwO1xuXHR3aGlsZSAoY3VycmVudFRleHRzLmxlbmd0aCA+IDEgJiYgcGFzcyA8IHNldHRpbmdzLm1heENodW5rTWVyZ2VQYXNzZXMpIHtcblx0XHR0aHJvd0lmQ2FuY2VsbGVkKHRva2VuKTtcblx0XHRwYXNzKys7XG5cdFx0Y29uc3QgZ3JvdXBlZCA9IGNodW5rVW5pdHMoY3VycmVudFRleHRzLCB7XG5cdFx0XHQvLyBtZXJnZUdyb3VwTWF4Q2hhcnMgaXMgdGhlIHJlYWwgZ2F0ZSBoZXJlIFx1MjAxNCB1bml0cyBhcmUgZ3JvdXBlZFxuXHRcdFx0Ly8gcHVyZWx5IGJ5IGNoYXJhY3RlciBidWRnZXQsIHdpdGggbm8gc2VwYXJhdGUgY2FwIG9uIGhvdyBtYW55XG5cdFx0XHQvLyB1bml0cyBjYW4gbGFuZCBpbiBvbmUgZ3JvdXAgKGEgZmFjdC1leHRyYWN0ZWQgdW5pdCdzIGxlbmd0aFxuXHRcdFx0Ly8gdmFyaWVzIGEgbG90LCBzbyBhbiBhcmJpdHJhcnkgdW5pdC1jb3VudCBjZWlsaW5nIGRvZXNuJ3QgYWRkXG5cdFx0XHQvLyBhbnl0aGluZyB0aGUgY2hhciBidWRnZXQgZG9lc24ndCBhbHJlYWR5IGNvbnRyb2wpLlxuXHRcdFx0bWF4Q2hhcnM6IHNldHRpbmdzLm1lcmdlR3JvdXBNYXhDaGFycyxcblx0XHRcdG1heFVuaXRzOiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUixcblx0XHRcdG92ZXJsYXBVbml0czogc2V0dGluZ3MubWVyZ2VPdmVybGFwVW5pdHMsXG5cdFx0fSk7XG5cdFx0b25Qcm9ncmVzcz8uKHsgbGF5ZXJJbmRleDogLTEsIGxheWVyTmFtZTogXCJDb21wcmVoZW5zaXZlIFN1bW1hcnlcIiwgcGhhc2U6IGBNZXJnZSBwYXNzICR7cGFzc306IGNvbWJpbmluZyAke2N1cnJlbnRUZXh0cy5sZW5ndGh9IHBhcnQocykgaW50byAke2dyb3VwZWQubGVuZ3RofWAsIHN0YXR1czogXCJzdGFydGluZ1wiIH0pO1xuXHRcdGN1cnJlbnRUZXh0cyA9IGF3YWl0IG1hcFdpdGhDb25jdXJyZW5jeShncm91cGVkLCBzZXR0aW5ncy5tYXhDb25jdXJyZW50U3VtbWFyaWVzLCAoZykgPT4gc3VtbWFyaXplVGV4dChjbGllbnQsIHNldHRpbmdzLCBnLnRleHQsIENPTVBSRUhFTlNJVkVfTUVSR0VfUFJPTVBUKSwgdG9rZW4pO1xuXHRcdG9uUHJvZ3Jlc3M/Lih7IGxheWVySW5kZXg6IC0xLCBsYXllck5hbWU6IFwiQ29tcHJlaGVuc2l2ZSBTdW1tYXJ5XCIsIHBoYXNlOiBgTWVyZ2UgcGFzcyAke3Bhc3N9IGRvbmUgXHUyMDE0ICR7Y3VycmVudFRleHRzLmxlbmd0aH0gcGFydChzKSBsZWZ0YCwgc3RhdHVzOiBcImRvbmVcIiB9KTtcblx0fVxuXG5cdGlmIChjdXJyZW50VGV4dHMubGVuZ3RoID4gMSkge1xuXHRcdC8vIFNhZmV0eS1jYXAgZmFsbGJhY2s6IGZvcmNlIG9uZSBmaW5hbCBtZXJnZSByZWdhcmRsZXNzIG9mIHJlbWFpbmluZyBzaXplLlxuXHRcdHJldHVybiBzdW1tYXJpemVUZXh0KGNsaWVudCwgc2V0dGluZ3MsIGN1cnJlbnRUZXh0cy5qb2luKFwiXFxuXFxuXCIpLCBDT01QUkVIRU5TSVZFX01FUkdFX1BST01QVCk7XG5cdH1cblxuXHRyZXR1cm4gY3VycmVudFRleHRzWzBdO1xufVxuXG4vKipcbiAqIENhc2NhZGVzIFVQIGZyb20gdGhlIENvbXByZWhlbnNpdmUgU3VtbWFyeSB0aHJvdWdoIGBudW1BYnN0cmFjdGlvbkxheWVyc2BcbiAqIGZ1cnRoZXIgY29tcHJlc3Npb24gcGFzc2VzLCBlYWNoIG9uZSBkZXJpdmluZyBzdHJpY3RseSBmcm9tIHRoZSBsYXllclxuICogZGlyZWN0bHkgYmVsb3cgaXQgKG5ldmVyIGZyb20gdGhlIHJhdyBzb3VyY2UgYWdhaW4pLCBzbyBldmVyeSBsYXllciBzdGF5c1xuICogYSBmYWl0aGZ1bCwgbm9uLWhhbGx1Y2luYXRlZCBhYnN0cmFjdGlvbiBvZiB0aGUgb25lIGJlbmVhdGggaXQuIFJldHVybnNcbiAqIGxheWVycyBpbmRleGVkIDAgKE92ZXJ2aWV3KSB0aHJvdWdoIG51bUFic3RyYWN0aW9uTGF5ZXJzLTEuXG4gKi9cbmFzeW5jIGZ1bmN0aW9uIGNhc2NhZGVMYXllcnNVcHdhcmQoXG5cdGNvbXByZWhlbnNpdmVUZXh0OiBzdHJpbmcsXG5cdG51bUFic3RyYWN0aW9uTGF5ZXJzOiBudW1iZXIsXG5cdGNsaWVudDogT2xsYW1hQ2xpZW50LFxuXHRzZXR0aW5nczogT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MsXG5cdG9uUHJvZ3Jlc3M/OiAocDogQnVpbGRQcm9ncmVzcykgPT4gdm9pZCxcblx0dG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlblxuKTogUHJvbWlzZTxNZW1vcnlMYXllcltdPiB7XG5cdGNvbnN0IGxheWVyczogTWVtb3J5TGF5ZXJbXSA9IFtdO1xuXHRsZXQgY3VycmVudCA9IGNvbXByZWhlbnNpdmVUZXh0O1xuXHRsZXQgY3VycmVudE5hbWUgPSBcIkNvbXByZWhlbnNpdmUgU3VtbWFyeVwiO1xuXG5cdGZvciAobGV0IGkgPSBudW1BYnN0cmFjdGlvbkxheWVycyAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0dGhyb3dJZkNhbmNlbGxlZCh0b2tlbik7XG5cdFx0Y29uc3Qgcm9sZSA9IGxheWVyUm9sZShpLCBudW1BYnN0cmFjdGlvbkxheWVycyk7XG5cdFx0b25Qcm9ncmVzcz8uKHsgbGF5ZXJJbmRleDogaSwgbGF5ZXJOYW1lOiByb2xlLm5hbWUsIHBoYXNlOiBgRGlzdGlsbGluZyAke3JvbGUubmFtZX1gLCBzdGF0dXM6IFwic3RhcnRpbmdcIiB9KTtcblx0XHRjb25zdCB0ZXh0ID0gYXdhaXQgc3VtbWFyaXplVGV4dChjbGllbnQsIHNldHRpbmdzLCBjdXJyZW50LCBsYXllclByb21wdChyb2xlLCBjdXJyZW50TmFtZSkpO1xuXHRcdGxheWVyc1tpXSA9IHsgaW5kZXg6IGksIG5hbWU6IHJvbGUubmFtZSwgdGV4dCB9O1xuXHRcdG9uUHJvZ3Jlc3M/Lih7IGxheWVySW5kZXg6IGksIGxheWVyTmFtZTogcm9sZS5uYW1lLCBwaGFzZTogYERpc3RpbGxlZCAke3JvbGUubmFtZX1gLCBzdGF0dXM6IFwiZG9uZVwiIH0pO1xuXHRcdGN1cnJlbnQgPSB0ZXh0O1xuXHRcdGN1cnJlbnROYW1lID0gcm9sZS5uYW1lO1xuXHR9XG5cblx0cmV0dXJuIGxheWVycztcbn1cblxuLyoqIEJ1aWxkcyBhIGJyYW5kLW5ldyBsYXllcmVkIG1lbW9yeSBmcm9tIHJhdyBzb3VyY2UgdGV4dDogdGhlIENvbXByZWhlbnNpdmUgU3VtbWFyeSBmaXJzdCwgdGhlbiB0aGUgbmFtZWQgbGF5ZXJzIGNhc2NhZGluZyB1cCB0byB0aGUgT3ZlcnZpZXcuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gYnVpbGRMYXllcmVkTWVtb3J5KFxuXHRzb3VyY2VUZXh0OiBzdHJpbmcsXG5cdGNsaWVudDogT2xsYW1hQ2xpZW50LFxuXHRzZXR0aW5nczogT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MsXG5cdG9uUHJvZ3Jlc3M/OiAocDogQnVpbGRQcm9ncmVzcykgPT4gdm9pZCxcblx0dG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlblxuKTogUHJvbWlzZTxMYXllcmVkTWVtb3J5PiB7XG5cdGNvbnN0IG51bUxheWVycyA9IE1hdGgubWF4KDEsIHNldHRpbmdzLm51bUFic3RyYWN0aW9uTGF5ZXJzKTtcblx0Y29uc3QgY29tcHJlaGVuc2l2ZSA9IGF3YWl0IGJ1aWxkQ29tcHJlaGVuc2l2ZVN1bW1hcnkoc291cmNlVGV4dCwgY2xpZW50LCBzZXR0aW5ncywgb25Qcm9ncmVzcywgdG9rZW4pO1xuXHRjb25zdCB1cHBlckxheWVycyA9IGF3YWl0IGNhc2NhZGVMYXllcnNVcHdhcmQoY29tcHJlaGVuc2l2ZSwgbnVtTGF5ZXJzLCBjbGllbnQsIHNldHRpbmdzLCBvblByb2dyZXNzLCB0b2tlbik7XG5cdGNvbnN0IGxheWVycyA9IFsuLi51cHBlckxheWVycywgeyBpbmRleDogbnVtTGF5ZXJzLCBuYW1lOiBcIkNvbXByZWhlbnNpdmUgU3VtbWFyeVwiLCB0ZXh0OiBjb21wcmVoZW5zaXZlIH1dO1xuXHRyZXR1cm4geyBsYXllcnMsIG9yaWdpbmFsOiBzb3VyY2VUZXh0LCBidWlsdEF0OiBEYXRlLm5vdygpIH07XG59XG5cbi8qKlxuICogR3Jvd3MgYW4gZXhpc3RpbmcgbGF5ZXJlZCBtZW1vcnkgd2l0aCBuZXcgcmF3IHRleHQ6IGJ1aWxkcyBhIGNvbXByZWhlbnNpdmVcbiAqIHN1bW1hcnkgb2YganVzdCB0aGUgbmV3IHRleHQsIG1lcmdlcyBpdCB3aXRoIHRoZSBleGlzdGluZyBDb21wcmVoZW5zaXZlXG4gKiBTdW1tYXJ5IChwcmVmZXJyaW5nIG5ldyBpbmZvcm1hdGlvbiBpZiB0aGUgdHdvIGRpc2FncmVlLCBidXQga2VlcGluZyBib3RoXG4gKiByYXRoZXIgdGhhbiBzaWxlbnRseSBkcm9wcGluZyBvbGQgY29udGV4dCksIHRoZW4gcmVjYXNjYWRlcyBldmVyeSBsYXllclxuICogYWJvdmUgaXQgZnJvbSB0aGF0IG1lcmdlZCB0ZXh0LlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZXh0ZW5kTGF5ZXJlZE1lbW9yeShcblx0ZXhpc3Rpbmc6IExheWVyZWRNZW1vcnksXG5cdG5ld1RleHQ6IHN0cmluZyxcblx0Y2xpZW50OiBPbGxhbWFDbGllbnQsXG5cdHNldHRpbmdzOiBPbGxhbWFPcmNoZXN0cmF0b3JTZXR0aW5ncyxcblx0b25Qcm9ncmVzcz86IChwOiBCdWlsZFByb2dyZXNzKSA9PiB2b2lkLFxuXHR0b2tlbj86IENhbmNlbGxhdGlvblRva2VuXG4pOiBQcm9taXNlPExheWVyZWRNZW1vcnk+IHtcblx0Y29uc3QgbnVtTGF5ZXJzID0gTWF0aC5tYXgoMSwgc2V0dGluZ3MubnVtQWJzdHJhY3Rpb25MYXllcnMpO1xuXHRjb25zdCBleGlzdGluZ0NvbXByZWhlbnNpdmUgPSBleGlzdGluZy5sYXllcnNbZXhpc3RpbmcubGF5ZXJzLmxlbmd0aCAtIDFdPy50ZXh0ID8/IFwiXCI7XG5cdGNvbnN0IG5ld0NvbXByZWhlbnNpdmUgPSBhd2FpdCBidWlsZENvbXByZWhlbnNpdmVTdW1tYXJ5KG5ld1RleHQsIGNsaWVudCwgc2V0dGluZ3MsIG9uUHJvZ3Jlc3MsIHRva2VuKTtcblxuXHRjb25zdCBjb21iaW5lZEZvck1lcmdlID0gYFBSRVZJT1VTOlxcbiR7ZXhpc3RpbmdDb21wcmVoZW5zaXZlfVxcblxcbk5FVzpcXG4ke25ld0NvbXByZWhlbnNpdmV9YDtcblx0dGhyb3dJZkNhbmNlbGxlZCh0b2tlbik7XG5cdGNvbnN0IG1lcmdlZENvbXByZWhlbnNpdmUgPVxuXHRcdGNvbWJpbmVkRm9yTWVyZ2UubGVuZ3RoIDw9IERJUkVDVF9TVU1NQVJJWkVfQ0hBUl9DQVBcblx0XHRcdD8gYXdhaXQgc3VtbWFyaXplVGV4dChjbGllbnQsIHNldHRpbmdzLCBjb21iaW5lZEZvck1lcmdlLCBNRVJHRV9UV09fQ09NUFJFSEVOU0lWRV9QUk9NUFQpXG5cdFx0XHQ6IGF3YWl0IGJ1aWxkQ29tcHJlaGVuc2l2ZVN1bW1hcnkoY29tYmluZWRGb3JNZXJnZSwgY2xpZW50LCBzZXR0aW5ncywgb25Qcm9ncmVzcywgdG9rZW4pO1xuXG5cdGNvbnN0IHVwcGVyTGF5ZXJzID0gYXdhaXQgY2FzY2FkZUxheWVyc1Vwd2FyZChtZXJnZWRDb21wcmVoZW5zaXZlLCBudW1MYXllcnMsIGNsaWVudCwgc2V0dGluZ3MsIG9uUHJvZ3Jlc3MsIHRva2VuKTtcblx0Y29uc3QgbGF5ZXJzID0gWy4uLnVwcGVyTGF5ZXJzLCB7IGluZGV4OiBudW1MYXllcnMsIG5hbWU6IFwiQ29tcHJlaGVuc2l2ZSBTdW1tYXJ5XCIsIHRleHQ6IG1lcmdlZENvbXByZWhlbnNpdmUgfV07XG5cblx0cmV0dXJuIHsgbGF5ZXJzLCBvcmlnaW5hbDogYCR7ZXhpc3Rpbmcub3JpZ2luYWx9XFxuXFxuJHtuZXdUZXh0fWAsIGJ1aWx0QXQ6IERhdGUubm93KCkgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG92ZXJ2aWV3TGF5ZXIobWVtb3J5OiBMYXllcmVkTWVtb3J5KTogTWVtb3J5TGF5ZXIge1xuXHRyZXR1cm4gbWVtb3J5LmxheWVyc1swXTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXByZWhlbnNpdmVMYXllcihtZW1vcnk6IExheWVyZWRNZW1vcnkpOiBNZW1vcnlMYXllciB7XG5cdHJldHVybiBtZW1vcnkubGF5ZXJzW21lbW9yeS5sYXllcnMubGVuZ3RoIC0gMV07XG59XG5cbi8qKlxuICogQSBzaW5nbGUgY2hlYXAgTExNIGNhbGwgdG8gZ2V0IGEgcHJvdmlzaW9uYWwgMS0yIHNlbnRlbmNlIG92ZXJ2aWV3IG9mIGFcbiAqIHBpZWNlIG9mIHRleHQsIHVzZWQgb25seSB0byBkZWNpZGUgdG9waWMgbWF0Y2hpbmcgQkVGT1JFIGNvbW1pdHRpbmcgdG8gYVxuICogZnVsbCBidWlsZC9leHRlbmQgKHNvIHRoYXQgd29yayBpc24ndCBkb25lIHR3aWNlIHdoZW4gdGhlIGNvbnRlbnQgdHVybnNcbiAqIG91dCB0byBiZWxvbmcgdG8gYW4gZXhpc3RpbmcgdG9waWMpLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcXVpY2tPdmVydmlldyhjbGllbnQ6IE9sbGFtYUNsaWVudCwgc2V0dGluZ3M6IE9sbGFtYU9yY2hlc3RyYXRvclNldHRpbmdzLCB0ZXh0OiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRjb25zdCBjYXBwZWQgPSB0ZXh0Lmxlbmd0aCA+IERJUkVDVF9TVU1NQVJJWkVfQ0hBUl9DQVAgKiAyID8gdGV4dC5zbGljZSgwLCBESVJFQ1RfU1VNTUFSSVpFX0NIQVJfQ0FQICogMikgOiB0ZXh0O1xuXHRyZXR1cm4gc3VtbWFyaXplVGV4dChcblx0XHRjbGllbnQsXG5cdFx0c2V0dGluZ3MsXG5cdFx0Y2FwcGVkLFxuXHRcdFwiU3VtbWFyaXplIHRoZSBmb2xsb3dpbmcgdGV4dCBpbiBleGFjdGx5IDEtMiBzaG9ydCBzZW50ZW5jZXMgZGVzY3JpYmluZyB3aGF0IGl0IGlzIGFib3V0IG92ZXJhbGwuIE5vIHByZWFtYmxlLCBubyBidWxsZXQgcG9pbnRzLCBqdXN0IHRoZSBzZW50ZW5jZShzKS5cIlxuXHQpO1xufVxuXG4vKiogQSBzaW5nbGUgY2hlYXAgTExNIGNhbGwgdG8gcHJvZHVjZSBhIHNob3J0ICgzLTYgd29yZCkgY2hhdC1zZXNzaW9uIHRpdGxlIGZyb20gaXRzIGZpcnN0IG1lc3NhZ2UuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2VuZXJhdGVTaG9ydFRpdGxlKGNsaWVudDogT2xsYW1hQ2xpZW50LCBzZXR0aW5nczogT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MsIGZpcnN0TWVzc2FnZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0Y29uc3QgY2FwcGVkID0gZmlyc3RNZXNzYWdlLmxlbmd0aCA+IDYwMCA/IGZpcnN0TWVzc2FnZS5zbGljZSgwLCA2MDApIDogZmlyc3RNZXNzYWdlO1xuXHRjb25zdCBwcm9tcHQgPSBgR2l2ZSBhIHNob3J0LCBwbGFpbiAzLTYgd29yZCB0aXRsZSAobm8gcHVuY3R1YXRpb24gYXQgdGhlIGVuZCwgbm8gcXVvdGVzKSBmb3IgYSBjb252ZXJzYXRpb24gdGhhdCBzdGFydHMgd2l0aCB0aGlzIG1lc3NhZ2U6XFxuXFxuXCIke2NhcHBlZH1cIlxcblxcblJlc3BvbmQgd2l0aCBPTkxZIHRoZSB0aXRsZS5gO1xuXHRjb25zdCByYXcgPSAoYXdhaXQgY2xpZW50LmdlbmVyYXRlKHNldHRpbmdzLnN1bW1hcnlNb2RlbCwgcHJvbXB0LCB7IHRlbXBlcmF0dXJlOiAwLjMgfSkpLnRyaW0oKTtcblx0Y29uc3QgY2xlYW5lZCA9IHJhdy5yZXBsYWNlKC9eW1wiJ1xcc10rfFtcIidcXHMuXSskL2csIFwiXCIpO1xuXHRyZXR1cm4gY2xlYW5lZCB8fCAoY2FwcGVkLmxlbmd0aCA+IDQwID8gYCR7Y2FwcGVkLnNsaWNlKDAsIDQwKX1cdTIwMjZgIDogY2FwcGVkKSB8fCBcIk5ldyBjaGF0XCI7XG59XG5cbi8qKlxuICogRGlzdGlsbHMgd2hhdCB0aGUgdXNlciBpcyBBQ1RVQUxMWSBhc2tpbmcgXHUyMDE0IHJlc29sdmluZyBwcm9ub3Vucy9jb250ZXh0XG4gKiBmcm9tIHJlY2VudCBoaXN0b3J5LCBzdHJpcHBpbmcgY29udmVyc2F0aW9uYWwgZmlsbGVyIFx1MjAxNCBpbnRvIG9uZSBjcmlzcFxuICogc2VudGVuY2UuIFVzZWQgdG8gc2hhcnBlbiBib3RoIHJldHJpZXZhbCAocm91dGluZy9mcm9udGllciBkZWNpc2lvbnMpIGFuZFxuICogdGhlIGZpbmFsIGFuc3dlciwgc28gdGhlIG1vZGVsIHNlYXJjaGVzIGFuZCBhbnN3ZXJzIHByZWNpc2VseSBpbnN0ZWFkIG9mXG4gKiBkcmlmdGluZyBicm9hZCBvbiBhIGxvb3NlbHktcGhyYXNlZCBvciBjb250ZXh0LWRlcGVuZGVudCBxdWVzdGlvbi5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGV4dHJhY3RRdWVyeUludGVudChcblx0Y2xpZW50OiBPbGxhbWFDbGllbnQsXG5cdHNldHRpbmdzOiBPbGxhbWFPcmNoZXN0cmF0b3JTZXR0aW5ncyxcblx0cXVlcnk6IHN0cmluZyxcblx0cmVjZW50SGlzdG9yeTogeyByb2xlOiBzdHJpbmc7IGNvbnRlbnQ6IHN0cmluZyB9W10gPSBbXSxcblx0c2Vzc2lvblN1bW1hcnk/OiBzdHJpbmdcbik6IFByb21pc2U8c3RyaW5nPiB7XG5cdGNvbnN0IGhpc3RvcnlUZXh0ID0gcmVjZW50SGlzdG9yeVxuXHRcdC5zbGljZSgtNClcblx0XHQubWFwKChtKSA9PiBgJHttLnJvbGV9OiAke20uY29udGVudH1gKVxuXHRcdC5qb2luKFwiXFxuXCIpO1xuXHRjb25zdCBzdW1tYXJ5VGV4dCA9IHNlc3Npb25TdW1tYXJ5ID8gYCR7c2Vzc2lvblN1bW1hcnl9XFxuXFxuYCA6IFwiXCI7XG5cblx0Y29uc3QgcHJvbXB0ID0gYCR7c3VtbWFyeVRleHR9UmVjZW50IGNvbnZlcnNhdGlvbiAobWF5IGJlIGVtcHR5KTpcbiR7aGlzdG9yeVRleHQgfHwgXCIobm9uZSlcIn1cblxuTGF0ZXN0IG1lc3NhZ2U6IFwiJHtxdWVyeX1cIlxuXG5JbiBPTkUgY3Jpc3Agc2VudGVuY2UsIHN0YXRlIGV4YWN0bHkgd2hhdCBzcGVjaWZpYyBpbmZvcm1hdGlvbiBvciBvdXRjb21lIHRoZSB1c2VyIGlzIGFza2luZyBmb3IgcmlnaHQgbm93IFx1MjAxNCByZXNvbHZlIGFueSBwcm9ub3VucyBvciBcInRoYXRcIi9cInRoaXNcIiByZWZlcmVuY2VzIHVzaW5nIHRoZSByZWNlbnQgY29udmVyc2F0aW9uIGFib3ZlLCBhbmQgc3RyaXAgYXdheSBncmVldGluZ3Mgb3IgZmlsbGVyLiBEb24ndCBhbnN3ZXIgdGhlIHF1ZXN0aW9uLCBqdXN0IHJlc3RhdGUgaXRzIHByZWNpc2UgaW50ZW50LlxuXG5SZXNwb25kIHdpdGggT05MWSB0aGF0IG9uZSBzZW50ZW5jZS5gO1xuXG5cdGNvbnN0IHJhdyA9IChhd2FpdCBjbGllbnQuZ2VuZXJhdGUoc2V0dGluZ3Muc3VtbWFyeU1vZGVsLCBwcm9tcHQsIHsgdGVtcGVyYXR1cmU6IDAuMSB9KSkudHJpbSgpO1xuXHRyZXR1cm4gcmF3IHx8IHF1ZXJ5O1xufVxuIiwgImltcG9ydCB7IEFwcCwgVEZpbGUsIG5vcm1hbGl6ZVBhdGggfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IHNsdWdpZnkgfSBmcm9tIFwiLi9tZW1vcnlTdG9yZVwiO1xuXG4vKipcbiAqIEEgY2FuZGlkYXRlIG1lbW9yeSB1cGRhdGUgdGhlIG9yY2hlc3RyYXRvciBub3RpY2VkIGJ1dCBoYXMgTk9UIGNvbW1pdHRlZFxuICogdG8gcGVybWFuZW50IG1lbW9yeSB5ZXQuIFN1cmZhY2VkIGluIHRoZSBjaGF0IHBhbmVsIGZvciB0aGUgdXNlciB0b1xuICogY29uZmlybSBvciBkaXNjYXJkLiBFYWNoIGVudHJ5IGJlbG9uZ3MgdG8gYSBjaGF0IHNlc3Npb24gXHUyMDE0IGl0J3MgdXNlZCBhc1xuICogbGl2ZSBjb250ZXh0IGZvciB0aGF0IHNlc3Npb24sIGFuZCBzdGF5cyB0aGVyZSAoYW5kIHN0YXlzIHJldmlzaXRhYmxlKVxuICogZXZlbiBhZnRlciB0aGUgY2hhdCBtb3ZlcyBvbiwgcmlnaHQgdXAgdW50aWwgaXQncyBjb25maXJtZWQsIGRpc2NhcmRlZCxcbiAqIG9yIHRoZSBzZXNzaW9uJ3MgdGVtcC1tZW1vcnkgaXMgZXhwbGljaXRseSBjbGVhcmVkL3Jlc3RhcnRlZC5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUZW1wTWVtb3J5RW50cnkge1xuXHRpZDogc3RyaW5nO1xuXHRzZXNzaW9uSWQ6IHN0cmluZztcblx0YWN0aW9uOiBcImV4dGVuZFwiIHwgXCJuZXdcIjtcblx0dG9waWNJZD86IHN0cmluZzsgLy8gc2V0IHdoZW4gYWN0aW9uID09PSBcImV4dGVuZFwiXG5cdHRvcGljTmFtZT86IHN0cmluZzsgLy8gZGlzcGxheSBuYW1lOiBleGlzdGluZyB0b3BpYydzIG5hbWUsIG9yIHRoZSBwcm9wb3NlZCBuZXcgdG9waWMncyBuYW1lXG5cdGZhY3Q6IHN0cmluZztcblx0c291cmNlUXVlcnk6IHN0cmluZztcblx0bm90ZVBhdGg6IHN0cmluZztcblx0Y3JlYXRlZEF0OiBudW1iZXI7XG59XG5cbmV4cG9ydCB0eXBlIFRlbXBNZW1vcnlEYXRhID0gUmVjb3JkPHN0cmluZywgVGVtcE1lbW9yeUVudHJ5PjtcblxuZXhwb3J0IGZ1bmN0aW9uIGVtcHR5VGVtcE1lbW9yeURhdGEoKTogVGVtcE1lbW9yeURhdGEge1xuXHRyZXR1cm4ge307XG59XG5cbmZ1bmN0aW9uIHJlbmRlclRlbXBOb3RlKGVudHJ5OiBUZW1wTWVtb3J5RW50cnkpOiBzdHJpbmcge1xuXHRjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcblx0bGluZXMucHVzaChcIi0tLVwiKTtcblx0bGluZXMucHVzaChgdGVtcF9pZDogJHtlbnRyeS5pZH1gKTtcblx0bGluZXMucHVzaChcInN0YXR1czogcGVuZGluZ1wiKTtcblx0bGluZXMucHVzaChgYWN0aW9uOiAke2VudHJ5LmFjdGlvbn1gKTtcblx0aWYgKGVudHJ5LnRvcGljSWQpIGxpbmVzLnB1c2goYHJlbGF0ZWRfdG9waWNfaWQ6ICR7ZW50cnkudG9waWNJZH1gKTtcblx0aWYgKGVudHJ5LnRvcGljTmFtZSkgbGluZXMucHVzaChgdG9waWNfbmFtZTogJHtlbnRyeS50b3BpY05hbWV9YCk7XG5cdGxpbmVzLnB1c2goYGNyZWF0ZWQ6ICR7bmV3IERhdGUoZW50cnkuY3JlYXRlZEF0KS50b0lTT1N0cmluZygpfWApO1xuXHRsaW5lcy5wdXNoKFwiLS0tXCIpO1xuXHRsaW5lcy5wdXNoKFwiXCIpO1xuXHRsaW5lcy5wdXNoKFwiIyBQZW5kaW5nIG1lbW9yeSB1cGRhdGVcIik7XG5cdGxpbmVzLnB1c2goXCJcIik7XG5cdGxpbmVzLnB1c2goYCoqRnJvbSBxdWVyeToqKiAke2VudHJ5LnNvdXJjZVF1ZXJ5fWApO1xuXHRsaW5lcy5wdXNoKFwiXCIpO1xuXHRsaW5lcy5wdXNoKGAqKlByb3Bvc2VkIGZhY3Q6KiogJHtlbnRyeS5mYWN0fWApO1xuXHRsaW5lcy5wdXNoKFwiXCIpO1xuXHRsaW5lcy5wdXNoKFxuXHRcdGVudHJ5LmFjdGlvbiA9PT0gXCJleHRlbmRcIlxuXHRcdFx0PyBgV291bGQgZXh0ZW5kIGV4aXN0aW5nIHRvcGljICoqJHtlbnRyeS50b3BpY05hbWUgPz8gZW50cnkudG9waWNJZH0qKi5gXG5cdFx0XHQ6IGBXb3VsZCBjcmVhdGUgYSBuZXcgdG9waWMgKioke2VudHJ5LnRvcGljTmFtZX0qKi5gXG5cdCk7XG5cdGxpbmVzLnB1c2goXCJcIik7XG5cdGxpbmVzLnB1c2goXG5cdFx0XCJDb25maXJtIG9yIGRpc2NhcmQgdGhpcyBmcm9tIFRoZSBMaWJyYXJpdW0gY2hhdCBwYW5lbC4gQ2xlYXJpbmcgdGhhdCBjaGF0J3MgdGVtcC1tZW1vcnkgKG9yIGxldHRpbmcgdGhlIGNoYXQgZ2V0IHBydW5lZCkgcmVtb3ZlcyB1bmNvbmZpcm1lZCBlbnRyaWVzIHRvby5cIlxuXHQpO1xuXHRsaW5lcy5wdXNoKFwiXCIpO1xuXHRyZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcbn1cblxuZXhwb3J0IGNsYXNzIFRlbXBNZW1vcnlTdG9yZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgYXBwOiBBcHAsXG5cdFx0cHJpdmF0ZSBkYXRhOiBUZW1wTWVtb3J5RGF0YSxcblx0XHRwcml2YXRlIGZvbGRlcjogc3RyaW5nLFxuXHRcdHByaXZhdGUgcGVyc2lzdDogKCkgPT4gUHJvbWlzZTx2b2lkPlxuXHQpIHt9XG5cblx0YXN5bmMgZW5zdXJlRm9sZGVyKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHBhdGggPSBub3JtYWxpemVQYXRoKHRoaXMuZm9sZGVyKTtcblx0XHRpZiAoIXRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlRm9sZGVyKHBhdGgpLmNhdGNoKCgpID0+IHZvaWQgMCk7XG5cdFx0fVxuXHR9XG5cblx0bGlzdCgpOiBUZW1wTWVtb3J5RW50cnlbXSB7XG5cdFx0cmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5kYXRhKS5zb3J0KChhLCBiKSA9PiBiLmNyZWF0ZWRBdCAtIGEuY3JlYXRlZEF0KTtcblx0fVxuXG5cdC8qKiBFbnRyaWVzIGJlbG9uZ2luZyB0byBvbmUgY2hhdCBzZXNzaW9uLCBtb3N0IHJlY2VudCBmaXJzdCAocmVjZW5jeSBpcyB3aGF0IGdpdmVzIHRoZW0gbW9yZSB3ZWlnaHQgaW4gY29udGV4dCkuICovXG5cdGxpc3RGb3JTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nKTogVGVtcE1lbW9yeUVudHJ5W10ge1xuXHRcdHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuZGF0YSlcblx0XHRcdC5maWx0ZXIoKGUpID0+IGUuc2Vzc2lvbklkID09PSBzZXNzaW9uSWQpXG5cdFx0XHQuc29ydCgoYSwgYikgPT4gYi5jcmVhdGVkQXQgLSBhLmNyZWF0ZWRBdCk7XG5cdH1cblxuXHRnZXQoaWQ6IHN0cmluZyk6IFRlbXBNZW1vcnlFbnRyeSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZGF0YVtpZF07XG5cdH1cblxuXHRhc3luYyBjcmVhdGUocGFydGlhbDogT21pdDxUZW1wTWVtb3J5RW50cnksIFwiaWRcIiB8IFwibm90ZVBhdGhcIiB8IFwiY3JlYXRlZEF0XCI+KTogUHJvbWlzZTxUZW1wTWVtb3J5RW50cnk+IHtcblx0XHRhd2FpdCB0aGlzLmVuc3VyZUZvbGRlcigpO1xuXHRcdGNvbnN0IGlkID0gYHRlbXAtJHtEYXRlLm5vdygpLnRvU3RyaW5nKDM2KX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCA2KX1gO1xuXHRcdGNvbnN0IGxhYmVsID0gcGFydGlhbC50b3BpY05hbWUgPz8gcGFydGlhbC50b3BpY0lkID8/IFwidG9waWNcIjtcblx0XHRjb25zdCBub3RlUGF0aCA9IG5vcm1hbGl6ZVBhdGgoYCR7dGhpcy5mb2xkZXJ9LyR7c2x1Z2lmeShsYWJlbCl9LSR7aWR9Lm1kYCk7XG5cdFx0Y29uc3QgZW50cnk6IFRlbXBNZW1vcnlFbnRyeSA9IHsgLi4ucGFydGlhbCwgaWQsIG5vdGVQYXRoLCBjcmVhdGVkQXQ6IERhdGUubm93KCkgfTtcblxuXHRcdHRoaXMuZGF0YVtpZF0gPSBlbnRyeTtcblx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUobm90ZVBhdGgsIHJlbmRlclRlbXBOb3RlKGVudHJ5KSk7XG5cdFx0YXdhaXQgdGhpcy5wZXJzaXN0KCk7XG5cdFx0cmV0dXJuIGVudHJ5O1xuXHR9XG5cblx0YXN5bmMgZGlzY2FyZChpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZW50cnkgPSB0aGlzLmRhdGFbaWRdO1xuXHRcdGlmICghZW50cnkpIHJldHVybjtcblx0XHRjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGVudHJ5Lm5vdGVQYXRoKTtcblx0XHRpZiAoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSBhd2FpdCB0aGlzLmFwcC52YXVsdC5kZWxldGUoZmlsZSk7XG5cdFx0ZGVsZXRlIHRoaXMuZGF0YVtpZF07XG5cdFx0YXdhaXQgdGhpcy5wZXJzaXN0KCk7XG5cdH1cblxuXHQvKiogRXhwbGljaXQgXCJyZXN0YXJ0IHRlbXAtbWVtb3J5XCIgZm9yIG9uZSBjaGF0LCB3aXRob3V0IHRvdWNoaW5nIG90aGVyIHNlc3Npb25zJyBwZW5kaW5nIGVudHJpZXMuICovXG5cdGFzeW5jIGNsZWFyU2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGlkcyA9IE9iamVjdC52YWx1ZXModGhpcy5kYXRhKVxuXHRcdFx0LmZpbHRlcigoZSkgPT4gZS5zZXNzaW9uSWQgPT09IHNlc3Npb25JZClcblx0XHRcdC5tYXAoKGUpID0+IGUuaWQpO1xuXHRcdGZvciAoY29uc3QgaWQgb2YgaWRzKSBhd2FpdCB0aGlzLmRpc2NhcmQoaWQpO1xuXHR9XG5cblx0LyoqIFdpcGVzIGV2ZXJ5IHBlbmRpbmcgZW50cnkgYWNyb3NzIGV2ZXJ5IHNlc3Npb24uIFJhcmVseSBuZWVkZWQgZGlyZWN0bHkgXHUyMDE0IHByZWZlciBjbGVhclNlc3Npb24oKS4gKi9cblx0YXN5bmMgY2xlYXJBbGwoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Zm9yIChjb25zdCBpZCBvZiBPYmplY3Qua2V5cyh0aGlzLmRhdGEpKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmRpc2NhcmQoaWQpO1xuXHRcdH1cblx0fVxufVxuIiwgImltcG9ydCB7IEFwcCwgVEZpbGUsIG5vcm1hbGl6ZVBhdGggfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IE9sbGFtYUNsaWVudCB9IGZyb20gXCIuL29sbGFtYUNsaWVudFwiO1xuaW1wb3J0IHsgT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xuaW1wb3J0IHsgTGF5ZXJlZE1lbW9yeSwgYnVpbGRMYXllcmVkTWVtb3J5LCBleHRlbmRMYXllcmVkTWVtb3J5LCBCdWlsZFByb2dyZXNzIH0gZnJvbSBcIi4vc3VtbWFyaXplclwiO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tIFwiLi9jYW5jZWxsYXRpb25cIjtcbmltcG9ydCB7IHNsdWdpZnkgfSBmcm9tIFwiLi9tZW1vcnlTdG9yZVwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVNZW1vcnlFbnRyeSB7XG5cdGZpbGVQYXRoOiBzdHJpbmc7IC8vIHZhdWx0IHBhdGggb2YgdGhlIG1pcnJvcmVkIG5vdGUgXHUyMDE0IHRoZSBrZXlcblx0ZmlsZU5hbWU6IHN0cmluZztcblx0c291cmNlVGV4dDogc3RyaW5nOyAvLyBsYXN0LXN5bmNlZCBmdWxsIHRleHQsIGtlcHQgc28gaW5jcmVtZW50YWwgcmVmcmVzaCBjYW4gZGlmZiBhbiBhcHBlbmRcblx0bWVtb3J5OiBMYXllcmVkTWVtb3J5O1xuXHRtaXJyb3JGb2xkZXJQYXRoOiBzdHJpbmc7IC8vIGNvbXBhbmlvbiBmb2xkZXIgdW5kZXIgbm90ZU1lbW9yeUZvbGRlciBob2xkaW5nIG9uZSBmaWxlIHBlciBsYXllciArIG9yaWdpbmFsXG5cdG1pcnJvck5vdGVQYXRoOiBzdHJpbmc7IC8vIHRoZSBtYWluIG1pcnJvciBub3RlOiBPdmVydmlldyArIGxpbmtzIHRvIHRoZSBkZWVwZXIgbGF5ZXJzXG5cdHVwZGF0ZWRBdDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIE5vdGVNZW1vcnlTdG9yZURhdGEge1xuXHRlbnRyaWVzOiBSZWNvcmQ8c3RyaW5nLCBOb3RlTWVtb3J5RW50cnk+OyAvLyBrZXllZCBieSBmaWxlUGF0aFxufVxuXG5leHBvcnQgZnVuY3Rpb24gZW1wdHlOb3RlTWVtb3J5RGF0YSgpOiBOb3RlTWVtb3J5U3RvcmVEYXRhIHtcblx0cmV0dXJuIHsgZW50cmllczoge30gfTtcbn1cblxuZnVuY3Rpb24gbGF5ZXJGaWxlTmFtZShsYXllcjogeyBpbmRleDogbnVtYmVyOyBuYW1lOiBzdHJpbmcgfSk6IHN0cmluZyB7XG5cdHJldHVybiBgJHtTdHJpbmcobGF5ZXIuaW5kZXgpLnBhZFN0YXJ0KDIsIFwiMFwiKX0tJHtzbHVnaWZ5KGxheWVyLm5hbWUpfS5tZGA7XG59XG5cbmZ1bmN0aW9uIHJlbmRlck1pcnJvck5vdGUoZW50cnk6IE5vdGVNZW1vcnlFbnRyeSk6IHN0cmluZyB7XG5cdGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuXHRsaW5lcy5wdXNoKFwiLS0tXCIpO1xuXHRsaW5lcy5wdXNoKGBzb3VyY2VfcGF0aDogJHtlbnRyeS5maWxlUGF0aH1gKTtcblx0bGluZXMucHVzaChgc3luY2VkOiAke25ldyBEYXRlKGVudHJ5LnVwZGF0ZWRBdCkudG9JU09TdHJpbmcoKX1gKTtcblx0bGluZXMucHVzaChcIi0tLVwiKTtcblx0bGluZXMucHVzaChcIlwiKTtcblx0bGluZXMucHVzaChgIyBOb3RlIG1lbW9yeTogJHtlbnRyeS5maWxlTmFtZX1gKTtcblx0bGluZXMucHVzaChcIlwiKTtcblx0bGluZXMucHVzaChcblx0XHRgX0xheWVyZWQgbWlycm9yIG9mIFtbJHtlbnRyeS5maWxlUGF0aH18JHtlbnRyeS5maWxlTmFtZX1dXSwgdXNlZCB3aGVuIFwiSW5jbHVkZSBjdXJyZW50IG5vdGVcIiBpcyBvbiBzbyBhIHF1ZXJ5IG9ubHkgcHVsbHMgaW4gdGhlIGxldmVsIG9mIGRldGFpbCBpdCBuZWVkcyBpbnN0ZWFkIG9mIHRoZSB3aG9sZSBmaWxlLiBSZWZyZXNoIGZyb20gdGhlIGNoYXQgcGFuZWwgb3IgdGhlIGNvbW1hbmQgcGFsZXR0ZSBcdTIwMTQgdGhpcyBkb2Vzbid0IHVwZGF0ZSBvbiBpdHMgb3duLl9gXG5cdCk7XG5cdGxpbmVzLnB1c2goXCJcIik7XG5cdGxpbmVzLnB1c2goXCIjIyBPdmVydmlld1wiKTtcblx0bGluZXMucHVzaChlbnRyeS5tZW1vcnkubGF5ZXJzWzBdLnRleHQudHJpbSgpKTtcblxuXHRpZiAoZW50cnkubWVtb3J5LmxheWVycy5sZW5ndGggPiAxKSB7XG5cdFx0bGluZXMucHVzaChcIlwiKTtcblx0XHRsaW5lcy5wdXNoKFwiIyMgTW9yZSBkZXRhaWxcIik7XG5cdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBlbnRyeS5tZW1vcnkubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBsYXllciA9IGVudHJ5Lm1lbW9yeS5sYXllcnNbaV07XG5cdFx0XHRsaW5lcy5wdXNoKGAtIFtbJHtlbnRyeS5taXJyb3JGb2xkZXJQYXRofS8ke2xheWVyRmlsZU5hbWUobGF5ZXIpfXwke2xheWVyLm5hbWV9XV1gKTtcblx0XHR9XG5cdFx0bGluZXMucHVzaChgLSBbWyR7ZW50cnkubWlycm9yRm9sZGVyUGF0aH0vb3JpZ2luYWwubWR8T3JpZ2luYWwgbm90ZSB0ZXh0XV1gKTtcblx0fVxuXHRsaW5lcy5wdXNoKFwiXCIpO1xuXHRyZXR1cm4gbGluZXMuam9pbihcIlxcblwiKTtcbn1cblxuZnVuY3Rpb24gcmVuZGVyTGF5ZXJGaWxlKGVudHJ5OiBOb3RlTWVtb3J5RW50cnksIGxheWVyOiB7IGluZGV4OiBudW1iZXI7IG5hbWU6IHN0cmluZzsgdGV4dDogc3RyaW5nIH0pOiBzdHJpbmcge1xuXHRjb25zdCBsaW5lczogc3RyaW5nW10gPSBbXTtcblx0bGluZXMucHVzaChcIi0tLVwiKTtcblx0bGluZXMucHVzaChgc291cmNlX3BhdGg6ICR7ZW50cnkuZmlsZVBhdGh9YCk7XG5cdGxpbmVzLnB1c2goYGxheWVyX2luZGV4OiAke2xheWVyLmluZGV4fWApO1xuXHRsaW5lcy5wdXNoKFwiLS0tXCIpO1xuXHRsaW5lcy5wdXNoKFwiXCIpO1xuXHRsaW5lcy5wdXNoKGAjICR7ZW50cnkuZmlsZU5hbWV9IFx1MjAxNCAke2xheWVyLm5hbWV9YCk7XG5cdGxpbmVzLnB1c2goXCJcIik7XG5cdGxpbmVzLnB1c2goYF9QYXJ0IG9mIFtbJHtlbnRyeS5taXJyb3JOb3RlUGF0aH18JHtlbnRyeS5maWxlTmFtZX0ncyBub3RlIG1lbW9yeV1dLiBFeHBhbmRzIG9uIHRoZSBsYXllciBhYm92ZSBpdCB3aXRob3V0IGNoYW5naW5nIGl0cyBtZWFuaW5nLl9gKTtcblx0bGluZXMucHVzaChcIlwiKTtcblx0bGluZXMucHVzaChsYXllci50ZXh0LnRyaW0oKSk7XG5cdGxpbmVzLnB1c2goXCJcIik7XG5cdHJldHVybiBsaW5lcy5qb2luKFwiXFxuXCIpO1xufVxuXG5mdW5jdGlvbiByZW5kZXJPcmlnaW5hbEZpbGUoZW50cnk6IE5vdGVNZW1vcnlFbnRyeSk6IHN0cmluZyB7XG5cdGNvbnN0IGxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuXHRsaW5lcy5wdXNoKFwiLS0tXCIpO1xuXHRsaW5lcy5wdXNoKGBzb3VyY2VfcGF0aDogJHtlbnRyeS5maWxlUGF0aH1gKTtcblx0bGluZXMucHVzaChcIi0tLVwiKTtcblx0bGluZXMucHVzaChcIlwiKTtcblx0bGluZXMucHVzaChgIyAke2VudHJ5LmZpbGVOYW1lfSBcdTIwMTQgT3JpZ2luYWwgbm90ZSB0ZXh0YCk7XG5cdGxpbmVzLnB1c2goXCJcIik7XG5cdGxpbmVzLnB1c2goYF9TbmFwc2hvdCBhcyBvZiB0aGUgbGFzdCBzeW5jLiBQYXJ0IG9mIFtbJHtlbnRyeS5taXJyb3JOb3RlUGF0aH18JHtlbnRyeS5maWxlTmFtZX0ncyBub3RlIG1lbW9yeV1dLl9gKTtcblx0bGluZXMucHVzaChcIlwiKTtcblx0bGluZXMucHVzaChlbnRyeS5tZW1vcnkub3JpZ2luYWwudHJpbSgpKTtcblx0bGluZXMucHVzaChcIlwiKTtcblx0cmV0dXJuIGxpbmVzLmpvaW4oXCJcXG5cIik7XG59XG5cbi8qKlxuICogQSBkaXN0aW5jdCBtZW1vcnkgdHlwZSBmcm9tIHJlZ3VsYXIgdG9waWNzOiBhIDE6MSBsYXllcmVkIG1pcnJvciBvZiBhXG4gKiBzaW5nbGUgbm90ZSwgYXV0by1idWlsdCB0aGUgZmlyc3QgdGltZSB0aGF0IG5vdGUgaXMgcmVmZXJlbmNlZCBpbiBjaGF0XG4gKiAoXCJ0aGlzIG5vdGVcIiwgXCJ0aGUgY3VycmVudCBub3RlXCIsIG9yIHRoZSBcIkluY2x1ZGUgY3VycmVudCBub3RlXCIgdG9nZ2xlKSxcbiAqIGFuZCBvdGhlcndpc2Ugb25seSB1cGRhdGVkIHdoZW4gdGhlIHVzZXIgZXhwbGljaXRseSBhc2tzIFx1MjAxNCB2aWEgY2hhdCwgYVxuICogY29tbWFuZCwgb3IgYSBidXR0b24gXHUyMDE0IGVpdGhlciBhIGZ1bGwgcmVidWlsZCBvciBhbiBpbmNyZW1lbnRhbCB1cGRhdGVcbiAqIChhcHBlbmQtb25seSBkaWZmIGFnYWluc3Qgd2hhdCB3YXMgbGFzdCBzeW5jZWQpLlxuICovXG5leHBvcnQgY2xhc3MgTm90ZU1lbW9yeVN0b3JlIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBhcHA6IEFwcCxcblx0XHRwcml2YXRlIGRhdGE6IE5vdGVNZW1vcnlTdG9yZURhdGEsXG5cdFx0cHJpdmF0ZSBmb2xkZXI6IHN0cmluZyxcblx0XHRwcml2YXRlIHBlcnNpc3Q6ICgpID0+IFByb21pc2U8dm9pZD5cblx0KSB7fVxuXG5cdGFzeW5jIGVuc3VyZUZvbGRlcihwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplUGF0aChwYXRoKTtcblx0XHRpZiAoIXRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChub3JtYWxpemVkKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlRm9sZGVyKG5vcm1hbGl6ZWQpLmNhdGNoKCgpID0+IHZvaWQgMCk7XG5cdFx0fVxuXHR9XG5cblx0Z2V0KGZpbGVQYXRoOiBzdHJpbmcpOiBOb3RlTWVtb3J5RW50cnkgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmRhdGEuZW50cmllc1tmaWxlUGF0aF07XG5cdH1cblxuXHRsaXN0KCk6IE5vdGVNZW1vcnlFbnRyeVtdIHtcblx0XHRyZXR1cm4gT2JqZWN0LnZhbHVlcyh0aGlzLmRhdGEuZW50cmllcykuc29ydCgoYSwgYikgPT4gYi51cGRhdGVkQXQgLSBhLnVwZGF0ZWRBdCk7XG5cdH1cblxuXHQvKiogUmV0dXJucyB0aGUgZXhpc3RpbmcgbWlycm9yIGZvciB0aGlzIGZpbGUsIGJ1aWxkaW5nIGl0IGZyZXNoIGlmIGl0IGRvZXNuJ3QgZXhpc3QgeWV0LiBOZXZlciBhdXRvLXJlZnJlc2hlcyBhIHN0YWxlIG9uZS4gKi9cblx0YXN5bmMgZW5zdXJlKFxuXHRcdGZpbGU6IFRGaWxlLFxuXHRcdGNsaWVudDogT2xsYW1hQ2xpZW50LFxuXHRcdHNldHRpbmdzOiBPbGxhbWFPcmNoZXN0cmF0b3JTZXR0aW5ncyxcblx0XHRvblByb2dyZXNzPzogKHA6IEJ1aWxkUHJvZ3Jlc3MpID0+IHZvaWQsXG5cdFx0dG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlblxuXHQpOiBQcm9taXNlPE5vdGVNZW1vcnlFbnRyeT4ge1xuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5kYXRhLmVudHJpZXNbZmlsZS5wYXRoXTtcblx0XHRpZiAoZXhpc3RpbmcpIHJldHVybiBleGlzdGluZztcblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcblx0XHRyZXR1cm4gdGhpcy5yZWJ1aWxkRnVsbChmaWxlLCBjb250ZW50LCBjbGllbnQsIHNldHRpbmdzLCBvblByb2dyZXNzLCB0b2tlbik7XG5cdH1cblxuXHQvKiogV2hldGhlciB0aGlzIG5vdGUncyBtaXJyb3IgaXMgb3V0IG9mIGRhdGUgcmVsYXRpdmUgdG8gaXRzIGN1cnJlbnQgb24tZGlzayBjb250ZW50IFx1MjAxNCBzdXJmYWNlZCBpbiB0aGUgVUksIG5ldmVyIGFjdGVkIG9uIGF1dG9tYXRpY2FsbHkuICovXG5cdGFzeW5jIGlzU3RhbGUoZmlsZTogVEZpbGUpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuZGF0YS5lbnRyaWVzW2ZpbGUucGF0aF07XG5cdFx0aWYgKCFleGlzdGluZykgcmV0dXJuIGZhbHNlO1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGZpbGUpO1xuXHRcdHJldHVybiBjb250ZW50ICE9PSBleGlzdGluZy5zb3VyY2VUZXh0O1xuXHR9XG5cblx0LyoqIEZ1bGwgcmVidWlsZCBmcm9tIHNjcmF0Y2ggXHUyMDE0IGFsd2F5cyBjb3JyZWN0LCBjb3N0cyBhIGZyZXNoIHN1bW1hcml6YXRpb24gcGFzcyBvdmVyIHRoZSB3aG9sZSBub3RlLiAqL1xuXHRhc3luYyByZWZyZXNoRnVsbChcblx0XHRmaWxlOiBURmlsZSxcblx0XHRjbGllbnQ6IE9sbGFtYUNsaWVudCxcblx0XHRzZXR0aW5nczogT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MsXG5cdFx0b25Qcm9ncmVzcz86IChwOiBCdWlsZFByb2dyZXNzKSA9PiB2b2lkLFxuXHRcdHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW5cblx0KTogUHJvbWlzZTxOb3RlTWVtb3J5RW50cnk+IHtcblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcblx0XHRyZXR1cm4gdGhpcy5yZWJ1aWxkRnVsbChmaWxlLCBjb250ZW50LCBjbGllbnQsIHNldHRpbmdzLCBvblByb2dyZXNzLCB0b2tlbik7XG5cdH1cblxuXHQvKipcblx0ICogSW5jcmVtZW50YWwgcmVmcmVzaDogaWYgdGhlIG5vdGUncyBjdXJyZW50IGNvbnRlbnQgc3RpbGwgc3RhcnRzIHdpdGhcblx0ICogZXhhY3RseSB3aGF0IHdhcyBsYXN0IHN5bmNlZCAodGhlIGNvbW1vbiBhcHBlbmQtb25seSBjYXNlIFx1MjAxNCBqb3VybmFsXG5cdCAqIGVudHJpZXMsIHJ1bm5pbmcgbm90ZXMsIGxvZ3MpLCBvbmx5IHRoZSBuZXcgc3VmZml4IGlzIGNodW5rZWQgYW5kXG5cdCAqIHN1bW1hcml6ZWQsIGFuZCB0aGUgbGF5ZXJlZCBtZW1vcnkgaXMgZXh0ZW5kZWQgcmF0aGVyIHRoYW4gcmVidWlsdC4gSWZcblx0ICogdGhlIG5vdGUgd2FzIGVkaXRlZCBpbiB0aGUgbWlkZGxlIGluc3RlYWQsIGFuIGFwcGVuZC1vbmx5IGRpZmYgaXNuJ3Rcblx0ICogbWVhbmluZ2Z1bCwgc28gdGhpcyBzYWZlbHkgZmFsbHMgYmFjayB0byBhIGZ1bGwgcmVidWlsZCBpbnN0ZWFkIG9mXG5cdCAqIHByb2R1Y2luZyBsYXllcnMgdGhhdCBubyBsb25nZXIgbWF0Y2ggdGhlIG5vdGUuXG5cdCAqL1xuXHRhc3luYyByZWZyZXNoSW5jcmVtZW50YWwoXG5cdFx0ZmlsZTogVEZpbGUsXG5cdFx0Y2xpZW50OiBPbGxhbWFDbGllbnQsXG5cdFx0c2V0dGluZ3M6IE9sbGFtYU9yY2hlc3RyYXRvclNldHRpbmdzLFxuXHRcdG9uUHJvZ3Jlc3M/OiAocDogQnVpbGRQcm9ncmVzcykgPT4gdm9pZCxcblx0XHR0b2tlbj86IENhbmNlbGxhdGlvblRva2VuXG5cdCk6IFByb21pc2U8eyBlbnRyeTogTm90ZU1lbW9yeUVudHJ5OyBmZWxsQmFja1RvRnVsbDogYm9vbGVhbiB9PiB7XG5cdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLmRhdGEuZW50cmllc1tmaWxlLnBhdGhdO1xuXG5cdFx0aWYgKCFleGlzdGluZykge1xuXHRcdFx0cmV0dXJuIHsgZW50cnk6IGF3YWl0IHRoaXMucmVidWlsZEZ1bGwoZmlsZSwgY29udGVudCwgY2xpZW50LCBzZXR0aW5ncywgb25Qcm9ncmVzcywgdG9rZW4pLCBmZWxsQmFja1RvRnVsbDogdHJ1ZSB9O1xuXHRcdH1cblx0XHRpZiAoY29udGVudCA9PT0gZXhpc3Rpbmcuc291cmNlVGV4dCkge1xuXHRcdFx0cmV0dXJuIHsgZW50cnk6IGV4aXN0aW5nLCBmZWxsQmFja1RvRnVsbDogZmFsc2UgfTtcblx0XHR9XG5cdFx0aWYgKCFjb250ZW50LnN0YXJ0c1dpdGgoZXhpc3Rpbmcuc291cmNlVGV4dCkpIHtcblx0XHRcdHJldHVybiB7IGVudHJ5OiBhd2FpdCB0aGlzLnJlYnVpbGRGdWxsKGZpbGUsIGNvbnRlbnQsIGNsaWVudCwgc2V0dGluZ3MsIG9uUHJvZ3Jlc3MsIHRva2VuKSwgZmVsbEJhY2tUb0Z1bGw6IHRydWUgfTtcblx0XHR9XG5cblx0XHRjb25zdCBhZGRlZFRleHQgPSBjb250ZW50LnNsaWNlKGV4aXN0aW5nLnNvdXJjZVRleHQubGVuZ3RoKTtcblx0XHRpZiAoIWFkZGVkVGV4dC50cmltKCkpIHtcblx0XHRcdHJldHVybiB7IGVudHJ5OiBleGlzdGluZywgZmVsbEJhY2tUb0Z1bGw6IGZhbHNlIH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWVtb3J5ID0gYXdhaXQgZXh0ZW5kTGF5ZXJlZE1lbW9yeShleGlzdGluZy5tZW1vcnksIGFkZGVkVGV4dCwgY2xpZW50LCBzZXR0aW5ncywgb25Qcm9ncmVzcywgdG9rZW4pO1xuXHRcdGNvbnN0IGVudHJ5OiBOb3RlTWVtb3J5RW50cnkgPSB7IC4uLmV4aXN0aW5nLCBzb3VyY2VUZXh0OiBjb250ZW50LCBtZW1vcnksIHVwZGF0ZWRBdDogRGF0ZS5ub3coKSB9O1xuXHRcdHRoaXMuZGF0YS5lbnRyaWVzW2ZpbGUucGF0aF0gPSBlbnRyeTtcblx0XHRhd2FpdCB0aGlzLndyaXRlQWxsRmlsZXMoZW50cnkpO1xuXHRcdGF3YWl0IHRoaXMucGVyc2lzdCgpO1xuXHRcdHJldHVybiB7IGVudHJ5LCBmZWxsQmFja1RvRnVsbDogZmFsc2UgfTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVidWlsZEZ1bGwoXG5cdFx0ZmlsZTogVEZpbGUsXG5cdFx0Y29udGVudDogc3RyaW5nLFxuXHRcdGNsaWVudDogT2xsYW1hQ2xpZW50LFxuXHRcdHNldHRpbmdzOiBPbGxhbWFPcmNoZXN0cmF0b3JTZXR0aW5ncyxcblx0XHRvblByb2dyZXNzPzogKHA6IEJ1aWxkUHJvZ3Jlc3MpID0+IHZvaWQsXG5cdFx0dG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlblxuXHQpOiBQcm9taXNlPE5vdGVNZW1vcnlFbnRyeT4ge1xuXHRcdGNvbnN0IG1lbW9yeSA9IGF3YWl0IGJ1aWxkTGF5ZXJlZE1lbW9yeShjb250ZW50LCBjbGllbnQsIHNldHRpbmdzLCBvblByb2dyZXNzLCB0b2tlbik7XG5cblx0XHQvLyBSZXVzZSB0aGUgbWlycm9yIGxvY2F0aW9uIGZyb20gYW55IGV4aXN0aW5nIGVudHJ5IGZvciB0aGlzIGV4YWN0XG5cdFx0Ly8gZmlsZSAoYSBmdWxsIHJlZnJlc2ggb2YgYW4gYWxyZWFkeS1taXJyb3JlZCBub3RlKSwgc28gcmVidWlsZGluZ1xuXHRcdC8vIGRvZXNuJ3Qgb3JwaGFuIHRoZSBwcmV2aW91cyBtaXJyb3IgZmlsZXMgdW5kZXIgYSBmcmVzaCBwYXRoLiBPbmx5XG5cdFx0Ly8gYSBnZW51aW5lbHkgbmV3IGZpbGUgZ2V0cyBhIG5ld2x5IGFsbG9jYXRlZCBzbHVnLlxuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5kYXRhLmVudHJpZXNbZmlsZS5wYXRoXTtcblx0XHRjb25zdCBzbHVnID0gZXhpc3RpbmcgPyB1bmRlZmluZWQgOiB0aGlzLnVuaXF1ZVNsdWcoZmlsZSk7XG5cdFx0Y29uc3QgbWlycm9yTm90ZVBhdGggPSBleGlzdGluZz8ubWlycm9yTm90ZVBhdGggPz8gbm9ybWFsaXplUGF0aChgJHt0aGlzLmZvbGRlcn0vJHtzbHVnfS5tZGApO1xuXHRcdGNvbnN0IG1pcnJvckZvbGRlclBhdGggPSBleGlzdGluZz8ubWlycm9yRm9sZGVyUGF0aCA/PyBub3JtYWxpemVQYXRoKGAke3RoaXMuZm9sZGVyfS8ke3NsdWd9YCk7XG5cblx0XHRjb25zdCBlbnRyeTogTm90ZU1lbW9yeUVudHJ5ID0ge1xuXHRcdFx0ZmlsZVBhdGg6IGZpbGUucGF0aCxcblx0XHRcdGZpbGVOYW1lOiBmaWxlLmJhc2VuYW1lLFxuXHRcdFx0c291cmNlVGV4dDogY29udGVudCxcblx0XHRcdG1lbW9yeSxcblx0XHRcdG1pcnJvckZvbGRlclBhdGgsXG5cdFx0XHRtaXJyb3JOb3RlUGF0aCxcblx0XHRcdHVwZGF0ZWRBdDogRGF0ZS5ub3coKSxcblx0XHR9O1xuXHRcdHRoaXMuZGF0YS5lbnRyaWVzW2ZpbGUucGF0aF0gPSBlbnRyeTtcblx0XHRhd2FpdCB0aGlzLndyaXRlQWxsRmlsZXMoZW50cnkpO1xuXHRcdGF3YWl0IHRoaXMucGVyc2lzdCgpO1xuXHRcdHJldHVybiBlbnRyeTtcblx0fVxuXG5cdC8qKlxuXHQgKiBCYXNlbmFtZS1kZXJpdmVkIHNsdWcsIGRpc2FtYmlndWF0ZWQgYWdhaW5zdCBldmVyeSBvdGhlciB0cmFja2VkXG5cdCAqIGZpbGUncyBtaXJyb3IgZm9sZGVyIHNvIHR3byB2YXVsdCBmaWxlcyB3aXRoIHRoZSBzYW1lIG5hbWUgKGEgY29tbW9uXG5cdCAqIE9ic2lkaWFuIG9jY3VycmVuY2UgXHUyMDE0IHNhbWUgZmlsZW5hbWUgaW4gZGlmZmVyZW50IGZvbGRlcnMpIGRvbid0XG5cdCAqIHNpbGVudGx5IHNoYXJlLCBhbmQgb3ZlcndyaXRlLCB0aGUgc2FtZSBtaXJyb3IuIERldGVybWluaXN0aWMgZ2l2ZW5cblx0ICogdGhlIGN1cnJlbnQgc2V0IG9mIGVudHJpZXM6IHRoZSBmaXJzdCBub3RlIHRvIGNsYWltIGEgbmFtZSBnZXRzIHRoZVxuXHQgKiBwbGFpbiBzbHVnLCBsYXRlciBvbmVzIGdldCBcIi0yXCIsIFwiLTNcIiwgZXRjLlxuXHQgKi9cblx0cHJpdmF0ZSB1bmlxdWVTbHVnKGZpbGU6IFRGaWxlKTogc3RyaW5nIHtcblx0XHRjb25zdCBiYXNlID0gc2x1Z2lmeShmaWxlLmJhc2VuYW1lKTtcblx0XHRjb25zdCB0YWtlbiA9IG5ldyBTZXQoXG5cdFx0XHRPYmplY3QudmFsdWVzKHRoaXMuZGF0YS5lbnRyaWVzKVxuXHRcdFx0XHQuZmlsdGVyKChlKSA9PiBlLmZpbGVQYXRoICE9PSBmaWxlLnBhdGgpXG5cdFx0XHRcdC5tYXAoKGUpID0+IGUubWlycm9yRm9sZGVyUGF0aClcblx0XHQpO1xuXHRcdGxldCBjYW5kaWRhdGUgPSBiYXNlO1xuXHRcdGZvciAobGV0IG4gPSAyOyB0YWtlbi5oYXMobm9ybWFsaXplUGF0aChgJHt0aGlzLmZvbGRlcn0vJHtjYW5kaWRhdGV9YCkpOyBuKyspIHtcblx0XHRcdGNhbmRpZGF0ZSA9IGAke2Jhc2V9LSR7bn1gO1xuXHRcdH1cblx0XHRyZXR1cm4gY2FuZGlkYXRlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB3cml0ZUFsbEZpbGVzKGVudHJ5OiBOb3RlTWVtb3J5RW50cnkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLmVuc3VyZUZvbGRlcih0aGlzLmZvbGRlcik7XG5cdFx0YXdhaXQgdGhpcy53cml0ZUZpbGUoZW50cnkubWlycm9yTm90ZVBhdGgsIHJlbmRlck1pcnJvck5vdGUoZW50cnkpKTtcblxuXHRcdGlmIChlbnRyeS5tZW1vcnkubGF5ZXJzLmxlbmd0aCA+IDEpIHtcblx0XHRcdGF3YWl0IHRoaXMuZW5zdXJlRm9sZGVyKGVudHJ5Lm1pcnJvckZvbGRlclBhdGgpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCBlbnRyeS5tZW1vcnkubGF5ZXJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGxheWVyID0gZW50cnkubWVtb3J5LmxheWVyc1tpXTtcblx0XHRcdFx0YXdhaXQgdGhpcy53cml0ZUZpbGUobm9ybWFsaXplUGF0aChgJHtlbnRyeS5taXJyb3JGb2xkZXJQYXRofS8ke2xheWVyRmlsZU5hbWUobGF5ZXIpfWApLCByZW5kZXJMYXllckZpbGUoZW50cnksIGxheWVyKSk7XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLndyaXRlRmlsZShub3JtYWxpemVQYXRoKGAke2VudHJ5Lm1pcnJvckZvbGRlclBhdGh9L29yaWdpbmFsLm1kYCksIHJlbmRlck9yaWdpbmFsRmlsZShlbnRyeSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd3JpdGVGaWxlKHBhdGg6IHN0cmluZywgY29udGVudDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgocGF0aCk7XG5cdFx0aWYgKGV4aXN0aW5nIGluc3RhbmNlb2YgVEZpbGUpIHtcblx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShleGlzdGluZywgY29udGVudCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUocGF0aCwgY29udGVudCk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRjb25zdCByZXRyeSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChwYXRoKTtcblx0XHRcdGlmIChyZXRyeSBpbnN0YW5jZW9mIFRGaWxlKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShyZXRyeSwgY29udGVudCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBlcnI7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG4iLCAiZXhwb3J0IGludGVyZmFjZSBTdG9yZWRDaGF0TWVzc2FnZSB7XG5cdHJvbGU6IFwidXNlclwiIHwgXCJhc3Npc3RhbnRcIjtcblx0Y29udGVudDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIENoYXRTZXNzaW9uIHtcblx0aWQ6IHN0cmluZztcblx0dGl0bGU6IHN0cmluZztcblx0Y3JlYXRlZEF0OiBudW1iZXI7XG5cdHVwZGF0ZWRBdDogbnVtYmVyO1xuXHRtZXNzYWdlczogU3RvcmVkQ2hhdE1lc3NhZ2VbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBDaGF0U2Vzc2lvblN0b3JlRGF0YSB7XG5cdHNlc3Npb25zOiBSZWNvcmQ8c3RyaW5nLCBDaGF0U2Vzc2lvbj47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbXB0eUNoYXRTZXNzaW9uRGF0YSgpOiBDaGF0U2Vzc2lvblN0b3JlRGF0YSB7XG5cdHJldHVybiB7IHNlc3Npb25zOiB7fSB9O1xufVxuXG5mdW5jdGlvbiBmYWxsYmFja1RpdGxlKHRleHQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdGNvbnN0IGNsZWFuID0gdGV4dC50cmltKCkucmVwbGFjZSgvXFxzKy9nLCBcIiBcIik7XG5cdHJldHVybiBjbGVhbi5sZW5ndGggPiA0OCA/IGAke2NsZWFuLnNsaWNlKDAsIDQ4KX1cdTIwMjZgIDogY2xlYW4gfHwgXCJOZXcgY2hhdFwiO1xufVxuXG4vKipcbiAqIEV2ZXJ5IGNoYXQgaXMgYSBzZXNzaW9uIHlvdSBjYW4gY29tZSBiYWNrIHRvLiBFYWNoIHNlc3Npb24gb3ducyBpdHMgb3duXG4gKiBzbGljZSBvZiB0ZW1wLW1lbW9yeSAoc2VlIFRlbXBNZW1vcnlTdG9yZS5saXN0Rm9yU2Vzc2lvbiksIHNvIHJldmlzaXRpbmdcbiAqIGFuIG9sZCBjaGF0IHNob3dzIHlvdSBleGFjdGx5IHRoZSB1bmNvbmZpcm1lZCBub3RlcyB0aGF0IHdlcmUgbGl2ZSBkdXJpbmdcbiAqIHRoYXQgY29udmVyc2F0aW9uLCBub3Qgd2hhdGV2ZXIncyBsaXZlIGluIHlvdXIgY3VycmVudCBvbmUuXG4gKlxuICogU2Vzc2lvbnMgc3RhcnQgYXMgYW4gaW4tbWVtb3J5LW9ubHkgXCJkcmFmdFwiIChgY3JlYXRlKClgKSwgaW52aXNpYmxlIHRvXG4gKiBgbGlzdCgpYCBhbmQgbmV2ZXIgd3JpdHRlbiB0byBkaXNrIFx1MjAxNCBjbGlja2luZyBcIk5ldyBjaGF0XCIgYW5kIHRoZW5cbiAqIGFiYW5kb25pbmcgaXQgd2l0aG91dCBzZW5kaW5nIGFueXRoaW5nIGxlYXZlcyBubyB0cmFjZS4gQSBkcmFmdCBpc1xuICogcHJvbW90ZWQgdG8gYSByZWFsLCBwZXJzaXN0ZWQsIGxpc3RlZCBzZXNzaW9uIHRoZSBtb21lbnQgaXRzIGZpcnN0XG4gKiBtZXNzYWdlIGlzIGFwcGVuZGVkLlxuICovXG5leHBvcnQgY2xhc3MgQ2hhdFNlc3Npb25TdG9yZSB7XG5cdHByaXZhdGUgc3RhdGljIE1BWF9TRVNTSU9OUyA9IDMwO1xuXHRwcml2YXRlIGRyYWZ0cyA9IG5ldyBNYXA8c3RyaW5nLCBDaGF0U2Vzc2lvbj4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIGRhdGE6IENoYXRTZXNzaW9uU3RvcmVEYXRhLFxuXHRcdHByaXZhdGUgcGVyc2lzdDogKCkgPT4gUHJvbWlzZTx2b2lkPixcblx0XHRwcml2YXRlIG9uUHJ1bmU/OiAoc2Vzc2lvbklkOiBzdHJpbmcpID0+IHZvaWRcblx0KSB7fVxuXG5cdGxpc3QoKTogQ2hhdFNlc3Npb25bXSB7XG5cdFx0cmV0dXJuIE9iamVjdC52YWx1ZXModGhpcy5kYXRhLnNlc3Npb25zKS5zb3J0KChhLCBiKSA9PiBiLnVwZGF0ZWRBdCAtIGEudXBkYXRlZEF0KTtcblx0fVxuXG5cdGdldChpZDogc3RyaW5nKTogQ2hhdFNlc3Npb24gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmRhdGEuc2Vzc2lvbnNbaWRdID8/IHRoaXMuZHJhZnRzLmdldChpZCk7XG5cdH1cblxuXHRpc0RyYWZ0KGlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5kcmFmdHMuaGFzKGlkKTtcblx0fVxuXG5cdC8qKiBDcmVhdGVzIGEgbmV3IHNlc3Npb24sIGJ1dCBvbmx5IGluIG1lbW9yeSBcdTIwMTQgbm90aGluZyBpcyBwZXJzaXN0ZWQgb3IgbGlzdGVkIHVudGlsIGl0cyBmaXJzdCBtZXNzYWdlLiAqL1xuXHRjcmVhdGUoKTogQ2hhdFNlc3Npb24ge1xuXHRcdGNvbnN0IGlkID0gYHNlc3Npb24tJHtEYXRlLm5vdygpLnRvU3RyaW5nKDM2KX0tJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCA2KX1gO1xuXHRcdGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cdFx0Y29uc3Qgc2Vzc2lvbjogQ2hhdFNlc3Npb24gPSB7IGlkLCB0aXRsZTogXCJOZXcgY2hhdFwiLCBjcmVhdGVkQXQ6IG5vdywgdXBkYXRlZEF0OiBub3csIG1lc3NhZ2VzOiBbXSB9O1xuXHRcdHRoaXMuZHJhZnRzLnNldChpZCwgc2Vzc2lvbik7XG5cdFx0cmV0dXJuIHNlc3Npb247XG5cdH1cblxuXHRhc3luYyBhcHBlbmRNZXNzYWdlKGlkOiBzdHJpbmcsIG1lc3NhZ2U6IFN0b3JlZENoYXRNZXNzYWdlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuZ2V0KGlkKTtcblx0XHRpZiAoIXNlc3Npb24pIHJldHVybjtcblxuXHRcdHNlc3Npb24ubWVzc2FnZXMucHVzaChtZXNzYWdlKTtcblx0XHRzZXNzaW9uLnVwZGF0ZWRBdCA9IERhdGUubm93KCk7XG5cdFx0aWYgKHNlc3Npb24ubWVzc2FnZXMubGVuZ3RoID09PSAxICYmIG1lc3NhZ2Uucm9sZSA9PT0gXCJ1c2VyXCIpIHtcblx0XHRcdHNlc3Npb24udGl0bGUgPSBmYWxsYmFja1RpdGxlKG1lc3NhZ2UuY29udGVudCk7IC8vIHBsYWNlaG9sZGVyIHVudGlsIGdlbmVyYXRlU2hvcnRUaXRsZSByZXNvbHZlcyBhbmQgY2FsbHMgc2V0VGl0bGVcblx0XHR9XG5cblx0XHRpZiAodGhpcy5kcmFmdHMuaGFzKGlkKSkge1xuXHRcdFx0dGhpcy5kcmFmdHMuZGVsZXRlKGlkKTtcblx0XHRcdHRoaXMuZGF0YS5zZXNzaW9uc1tpZF0gPSBzZXNzaW9uO1xuXHRcdFx0YXdhaXQgdGhpcy5wcnVuZSgpO1xuXHRcdH1cblx0XHRhd2FpdCB0aGlzLnBlcnNpc3QoKTtcblx0fVxuXG5cdGFzeW5jIHNldFRpdGxlKGlkOiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzZXNzaW9uID0gdGhpcy5nZXQoaWQpO1xuXHRcdGlmICghc2Vzc2lvbikgcmV0dXJuO1xuXHRcdHNlc3Npb24udGl0bGUgPSB0aXRsZS50cmltKCkgfHwgc2Vzc2lvbi50aXRsZTtcblx0XHRpZiAodGhpcy5kYXRhLnNlc3Npb25zW2lkXSkgYXdhaXQgdGhpcy5wZXJzaXN0KCk7IC8vIGEgc3RpbGwtZHJhZnQgc2Vzc2lvbidzIHRpdGxlIGp1c3QgbGl2ZXMgaW4gbWVtb3J5IHVudGlsIGl0J3MgcHJvbW90ZWRcblx0fVxuXG5cdC8qKiBEZWxldGVzIGEgc2Vzc2lvbiBvdXRyaWdodCBcdTIwMTQgaXRzIHRlbXAtbWVtb3J5IGlzIGNsZWFyZWQgdmlhIG9uUHJ1bmUsIHNhbWUgYXMgbmF0dXJhbCBwcnVuaW5nLiAqL1xuXHRhc3luYyBkZWxldGVTZXNzaW9uKGlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmRyYWZ0cy5kZWxldGUoaWQpO1xuXHRcdGlmICh0aGlzLmRhdGEuc2Vzc2lvbnNbaWRdKSB7XG5cdFx0XHRkZWxldGUgdGhpcy5kYXRhLnNlc3Npb25zW2lkXTtcblx0XHRcdHRoaXMub25QcnVuZT8uKGlkKTtcblx0XHRcdGF3YWl0IHRoaXMucGVyc2lzdCgpO1xuXHRcdH1cblx0fVxuXG5cdC8qKiBLZWVwcyB0aGUgc2Vzc2lvbiBsaXN0IGZyb20gZ3Jvd2luZyBmb3JldmVyOyBvbGRlc3Qgc2Vzc2lvbnMgYmV5b25kIHRoZSBjYXAgYXJlIGRyb3BwZWQgKHRoZWlyIHRlbXAtbWVtb3J5IGlzIHBydW5lZCBieSB0aGUgY2FsbGVyIHZpYSBvblBydW5lKS4gKi9cblx0cHJpdmF0ZSBhc3luYyBwcnVuZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBhbGwgPSB0aGlzLmxpc3QoKTtcblx0XHRpZiAoYWxsLmxlbmd0aCA8PSBDaGF0U2Vzc2lvblN0b3JlLk1BWF9TRVNTSU9OUykgcmV0dXJuO1xuXHRcdGNvbnN0IG92ZXJmbG93ID0gYWxsLnNsaWNlKENoYXRTZXNzaW9uU3RvcmUuTUFYX1NFU1NJT05TKTtcblx0XHRmb3IgKGNvbnN0IHNlc3Npb24gb2Ygb3ZlcmZsb3cpIHtcblx0XHRcdGRlbGV0ZSB0aGlzLmRhdGEuc2Vzc2lvbnNbc2Vzc2lvbi5pZF07XG5cdFx0XHR0aGlzLm9uUHJ1bmU/LihzZXNzaW9uLmlkKTtcblx0XHR9XG5cdH1cbn1cbiIsICJpbXBvcnQgeyBPbGxhbWFDbGllbnQgfSBmcm9tIFwiLi9vbGxhbWFDbGllbnRcIjtcbmltcG9ydCB7IE9sbGFtYU9yY2hlc3RyYXRvclNldHRpbmdzIH0gZnJvbSBcIi4vc2V0dGluZ3NcIjtcblxuLyoqXG4gKiBBIHJvbGxpbmcsIGluY3JlbWVudGFsbHktdXBkYXRlZCBkaWdlc3Qgb2YgT05FIGNoYXQgc2Vzc2lvbjogYSBjb21wYWN0XG4gKiBuYXJyYXRpdmUgb2Ygd2hhdCdzIGJlZW4gZGlzY3Vzc2VkIHNvIGZhciwgcGx1cyB0aGUgY3VycmVudCBiZXN0IHJlYWQgb2ZcbiAqIHdoYXQgdGhlIHVzZXIgaXMgb3ZlcmFsbCB0cnlpbmcgdG8gYWNjb21wbGlzaCBpbiB0aGlzIGNoYXQuIFVubGlrZVxuICogVGVtcE1lbW9yeUVudHJ5IChhIGNhbmRpZGF0ZSBmYWN0IGF3YWl0aW5nIGEgc2F2ZS9kaXNjYXJkIGRlY2lzaW9uKSwgdGhpc1xuICogaXMgbmV2ZXIgc2hvd24gdG8gdGhlIHVzZXIgYW5kIG5ldmVyIHdyaXR0ZW4gdG8gdGhlIHZhdWx0IFx1MjAxNCBpdCdzIHB1cmVcbiAqIHNjcmF0Y2ggY29udGV4dCB0aGF0IGxldHMgdGhlIExMTSBcInJlbWVtYmVyXCIgZWFybGllciB0dXJucyBldmVuIHdoZW4gdGhlXG4gKiByYXcgbWVzc2FnZSBoaXN0b3J5IHNlbnQgd2l0aCBhIHJlcXVlc3QgaXMgY2FwcGVkIGZvciB0b2tlbi1lZmZpY2llbmN5LlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFNlc3Npb25TdW1tYXJ5IHtcblx0c2Vzc2lvbklkOiBzdHJpbmc7XG5cdC8qKiBDb21wYWN0IG5hcnJhdGl2ZSBzdW1tYXJ5IG9mIHRoZSBjb252ZXJzYXRpb24gc28gZmFyLiAqL1xuXHRzdW1tYXJ5OiBzdHJpbmc7XG5cdC8qKiBDdXJyZW50IGJlc3QgcmVhZCBvZiB3aGF0IHRoZSB1c2VyIGlzIG92ZXJhbGwgdHJ5aW5nIHRvIGFjY29tcGxpc2ggaW4gdGhpcyBjaGF0LCByZXZpc2VkIChub3QganVzdCBhcHBlbmRlZCB0bykgYXMgdGhlIGNvbnZlcnNhdGlvbiBjbGFyaWZpZXMgb3IgY2hhbmdlcyBpdC4gKi9cblx0dXNlckludGVudDogc3RyaW5nO1xuXHQvKipcblx0ICogVGhlIGxpdGVyYWwgKG5vdCBtb2RlbC1wYXJhcGhyYXNlZCkgdGV4dCBvZiB0aGUgbW9zdCByZWNlbnQgdHVybi5cblx0ICogVGhlIG5hcnJhdGl2ZSBgc3VtbWFyeWAgYWJvdmUgaXMgcmVnZW5lcmF0ZWQgYnkgYW4gTExNIG1lcmdlIGNhbGwgZWFjaFxuXHQgKiB0dXJuLCBzbyBpdCdzIGEgY29tcGFjdCByZXRlbGxpbmcsIG5vdCBhIHRyYW5zY3JpcHQgXHUyMDE0IGEgcXVlcnkgdGhhdFxuXHQgKiBkZXBlbmRzIG9uIHRoZSAqZXhhY3QqIHdvcmRpbmcgb2Ygd2hhdCB3YXMganVzdCBhc2tlZCBvciBhbnN3ZXJlZFxuXHQgKiAoZS5nLiBcIndoYXQgZGlkIHlvdSBqdXN0IHNheT9cIiwgYSBmb2xsb3ctdXAgcXVvdGluZyBhIGZpZ3VyZSBvciBuYW1lXG5cdCAqIGZyb20gdGhlIGxhc3QgYW5zd2VyKSBjYW4gbG9zZSBwcmVjaXNpb24gdG8gdGhhdCBwYXJhcGhyYXNlLiBTdG9yaW5nXG5cdCAqIHRoZSByYXcgbGFzdCBleGNoYW5nZSBhbG9uZ3NpZGUgdGhlIHN1bW1hcnkga2VlcHMgdGhlIG1vc3QgcmVjZW50XG5cdCAqIGFuc3dlcmluZyBhbmQgcXVlcnlpbmcgYXZhaWxhYmxlIHZlcmJhdGltLCBhdCB6ZXJvIGV4dHJhIExMTSBjb3N0LlxuXHQgKi9cblx0bGFzdFVzZXJUZXh0OiBzdHJpbmc7XG5cdGxhc3RBc3Npc3RhbnRUZXh0OiBzdHJpbmc7XG5cdC8qKiBIb3cgbWFueSB1c2VyL2Fzc2lzdGFudCB0dXJuLXBhaXJzIGhhdmUgYmVlbiBmb2xkZWQgaW4gc28gZmFyLiAqL1xuXHR0dXJuc1N1bW1hcml6ZWQ6IG51bWJlcjtcblx0dXBkYXRlZEF0OiBudW1iZXI7XG59XG5cbmV4cG9ydCB0eXBlIENoYXRIaXN0b3J5RGF0YSA9IFJlY29yZDxzdHJpbmcsIFNlc3Npb25TdW1tYXJ5PjtcblxuZXhwb3J0IGZ1bmN0aW9uIGVtcHR5Q2hhdEhpc3RvcnlEYXRhKCk6IENoYXRIaXN0b3J5RGF0YSB7XG5cdHJldHVybiB7fTtcbn1cblxuZnVuY3Rpb24gZXh0cmFjdEpzb248VD4ocmF3OiBzdHJpbmcpOiBUIHwgbnVsbCB7XG5cdGNvbnN0IG1hdGNoID0gcmF3Lm1hdGNoKC9cXHtbXFxzXFxTXSpcXH0vKTtcblx0aWYgKCFtYXRjaCkgcmV0dXJuIG51bGw7XG5cdHRyeSB7XG5cdFx0cmV0dXJuIEpTT04ucGFyc2UobWF0Y2hbMF0pIGFzIFQ7XG5cdH0gY2F0Y2gge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG59XG5cbmNvbnN0IFVQREFURV9QUk9NUFQgPSAoXG5cdHByZXZTdW1tYXJ5OiBzdHJpbmcsXG5cdHByZXZJbnRlbnQ6IHN0cmluZyxcblx0dXNlclRleHQ6IHN0cmluZyxcblx0YXNzaXN0YW50VGV4dDogc3RyaW5nXG4pID0+IGBZb3UgYXJlIG1haW50YWluaW5nIGEgcnVubmluZyBkaWdlc3Qgb2YgYW4gb25nb2luZyBjaGF0IGNvbnZlcnNhdGlvbiwgdXBkYXRlZCBvbmUgdHVybiBhdCBhIHRpbWUuXG5cblN1bW1hcnkgc28gZmFyIChtYXkgYmUgZW1wdHksIGlmIHRoaXMgaXMgdGhlIGZpcnN0IHR1cm4pOlxuJHtwcmV2U3VtbWFyeSB8fCBcIihub25lIHlldClcIn1cblxuQ3VycmVudCByZWFkIG9mIHdoYXQgdGhlIHVzZXIgaXMgb3ZlcmFsbCB0cnlpbmcgdG8gYWNjb21wbGlzaCBpbiB0aGlzIGNoYXQgKG1heSBiZSBlbXB0eSk6XG4ke3ByZXZJbnRlbnQgfHwgXCIobm9uZSB5ZXQpXCJ9XG5cbk5ldyB0dXJuIGp1c3QgZXhjaGFuZ2VkOlxuVXNlcjogJHt1c2VyVGV4dH1cbkFzc2lzdGFudDogJHthc3Npc3RhbnRUZXh0fVxuXG5VcGRhdGUgYm90aCBmaWVsZHMgdG8gZm9sZCBpbiB0aGlzIG5ldyB0dXJuOlxuLSBcInN1bW1hcnlcIjogYSBjb21wYWN0LCBjb250aW51b3VzIG5hcnJhdGl2ZSBvZiB0aGUgY29udmVyc2F0aW9uIHNvIGZhciAobm90IGEgdHJhbnNjcmlwdCkgXHUyMDE0IGtlZXAgaXQgY29uY2lzZSBidXQgcHJlc2VydmUgZmFjdHMsIGRlY2lzaW9ucywgbmFtZXMsIGFuZCBjb250ZXh0IHRoYXQgbGF0ZXIgdHVybnMgbWlnaHQgZGVwZW5kIG9uLiBSZW1vdmUgbm90aGluZyB0aGF0J3Mgc3RpbGwgcmVsZXZhbnQsIGJ1dCBkb24ndCBqdXN0IGFwcGVuZCB0aGUgbmV3IHR1cm4gdmVyYmF0aW07IGludGVncmF0ZSBpdC5cbi0gXCJ1c2VySW50ZW50XCI6IHRoZSB1c2VyJ3MgY3VycmVudCBvdmVyYWxsIGdvYWwgb3Igd2hhdCB0aGV5J3JlIHRyeWluZyB0byBhY2NvbXBsaXNoIGluIHRoaXMgY2hhdCwgYXMgYmVzdCB1bmRlcnN0b29kIHJpZ2h0IG5vdy4gSWYgdGhpcyB0dXJuIGNsYXJpZmllcywgY2hhbmdlcywgb3IgY29tcGxldGVzIHRoZWlyIGludGVudCwgcmV2aXNlIGl0IHJhdGhlciB0aGFuIGp1c3QgYXBwZW5kaW5nIHRoZSBvbGQgb25lLlxuXG5SZXNwb25kIHdpdGggT05MWSBKU09OOiB7XCJzdW1tYXJ5XCI6IFwiLi4uXCIsIFwidXNlckludGVudFwiOiBcIi4uLlwifWA7XG5cbi8qKlxuICogS2VlcHMgb25lIFNlc3Npb25TdW1tYXJ5IHBlciBjaGF0IHNlc3Npb24sIHVwZGF0ZWQgd2l0aCBhIHNpbmdsZSBjaGVhcFxuICogbWVyZ2UgY2FsbCBwZXIgdHVybiAocHJldmlvdXMgZGlnZXN0ICsgdGhpcyB0dXJuIC0+IG5ldyBkaWdlc3QpIHJhdGhlclxuICogdGhhbiByZS1yZWFkaW5nIHRoZSB3aG9sZSB0cmFuc2NyaXB0IGV2ZXJ5IHRpbWUsIHRoZSBzYW1lIGluY3JlbWVudGFsXG4gKiBwYXR0ZXJuIGV4dGVuZExheWVyZWRNZW1vcnkgdXNlcyBmb3IgdG9waWMgbWVtb3JpZXMuXG4gKi9cbmV4cG9ydCBjbGFzcyBDaGF0SGlzdG9yeVN0b3JlIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBkYXRhOiBDaGF0SGlzdG9yeURhdGEsXG5cdFx0cHJpdmF0ZSBwZXJzaXN0OiAoKSA9PiBQcm9taXNlPHZvaWQ+XG5cdCkge31cblxuXHRnZXQoc2Vzc2lvbklkOiBzdHJpbmcpOiBTZXNzaW9uU3VtbWFyeSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZGF0YVtzZXNzaW9uSWRdO1xuXHR9XG5cblx0LyoqIFJlbmRlcnMgdGhlIGRpZ2VzdCBhcyBhIGNvdXBsZSBvZiBjb250ZXh0IGJsb2Nrcywgb3IgdW5kZWZpbmVkIGlmIG5vdGhpbmcncyBiZWVuIHN1bW1hcml6ZWQgeWV0LiAqL1xuXHRjb250ZXh0QmxvY2soc2Vzc2lvbklkOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHMgPSB0aGlzLmRhdGFbc2Vzc2lvbklkXTtcblx0XHRpZiAoIXMgfHwgKCFzLnN1bW1hcnkgJiYgIXMudXNlckludGVudCkpIHJldHVybiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgbGluZXM6IHN0cmluZ1tdID0gW107XG5cdFx0aWYgKHMuc3VtbWFyeSkgbGluZXMucHVzaChgIyMjIFN1bW1hcnkgb2YgdGhpcyBjb252ZXJzYXRpb24gc28gZmFyXFxuJHtzLnN1bW1hcnl9YCk7XG5cdFx0aWYgKHMudXNlckludGVudCkgbGluZXMucHVzaChgIyMjIFdoYXQgdGhlIHVzZXIgaGFzIGJlZW4gdHJ5aW5nIHRvIGFjY29tcGxpc2ggaW4gdGhpcyBjaGF0XFxuJHtzLnVzZXJJbnRlbnR9YCk7XG5cdFx0aWYgKHMubGFzdFVzZXJUZXh0IHx8IHMubGFzdEFzc2lzdGFudFRleHQpIHtcblx0XHRcdGxpbmVzLnB1c2goXG5cdFx0XHRcdGAjIyMgTW9zdCByZWNlbnQgZXhjaGFuZ2UgKHZlcmJhdGltLCBpbiBjYXNlIGV4YWN0IHdvcmRpbmcgbWF0dGVycylcXG5Vc2VyOiAke3MubGFzdFVzZXJUZXh0IHx8IFwiKG5vbmUpXCJ9XFxuQXNzaXN0YW50OiAke3MubGFzdEFzc2lzdGFudFRleHQgfHwgXCIobm9uZSlcIn1gXG5cdFx0XHQpO1xuXHRcdH1cblx0XHRyZXR1cm4gbGluZXMuam9pbihcIlxcblxcblwiKTtcblx0fVxuXG5cdC8qKiBTaG9ydCBwbGFpbi10ZXh0IGZvcm0gZm9yIGZlZWRpbmcgaW50byBvdGhlciBzbWFsbCBwcm9tcHRzIChpbnRlbnQgZXh0cmFjdGlvbiwgbWVtb3J5LWNvbW1hbmQgZGV0ZWN0aW9uLCBhbWJpZ3VpdHkgY2hlY2tzKSB3aXRob3V0IGFuIGV4dHJhIEpTT04gbGF5ZXIuICovXG5cdGlubGluZVRleHQoc2Vzc2lvbklkOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHMgPSB0aGlzLmRhdGFbc2Vzc2lvbklkXTtcblx0XHRpZiAoIXMgfHwgKCFzLnN1bW1hcnkgJiYgIXMudXNlckludGVudCkpIHJldHVybiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG5cdFx0aWYgKHMuc3VtbWFyeSkgcGFydHMucHVzaChgQ29udmVyc2F0aW9uIHNvIGZhcjogJHtzLnN1bW1hcnl9YCk7XG5cdFx0aWYgKHMudXNlckludGVudCkgcGFydHMucHVzaChgVXNlcidzIG92ZXJhbGwgZ29hbCBzbyBmYXI6ICR7cy51c2VySW50ZW50fWApO1xuXHRcdGlmIChzLmxhc3RVc2VyVGV4dCB8fCBzLmxhc3RBc3Npc3RhbnRUZXh0KSB7XG5cdFx0XHRwYXJ0cy5wdXNoKGBNb3N0IHJlY2VudCBleGNoYW5nZSBcdTIwMTQgVXNlcjogJHtzLmxhc3RVc2VyVGV4dCB8fCBcIihub25lKVwifSB8IEFzc2lzdGFudDogJHtzLmxhc3RBc3Npc3RhbnRUZXh0IHx8IFwiKG5vbmUpXCJ9YCk7XG5cdFx0fVxuXHRcdHJldHVybiBwYXJ0cy5qb2luKFwiXFxuXCIpO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlKFxuXHRcdHNlc3Npb25JZDogc3RyaW5nLFxuXHRcdHVzZXJUZXh0OiBzdHJpbmcsXG5cdFx0YXNzaXN0YW50VGV4dDogc3RyaW5nLFxuXHRcdGNsaWVudDogT2xsYW1hQ2xpZW50LFxuXHRcdHNldHRpbmdzOiBPbGxhbWFPcmNoZXN0cmF0b3JTZXR0aW5nc1xuXHQpOiBQcm9taXNlPFNlc3Npb25TdW1tYXJ5PiB7XG5cdFx0Y29uc3QgcHJldiA9IHRoaXMuZGF0YVtzZXNzaW9uSWRdO1xuXHRcdGNvbnN0IHByb21wdCA9IFVQREFURV9QUk9NUFQocHJldj8uc3VtbWFyeSA/PyBcIlwiLCBwcmV2Py51c2VySW50ZW50ID8/IFwiXCIsIHVzZXJUZXh0LCBhc3Npc3RhbnRUZXh0KTtcblx0XHRjb25zdCByYXcgPSBhd2FpdCBjbGllbnQuZ2VuZXJhdGUoc2V0dGluZ3Muc3VtbWFyeU1vZGVsLCBwcm9tcHQsIHsgdGVtcGVyYXR1cmU6IDAuMiB9KTtcblx0XHRjb25zdCBwYXJzZWQgPSBleHRyYWN0SnNvbjx7IHN1bW1hcnk/OiBzdHJpbmc7IHVzZXJJbnRlbnQ/OiBzdHJpbmcgfT4ocmF3KTtcblxuXHRcdGNvbnN0IG5leHQ6IFNlc3Npb25TdW1tYXJ5ID0ge1xuXHRcdFx0c2Vzc2lvbklkLFxuXHRcdFx0Ly8gSWYgdGhlIG1vZGVsIGNhbGwgZmFpbGVkIHRvIHBhcnNlLCBrZWVwIHRoZSBwcmV2aW91cyBkaWdlc3QgcmF0aGVyXG5cdFx0XHQvLyB0aGFuIGxvc2luZyBpdCwgYW5kIGZhbGwgYmFjayB0byBhIHBsYWluIGFwcGVuZCBzbyB0aGUgdHVybiBpc24ndFxuXHRcdFx0Ly8gc2lsZW50bHkgZHJvcHBlZCBmcm9tIHRoZSBydW5uaW5nIGNvbnRleHQuXG5cdFx0XHRzdW1tYXJ5OiBwYXJzZWQ/LnN1bW1hcnk/LnRyaW0oKSB8fCBgJHtwcmV2Py5zdW1tYXJ5ID8/IFwiXCJ9JHtwcmV2Py5zdW1tYXJ5ID8gXCIgXCIgOiBcIlwifSR7dXNlclRleHR9YC50cmltKCksXG5cdFx0XHR1c2VySW50ZW50OiBwYXJzZWQ/LnVzZXJJbnRlbnQ/LnRyaW0oKSB8fCBwcmV2Py51c2VySW50ZW50IHx8IFwiXCIsXG5cdFx0XHQvLyBTdG9yZWQgYXMtaXMgKG5vIExMTSByb3VuZCB0cmlwKSBzbyB0aGUgbW9zdCByZWNlbnQgcXVlc3Rpb24gYW5kXG5cdFx0XHQvLyBhbnN3ZXIgYXJlIGFsd2F5cyBhdmFpbGFibGUgdmVyYmF0aW0sIGluZGVwZW5kZW50IG9mIGhvdyB3ZWxsXG5cdFx0XHQvLyB0aGUgbmFycmF0aXZlIGBzdW1tYXJ5YCBhYm92ZSBjYXB0dXJlZCB0aGVtLlxuXHRcdFx0bGFzdFVzZXJUZXh0OiB1c2VyVGV4dCxcblx0XHRcdGxhc3RBc3Npc3RhbnRUZXh0OiBhc3Npc3RhbnRUZXh0LFxuXHRcdFx0dHVybnNTdW1tYXJpemVkOiAocHJldj8udHVybnNTdW1tYXJpemVkID8/IDApICsgMSxcblx0XHRcdHVwZGF0ZWRBdDogRGF0ZS5ub3coKSxcblx0XHR9O1xuXHRcdHRoaXMuZGF0YVtzZXNzaW9uSWRdID0gbmV4dDtcblx0XHRhd2FpdCB0aGlzLnBlcnNpc3QoKTtcblx0XHRyZXR1cm4gbmV4dDtcblx0fVxuXG5cdGFzeW5jIGNsZWFyU2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5kYXRhW3Nlc3Npb25JZF0pIHJldHVybjtcblx0XHRkZWxldGUgdGhpcy5kYXRhW3Nlc3Npb25JZF07XG5cdFx0YXdhaXQgdGhpcy5wZXJzaXN0KCk7XG5cdH1cblxuXHRhc3luYyBjbGVhckFsbCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRmb3IgKGNvbnN0IGlkIG9mIE9iamVjdC5rZXlzKHRoaXMuZGF0YSkpIGRlbGV0ZSB0aGlzLmRhdGFbaWRdO1xuXHRcdGF3YWl0IHRoaXMucGVyc2lzdCgpO1xuXHR9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBNYXJrZG93blZpZXcsIFRGaWxlLCBXb3Jrc3BhY2VMZWFmIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5cbi8qKlxuICogYHdvcmtzcGFjZS5nZXRBY3RpdmVGaWxlKClgIHJlZmxlY3RzIHdoaWNoZXZlciBsZWFmIGlzIGN1cnJlbnRseSBhY3RpdmUgXHUyMDE0XG4gKiBhbmQgdGhlIG1vbWVudCB0aGUgdXNlciBjbGlja3MgaW50byB0aGlzIHBsdWdpbidzIG93biBjaGF0IHBhbmVsICh0byB0eXBlXG4gKiBhIHF1ZXN0aW9uLCBvciBqdXN0IHRvIHNjcm9sbCksIFRIQVQgbGVhZiBiZWNvbWVzIGFjdGl2ZS4gU2luY2UgdGhlIGNoYXRcbiAqIHBhbmVsIGlzbid0IGEgZmlsZS1iYWNrZWQgdmlldywgYGdldEFjdGl2ZUZpbGUoKWAgdGhlbiByZXR1cm5zIG51bGwsIGV2ZW5cbiAqIHRob3VnaCBmcm9tIHRoZSB1c2VyJ3MgcGVyc3BlY3RpdmUgXCJ0aGUgbm90ZSBJIGhhdmUgb3BlblwiIGhhc24ndCBjaGFuZ2VkXG4gKiBhdCBhbGwuIExlZnQgdW5oYW5kbGVkLCB0aGlzIHNpbGVudGx5IHNraXBzIFwicmVhZGluZyBwYWdlXCIgbW9kZSBhbmRcbiAqIG5vdGUtbWVtb3J5IGF1dG8taW5pdCBvbiBleGFjdGx5IHRoZSB0dXJuIHdoZXJlIHRoZSB1c2VyIGp1c3Qgc3dpdGNoZWRcbiAqIGZvY3VzIGludG8gY2hhdCB0byBhc2sgYWJvdXQgdGhlaXIgbm90ZSBcdTIwMTQgd2hpY2ggaW4gcHJhY3RpY2UgaXMgbW9zdFxuICogZmlyc3QtdGltZSBhc2tzLlxuICpcbiAqIFRoaXMgdHJhY2tzIHRoZSBsYXN0IGZpbGUgdGhhdCB3YXMgQUNUVUFMTFkgc2hvd24gaW4gYSByZWFsIG1hcmtkb3duXG4gKiB2aWV3LCBhbmQga2VlcHMgcmVwb3J0aW5nIGl0IGFzIFwidGhlIGFjdGl2ZSBub3RlXCIgdW50aWwgYSAqZGlmZmVyZW50KlxuICogbWFya2Rvd24gdmlldyBnZW51aW5lbHkgdGFrZXMgb3ZlciBcdTIwMTQgcmVnYXJkbGVzcyBvZiB3aGF0ZXZlciBlbHNlIGdldHNcbiAqIGZvY3VzZWQgaW4gYmV0d2VlbiAobGlrZSB0aGUgY2hhdCBpbnB1dCkuXG4gKi9cbmV4cG9ydCBjbGFzcyBBY3RpdmVGaWxlVHJhY2tlciB7XG5cdHByaXZhdGUgbGFzdEZpbGU6IFRGaWxlIHwgbnVsbCA9IG51bGw7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBhcHA6IEFwcCkge1xuXHRcdHRoaXMubGFzdEZpbGUgPSBhcHAud29ya3NwYWNlLmdldEFjdGl2ZVZpZXdPZlR5cGUoTWFya2Rvd25WaWV3KT8uZmlsZSA/PyBudWxsO1xuXHR9XG5cblx0LyoqIFdpcmUgdGhpcyB0byBgd29ya3NwYWNlLm9uKFwiYWN0aXZlLWxlYWYtY2hhbmdlXCIsIC4uLilgIGluIG9ubG9hZCgpLiAqL1xuXHRoYW5kbGVBY3RpdmVMZWFmQ2hhbmdlKGxlYWY6IFdvcmtzcGFjZUxlYWYgfCBudWxsKTogdm9pZCB7XG5cdFx0aWYgKGxlYWY/LnZpZXcgaW5zdGFuY2VvZiBNYXJrZG93blZpZXcgJiYgbGVhZi52aWV3LmZpbGUpIHtcblx0XHRcdHRoaXMubGFzdEZpbGUgPSBsZWFmLnZpZXcuZmlsZTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGZpbGUgT2JzaWRpYW4gY3VycmVudGx5IHJlcG9ydHMgYXMgYWN0aXZlIGlmIGl0IGhhcyBvbmUgKHRoZVxuXHQgKiBjb21tb24gY2FzZSBcdTIwMTQgYW4gYWN0dWFsIG5vdGUgaXMgZm9jdXNlZCk7IG90aGVyd2lzZSB0aGUgbGFzdCBub3RlIHRoYXRcblx0ICogd2FzIGdlbnVpbmVseSBmb2N1c2VkIGJlZm9yZSBmb2N1cyBtb3ZlZCBlbHNld2hlcmUgKGUuZy4gaW50byB0aGVcblx0ICogY2hhdCBwYW5lbCkuIE5ldmVyIHJldHVybnMgYSBmaWxlIHRoYXQncyBzaW5jZSBiZWVuIGRlbGV0ZWQvcmVuYW1lZFxuXHQgKiBhd2F5IG91dCBmcm9tIHVuZGVyIHRoZSBjYWNoZS5cblx0ICovXG5cdGdldEZpbGUoKTogVEZpbGUgfCBudWxsIHtcblx0XHRjb25zdCBhY3RpdmUgPSB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHRcdGlmIChhY3RpdmUpIHJldHVybiBhY3RpdmU7XG5cdFx0aWYgKHRoaXMubGFzdEZpbGUgJiYgdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKHRoaXMubGFzdEZpbGUucGF0aCkgPT09IHRoaXMubGFzdEZpbGUpIHtcblx0XHRcdHJldHVybiB0aGlzLmxhc3RGaWxlO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufVxuIiwgImltcG9ydCB7IE9sbGFtYUNsaWVudCB9IGZyb20gXCIuL29sbGFtYUNsaWVudFwiO1xuaW1wb3J0IHsgT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xuaW1wb3J0IHsgTGF5ZXJlZE1lbW9yeSwgTWVtb3J5TGF5ZXIgfSBmcm9tIFwiLi9zdW1tYXJpemVyXCI7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgdGhyb3dJZkNhbmNlbGxlZCB9IGZyb20gXCIuL2NhbmNlbGxhdGlvblwiO1xuXG5mdW5jdGlvbiBleHRyYWN0SnNvbjxUPihyYXc6IHN0cmluZyk6IFQgfCBudWxsIHtcblx0Y29uc3QgbWF0Y2ggPSByYXcubWF0Y2goL1xce1tcXHNcXFNdKlxcfXxcXFtbXFxzXFxTXSpcXF0vKTtcblx0aWYgKCFtYXRjaCkgcmV0dXJuIG51bGw7XG5cdHRyeSB7XG5cdFx0cmV0dXJuIEpTT04ucGFyc2UobWF0Y2hbMF0pIGFzIFQ7XG5cdH0gY2F0Y2gge1xuXHRcdHJldHVybiBudWxsO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSGllcmFyY2hpY2FsQW5zd2VyUmVzdWx0IHtcblx0dGV4dDogc3RyaW5nO1xuXHRsYXllclVzZWQ6IHN0cmluZzsgLy8gbGF5ZXIgbmFtZSwgb3IgXCJPcmlnaW5hbFwiIGlmIGl0IGZlbGwgYWxsIHRoZSB3YXkgdGhyb3VnaFxufVxuXG4vKipcbiAqIFJlc29sdmVzIGEgc2luZ2xlIG1lbW9yeSdzIGxheWVyIHN0YWNrIGluIE9ORSBMTE0gY2FsbCBpbnN0ZWFkIG9mIHdhbGtpbmdcbiAqIGl0IGxheWVyIGJ5IGxheWVyOiB0aGUgbW9kZWwgaXMgc2hvd24gZXZlcnkgbGF5ZXIgYXQgb25jZSAoT3ZlcnZpZXdcbiAqIHRocm91Z2ggQ29tcHJlaGVuc2l2ZSBTdW1tYXJ5KSBhbmQgYXNrZWQgdG8gcGljayB0aGUgbG93ZXN0LWRldGFpbCBsYXllclxuICogdGhhdCdzIHN1ZmZpY2llbnQgdG8gYW5zd2VyIHRoZSBxdWVyeSBcdTIwMTQgdXNpbmcgYm90aCB0aGUgcmF3IHF1ZXN0aW9uIGFuZFxuICogaXRzIGRpc3RpbGxlZCBpbnRlbnQsIHNvIGEgdmFndWVseSBwaHJhc2VkIHF1ZXN0aW9uIGRvZXNuJ3QgZ2V0IG1hdGNoZWRcbiAqIHRvIGEgc3VtbWFyeSBqdXN0IGJlY2F1c2UgaXQgc291bmRzIGJyb2FkbHkgcmVsYXRlZCBcdTIwMTQgb3IgdG8gc2F5XG4gKiBgbmVlZF9vcmlnaW5hbGAgaWYgbm9uZSBvZiB0aGUgbmFtZWQgbGF5ZXJzIGFyZSBlbm91Z2guXG4gKlxuICogVGhpcyByZXBsYWNlcyB0aGUgb2xkIHNlcXVlbnRpYWwsIHRvcC1kb3duIHdhbGsgKG9uZSByb3VuZCB0cmlwIHBlclxuICogbGF5ZXIsIHVwIHRvIGBudW1BYnN0cmFjdGlvbkxheWVycyArIDFgIGNhbGxzKSB3aXRoIGEgc2luZ2xlIHJvdW5kIHRyaXBcbiAqIHJlZ2FyZGxlc3Mgb2YgaG93IG1hbnkgbGF5ZXJzIHRoZSBtZW1vcnkgaGFzLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZUZyb21MYXllcnMoXG5cdG1lbW9yeTogTGF5ZXJlZE1lbW9yeSxcblx0cXVlcnk6IHN0cmluZyxcblx0aW50ZW50OiBzdHJpbmcsXG5cdGNsaWVudDogT2xsYW1hQ2xpZW50LFxuXHRzZXR0aW5nczogT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MsXG5cdHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW5cbik6IFByb21pc2U8SGllcmFyY2hpY2FsQW5zd2VyUmVzdWx0PiB7XG5cdGlmIChtZW1vcnkubGF5ZXJzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybiB7IHRleHQ6IG1lbW9yeS5vcmlnaW5hbCwgbGF5ZXJVc2VkOiBcIk9yaWdpbmFsXCIgfTtcblx0fVxuXG5cdHRocm93SWZDYW5jZWxsZWQodG9rZW4pO1xuXG5cdGNvbnN0IGxpc3RpbmcgPSBtZW1vcnkubGF5ZXJzXG5cdFx0Lm1hcCgobGF5ZXIpID0+IGAtIGxheWVyIGluZGV4OiAke2xheWVyLmluZGV4fVxcbiAgbmFtZTogXCIke2xheWVyLm5hbWV9XCJcXG4gIHRleHQ6ICR7bGF5ZXIudGV4dH1gKVxuXHRcdC5qb2luKFwiXFxuXCIpO1xuXG5cdGNvbnN0IHByb21wdCA9IGBRdWVzdGlvbjogXCIke3F1ZXJ5fVwiXG5XaGF0IHRoZSB1c2VyIHNwZWNpZmljYWxseSBuZWVkczogJHtpbnRlbnR9XG5cbkhlcmUgYXJlIEFMTCB0aGUgYWJzdHJhY3Rpb24gbGF5ZXJzIG9mIGEgc291cmNlLCBmcm9tIGxlYXN0IGRldGFpbGVkIChsYXllciBpbmRleCAwLCB0aGUgT3ZlcnZpZXcpIHRvIG1vc3QgZGV0YWlsZWQgKGxheWVyIGluZGV4ICR7bWVtb3J5LmxheWVycy5sZW5ndGggLSAxfSwgdGhlIENvbXByZWhlbnNpdmUgU3VtbWFyeSk6XG4ke2xpc3Rpbmd9XG5cbkNob29zZSB0aGUgTE9XRVNULW51bWJlcmVkIGxheWVyIGluZGV4IHRoYXQsIG9uIGl0cyBvd24sIGlzIGRldGFpbGVkIGVub3VnaCB0byBmdWxseSBhZGRyZXNzIHdoYXQgdGhlIHVzZXIgc3BlY2lmaWNhbGx5IG5lZWRzLiBPbmx5IG1vdmUgdG8gYSBoaWdoZXIgKG1vcmUgZGV0YWlsZWQpIGxheWVyIGluZGV4IGlmIHRoZSBsb3dlciBvbmVzIGdlbnVpbmVseSBsYWNrIHRoZSBuZWVkZWQgZGV0YWlsLiBJZiBldmVuIHRoZSBtb3N0IGRldGFpbGVkIGxheWVyIGFib3ZlIHN0aWxsIGlzbid0IGVub3VnaCwgcmVzcG9uZCB3aXRoIFwibmVlZF9vcmlnaW5hbFwiIGluc3RlYWQgXHUyMDE0IHRoYXQgcHVsbHMgaW4gdGhlIGNvbXBsZXRlLCB1bm1vZGlmaWVkIHNvdXJjZSB0ZXh0LlxuXG5SZXNwb25kIHdpdGggT05MWSBKU09OOiB7XCJjaG9pY2VcIjogPGxheWVyIGluZGV4IG51bWJlcj59IG9yIHtcImNob2ljZVwiOiBcIm5lZWRfb3JpZ2luYWxcIn0uYDtcblxuXHRjb25zdCByYXcgPSBhd2FpdCBjbGllbnQuZ2VuZXJhdGUoc2V0dGluZ3Muc3VtbWFyeU1vZGVsLCBwcm9tcHQsIHsgdGVtcGVyYXR1cmU6IDAuMSB9KTtcblx0Y29uc3QgcGFyc2VkID0gZXh0cmFjdEpzb248eyBjaG9pY2U/OiBudW1iZXIgfCBzdHJpbmcgfT4ocmF3KTtcblxuXHRjb25zdCBsYXllciA9IHNlbGVjdExheWVyKG1lbW9yeS5sYXllcnMsIHBhcnNlZD8uY2hvaWNlKTtcblx0aWYgKGxheWVyKSB7XG5cdFx0cmV0dXJuIHsgdGV4dDogbGF5ZXIudGV4dCwgbGF5ZXJVc2VkOiBsYXllci5uYW1lIH07XG5cdH1cblxuXHQvLyBcIm5lZWRfb3JpZ2luYWxcIiwgYW4gdW5wYXJzZWFibGUvbWlzc2luZyByZXNwb25zZSwgb3IgYW4gb3V0LW9mLXJhbmdlXG5cdC8vIGluZGV4IGFsbCBmYWxsIHRocm91Z2ggdG8gdGhlIHJhdyBPcmlnaW5hbCBcdTIwMTQgdGhlIHNhZmUgZGVmYXVsdFxuXHQvLyB3aGVuZXZlciB0aGUgc2luZ2xlIGNhbGwgZGlkbid0IHByb2R1Y2UgYSBjbGVhbiwgdmFsaWQgbGF5ZXIgY2hvaWNlLlxuXHRyZXR1cm4geyB0ZXh0OiBtZW1vcnkub3JpZ2luYWwsIGxheWVyVXNlZDogXCJPcmlnaW5hbFwiIH07XG59XG5cbmZ1bmN0aW9uIHNlbGVjdExheWVyKGxheWVyczogTWVtb3J5TGF5ZXJbXSwgY2hvaWNlOiBudW1iZXIgfCBzdHJpbmcgfCB1bmRlZmluZWQpOiBNZW1vcnlMYXllciB8IHVuZGVmaW5lZCB7XG5cdGlmIChjaG9pY2UgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHVuZGVmaW5lZDtcblx0aWYgKHR5cGVvZiBjaG9pY2UgPT09IFwibnVtYmVyXCIpIHtcblx0XHRyZXR1cm4gbGF5ZXJzLmZpbmQoKGwpID0+IGwuaW5kZXggPT09IGNob2ljZSk7XG5cdH1cblx0aWYgKGNob2ljZSA9PT0gXCJuZWVkX29yaWdpbmFsXCIpIHJldHVybiB1bmRlZmluZWQ7XG5cdGNvbnN0IG4gPSBOdW1iZXIoY2hvaWNlKTtcblx0cmV0dXJuIE51bWJlci5pc05hTihuKSA/IHVuZGVmaW5lZCA6IGxheWVycy5maW5kKChsKSA9PiBsLmluZGV4ID09PSBuKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIaWVyYXJjaGljYWxTb3VyY2Uge1xuXHRrZXk6IHN0cmluZzsgLy8gc3RhYmxlIGlkIGZvciB0aGlzIHNvdXJjZSwgZS5nLiBcInRvcGljOjxpZD5cIlxuXHRsYWJlbDogc3RyaW5nOyAvLyBkaXNwbGF5IG5hbWUgc2hvd24gaW4gY29udGV4dCBibG9ja3Ncblx0bWVtb3J5OiBMYXllcmVkTWVtb3J5O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJlc29sdmVkU291cmNlIHtcblx0a2V5OiBzdHJpbmc7XG5cdGxhYmVsOiBzdHJpbmc7XG5cdHRleHQ6IHN0cmluZztcblx0bGF5ZXJVc2VkOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBGcm9udGllckl0ZW0ge1xuXHRzb3VyY2U6IEhpZXJhcmNoaWNhbFNvdXJjZTtcblx0bGF5ZXJJbmRleDogbnVtYmVyOyAvLyBpbmRleCBpbnRvIHNvdXJjZS5tZW1vcnkubGF5ZXJzLCBvciAtMSB0byBtZWFuIFwiZmVsbCB0aHJvdWdoIHRvIE9yaWdpbmFsXCJcbn1cblxudHlwZSBGcm9udGllclZlcmRpY3QgPSBcImlycmVsZXZhbnRcIiB8IFwic3VmZmljaWVudFwiIHwgXCJkZXNjZW5kXCI7XG5cbmZ1bmN0aW9uIGZyb250aWVyS2V5KGl0ZW06IEZyb250aWVySXRlbSk6IHN0cmluZyB7XG5cdHJldHVybiBgJHtpdGVtLnNvdXJjZS5rZXl9Ojoke2l0ZW0ubGF5ZXJJbmRleH1gO1xufVxuXG5hc3luYyBmdW5jdGlvbiBldmFsdWF0ZUZyb250aWVyKFxuXHRjbGllbnQ6IE9sbGFtYUNsaWVudCxcblx0c2V0dGluZ3M6IE9sbGFtYU9yY2hlc3RyYXRvclNldHRpbmdzLFxuXHRxdWVyeTogc3RyaW5nLFxuXHRpbnRlbnQ6IHN0cmluZyxcblx0ZnJvbnRpZXI6IEZyb250aWVySXRlbVtdXG4pOiBQcm9taXNlPE1hcDxzdHJpbmcsIEZyb250aWVyVmVyZGljdD4+IHtcblx0Y29uc3QgbGlzdGluZyA9IGZyb250aWVyXG5cdFx0Lm1hcCgoaXRlbSkgPT4ge1xuXHRcdFx0Y29uc3QgbGF5ZXIgPSBpdGVtLnNvdXJjZS5tZW1vcnkubGF5ZXJzW2l0ZW0ubGF5ZXJJbmRleF07XG5cdFx0XHRyZXR1cm4gYC0ga2V5OiAke2Zyb250aWVyS2V5KGl0ZW0pfVxcbiAgc291cmNlOiAke2l0ZW0uc291cmNlLmxhYmVsfVxcbiAgbGF5ZXI6ICR7bGF5ZXIubmFtZX1cXG4gIHN1bW1hcnk6ICR7bGF5ZXIudGV4dH1gO1xuXHRcdH0pXG5cdFx0LmpvaW4oXCJcXG5cIik7XG5cblx0Y29uc3QgcHJvbXB0ID0gYFlvdSBhcmUgc2VhcmNoaW5nIHNldmVyYWwgc291cmNlcyBhdCBvbmNlLCBlYWNoIHNob3duIGF0IGl0cyBMRUFTVCBkZXRhaWxlZCBhdmFpbGFibGUgbGF5ZXIgZm9yIHRoaXMgcm91bmQuXG5cblF1ZXN0aW9uOiBcIiR7cXVlcnl9XCJcbldoYXQgdGhlIHVzZXIgc3BlY2lmaWNhbGx5IG5lZWRzOiAke2ludGVudH1cblxuSXRlbXM6XG4ke2xpc3Rpbmd9XG5cbkZvciBFQUNIIGl0ZW0sIGRlY2lkZSBvbmUgb2Y6XG4tIFwiaXJyZWxldmFudFwiIFx1MjAxNCB0aGlzIHNvdXJjZSBoYXMgbm90aGluZyB0byBkbyB3aXRoIHdoYXQgdGhlIHVzZXIgc3BlY2lmaWNhbGx5IG5lZWRzOyBza2lwIGl0IGVudGlyZWx5LlxuLSBcInN1ZmZpY2llbnRcIiBcdTIwMTQgdGhpcyBsYXllciBhbG9uZSBpcyBkZXRhaWxlZCBlbm91Z2ggdG8gYWRkcmVzcyB3aGF0IHRoZSB1c2VyIHNwZWNpZmljYWxseSBuZWVkczsga2VlcCBpdCBhcy1pcy5cbi0gXCJkZXNjZW5kXCIgXHUyMDE0IHRoaXMgc291cmNlIHNlZW1zIHJlbGV2YW50IGJ1dCB0aGlzIGxheWVyIGlzbid0IGRldGFpbGVkIGVub3VnaDsgZmV0Y2ggdGhlIG5leHQsIG1vcmUgZGV0YWlsZWQgbGF5ZXIgb2YgdGhpcyBTQU1FIHNvdXJjZS5cblxuUmVzcG9uZCB3aXRoIE9OTFkgYSBKU09OIGFycmF5IGNvdmVyaW5nIGV2ZXJ5IGl0ZW0gYWJvdmU6IFt7XCJrZXlcIjogXCI8a2V5PlwiLCBcInZlcmRpY3RcIjogXCJpcnJlbGV2YW50XCJ8XCJzdWZmaWNpZW50XCJ8XCJkZXNjZW5kXCJ9LCAuLi5dYDtcblxuXHRjb25zdCByYXcgPSBhd2FpdCBjbGllbnQuZ2VuZXJhdGUoc2V0dGluZ3Muc3VtbWFyeU1vZGVsLCBwcm9tcHQsIHsgdGVtcGVyYXR1cmU6IDAuMSB9KTtcblx0Y29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIEZyb250aWVyVmVyZGljdD4oKTtcblx0Y29uc3QgYXJyID0gZXh0cmFjdEpzb248eyBrZXk/OiBzdHJpbmc7IHZlcmRpY3Q/OiBzdHJpbmcgfVtdPihyYXcpO1xuXHRpZiAoQXJyYXkuaXNBcnJheShhcnIpKSB7XG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBhcnIpIHtcblx0XHRcdGlmIChlbnRyeS5rZXkgJiYgKGVudHJ5LnZlcmRpY3QgPT09IFwiaXJyZWxldmFudFwiIHx8IGVudHJ5LnZlcmRpY3QgPT09IFwic3VmZmljaWVudFwiIHx8IGVudHJ5LnZlcmRpY3QgPT09IFwiZGVzY2VuZFwiKSkge1xuXHRcdFx0XHRtYXAuc2V0KGVudHJ5LmtleSwgZW50cnkudmVyZGljdCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiBtYXA7XG59XG5cbi8qKlxuICogU2VhcmNoZXMgbXVsdGlwbGUgbGF5ZXJlZCBtZW1vcmllcyBUT0dFVEhFUiwgb25lIHJvdW5kIHBlciBsYXllciB0aWVyOlxuICogZXZlcnkgc291cmNlIHN0YXJ0cyBhdCBsYXllciAwIChPdmVydmlldykuIEEgc2luZ2xlIGJhdGNoZWQgTExNIGNhbGxcbiAqIGV2YWx1YXRlcyB0aGUgd2hvbGUgY3VycmVudCB0aWVyIGF0IG9uY2UgYW5kIGRlY2lkZXMsIHBlciBzb3VyY2UsIHdoZXRoZXJcbiAqIHRvIGRpc2NhcmQgaXQsIGFjY2VwdCBpdHMgY3VycmVudCAoY2hlYXApIGxheWVyIGFzIHN1ZmZpY2llbnQsIG9yIGRlc2NlbmRcbiAqIG9uZSBsYXllciBmb3IgdGhhdCBzb3VyY2Ugb25seSBcdTIwMTQgb25seSBzb3VyY2VzIHN0aWxsIG1hcmtlZCBcImRlc2NlbmRcIlxuICogY29udGludWUgaW50byB0aGUgbmV4dCwgbW9yZSBkZXRhaWxlZCAoYW5kIG1vcmUgdG9rZW4taGVhdnkpIHRpZXIsIGFsbFxuICogdGhlIHdheSBkb3duIHRvIHRoZSBDb21wcmVoZW5zaXZlIFN1bW1hcnkgYW5kLCBhcyBhbiBhYnNvbHV0ZSBsYXN0XG4gKiByZXNvcnQsIHRoZSByYXcgT3JpZ2luYWwgdGV4dC5cbiAqXG4gKiBUaGlzIGlzIHdoYXQgbWFrZXMgXCJzZWFyY2ggdGhlIGxlYXN0LWRldGFpbGVkIGxheWVyIGZpcnN0LCB0aGVuXG4gKiBwcm9wYWdhdGUgZG93biBvbmx5IHdoZXJlIG5lZWRlZFwiIGEgcHJvcGVydHkgb2YgdGhlIHdob2xlIG1lbW9yeSBzZWFyY2hcbiAqIHJhdGhlciB0aGFuIG9mIG9uZSBzb3VyY2UncyBzdGFjayBpbiBpc29sYXRpb246IHRvdGFsIExMTSBjYWxscyBzY2FsZVxuICogd2l0aCBsYXllciBkZXB0aCAoYm91bmRlZCBieSBgbnVtQWJzdHJhY3Rpb25MYXllcnNgKSwgbm90IHdpdGggaG93IG1hbnlcbiAqIHNvdXJjZXMgd2VyZSBiZWluZyBzZWFyY2hlZCwgYW5kIGlycmVsZXZhbnQgc291cmNlcyBuZXZlciBjb3N0IG1vcmUgdGhhblxuICogdGhlaXIgT3ZlcnZpZXcuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiByZXNvbHZlQWNyb3NzU291cmNlcyhcblx0c291cmNlczogSGllcmFyY2hpY2FsU291cmNlW10sXG5cdHF1ZXJ5OiBzdHJpbmcsXG5cdGludGVudDogc3RyaW5nLFxuXHRjbGllbnQ6IE9sbGFtYUNsaWVudCxcblx0c2V0dGluZ3M6IE9sbGFtYU9yY2hlc3RyYXRvclNldHRpbmdzLFxuXHRtYXhSZXN1bHRzOiBudW1iZXIsXG5cdHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW5cbik6IFByb21pc2U8UmVzb2x2ZWRTb3VyY2VbXT4ge1xuXHRsZXQgZnJvbnRpZXI6IEZyb250aWVySXRlbVtdID0gc291cmNlc1xuXHRcdC5maWx0ZXIoKHMpID0+IHMubWVtb3J5LmxheWVycy5sZW5ndGggPiAwKVxuXHRcdC5tYXAoKHMpID0+ICh7IHNvdXJjZTogcywgbGF5ZXJJbmRleDogMCB9KSk7XG5cblx0Y29uc3QgcmVzdWx0czogUmVzb2x2ZWRTb3VyY2VbXSA9IFtdO1xuXG5cdHdoaWxlIChmcm9udGllci5sZW5ndGggPiAwKSB7XG5cdFx0dGhyb3dJZkNhbmNlbGxlZCh0b2tlbik7XG5cdFx0Y29uc3QgdmVyZGljdHMgPSBhd2FpdCBldmFsdWF0ZUZyb250aWVyKGNsaWVudCwgc2V0dGluZ3MsIHF1ZXJ5LCBpbnRlbnQsIGZyb250aWVyKTtcblx0XHRjb25zdCBuZXh0RnJvbnRpZXI6IEZyb250aWVySXRlbVtdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgZnJvbnRpZXIpIHtcblx0XHRcdGNvbnN0IGxheWVyID0gaXRlbS5zb3VyY2UubWVtb3J5LmxheWVyc1tpdGVtLmxheWVySW5kZXhdO1xuXHRcdFx0Y29uc3QgYXREZWVwZXN0TGF5ZXIgPSBpdGVtLmxheWVySW5kZXggPT09IGl0ZW0uc291cmNlLm1lbW9yeS5sYXllcnMubGVuZ3RoIC0gMTtcblx0XHRcdGNvbnN0IHZlcmRpY3QgPSB2ZXJkaWN0cy5nZXQoZnJvbnRpZXJLZXkoaXRlbSkpID8/IFwiZGVzY2VuZFwiOyAvLyBtaXNzaW5nIGZyb20gdGhlIHJlc3BvbnNlIGRlZmF1bHRzIHRvIGRlc2NlbmQsIG5vdCBzaWxlbnRseSBkcm9wcGVkXG5cblx0XHRcdGlmICh2ZXJkaWN0ID09PSBcImlycmVsZXZhbnRcIikgY29udGludWU7XG5cblx0XHRcdGlmICh2ZXJkaWN0ID09PSBcInN1ZmZpY2llbnRcIikge1xuXHRcdFx0XHRyZXN1bHRzLnB1c2goeyBrZXk6IGl0ZW0uc291cmNlLmtleSwgbGFiZWw6IGl0ZW0uc291cmNlLmxhYmVsLCB0ZXh0OiBsYXllci50ZXh0LCBsYXllclVzZWQ6IGxheWVyLm5hbWUgfSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB2ZXJkaWN0ID09PSBcImRlc2NlbmRcIlxuXHRcdFx0aWYgKGF0RGVlcGVzdExheWVyKSB7XG5cdFx0XHRcdC8vIE5vdGhpbmcgbW9yZSBkZXRhaWxlZCB0aGFuIHRoZSBDb21wcmVoZW5zaXZlIFN1bW1hcnkgZXhjZXB0XG5cdFx0XHRcdC8vIHRoZSByYXcgT3JpZ2luYWwgXHUyMDE0IHdvcnRoIGl0IG9ubHkgYmVjYXVzZSB0aGlzIHNvdXJjZSB3YXNcblx0XHRcdFx0Ly8gZXhwbGljaXRseSBqdWRnZWQgcmVsZXZhbnQtYnV0LWluc3VmZmljaWVudCwgbm90IGp1c3Qgcm91dGVkLlxuXHRcdFx0XHRyZXN1bHRzLnB1c2goeyBrZXk6IGl0ZW0uc291cmNlLmtleSwgbGFiZWw6IGl0ZW0uc291cmNlLmxhYmVsLCB0ZXh0OiBpdGVtLnNvdXJjZS5tZW1vcnkub3JpZ2luYWwsIGxheWVyVXNlZDogXCJPcmlnaW5hbFwiIH0pO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0bmV4dEZyb250aWVyLnB1c2goeyBzb3VyY2U6IGl0ZW0uc291cmNlLCBsYXllckluZGV4OiBpdGVtLmxheWVySW5kZXggKyAxIH0pO1xuXHRcdH1cblxuXHRcdGZyb250aWVyID0gbmV4dEZyb250aWVyO1xuXHRcdGlmIChyZXN1bHRzLmxlbmd0aCA+PSBtYXhSZXN1bHRzKSBicmVhaztcblx0fVxuXG5cdC8vIE1lcmdlIG11bHRpcGxlIGhpdHMgZnJvbSB0aGUgc2FtZSBzb3VyY2UgaW50byBvbmUgYmxvY2ssIHRoZW4gY2FwLlxuXHRjb25zdCBtZXJnZWQgPSBuZXcgTWFwPHN0cmluZywgUmVzb2x2ZWRTb3VyY2U+KCk7XG5cdGZvciAoY29uc3QgciBvZiByZXN1bHRzKSB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSBtZXJnZWQuZ2V0KHIua2V5KTtcblx0XHRpZiAoZXhpc3RpbmcpIHtcblx0XHRcdGV4aXN0aW5nLnRleHQgPSBgJHtleGlzdGluZy50ZXh0fVxcbiR7ci50ZXh0fWA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1lcmdlZC5zZXQoci5rZXksIHsgLi4uciB9KTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gQXJyYXkuZnJvbShtZXJnZWQudmFsdWVzKCkpLnNsaWNlKDAsIG1heFJlc3VsdHMpO1xufVxuIiwgImltcG9ydCB7IE9sbGFtYUNsaWVudCwgY29zaW5lU2ltaWxhcml0eSB9IGZyb20gXCIuL29sbGFtYUNsaWVudFwiO1xuaW1wb3J0IHsgT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xuaW1wb3J0IHsgTWVtb3J5VG9waWMgfSBmcm9tIFwiLi9tZW1vcnlTdG9yZVwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJvdXRlZFRvcGljIHtcblx0dG9waWM6IE1lbW9yeVRvcGljO1xuXHRzY29yZTogbnVtYmVyO1xuXHRyZWFzb24/OiBzdHJpbmc7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RKc29uQXJyYXkocmF3OiBzdHJpbmcpOiBzdHJpbmdbXSB8IG51bGwge1xuXHRjb25zdCBtYXRjaCA9IHJhdy5tYXRjaCgvXFxbW1xcc1xcU10qXFxdLyk7XG5cdGlmICghbWF0Y2gpIHJldHVybiBudWxsO1xuXHR0cnkge1xuXHRcdGNvbnN0IGFyciA9IEpTT04ucGFyc2UobWF0Y2hbMF0pO1xuXHRcdHJldHVybiBBcnJheS5pc0FycmF5KGFycikgPyBhcnIubWFwKFN0cmluZykgOiBudWxsO1xuXHR9IGNhdGNoIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufVxuXG4vKiogTExNLWJhc2VkIHJvdXRpbmc6IHNob3cgdGhlIG1vZGVsIGV2ZXJ5IHRvcGljIG92ZXJ2aWV3IGFuZCBhc2sgaXQgdG8gcGljayByZWxldmFudCBpZHMuICovXG5hc3luYyBmdW5jdGlvbiByb3V0ZUJ5TGxtKFxuXHRjbGllbnQ6IE9sbGFtYUNsaWVudCxcblx0c2V0dGluZ3M6IE9sbGFtYU9yY2hlc3RyYXRvclNldHRpbmdzLFxuXHRxdWVyeTogc3RyaW5nLFxuXHRjYW5kaWRhdGVzOiBNZW1vcnlUb3BpY1tdXG4pOiBQcm9taXNlPFJvdXRlZFRvcGljW10+IHtcblx0aWYgKGNhbmRpZGF0ZXMubGVuZ3RoID09PSAwKSByZXR1cm4gW107XG5cblx0Y29uc3QgbGlzdGluZyA9IGNhbmRpZGF0ZXMubWFwKCh0KSA9PiBgLSBpZDogJHt0LmlkfVxcbiAgbmFtZTogJHt0Lm5hbWV9XFxuICBvdmVydmlldzogJHt0Lm92ZXJ2aWV3fWApLmpvaW4oXCJcXG5cIik7XG5cdGNvbnN0IHByb21wdCA9IGBBIHVzZXIgYXNrZWQ6IFwiJHtxdWVyeX1cIlxuXG5IZXJlIGFyZSBtZW1vcnkgdG9waWNzIGF2YWlsYWJsZSwgZWFjaCB3aXRoIGEgc2hvcnQgb3ZlcnZpZXc6XG4ke2xpc3Rpbmd9XG5cbkxpc3QgdGhlIGlkcyBvZiB0aGUgdG9waWNzIChhdCBtb3N0ICR7c2V0dGluZ3MubWF4TWVtb3JpZXNQZXJRdWVyeX0pIHRoYXQgYXJlIGFjdHVhbGx5IHJlbGV2YW50IHRvIGFuc3dlcmluZyBvciBpbmZvcm1pbmcgYSByZXNwb25zZSB0byB0aGlzIHF1ZXN0aW9uLiBPcmRlciB0aGVtIGZyb20gbW9zdCB0byBsZWFzdCByZWxldmFudC4gSWYgbm9uZSBhcmUgcmVsZXZhbnQsIHJldHVybiBhbiBlbXB0eSBhcnJheS5cblxuUmVzcG9uZCB3aXRoIE9OTFkgYSBKU09OIGFycmF5IG9mIGlkIHN0cmluZ3MsIG5vdGhpbmcgZWxzZS5gO1xuXG5cdGNvbnN0IHJhdyA9IGF3YWl0IGNsaWVudC5nZW5lcmF0ZShzZXR0aW5ncy5zdW1tYXJ5TW9kZWwsIHByb21wdCwgeyB0ZW1wZXJhdHVyZTogMC4xIH0pO1xuXHRjb25zdCBpZHMgPSBleHRyYWN0SnNvbkFycmF5KHJhdykgPz8gW107XG5cblx0Y29uc3QgYnlJZCA9IG5ldyBNYXAoY2FuZGlkYXRlcy5tYXAoKHQpID0+IFt0LmlkLCB0XSkpO1xuXHRjb25zdCByZXN1bHQ6IFJvdXRlZFRvcGljW10gPSBbXTtcblx0Zm9yIChjb25zdCBpZCBvZiBpZHMpIHtcblx0XHRjb25zdCB0ID0gYnlJZC5nZXQoaWQpO1xuXHRcdGlmICh0KSByZXN1bHQucHVzaCh7IHRvcGljOiB0LCBzY29yZTogMSB9KTtcblx0fVxuXHRyZXR1cm4gcmVzdWx0LnNsaWNlKDAsIHNldHRpbmdzLm1heE1lbW9yaWVzUGVyUXVlcnkpO1xufVxuXG4vKiogRW1iZWRkaW5nLWJhc2VkIHJvdXRpbmc6IGNvc2luZSBzaW1pbGFyaXR5IGJldHdlZW4gdGhlIHF1ZXJ5IGFuZCBlYWNoIHRvcGljIG92ZXJ2aWV3LiAqL1xuYXN5bmMgZnVuY3Rpb24gcm91dGVCeUVtYmVkZGluZyhcblx0Y2xpZW50OiBPbGxhbWFDbGllbnQsXG5cdHNldHRpbmdzOiBPbGxhbWFPcmNoZXN0cmF0b3JTZXR0aW5ncyxcblx0cXVlcnk6IHN0cmluZyxcblx0Y2FuZGlkYXRlczogTWVtb3J5VG9waWNbXSxcblx0b3ZlcnZpZXdFbWJlZGRpbmdzOiBNYXA8c3RyaW5nLCBudW1iZXJbXT5cbik6IFByb21pc2U8Um91dGVkVG9waWNbXT4ge1xuXHRpZiAoY2FuZGlkYXRlcy5sZW5ndGggPT09IDApIHJldHVybiBbXTtcblx0Y29uc3QgcXVlcnlWZWMgPSBhd2FpdCBjbGllbnQuZW1iZWQoc2V0dGluZ3MuZW1iZWRkaW5nTW9kZWwsIHF1ZXJ5KTtcblxuXHRjb25zdCBzY29yZWQ6IFJvdXRlZFRvcGljW10gPSBbXTtcblx0Zm9yIChjb25zdCB0IG9mIGNhbmRpZGF0ZXMpIHtcblx0XHRsZXQgdmVjID0gb3ZlcnZpZXdFbWJlZGRpbmdzLmdldCh0LmlkKTtcblx0XHRpZiAoIXZlYykge1xuXHRcdFx0dmVjID0gYXdhaXQgY2xpZW50LmVtYmVkKHNldHRpbmdzLmVtYmVkZGluZ01vZGVsLCB0Lm92ZXJ2aWV3KTtcblx0XHRcdG92ZXJ2aWV3RW1iZWRkaW5ncy5zZXQodC5pZCwgdmVjKTtcblx0XHR9XG5cdFx0Y29uc3Qgc2NvcmUgPSBjb3NpbmVTaW1pbGFyaXR5KHF1ZXJ5VmVjLCB2ZWMpO1xuXHRcdGlmIChzY29yZSA+PSBzZXR0aW5ncy5zaW1pbGFyaXR5VGhyZXNob2xkKSB7XG5cdFx0XHRzY29yZWQucHVzaCh7IHRvcGljOiB0LCBzY29yZSB9KTtcblx0XHR9XG5cdH1cblxuXHRzY29yZWQuc29ydCgoYSwgYikgPT4gYi5zY29yZSAtIGEuc2NvcmUpO1xuXHRyZXR1cm4gc2NvcmVkLnNsaWNlKDAsIHNldHRpbmdzLm1heE1lbW9yaWVzUGVyUXVlcnkpO1xufVxuXG4vKipcbiAqIFNlbGVjdHMgd2hpY2ggbWVtb3J5IHRvcGljcyAobWF4IHNldHRpbmdzLm1heE1lbW9yaWVzUGVyUXVlcnkpIGFyZSByZWxldmFudFxuICogdG8gYSBnaXZlbiBjaGF0IHF1ZXJ5LCB1c2luZyB0aGUgY29uZmlndXJlZCByb3V0aW5nIG1ldGhvZDpcbiAqICAtIFwiZW1iZWRkaW5nXCI6IGZhc3QsIHNjYWxlcyB0byBtYW55IHRvcGljcywgbm8gTExNIHJvdW5kIHRyaXBcbiAqICAtIFwibGxtXCI6IG1vc3Qgc2VtYW50aWNhbGx5IGZsZXhpYmxlLCBjb3N0cyBvbmUgZ2VuZXJhdGlvbiBjYWxsXG4gKiAgLSBcImh5YnJpZFwiOiBlbWJlZGRpbmdzIHNob3J0bGlzdCBjYW5kaWRhdGVzICgyeCB0aGUgY2FwKSwgdGhlbiB0aGUgTExNXG4gKiAgICByZS1yYW5rcy9maWx0ZXJzIHRoYXQgc2hvcnRsaXN0IFx1MjAxNCBnb29kIGJhbGFuY2Ugb25jZSB0b3BpYyBjb3VudCBncm93cy5cbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJvdXRlTWVtb3JpZXMoXG5cdGNsaWVudDogT2xsYW1hQ2xpZW50LFxuXHRzZXR0aW5nczogT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MsXG5cdHF1ZXJ5OiBzdHJpbmcsXG5cdGFsbFRvcGljczogTWVtb3J5VG9waWNbXSxcblx0b3ZlcnZpZXdFbWJlZGRpbmdzOiBNYXA8c3RyaW5nLCBudW1iZXJbXT5cbik6IFByb21pc2U8Um91dGVkVG9waWNbXT4ge1xuXHRpZiAoYWxsVG9waWNzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuXG5cdGlmIChzZXR0aW5ncy5yb3V0aW5nTWV0aG9kID09PSBcImVtYmVkZGluZ1wiKSB7XG5cdFx0cmV0dXJuIHJvdXRlQnlFbWJlZGRpbmcoY2xpZW50LCBzZXR0aW5ncywgcXVlcnksIGFsbFRvcGljcywgb3ZlcnZpZXdFbWJlZGRpbmdzKTtcblx0fVxuXG5cdGlmIChzZXR0aW5ncy5yb3V0aW5nTWV0aG9kID09PSBcImxsbVwiKSB7XG5cdFx0cmV0dXJuIHJvdXRlQnlMbG0oY2xpZW50LCBzZXR0aW5ncywgcXVlcnksIGFsbFRvcGljcyk7XG5cdH1cblxuXHQvLyBoeWJyaWRcblx0Y29uc3Qgc2hvcnRsaXN0U2l6ZSA9IE1hdGgubWF4KHNldHRpbmdzLm1heE1lbW9yaWVzUGVyUXVlcnkgKiAyLCBzZXR0aW5ncy5tYXhNZW1vcmllc1BlclF1ZXJ5ICsgMik7XG5cdGNvbnN0IHNob3J0bGlzdGVkID0gYXdhaXQgcm91dGVCeUVtYmVkZGluZyhcblx0XHRjbGllbnQsXG5cdFx0eyAuLi5zZXR0aW5ncywgbWF4TWVtb3JpZXNQZXJRdWVyeTogc2hvcnRsaXN0U2l6ZSwgc2ltaWxhcml0eVRocmVzaG9sZDogMCB9LFxuXHRcdHF1ZXJ5LFxuXHRcdGFsbFRvcGljcyxcblx0XHRvdmVydmlld0VtYmVkZGluZ3Ncblx0KTtcblx0aWYgKHNob3J0bGlzdGVkLmxlbmd0aCA9PT0gMCkgcmV0dXJuIFtdO1xuXHRyZXR1cm4gcm91dGVCeUxsbShjbGllbnQsIHNldHRpbmdzLCBxdWVyeSwgc2hvcnRsaXN0ZWQubWFwKChzKSA9PiBzLnRvcGljKSk7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3RKc29uT2JqPFQ+KHJhdzogc3RyaW5nKTogVCB8IG51bGwge1xuXHRjb25zdCBtYXRjaCA9IHJhdy5tYXRjaCgvXFx7W1xcc1xcU10qXFx9Lyk7XG5cdGlmICghbWF0Y2gpIHJldHVybiBudWxsO1xuXHR0cnkge1xuXHRcdHJldHVybiBKU09OLnBhcnNlKG1hdGNoWzBdKSBhcyBUO1xuXHR9IGNhdGNoIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufVxuXG4vKipcbiAqIERlY2lkZXMgd2hldGhlciBhIG5ldyBwaWVjZSBvZiBjb250ZW50IChhIGZpbGUgYmVpbmcgaW5nZXN0ZWQsIGFuXG4gKiBleHBsaWNpdCBcInJlbWVtYmVyIHRoaXNcIiwgYW4gYXV0by1kZXRlY3RlZCBmYWN0KSBiZWxvbmdzIHVuZGVyIGFuXG4gKiBleGlzdGluZyB0b3BpYywgb3Igc2hvdWxkIGJlY29tZSBpdHMgb3duIG5ldyB0b3BpYy5cbiAqXG4gKiBUaGlzIHVzZWQgdG8gYXNrIHRoZSBMTE0gdG8gZnJlZWx5IHR5cGUgYmFjayBhbiBleGFjdCB0b3BpYyBpZCBmcm9tIGFcbiAqIGxpc3QgXHUyMDE0IHNtYWxsIGxvY2FsIG1vZGVscyBhcmUgdW5yZWxpYWJsZSBhdCB0aGF0LCBzbyBhIHZhbGlkIG1hdGNoIHdvdWxkXG4gKiBzaWxlbnRseSBjb21lIGJhY2sgYXMgXCJubyBtYXRjaFwiIGFuZCBmcmFnbWVudCBtZW1vcnkgaW50byBkdXBsaWNhdGVcbiAqIHRvcGljcyBpbnN0ZWFkIG9mIGFjdHVhbGx5IGV4dGVuZGluZyB0aGUgcmlnaHQgb25lLiBFbWJlZGRpbmcgc2ltaWxhcml0eVxuICogaXMgdXNlZCBhcyB0aGUgcHJpbWFyeSwgZGV0ZXJtaW5pc3RpYyBzaWduYWwgaW5zdGVhZDpcbiAqICAtIGEgc3Ryb25nIG1hdGNoICg+PSBzaW1pbGFyaXR5VGhyZXNob2xkKSBpcyB0YWtlbiBkaXJlY3RseSwgbm8gTExNIGNhbGw7XG4gKiAgLSBhIGJvcmRlcmxpbmUgbWF0Y2ggYXNrcyB0aGUgTExNIHRvIGNvbmZpcm0gYWdhaW5zdCBhIHNob3J0IGxpc3QsIGJ1dFxuICogICAgdGhlIGlkIGl0IHJldHVybnMgaXMgYWx3YXlzIHZhbGlkYXRlZCBhZ2FpbnN0IHRoZSByZWFsIGNhbmRpZGF0ZXMgXHUyMDE0XG4gKiAgICBhbiBpbnZhbGlkL2hhbGx1Y2luYXRlZCBpZCBpcyB0cmVhdGVkIGFzIFwibm8gbWF0Y2hcIiByYXRoZXIgdGhhblxuICogICAgc2lsZW50bHkgbWlzZmlsaW5nIGNvbnRlbnQgdW5kZXIgdGhlIHdyb25nIHRvcGljO1xuICogIC0gbm90aGluZyBjbG9zZSBlbm91Z2ggbWVhbnMgaXQncyBnZW51aW5lbHkgYSBuZXcgdG9waWMuXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBmaW5kQmVzdE1hdGNoaW5nVG9waWMoXG5cdGNsaWVudDogT2xsYW1hQ2xpZW50LFxuXHRzZXR0aW5nczogT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MsXG5cdGNhbmRpZGF0ZU92ZXJ2aWV3OiBzdHJpbmcsXG5cdGNhbmRpZGF0ZU5hbWU6IHN0cmluZyxcblx0YWxsVG9waWNzOiBNZW1vcnlUb3BpY1tdLFxuXHRvdmVydmlld0VtYmVkZGluZ3M6IE1hcDxzdHJpbmcsIG51bWJlcltdPlxuKTogUHJvbWlzZTxNZW1vcnlUb3BpYyB8IHVuZGVmaW5lZD4ge1xuXHRpZiAoYWxsVG9waWNzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHVuZGVmaW5lZDtcblxuXHRjb25zdCBxdWVyeVZlYyA9IGF3YWl0IGNsaWVudC5lbWJlZChzZXR0aW5ncy5lbWJlZGRpbmdNb2RlbCwgY2FuZGlkYXRlT3ZlcnZpZXcpO1xuXHRjb25zdCBzY29yZWQ6IHsgdG9waWM6IE1lbW9yeVRvcGljOyBzY29yZTogbnVtYmVyIH1bXSA9IFtdO1xuXHRmb3IgKGNvbnN0IHQgb2YgYWxsVG9waWNzKSB7XG5cdFx0bGV0IHZlYyA9IG92ZXJ2aWV3RW1iZWRkaW5ncy5nZXQodC5pZCk7XG5cdFx0aWYgKCF2ZWMpIHtcblx0XHRcdHZlYyA9IGF3YWl0IGNsaWVudC5lbWJlZChzZXR0aW5ncy5lbWJlZGRpbmdNb2RlbCwgdC5vdmVydmlldyk7XG5cdFx0XHRvdmVydmlld0VtYmVkZGluZ3Muc2V0KHQuaWQsIHZlYyk7XG5cdFx0fVxuXHRcdHNjb3JlZC5wdXNoKHsgdG9waWM6IHQsIHNjb3JlOiBjb3NpbmVTaW1pbGFyaXR5KHF1ZXJ5VmVjLCB2ZWMpIH0pO1xuXHR9XG5cdHNjb3JlZC5zb3J0KChhLCBiKSA9PiBiLnNjb3JlIC0gYS5zY29yZSk7XG5cblx0Y29uc3QgYmVzdCA9IHNjb3JlZFswXTtcblx0aWYgKCFiZXN0KSByZXR1cm4gdW5kZWZpbmVkO1xuXHRpZiAoYmVzdC5zY29yZSA+PSBzZXR0aW5ncy5zaW1pbGFyaXR5VGhyZXNob2xkKSByZXR1cm4gYmVzdC50b3BpYztcblxuXHQvLyBCb3JkZXJsaW5lIGJhbmQ6IGNsb3NlIGVub3VnaCB0byBiZSB3b3J0aCBhbiBMTE0gb3BpbmlvbiwgYnV0IG5vdFxuXHQvLyBjb25maWRlbnQgZW5vdWdoIHRvIGF1dG8tbWVyZ2UuXG5cdGNvbnN0IGJvcmRlcmxpbmVGbG9vciA9IE1hdGgubWF4KDAsIHNldHRpbmdzLnNpbWlsYXJpdHlUaHJlc2hvbGQgLSAwLjE1KTtcblx0Y29uc3QgYm9yZGVybGluZSA9IHNjb3JlZC5maWx0ZXIoKHMpID0+IHMuc2NvcmUgPj0gYm9yZGVybGluZUZsb29yKS5zbGljZSgwLCA1KTtcblx0aWYgKGJvcmRlcmxpbmUubGVuZ3RoID09PSAwKSByZXR1cm4gdW5kZWZpbmVkO1xuXG5cdGNvbnN0IGxpc3RpbmcgPSBib3JkZXJsaW5lLm1hcCgocykgPT4gYC0gaWQ6ICR7cy50b3BpYy5pZH1cXG4gIG5hbWU6ICR7cy50b3BpYy5uYW1lfVxcbiAgb3ZlcnZpZXc6ICR7cy50b3BpYy5vdmVydmlld31gKS5qb2luKFwiXFxuXCIpO1xuXHRjb25zdCBwcm9tcHQgPSBgTmV3IGNvbnRlbnQgb3ZlcnZpZXc6IFwiJHtjYW5kaWRhdGVPdmVydmlld31cIiAoY2FuZGlkYXRlIG5hbWU6IFwiJHtjYW5kaWRhdGVOYW1lfVwiKVxuXG5Qb3NzaWJseS1yZWxhdGVkIGV4aXN0aW5nIHRvcGljczpcbiR7bGlzdGluZ31cblxuRG9lcyB0aGUgbmV3IGNvbnRlbnQgYmVsb25nIHVuZGVyIG9uZSBvZiB0aGVzZSBleGlzdGluZyB0b3BpY3MgKHNhbWUgc3ViamVjdCksIG9yIGlzIGl0IGRpc3RpbmN0IGVub3VnaCB0byBiZSBpdHMgb3duIHRvcGljP1xuUmVzcG9uZCB3aXRoIE9OTFkgSlNPTjoge1wibWF0Y2hJZFwiOiBcIjxvbmUgb2YgdGhlIGlkcyBhYm92ZSwgb3IgbnVsbD5cIn1gO1xuXG5cdGNvbnN0IHJhdyA9IGF3YWl0IGNsaWVudC5nZW5lcmF0ZShzZXR0aW5ncy5zdW1tYXJ5TW9kZWwsIHByb21wdCwgeyB0ZW1wZXJhdHVyZTogMC4xIH0pO1xuXHRjb25zdCBwYXJzZWQgPSBleHRyYWN0SnNvbk9iajx7IG1hdGNoSWQ6IHN0cmluZyB8IG51bGwgfT4ocmF3KTtcblx0aWYgKCFwYXJzZWQ/Lm1hdGNoSWQpIHJldHVybiB1bmRlZmluZWQ7XG5cblx0Ly8gVmFsaWRhdGU6IG9ubHkgYWNjZXB0IGFuIGlkIHRoYXQgd2FzIGFjdHVhbGx5IG9mZmVyZWQsIG5ldmVyIHRydXN0IGl0IGJsaW5kbHkuXG5cdHJldHVybiBib3JkZXJsaW5lLmZpbmQoKHMpID0+IHMudG9waWMuaWQgPT09IHBhcnNlZC5tYXRjaElkKT8udG9waWM7XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBURmlsZSwgbm9ybWFsaXplUGF0aCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgQWN0aXZlRmlsZVRyYWNrZXIgfSBmcm9tIFwiLi9hY3RpdmVGaWxlVHJhY2tlclwiO1xuXG4vKiogVGhpbiB3cmFwcGVyIGFyb3VuZCBPYnNpZGlhbidzIHZhdWx0IEFQSSwgZXhwb3NlZCBhcyBcInNraWxsc1wiIHRoZSBvcmNoZXN0cmF0b3IgY2FuIGNhbGwuICovXG5leHBvcnQgY2xhc3MgRmlsZVNraWxscyB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgYXBwOiBBcHAsXG5cdFx0cHJpdmF0ZSBhY3RpdmVGaWxlVHJhY2tlcj86IEFjdGl2ZUZpbGVUcmFja2VyXG5cdCkge31cblxuXHRhc3luYyByZWFkRmlsZShwYXRoOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgobm9ybWFsaXplUGF0aChwYXRoKSk7XG5cdFx0aWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgdGhyb3cgbmV3IEVycm9yKGBOb3QgYSBmaWxlOiAke3BhdGh9YCk7XG5cdFx0cmV0dXJuIHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cdH1cblxuXHRhc3luYyB3cml0ZUZpbGUocGF0aDogc3RyaW5nLCBjb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBub3JtYWxpemVkID0gbm9ybWFsaXplUGF0aChwYXRoKTtcblx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChub3JtYWxpemVkKTtcblx0XHRpZiAoZXhpc3RpbmcgaW5zdGFuY2VvZiBURmlsZSkge1xuXHRcdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQubW9kaWZ5KGV4aXN0aW5nLCBjb250ZW50KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlKG5vcm1hbGl6ZWQsIGNvbnRlbnQpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGFwcGVuZFRvRmlsZShwYXRoOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG5vcm1hbGl6ZWQgPSBub3JtYWxpemVQYXRoKHBhdGgpO1xuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKG5vcm1hbGl6ZWQpO1xuXHRcdGlmIChleGlzdGluZyBpbnN0YW5jZW9mIFRGaWxlKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5hcHBlbmQoZXhpc3RpbmcsIGNvbnRlbnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUobm9ybWFsaXplZCwgY29udGVudCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgbGlzdE1hcmtkb3duRmlsZXMoZm9sZGVyPzogc3RyaW5nKTogUHJvbWlzZTxURmlsZVtdPiB7XG5cdFx0Y29uc3QgYWxsID0gdGhpcy5hcHAudmF1bHQuZ2V0TWFya2Rvd25GaWxlcygpO1xuXHRcdGlmICghZm9sZGVyKSByZXR1cm4gYWxsO1xuXHRcdGNvbnN0IHByZWZpeCA9IG5vcm1hbGl6ZVBhdGgoZm9sZGVyKSArIFwiL1wiO1xuXHRcdHJldHVybiBhbGwuZmlsdGVyKChmKSA9PiBmLnBhdGguc3RhcnRzV2l0aChwcmVmaXgpKTtcblx0fVxuXG5cdGdldEFjdGl2ZUZpbGUoKTogVEZpbGUgfCBudWxsIHtcblx0XHQvLyBQcmVmZXIgdGhlIHRyYWNrZXIgKHN1cnZpdmVzIGZvY3VzIG1vdmluZyBpbnRvIHRoZSBjaGF0IHBhbmVsKTtcblx0XHQvLyBmYWxsIGJhY2sgdG8gT2JzaWRpYW4ncyBvd24gYWNjZXNzb3IgaWYgbm8gdHJhY2tlciB3YXMgd2lyZWQgdXAuXG5cdFx0cmV0dXJuIHRoaXMuYWN0aXZlRmlsZVRyYWNrZXI/LmdldEZpbGUoKSA/PyB0aGlzLmFwcC53b3Jrc3BhY2UuZ2V0QWN0aXZlRmlsZSgpO1xuXHR9XG59XG4iLCAiaW1wb3J0IHsgQXBwLCBURmlsZSB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgT2xsYW1hQ2xpZW50LCBDaGF0TWVzc2FnZSB9IGZyb20gXCIuL29sbGFtYUNsaWVudFwiO1xuaW1wb3J0IHsgT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MgfSBmcm9tIFwiLi9zZXR0aW5nc1wiO1xuaW1wb3J0IHsgTWVtb3J5U3RvcmUsIE1lbW9yeVRvcGljIH0gZnJvbSBcIi4vbWVtb3J5U3RvcmVcIjtcbmltcG9ydCB7IHF1aWNrT3ZlcnZpZXcsIGdlbmVyYXRlU2hvcnRUaXRsZSwgZXh0cmFjdFF1ZXJ5SW50ZW50LCBESVJFQ1RfU1VNTUFSSVpFX0NIQVJfQ0FQIH0gZnJvbSBcIi4vc3VtbWFyaXplclwiO1xuaW1wb3J0IHsgcmVzb2x2ZUZyb21MYXllcnMsIHJlc29sdmVBY3Jvc3NTb3VyY2VzLCBIaWVyYXJjaGljYWxTb3VyY2UgfSBmcm9tIFwiLi9oaWVyYXJjaGljYWxRdWVyeVwiO1xuaW1wb3J0IHsgcm91dGVNZW1vcmllcywgZmluZEJlc3RNYXRjaGluZ1RvcGljLCBSb3V0ZWRUb3BpYyB9IGZyb20gXCIuL21lbW9yeVJvdXRlclwiO1xuaW1wb3J0IHsgRmlsZVNraWxscyB9IGZyb20gXCIuL2ZpbGVTa2lsbHNcIjtcbmltcG9ydCB7IFRlbXBNZW1vcnlTdG9yZSwgVGVtcE1lbW9yeUVudHJ5IH0gZnJvbSBcIi4vdGVtcE1lbW9yeVN0b3JlXCI7XG5pbXBvcnQgeyBOb3RlTWVtb3J5U3RvcmUgfSBmcm9tIFwiLi9ub3RlTWVtb3J5U3RvcmVcIjtcbmltcG9ydCB7IENoYXRIaXN0b3J5U3RvcmUgfSBmcm9tIFwiLi9jaGF0SGlzdG9yeVN0b3JlXCI7XG5pbXBvcnQgeyBBY3RpdmVGaWxlVHJhY2tlciB9IGZyb20gXCIuL2FjdGl2ZUZpbGVUcmFja2VyXCI7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgdGhyb3dJZkNhbmNlbGxlZCB9IGZyb20gXCIuL2NhbmNlbGxhdGlvblwiO1xuXG5mdW5jdGlvbiBleHRyYWN0SnNvbjxUPihyYXc6IHN0cmluZyk6IFQgfCBudWxsIHtcblx0Y29uc3QgbWF0Y2ggPSByYXcubWF0Y2goL1xce1tcXHNcXFNdKlxcfS8pO1xuXHRpZiAoIW1hdGNoKSByZXR1cm4gbnVsbDtcblx0dHJ5IHtcblx0XHRyZXR1cm4gSlNPTi5wYXJzZShtYXRjaFswXSkgYXMgVDtcblx0fSBjYXRjaCB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBDaGF0VHVyblJlc3VsdCB7XG5cdGFuc3dlcjogc3RyaW5nO1xuXHR1c2VkVG9waWNzOiBSb3V0ZWRUb3BpY1tdO1xuXHQvKiogdHJ1ZSBpZiBgYW5zd2VyYCBpcyBhIGNsYXJpZnlpbmcgcXVlc3Rpb24sIG5vdCBhIHJlYWwgYW5zd2VyIFx1MjAxNCB0aGUgbmV4dCBjaGF0IHR1cm4gc2hvdWxkIGJlIHRyZWF0ZWQgYXMgdGhlIHVzZXIncyByZXBseSB0byBpdC4gKi9cblx0bmVlZHNDbGFyaWZpY2F0aW9uPzogYm9vbGVhbjtcblx0LyoqIGNhbmRpZGF0ZSBtZW1vcnkgdXBkYXRlcyBzdXJmYWNlZCB0aGlzIHR1cm4sIGF3YWl0aW5nIHRoZSB1c2VyJ3MgY29uZmlybS9kaXNjYXJkIGluIHRoZSBjaGF0IHBhbmVsLiBDYW4gYmUgbW9yZSB0aGFuIG9uZSBcdTIwMTQgZS5nLiB0aGUgY2xhcmlmaWNhdGlvbiBhbnN3ZXIgaXRzZWxmLCBwbHVzIGEgc2VwYXJhdGVseS1kZXRlY3RlZCBmYWN0IGZyb20gdGhlIGZpbmFsIGFuc3dlci4gKi9cblx0cGVuZGluZ0VudHJpZXM/OiBUZW1wTWVtb3J5RW50cnlbXTtcblx0LyoqIHRydWUgaWYgdGhpcyB0dXJuIHdhcyBhbiBleHBsaWNpdCBcInJlbWVtYmVyIHRoaXNcIiBjb21tYW5kIHRoYXQgd2FzIGNvbW1pdHRlZCBkaXJlY3RseSAobm8gcGVuZGluZyBjYXJkLCBub3RoaW5nIGxlZnQgdG8gY29uZmlybSkuICovXG5cdG1lbW9yeUNvbW1pdHRlZD86IHsgdG9waWM6IE1lbW9yeVRvcGljIH07XG5cdC8qKiB0aGUgYWN0aXZlIG5vdGUncyBtaXJyb3Igd2FzIHVzZWQgdG8gZ3JvdW5kIHRoaXMgYW5zd2VyIFx1MjAxNCBzdXJmYWNlZCBzbyB0aGUgVUkgY2FuIG9mZmVyIGEgcmVmcmVzaCBpZiBpdCBsb29rcyBzdGFsZS4gKi9cblx0bm90ZU1lbW9yeVVzZWQ/OiB7IGZpbGVQYXRoOiBzdHJpbmc7IGZpbGVOYW1lOiBzdHJpbmcgfTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBIYW5kbGVRdWVyeU9wdGlvbnMge1xuXHQvKiogd2hpY2ggY2hhdCBzZXNzaW9uIHRoaXMgdHVybiBiZWxvbmdzIHRvIFx1MjAxNCBzY29wZXMgd2hpY2ggdGVtcC1tZW1vcnkgZW50cmllcyBjb3VudCBhcyBsaXZlIGNvbnRleHQuICovXG5cdHNlc3Npb25JZDogc3RyaW5nO1xuXHQvKiogaW5jbHVkZSB0aGUgY3VycmVudGx5IGFjdGl2ZS9vcGVuIG5vdGUncyBjb250ZW50IGFzIGV4dHJhIGNvbnRleHQgKFwicmVhZGluZyBwYWdlXCIgbW9kZSkuIERlZmF1bHQgZmFsc2UgKG1lbW9yeS1vbmx5KS4gKi9cblx0aW5jbHVkZUFjdGl2ZU5vdGU/OiBib29sZWFuO1xuXHQvKiogaW50ZXJuYWw6IHNraXAgdGhlIGFtYmlndWl0eSBjaGVjayBhbmQgY2FuZGlkYXRlLXN0YWdpbmcgcGFzcyAodXNlZCB3aGVuIHJlLWFuc3dlcmluZyByaWdodCBhZnRlciBhIGNsYXJpZmljYXRpb24gd2FzIGp1c3Qgc3VwcGxpZWQpLiAqL1xuXHRza2lwQ2xhcmlmaWNhdGlvbj86IGJvb2xlYW47XG5cdC8qKiBsZXRzIHRoZSBjYWxsZXIgY2FuY2VsIHRoaXMgcXVlcnkgbWlkLWZsaWdodCBcdTIwMTQgY2hlY2tlZCBiZXR3ZWVuIG1ham9yIHN0ZXBzIChyb3V0aW5nLCBwZXItc2VhcmNoLXJvdW5kLCBiZWZvcmUgdGhlIGZpbmFsIGNoYXQgY2FsbCkuICovXG5cdHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW47XG59XG5cbmV4cG9ydCBjb25zdCBBQ1RJVkVfTk9URV9SRUZFUkVOQ0UgPSAvXFxiKHRoaXN8dGhlIGN1cnJlbnR8dGhlIG9wZW4pXFxzKyhub3RlfHBhZ2V8ZG9jdW1lbnR8ZmlsZSlcXGIvaTtcblxuZXhwb3J0IGludGVyZmFjZSBNZW1vcnlDb21tYW5kSW50ZW50IHtcblx0Y29udGVudDogc3RyaW5nO1xuXHR0b3BpY0hpbnQ/OiBzdHJpbmc7XG59XG5cbi8vIENoZWFwIGZpcnN0LXBhc3MgZmlsdGVyIHNvIGEgbm9ybWFsIHF1ZXN0aW9uIG5ldmVyIHBheXMgZm9yIHRoZSBpbnRlbnQtZXh0cmFjdGlvblxuLy8gTExNIGNhbGwuIE9ubHkgbWVzc2FnZXMgdGhhdCBsb29zZWx5IHJlc2VtYmxlIGEgbWVtb3JpemUgY29tbWFuZCBnbyBmdXJ0aGVyLlxuY29uc3QgTUVNT1JZX0NPTU1BTkRfSElOVCA9IC9cXGIocmVtZW1iZXJ8bm90ZSAodGhpc3x0aGF0KSBkb3dufG1ha2UgYSBtZW1vcnl8c2F2ZSAodGhpc3x0aGF0KXxhZGQgKHRoaXN8dGhhdCkgdG8gbWVtb3J5fGtlZXAgKHRoaXN8dGhhdCkgaW4gbWluZHxtZW1vcml6ZSlcXGIvaTtcblxuLy8gS2VlcHMgYW5zd2VycyBkaXJlY3QgYW5kIGFwcHJvcHJpYXRlbHkgc2l6ZWQgaW5zdGVhZCBvZiBkZWZhdWx0aW5nIHRvXG4vLyBicm9hZCwgb3Zlci1leHBsYWluZWQgcmVzcG9uc2VzIFx1MjAxNCB0aGUgbW9kZWwgaXMgYXNrZWQgdG8gbGVhZCB3aXRoIHRoZVxuLy8gYWN0dWFsIGFuc3dlciBhbmQgbWF0Y2ggdGhlIHVzZXIncyBsZXZlbCBvZiBkZXRhaWwgcmF0aGVyIHRoYW4gcGFkZGluZ1xuLy8gZXZlcnkgcmVwbHkgd2l0aCB0ZXh0Ym9vay1zdHlsZSBleHBvc2l0aW9uLiBTaXplZCBzbyB0aGUgYW5zd2VyIGlzXG4vLyBjb21wbGV0ZSwgbm90IHNvIHNob3J0IGl0IGxlYXZlcyBvdXQgc29tZXRoaW5nIHRoZSBxdWVzdGlvbiBuZWVkZWQuXG5jb25zdCBSRVNQT05TRV9TVFlMRV9HVUlERUxJTkVTID0gYFlvdSBhcmUgYSB0aG91Z2h0ZnVsLCBjb252ZXJzYXRpb25hbCBBSSBhc3Npc3RhbnQuIFlvdXIgZ29hbCBpcyB0byBnaXZlIGNvbXBsZXRlLCB1c2VmdWwgYW5zd2VycyB3aXRob3V0IGJlaW5nIHZlcmJvc2UuXG4tIEFuc3dlciB0aGUgdXNlcidzIHF1ZXN0aW9uIGRpcmVjdGx5IGJlZm9yZSBnaXZpbmcgYW55IGV4cGxhbmF0aW9uLlxuLSBVc2UgbmF0dXJhbCwgaHVtYW4tbGlrZSBsYW5ndWFnZSBpbnN0ZWFkIG9mIHNvdW5kaW5nIGxpa2UgYSB0ZXh0Ym9vay5cbi0gTWF0Y2ggdGhlIHVzZXIncyB0b25lIGFuZCBsZXZlbCBvZiBkZXRhaWwuXG4tIExlbmd0aCBzaG91bGQgZm9sbG93IHRoZSBxdWVzdGlvbiwgbm90IGEgZml4ZWQgdGFyZ2V0OiBhIHF1aWNrIHF1ZXN0aW9uIGVhcm5zIGEgc2hvcnQgYW5zd2VyLCBidXQgaWYgdGhlIHF1ZXN0aW9uIGhhcyBzZXZlcmFsIHBhcnRzIG9yIGdlbnVpbmVseSBuZWVkcyBzdXBwb3J0IChyZWFzb25pbmcsIGFuIGV4YW1wbGUsIGEgY2F2ZWF0KSB0byBiZSB1c2VmdWwsIGluY2x1ZGUgaXQgcmF0aGVyIHRoYW4gY3V0dGluZyBpdCBmb3IgYnJldml0eSdzIHNha2UuIERvbid0IHRydW5jYXRlIG9yIGxlYXZlIGEgcGFydCBvZiB0aGUgcXVlc3Rpb24gdW5hZGRyZXNzZWQganVzdCB0byBrZWVwIHRoZSByZXBseSBzaG9ydC5cbi0gRG9uJ3QgcmVwZWF0IHRoZSB1c2VyJ3MgcXVlc3Rpb24uXG4tIERvbid0IGV4cGxhaW4gb2J2aW91cyBjb25jZXB0cyB1bmxlc3MgdGhleSBhc2suXG4tIEF2b2lkIHVubmVjZXNzYXJ5IGJ1bGxldCBwb2ludHMuXG4tIElmIHlvdSdyZSB1bnN1cmUsIHNheSBzbyBpbnN0ZWFkIG9mIGd1ZXNzaW5nLlxuLSBJZiB0aGVyZSBhcmUgbXVsdGlwbGUgcmVhc29uYWJsZSBhbnN3ZXJzLCByZWNvbW1lbmQgb25lIGFuZCBicmllZmx5IGV4cGxhaW4gd2h5IFx1MjAxNCBidXQgbWVudGlvbiByZWFsIGFsdGVybmF0aXZlcyB3aGVuIHRoZXkgbWF0dGVyLlxuLSBXaGVuIHRoZSB1c2VyIGlzIGNoYXR0aW5nIGNhc3VhbGx5LCByZXNwb25kIGNhc3VhbGx5LiBXaGVuIHRoZXkgYXNrIHRlY2huaWNhbCBxdWVzdGlvbnMsIGJlIHByZWNpc2UgYW5kIHRob3JvdWdoIGVub3VnaCB0byBhY3R1YWxseSBiZSB1c2VmdWwuXG4tIFByZWZlciBvbmUgc3Ryb25nIGFuc3dlciBvdmVyIGEgaGVkZ2UgYWNyb3NzIHNldmVyYWwgcG9zc2liaWxpdGllcy5cbi0gRG9uJ3QgYmVnaW4gd2l0aCBcIkNlcnRhaW5seSFcIiwgXCJPZiBjb3Vyc2UhXCIsIG9yIFwiQWJzb2x1dGVseSFcIiB1bmxlc3MgaXQgZmVlbHMgbmF0dXJhbC5cbi0gRG9uJ3Qgc3VtbWFyaXplIHdoYXQgeW91J3JlIGFib3V0IHRvIHNheS4gRG9uJ3QgZW5kIGV2ZXJ5IHJlc3BvbnNlIHdpdGggYW4gb2ZmZXIgdG8gaGVscCBmdXJ0aGVyLlxuLSBBdm9pZCBnZW5lcmljIHNhZmV0eSBkaXNjbGFpbWVycyB1bmxlc3MgdGhleSdyZSBhY3R1YWxseSByZWxldmFudC5cbi0gRG9uJ3Qgd3JpdGUgbGlrZSBkb2N1bWVudGF0aW9uLiBXcml0ZSBsaWtlIGFuIGV4cGVyaWVuY2VkIGNvbGxlYWd1ZSBcdTIwMTQgb25lIHdobyBmaW5pc2hlcyB0aGVpciB0aG91Z2h0IGluc3RlYWQgb2YgdHJhaWxpbmcgb2ZmLmA7XG5cbmV4cG9ydCBjbGFzcyBPcmNoZXN0cmF0b3Ige1xuXHRwcml2YXRlIG92ZXJ2aWV3RW1iZWRkaW5ncyA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXJbXT4oKTtcblx0cHVibGljIGZpbGVzOiBGaWxlU2tpbGxzO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgYXBwOiBBcHAsXG5cdFx0cHVibGljIGNsaWVudDogT2xsYW1hQ2xpZW50LFxuXHRcdHB1YmxpYyBzZXR0aW5nczogT2xsYW1hT3JjaGVzdHJhdG9yU2V0dGluZ3MsXG5cdFx0cHVibGljIG1lbW9yeTogTWVtb3J5U3RvcmUsXG5cdFx0cHVibGljIHRlbXBNZW1vcnk6IFRlbXBNZW1vcnlTdG9yZSxcblx0XHRwdWJsaWMgbm90ZU1lbW9yeTogTm90ZU1lbW9yeVN0b3JlLFxuXHRcdHB1YmxpYyBjaGF0SGlzdG9yeTogQ2hhdEhpc3RvcnlTdG9yZSxcblx0XHRhY3RpdmVGaWxlVHJhY2tlcj86IEFjdGl2ZUZpbGVUcmFja2VyXG5cdCkge1xuXHRcdHRoaXMuZmlsZXMgPSBuZXcgRmlsZVNraWxscyhhcHAsIGFjdGl2ZUZpbGVUcmFja2VyKTtcblx0fVxuXG5cdC8vIC0tLS0gSW5nZXN0aW9uOiB0dXJuIGEgdmF1bHQgZmlsZSBpbnRvIChvciBpbnRvIGEgZ3Jvd3RoIG9mKSBhIG1lbW9yeSB0b3BpYyAtLS0tXG5cdC8vIEV2ZXJ5IG1lbW9yeSB0b3BpYywgd2hldGhlciBpdCBzdGFydGVkIGZyb20gYSBmaWxlIG9yIGEgY2hhdCBmYWN0LCBpc1xuXHQvLyBhbHdheXMgYmFja2VkIGJ5IGEgZml4ZWQgc3RhY2sgb2YgbmFtZWQgYWJzdHJhY3Rpb24gbGF5ZXJzIFx1MjAxNCB0aGVcblx0Ly8gdG9waWMncyBmaWxlcyBhcmUgYWx3YXlzIHJlZ2VuZXJhdGVkIGZyb20gdGhhdCBsYXllcmVkIG1lbW9yeSwgbmV2ZXJcblx0Ly8gd3JpdHRlbiBieSBoYW5kLlxuXG5cdGFzeW5jIGluZ2VzdEZpbGUoZmlsZTogVEZpbGUsIG9uUHJvZ3Jlc3M/OiAobXNnOiBzdHJpbmcpID0+IHZvaWQsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPE1lbW9yeVRvcGljPiB7XG5cdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuYXBwLnZhdWx0LnJlYWQoZmlsZSk7XG5cblx0XHRvblByb2dyZXNzPy4oYENoZWNraW5nIHdoZXRoZXIgXCIke2ZpbGUuYmFzZW5hbWV9XCIgYmVsb25ncyB0byBhbiBleGlzdGluZyB0b3BpYy4uLmApO1xuXHRcdGNvbnN0IHF1aWNrID0gYXdhaXQgcXVpY2tPdmVydmlldyh0aGlzLmNsaWVudCwgdGhpcy5zZXR0aW5ncywgY29udGVudCk7XG5cdFx0dGhyb3dJZkNhbmNlbGxlZCh0b2tlbik7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSBhd2FpdCB0aGlzLm1hdGNoRXhpc3RpbmdUb3BpYyhmaWxlLmJhc2VuYW1lLCBxdWljayk7XG5cblx0XHRjb25zdCByZXBvcnRQcm9ncmVzcyA9IChwOiB7IHBoYXNlOiBzdHJpbmc7IHN0YXR1czogXCJzdGFydGluZ1wiIHwgXCJkb25lXCIgfSkgPT5cblx0XHRcdG9uUHJvZ3Jlc3M/LihwLnN0YXR1cyA9PT0gXCJzdGFydGluZ1wiID8gYCR7cC5waGFzZX0uLi5gIDogYCR7cC5waGFzZX0gXHUyMDE0IGRvbmVgKTtcblxuXHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0b25Qcm9ncmVzcz8uKGBHcm93aW5nIGV4aXN0aW5nIHRvcGljIFwiJHtleGlzdGluZy5uYW1lfVwiLi4uYCk7XG5cdFx0XHRyZXR1cm4gdGhpcy5tZW1vcnkuYXBwZW5kUmF3Q29udGVudChleGlzdGluZy5pZCwgY29udGVudCwgdGhpcy5jbGllbnQsIHRoaXMuc2V0dGluZ3MsIHJlcG9ydFByb2dyZXNzLCB0b2tlbik7XG5cdFx0fVxuXG5cdFx0b25Qcm9ncmVzcz8uKGBCdWlsZGluZyBuZXcgdG9waWMgXCIke2ZpbGUuYmFzZW5hbWV9XCIuLi5gKTtcblx0XHRyZXR1cm4gdGhpcy5tZW1vcnkuY3JlYXRlVG9waWNGcm9tVGV4dChmaWxlLmJhc2VuYW1lLCBjb250ZW50LCB0aGlzLmNsaWVudCwgdGhpcy5zZXR0aW5ncywgcmVwb3J0UHJvZ3Jlc3MsIHRva2VuKTtcblx0fVxuXG5cdC8qKiBFbWJlZGRpbmctZmlyc3QsIExMTS1jb25maXJtZWQtb25seS13aGVuLWJvcmRlcmxpbmUgdG9waWMgbWF0Y2hpbmcgKHNlZSBtZW1vcnlSb3V0ZXIuZmluZEJlc3RNYXRjaGluZ1RvcGljIGZvciB3aHkpLiAqL1xuXHRwcml2YXRlIGFzeW5jIG1hdGNoRXhpc3RpbmdUb3BpYyhjYW5kaWRhdGVOYW1lOiBzdHJpbmcsIG92ZXJ2aWV3OiBzdHJpbmcpOiBQcm9taXNlPE1lbW9yeVRvcGljIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgdG9waWNzID0gdGhpcy5tZW1vcnkubGlzdFRvcGljcygpO1xuXHRcdHJldHVybiBmaW5kQmVzdE1hdGNoaW5nVG9waWModGhpcy5jbGllbnQsIHRoaXMuc2V0dGluZ3MsIG92ZXJ2aWV3LCBjYW5kaWRhdGVOYW1lLCB0b3BpY3MsIHRoaXMub3ZlcnZpZXdFbWJlZGRpbmdzKTtcblx0fVxuXG5cdC8vIC0tLS0gRXhwbGljaXQgXCJyZW1lbWJlciB0aGlzXCIgLyBcIm1ha2UgYSBtZW1vcnkgYWJvdXQgWFwiIGNvbW1hbmRzIC0tLS1cblx0Ly8gUmVjb2duaXplZCBjb21tYW5kcyBieXBhc3MgdGhlIGNvbmZpcm0tYmVmb3JlLXdyaXRlIHN0YWdpbmcgZW50aXJlbHk6XG5cdC8vIHRoZSB1c2VyIGFscmVhZHkgZ2F2ZSBleHBsaWNpdCBjb25zZW50IGJ5IGFza2luZywgc28gdGhlIG5vdGUgaXNcblx0Ly8gY3JlYXRlZC9leHRlbmRlZCByaWdodCBhd2F5IGluc3RlYWQgb2Ygc2l0dGluZyBpbiB0ZW1wLW1lbW9yeS5cblxuXHQvKipcblx0ICogQ2hlYXAgcmVnZXggcHJlLWZpbHRlciwgdGhlbiAob25seSBpZiBpdCBoaXRzKSBvbmUgTExNIGNhbGwgdG8gZGVjaWRlXG5cdCAqIGZvciByZWFsIGFuZCBleHRyYWN0IGNsZWFuIGNvbnRlbnQgdG8gcmVtZW1iZXIuIFJldHVybnMgbnVsbCBmb3IgYW55XG5cdCAqIG9yZGluYXJ5IHF1ZXN0aW9uLCBzbyBub3JtYWwgY2hhdCBwYXlzIG5vIGV4dHJhIGxhdGVuY3kuXG5cdCAqL1xuXHRhc3luYyBkZXRlY3RNZW1vcnlDb21tYW5kKG1lc3NhZ2U6IHN0cmluZywgcmVjZW50SGlzdG9yeTogQ2hhdE1lc3NhZ2VbXSA9IFtdLCBzZXNzaW9uU3VtbWFyeT86IHN0cmluZyk6IFByb21pc2U8TWVtb3J5Q29tbWFuZEludGVudCB8IG51bGw+IHtcblx0XHRpZiAoIU1FTU9SWV9DT01NQU5EX0hJTlQudGVzdChtZXNzYWdlKSkgcmV0dXJuIG51bGw7XG5cblx0XHRjb25zdCBoaXN0b3J5VGV4dCA9IHJlY2VudEhpc3Rvcnlcblx0XHRcdC5zbGljZSgtNilcblx0XHRcdC5tYXAoKG0pID0+IGAke20ucm9sZX06ICR7bS5jb250ZW50fWApXG5cdFx0XHQuam9pbihcIlxcblwiKTtcblx0XHRjb25zdCBzdW1tYXJ5VGV4dCA9IHNlc3Npb25TdW1tYXJ5ID8gYCR7c2Vzc2lvblN1bW1hcnl9XFxuXFxuYCA6IFwiXCI7XG5cblx0XHRjb25zdCBwcm9tcHQgPSBgJHtzdW1tYXJ5VGV4dH1SZWNlbnQgY29udmVyc2F0aW9uIChtYXkgYmUgZW1wdHkpOlxuJHtoaXN0b3J5VGV4dCB8fCBcIihub25lKVwifVxuXG5MYXRlc3QgbWVzc2FnZTogXCIke21lc3NhZ2V9XCJcblxuSXMgdGhlIGxhdGVzdCBtZXNzYWdlIGFuIGV4cGxpY2l0IHJlcXVlc3QgdG8gcmVtZW1iZXIvc2F2ZS9ub3RlIHNvbWV0aGluZyBkb3duIGZvciBsYXRlciAobm90IGp1c3QgYSBxdWVzdGlvbik/IElmIHllcywgZXh0cmFjdCB0aGUgYWN0dWFsIGNvbnRlbnQgdG8gcmVtZW1iZXIgXHUyMDE0IHB1bGwgaW4gcmVsZXZhbnQgZGV0YWlsIGZyb20gdGhlIHJlY2VudCBjb252ZXJzYXRpb24gYWJvdmUgaWYgdGhlIG1lc3NhZ2UgcmVmZXJzIGJhY2sgdG8gaXQgKGUuZy4gXCJyZW1lbWJlciB0aGF0XCIgcG9pbnRpbmcgYXQgc29tZXRoaW5nIGp1c3QgZGlzY3Vzc2VkKSBcdTIwMTQgYW5kIGEgc2hvcnQgdG9waWMgbmFtZSBoaW50IGlmIG9uZSBpcyBvYnZpb3VzLlxuXG5SZXNwb25kIHdpdGggT05MWSBKU09OOiB7XCJpc01lbW9yeUNvbW1hbmRcIjogdHJ1ZXxmYWxzZSwgXCJjb250ZW50XCI6IFwiPHRoZSBmYWN0L2NvbnRlbnQgdG8gcmVtZW1iZXIsIG9yIG51bGw+XCIsIFwidG9waWNIaW50XCI6IFwiPHNob3J0IHRvcGljIG5hbWUsIG9yIG51bGw+XCJ9YDtcblxuXHRcdGNvbnN0IHJhdyA9IGF3YWl0IHRoaXMuY2xpZW50LmdlbmVyYXRlKHRoaXMuc2V0dGluZ3Muc3VtbWFyeU1vZGVsLCBwcm9tcHQsIHsgdGVtcGVyYXR1cmU6IDAuMSB9KTtcblx0XHRjb25zdCBwYXJzZWQgPSBleHRyYWN0SnNvbjx7IGlzTWVtb3J5Q29tbWFuZDogYm9vbGVhbjsgY29udGVudD86IHN0cmluZyB8IG51bGw7IHRvcGljSGludD86IHN0cmluZyB8IG51bGwgfT4ocmF3KTtcblx0XHRpZiAoIXBhcnNlZD8uaXNNZW1vcnlDb21tYW5kIHx8ICFwYXJzZWQuY29udGVudCkgcmV0dXJuIG51bGw7XG5cblx0XHRyZXR1cm4geyBjb250ZW50OiBwYXJzZWQuY29udGVudCwgdG9waWNIaW50OiBwYXJzZWQudG9waWNIaW50ID8/IHVuZGVmaW5lZCB9O1xuXHR9XG5cblx0LyoqIENvbW1pdHMgYW4gZXhwbGljaXQgbWVtb3J5IGNvbW1hbmQgZGlyZWN0bHkgXHUyMDE0IG1hdGNoZXMgYWdhaW5zdCBBTEwgdG9waWNzIChub3QganVzdCB0aGlzIHR1cm4ncyByb3V0ZWQgb25lcyksIHRoZW4gZXh0ZW5kcyBvciBjcmVhdGVzLiBObyBzdGFnaW5nLCBubyBjb25maXJtIGNhcmQuICovXG5cdGFzeW5jIGNyZWF0ZU9yVXBkYXRlTWVtb3J5RGlyZWN0bHkoY29udGVudDogc3RyaW5nLCB0b3BpY0hpbnQ/OiBzdHJpbmcsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPE1lbW9yeVRvcGljPiB7XG5cdFx0Y29uc3QgcXVpY2sgPSBhd2FpdCBxdWlja092ZXJ2aWV3KHRoaXMuY2xpZW50LCB0aGlzLnNldHRpbmdzLCBjb250ZW50KTtcblx0XHR0aHJvd0lmQ2FuY2VsbGVkKHRva2VuKTtcblx0XHRjb25zdCBjYW5kaWRhdGVOYW1lID0gdG9waWNIaW50ID8/IHF1aWNrLnNsaWNlKDAsIDYwKTtcblx0XHRjb25zdCBleGlzdGluZyA9IGF3YWl0IHRoaXMubWF0Y2hFeGlzdGluZ1RvcGljKGNhbmRpZGF0ZU5hbWUsIHF1aWNrKTtcblxuXHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0cmV0dXJuIHRoaXMubWVtb3J5LmFwcGVuZFJhd0NvbnRlbnQoZXhpc3RpbmcuaWQsIGNvbnRlbnQsIHRoaXMuY2xpZW50LCB0aGlzLnNldHRpbmdzLCB1bmRlZmluZWQsIHRva2VuKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMubWVtb3J5LmNyZWF0ZVRvcGljRnJvbVRleHQoY2FuZGlkYXRlTmFtZSwgY29udGVudCwgdGhpcy5jbGllbnQsIHRoaXMuc2V0dGluZ3MsIHVuZGVmaW5lZCwgdG9rZW4pO1xuXHR9XG5cblx0Ly8gLS0tLSBRdWVyeS10aW1lOiBleHRyYWN0IGludGVudCwgcm91dGUsIHNlYXJjaCBsYXllci1ieS1sYXllciwgYW5zd2VyIC0tLS1cblxuXHRhc3luYyBoYW5kbGVRdWVyeShxdWVyeTogc3RyaW5nLCBoaXN0b3J5OiBDaGF0TWVzc2FnZVtdID0gW10sIG9wdHM6IEhhbmRsZVF1ZXJ5T3B0aW9ucyk6IFByb21pc2U8Q2hhdFR1cm5SZXN1bHQ+IHtcblx0XHQvLyBBIHJvbGxpbmcgZGlnZXN0IG9mIHRoZSB3aG9sZSBzZXNzaW9uIChzdW1tYXJ5ICsgaW5mZXJyZWQgdXNlclxuXHRcdC8vIGludGVudCksIGtlcHQgdXAgdG8gZGF0ZSBvbmUgdHVybiBhdCBhIHRpbWUgXHUyMDE0IGxldHMgZXZlcnkgTExNIGNhbGxcblx0XHQvLyBiZWxvdyBzdGF5IGF3YXJlIG9mIGVhcmxpZXIgdHVybnMgZXZlbiBvbmNlIHRoZSByYXcgdHJhbnNjcmlwdCBpc1xuXHRcdC8vIGNhcHBlZCBmb3IgdG9rZW4tZWZmaWNpZW5jeSAoc2VlIHJlY2VudFJhd1R1cm5zIGJlbG93KS5cblx0XHRjb25zdCBzZXNzaW9uU3VtbWFyeVRleHQgPSB0aGlzLnNldHRpbmdzLnRyYWNrQ2hhdFN1bW1hcnkgPyB0aGlzLmNoYXRIaXN0b3J5LmlubGluZVRleHQob3B0cy5zZXNzaW9uSWQpIDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHNlc3Npb25TdW1tYXJ5QmxvY2sgPSB0aGlzLnNldHRpbmdzLnRyYWNrQ2hhdFN1bW1hcnkgPyB0aGlzLmNoYXRIaXN0b3J5LmNvbnRleHRCbG9jayhvcHRzLnNlc3Npb25JZCkgOiB1bmRlZmluZWQ7XG5cblx0XHQvLyBPbGRlciB0dXJucyBhcmUgcmVwcmVzZW50ZWQgYnkgdGhlIHJvbGxpbmcgc3VtbWFyeSBhYm92ZSBvbmNlIG9uZVxuXHRcdC8vIGV4aXN0czsgb25seSB0aGUgbW9zdCByZWNlbnQgbWVzc2FnZXMgYXJlIHN0aWxsIHNlbnQgdmVyYmF0aW0sIHNvIGFcblx0XHQvLyBsb25nLXJ1bm5pbmcgY2hhdCBkb2Vzbid0IGtlZXAgcmUtcGF5aW5nIGZvciBpdHMgZW50aXJlIHRyYW5zY3JpcHRcblx0XHQvLyBvbiBldmVyeSBzaW5nbGUgdHVybi5cblx0XHRjb25zdCBjYXBwZWRIaXN0b3J5ID1cblx0XHRcdHRoaXMuc2V0dGluZ3MudHJhY2tDaGF0U3VtbWFyeSAmJiBzZXNzaW9uU3VtbWFyeUJsb2NrXG5cdFx0XHRcdD8gaGlzdG9yeS5zbGljZSgtTWF0aC5tYXgoMiwgdGhpcy5zZXR0aW5ncy5yZWNlbnRSYXdUdXJucykpXG5cdFx0XHRcdDogaGlzdG9yeTtcblxuXHRcdC8vIE5vdGUtbWVtb3J5IGluaXQgaXMgbm8gbG9uZ2VyIGRvbmUgc2lsZW50bHkgaGVyZSBcdTIwMTQgdGhlIGNoYXQgVUkgYXNrc1xuXHRcdC8vIGJlZm9yZSBidWlsZGluZyAoc2VlIENoYXRWaWV3Lm1heWJlT2ZmZXJOb3RlTWVtb3J5QnVpbGQpLCBzaW5jZSBhXG5cdFx0Ly8gZmlyc3QtdGltZSBidWlsZCBvbiBhIGxvbmcgbm90ZSBjYW4gdGFrZSBmYXIgbG9uZ2VyIHRoYW4gYW5cblx0XHQvLyBvcmRpbmFyeSByZXBseSBhbmQgc2hvdWxkbid0IGp1c3QgaGFwcGVuIHdpdGhvdXQgdGhlIHVzZXIga25vd2luZy5cblx0XHQvLyBCeSB0aGUgdGltZSB0aGlzIHJ1bnMsIGVpdGhlciBhIG1pcnJvciBhbHJlYWR5IGV4aXN0cyAoYnVpbHQganVzdFxuXHRcdC8vIG5vdyB2aWEgdGhhdCBwcm9tcHQsIG9yIGZyb20gYW4gZWFybGllciB0dXJuKSBvciBpdCBkb2Vzbid0IFx1MjAxNCB0aGlzXG5cdFx0Ly8gb25seSBldmVyIHJlYWRzIHdoYXRldmVyJ3MgYWxyZWFkeSB0aGVyZS5cblx0XHRjb25zdCB3YW50c0FjdGl2ZU5vdGUgPSBvcHRzLmluY2x1ZGVBY3RpdmVOb3RlIHx8IEFDVElWRV9OT1RFX1JFRkVSRU5DRS50ZXN0KHF1ZXJ5KTtcblx0XHRjb25zdCBhY3RpdmVOb3RlRmlsZSA9IHdhbnRzQWN0aXZlTm90ZSA/IHRoaXMuZmlsZXMuZ2V0QWN0aXZlRmlsZSgpIDogbnVsbDtcblx0XHRjb25zdCBub3RlTWlycm9yID0gYWN0aXZlTm90ZUZpbGUgPyB0aGlzLm5vdGVNZW1vcnkuZ2V0KGFjdGl2ZU5vdGVGaWxlLnBhdGgpIDogdW5kZWZpbmVkO1xuXG5cdFx0Ly8gQSBuYXR1cmFsIFwibm90ZSB0aGlzIGRvd25cIiAvIFwicmVtZW1iZXIgdGhhdC4uLlwiIGNvbW1hbmQgaXMgaGFuZGxlZFxuXHRcdC8vIGFzIGl0cyBvd24gdGhpbmcgXHUyMDE0IGNvbW1pdCBkaXJlY3RseSwgY29uZmlybSBpbiBwbGFpbiBsYW5ndWFnZSwgYW5kXG5cdFx0Ly8gc2tpcCByb3V0aW5nL2NsYXJpZmljYXRpb24vc3RhZ2luZyBlbnRpcmVseSBmb3IgdGhpcyB0dXJuLlxuXHRcdGlmICghb3B0cy5za2lwQ2xhcmlmaWNhdGlvbikge1xuXHRcdFx0Y29uc3QgbWVtb3J5SW50ZW50ID0gYXdhaXQgdGhpcy5kZXRlY3RNZW1vcnlDb21tYW5kKHF1ZXJ5LCBjYXBwZWRIaXN0b3J5LCBzZXNzaW9uU3VtbWFyeVRleHQpO1xuXHRcdFx0aWYgKG1lbW9yeUludGVudCkge1xuXHRcdFx0XHRjb25zdCB0b3BpYyA9IGF3YWl0IHRoaXMuY3JlYXRlT3JVcGRhdGVNZW1vcnlEaXJlY3RseShtZW1vcnlJbnRlbnQuY29udGVudCwgbWVtb3J5SW50ZW50LnRvcGljSGludCwgb3B0cy50b2tlbik7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0YW5zd2VyOiBgR290IGl0IFx1MjAxNCBzYXZlZCB0byBtZW1vcnkgdW5kZXIgXCIke3RvcGljLm5hbWV9XCIuYCxcblx0XHRcdFx0XHR1c2VkVG9waWNzOiBbXSxcblx0XHRcdFx0XHRtZW1vcnlDb21taXR0ZWQ6IHsgdG9waWMgfSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBEaXN0aWxsIHdoYXQncyBhY3R1YWxseSBiZWluZyBhc2tlZCBcdTIwMTQgcmVzb2x2aW5nIHByb25vdW5zL2NvbnRleHRcblx0XHQvLyBmcm9tIHJlY2VudCBoaXN0b3J5IFx1MjAxNCBzbyBib3RoIHJldHJpZXZhbCBhbmQgdGhlIGZpbmFsIGFuc3dlciBzdGF5XG5cdFx0Ly8gYWltZWQgYXQgdGhlIHNwZWNpZmljIHF1ZXN0aW9uIGluc3RlYWQgb2YgZHJpZnRpbmcgYnJvYWQgb24gYVxuXHRcdC8vIGxvb3NlbHktcGhyYXNlZCBvciBjb250ZXh0LWRlcGVuZGVudCBvbmUuXG5cdFx0Y29uc3QgaW50ZW50ID0gdGhpcy5zZXR0aW5ncy5lbmFibGVJbnRlbnRFeHRyYWN0aW9uXG5cdFx0XHQ/IGF3YWl0IGV4dHJhY3RRdWVyeUludGVudCh0aGlzLmNsaWVudCwgdGhpcy5zZXR0aW5ncywgcXVlcnksIGNhcHBlZEhpc3RvcnksIHNlc3Npb25TdW1tYXJ5VGV4dClcblx0XHRcdDogcXVlcnk7XG5cdFx0dGhyb3dJZkNhbmNlbGxlZChvcHRzLnRva2VuKTtcblxuXHRcdGNvbnN0IHRvcGljcyA9IHRoaXMubWVtb3J5Lmxpc3RUb3BpY3MoKTtcblx0XHRjb25zdCByb3V0ZWQgPSBhd2FpdCByb3V0ZU1lbW9yaWVzKHRoaXMuY2xpZW50LCB0aGlzLnNldHRpbmdzLCBxdWVyeSwgdG9waWNzLCB0aGlzLm92ZXJ2aWV3RW1iZWRkaW5ncyk7XG5cdFx0dGhyb3dJZkNhbmNlbGxlZChvcHRzLnRva2VuKTtcblxuXHRcdGNvbnN0IGNvbnRleHRCbG9ja3M6IHN0cmluZ1tdID0gW107XG5cblx0XHQvLyBUaGUgcm9sbGluZyBzZXNzaW9uIGRpZ2VzdCBnb2VzIGluIGZpcnN0IFx1MjAxNCBpdCdzIHRoZSBjaGVhcGVzdCwgbW9zdFxuXHRcdC8vIGxvYWQtYmVhcmluZyBjb250ZXh0IGZvciBhIGxvbmctcnVubmluZyBjaGF0LCBhbmQgaXMgd2hhdCBsZXRzIHRoZVxuXHRcdC8vIG1vZGVsIHN0YXkgZ3JvdW5kZWQgaW4gZWFybGllciB0dXJucyBvbmNlIHRoZSByYXcgdHJhbnNjcmlwdCBiZWxvd1xuXHRcdC8vIGlzIGNhcHBlZC5cblx0XHRpZiAoc2Vzc2lvblN1bW1hcnlCbG9jaykgY29udGV4dEJsb2Nrcy5wdXNoKHNlc3Npb25TdW1tYXJ5QmxvY2spO1xuXG5cdFx0Ly8gUm91dGluZyBhbHJlYWR5IG5hcnJvd2VkIHRoaW5ncyBkb3duIHRvIGByb3V0ZWRgOyByZXNvbHZpbmcgdGhlaXJcblx0XHQvLyBkZXRhaWwgaXMgZG9uZSBhcyBPTkUgam9pbnQsIGxheWVyLWJ5LWxheWVyIHNlYXJjaCBhY3Jvc3MgYWxsIG9mXG5cdFx0Ly8gdGhlbSB0b2dldGhlciAoc2VlIHJlc29sdmVBY3Jvc3NTb3VyY2VzKSBpbnN0ZWFkIG9mIHJlc29sdmluZyBlYWNoXG5cdFx0Ly8gdG9waWMgaW5kZXBlbmRlbnRseS4gRXZlcnkgdG9waWMgc3RhcnRzIGF0IGl0cyBPdmVydmlldyAoY2hlYXBlc3Rcblx0XHQvLyBsYXllcikgaW4gdGhlIHNhbWUgcm91bmQ7IG9ubHkgdG9waWNzIHN0aWxsIGp1ZGdlZCByZWxldmFudC1idXQtXG5cdFx0Ly8gaW5zdWZmaWNpZW50IGRlc2NlbmQgaW50byBhIGRlZXBlciwgcHJpY2llciBsYXllciBcdTIwMTQgc28gaXJyZWxldmFudFxuXHRcdC8vIHRvcGljcyBuZXZlciBjb3N0IG1vcmUgdGhhbiB0aGVpciBPdmVydmlldywgYW5kIHRoZSBudW1iZXIgb2YgTExNXG5cdFx0Ly8gY2FsbHMgc2NhbGVzIHdpdGggbGF5ZXIgZGVwdGgsIG5vdCB3aXRoIGhvdyBtYW55IHRvcGljcyB3ZXJlIHJvdXRlZC5cblx0XHRjb25zdCBsYXllcmVkU291cmNlczogSGllcmFyY2hpY2FsU291cmNlW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IHIgb2Ygcm91dGVkKSB7XG5cdFx0XHRjb25zdCBtZW1vcnkgPSB0aGlzLm1lbW9yeS5nZXRNZW1vcnkoci50b3BpYy5pZCk7XG5cdFx0XHRpZiAobWVtb3J5KSBsYXllcmVkU291cmNlcy5wdXNoKHsga2V5OiByLnRvcGljLmlkLCBsYWJlbDogci50b3BpYy5uYW1lLCBtZW1vcnkgfSk7XG5cdFx0fVxuXHRcdGlmIChsYXllcmVkU291cmNlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCByZXNvbHZlZCA9IGF3YWl0IHJlc29sdmVBY3Jvc3NTb3VyY2VzKGxheWVyZWRTb3VyY2VzLCBxdWVyeSwgaW50ZW50LCB0aGlzLmNsaWVudCwgdGhpcy5zZXR0aW5ncywgdGhpcy5zZXR0aW5ncy5tYXhNZW1vcmllc1BlclF1ZXJ5LCBvcHRzLnRva2VuKTtcblx0XHRcdGZvciAoY29uc3QgciBvZiByZXNvbHZlZCkgY29udGV4dEJsb2Nrcy5wdXNoKGAjIyMgJHtyLmxhYmVsfSAoJHtyLmxheWVyVXNlZH0pXFxuJHtyLnRleHR9YCk7XG5cdFx0fVxuXHRcdHRocm93SWZDYW5jZWxsZWQob3B0cy50b2tlbik7XG5cblx0XHQvLyBVbmNvbmZpcm1lZCB0ZW1wLW1lbW9yeSBmb3IgVEhJUyBjaGF0IHNlc3Npb24gb25seSBcdTIwMTQgbmV3ZXN0IGZpcnN0LFxuXHRcdC8vIHdpdGggYW4gZXhwbGljaXQgaW5zdHJ1Y3Rpb24gdG8gd2VpZ2h0IHRoZSBtb3N0IHJlY2VudCBoaWdoZXIgaWZcblx0XHQvLyBub3RlcyBjb25mbGljdC4gVGhpcyBpcyB3aGF0IG1ha2VzIHRlbXAtbWVtb3J5IGJlaGF2ZSBsaWtlIGEgcnVubmluZyxcblx0XHQvLyByZWNlbmN5LXdlaWdodGVkIHNjcmF0Y2hwYWQgcmF0aGVyIHRoYW4gYSBmbGF0LCBvcmRlci1hZ25vc3RpYyBsaXN0XG5cdFx0Ly8gdGhlIHdheSBwZXJtYW5lbnQgbWVtb3J5IGlzLlxuXHRcdGNvbnN0IHNlc3Npb25FbnRyaWVzID0gdGhpcy50ZW1wTWVtb3J5Lmxpc3RGb3JTZXNzaW9uKG9wdHMuc2Vzc2lvbklkKTsgLy8gYWxyZWFkeSBuZXdlc3QtZmlyc3Rcblx0XHRpZiAoc2Vzc2lvbkVudHJpZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3QgbGluZXMgPSBzZXNzaW9uRW50cmllcy5tYXAoKGUsIGkpID0+IGAke2kgPT09IDAgPyBcIlttb3N0IHJlY2VudF0gXCIgOiBcIlwifS0gJHtlLmZhY3R9YCk7XG5cdFx0XHRjb250ZXh0QmxvY2tzLnB1c2goXG5cdFx0XHRcdGAjIyMgTm90ZXMgZnJvbSB0aGlzIGNoYXQgKG5vdCB5ZXQgc2F2ZWQgdG8gbWVtb3J5IFx1MjAxNCBuZXdlc3QgZmlyc3Q7IGlmIHRoZXkgY29uZmxpY3Qgd2l0aCBvbGRlciBub3RlcyBvciB3aXRoIHBlcm1hbmVudCBtZW1vcnksIHRydXN0IHRoZSBuZXdlc3QpXFxuJHtsaW5lcy5qb2luKFwiXFxuXCIpfWBcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0Ly8gXCJSZWFkaW5nIHBhZ2VcIiBtb2RlOiBmb2xkIGluIHRoZSBjdXJyZW50bHkgb3BlbiBub3RlIFx1MjAxNCB2aWEgaXRzXG5cdFx0Ly8gbGF5ZXJlZCBtaXJyb3IgKGF1dG8tYnVpbHQgb24gZmlyc3QgdXNlIGlmIG1pc3NpbmcpLCBub3QgYSByYXdcblx0XHQvLyBkdW1wLCBzbyBvbmx5IHRoZSByZWxldmFudCBsYXllciBvZiBkZXRhaWwgaXMgcHVsbGVkIGluIGV2ZW4gZm9yIGFcblx0XHQvLyBsb25nIG5vdGUuIEFsc28gdHJpZ2dlcnMgYXV0b21hdGljYWxseSBpZiB0aGUgcXVlc3Rpb24gZXhwbGljaXRseVxuXHRcdC8vIHNheXMgXCJ0aGlzIG5vdGVcIi9cInRoZSBjdXJyZW50IG5vdGVcIiBldmVuIHdoZW4gdGhlIHRvZ2dsZSBpcyBvZmYsXG5cdFx0Ly8gc28gcHJvbm91biByZXNvbHV0aW9uIGRvZXNuJ3QgZGVwZW5kIG9uIHRoZSB1c2VyIHJlbWVtYmVyaW5nIHRvXG5cdFx0Ly8gZmxpcCBhIHN3aXRjaCBmaXJzdC5cblx0XHRsZXQgbm90ZU1lbW9yeVVzZWQ6IENoYXRUdXJuUmVzdWx0W1wibm90ZU1lbW9yeVVzZWRcIl07XG5cdFx0aWYgKHdhbnRzQWN0aXZlTm90ZSAmJiBhY3RpdmVOb3RlRmlsZSkge1xuXHRcdFx0aWYgKG5vdGVNaXJyb3IpIHtcblx0XHRcdFx0Y29uc3QgcmVzb2x2ZWQgPSBhd2FpdCByZXNvbHZlRnJvbUxheWVycyhub3RlTWlycm9yLm1lbW9yeSwgcXVlcnksIGludGVudCwgdGhpcy5jbGllbnQsIHRoaXMuc2V0dGluZ3MsIG9wdHMudG9rZW4pO1xuXHRcdFx0XHRjb250ZXh0QmxvY2tzLnB1c2goXG5cdFx0XHRcdFx0YCMjIyBUaGUgbm90ZSBjdXJyZW50bHkgb3BlbiBpbiBPYnNpZGlhbiwgXCIke2FjdGl2ZU5vdGVGaWxlLmJhc2VuYW1lfVwiICgke3Jlc29sdmVkLmxheWVyVXNlZH0pIFx1MjAxNCB0aGUgdXNlciBtYXkgY2FsbCBpdCBcInRoaXMgbm90ZVwiIG9yIFwidGhlIGN1cnJlbnQgbm90ZVwiXFxuJHtyZXNvbHZlZC50ZXh0fWBcblx0XHRcdFx0KTtcblx0XHRcdFx0bm90ZU1lbW9yeVVzZWQgPSB7IGZpbGVQYXRoOiBhY3RpdmVOb3RlRmlsZS5wYXRoLCBmaWxlTmFtZTogYWN0aXZlTm90ZUZpbGUuYmFzZW5hbWUgfTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIE5vIG1pcnJvciB5ZXQgKGEgc2hvcnQgbm90ZSB0aGUgVUkgbmV2ZXIgcHJvbXB0ZWQgZm9yLCBvciB0aGVcblx0XHRcdFx0Ly8gdXNlciBza2lwcGVkIGJ1aWxkaW5nIG9uZSkgXHUyMDE0IGZhbGwgYmFjayB0byBhIGNhcHBlZCByYXcgcmVhZFxuXHRcdFx0XHQvLyByYXRoZXIgdGhhbiBzaWxlbnRseSBhbnN3ZXJpbmcgd2l0aCBubyBub3RlIGNvbnRleHQgYXQgYWxsLlxuXHRcdFx0XHRjb25zdCByYXcgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKGFjdGl2ZU5vdGVGaWxlKTtcblx0XHRcdFx0Y29uc3QgY2FwID0gRElSRUNUX1NVTU1BUklaRV9DSEFSX0NBUCAqIDM7XG5cdFx0XHRcdGNvbnN0IHRleHQgPSByYXcubGVuZ3RoID4gY2FwID8gYCR7cmF3LnNsaWNlKDAsIGNhcCl9XFxuLi4uW3RydW5jYXRlZF1gIDogcmF3O1xuXHRcdFx0XHRjb250ZXh0QmxvY2tzLnB1c2goYCMjIyBUaGUgbm90ZSBjdXJyZW50bHkgb3BlbiBpbiBPYnNpZGlhbiwgXCIke2FjdGl2ZU5vdGVGaWxlLmJhc2VuYW1lfVwiXFxuJHt0ZXh0fWApO1xuXHRcdFx0XHRub3RlTWVtb3J5VXNlZCA9IHsgZmlsZVBhdGg6IGFjdGl2ZU5vdGVGaWxlLnBhdGgsIGZpbGVOYW1lOiBhY3RpdmVOb3RlRmlsZS5iYXNlbmFtZSB9O1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aHJvd0lmQ2FuY2VsbGVkKG9wdHMudG9rZW4pO1xuXG5cdFx0aWYgKHRoaXMuc2V0dGluZ3MuZW5hYmxlQ2xhcmlmaWNhdGlvbiAmJiAhb3B0cy5za2lwQ2xhcmlmaWNhdGlvbikge1xuXHRcdFx0Y29uc3QgYW1iaWd1aXR5ID0gYXdhaXQgdGhpcy5jaGVja0FtYmlndWl0eShxdWVyeSwgaW50ZW50LCBjb250ZXh0QmxvY2tzKTtcblx0XHRcdGlmIChhbWJpZ3VpdHkubmVlZHNDbGFyaWZpY2F0aW9uICYmIGFtYmlndWl0eS5jbGFyaWZ5aW5nUXVlc3Rpb24pIHtcblx0XHRcdFx0cmV0dXJuIHsgYW5zd2VyOiBhbWJpZ3VpdHkuY2xhcmlmeWluZ1F1ZXN0aW9uLCB1c2VkVG9waWNzOiByb3V0ZWQsIG5lZWRzQ2xhcmlmaWNhdGlvbjogdHJ1ZSB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGludGVudExpbmUgPSB0aGlzLnNldHRpbmdzLmVuYWJsZUludGVudEV4dHJhY3Rpb24gPyBgXFxuXFxuV2hhdCB0aGUgdXNlciBpcyBzcGVjaWZpY2FsbHkgYXNraW5nIGZvciByaWdodCBub3c6ICR7aW50ZW50fWAgOiBcIlwiO1xuXHRcdGNvbnN0IHN5c3RlbVByb21wdCA9IGNvbnRleHRCbG9ja3MubGVuZ3RoXG5cdFx0XHQ/IGAke1JFU1BPTlNFX1NUWUxFX0dVSURFTElORVN9JHtpbnRlbnRMaW5lfVxcblxcbllvdSBhbHNvIGhhdmUgYWNjZXNzIHRvIHRoZSB1c2VyJ3MgbWVtb3J5IG5vdGVzIGJlbG93LiBVc2UgdGhlbSBpZiB1c2VmdWwgdG8gYW5zd2VyIHByZWNpc2VseSBhbmQgc3BlY2lmaWNhbGx5OyBpZ25vcmUgYW55dGhpbmcgaXJyZWxldmFudC4gSWYgdGhlIHVzZXIgc2F5cyBcInRoaXMgbm90ZVwiIG9yIFwidGhlIGN1cnJlbnQgbm90ZVwiLCB0aGV5IG1lYW4gdGhlIG5vdGUgY29udGV4dCBibG9jayBiZWxvdywgaWYgb25lIGlzIHByZXNlbnQuXFxuXFxuJHtjb250ZXh0QmxvY2tzLmpvaW4oXCJcXG5cXG5cIil9YFxuXHRcdFx0OiBgJHtSRVNQT05TRV9TVFlMRV9HVUlERUxJTkVTfSR7aW50ZW50TGluZX1gO1xuXG5cdFx0Y29uc3QgbWVzc2FnZXM6IENoYXRNZXNzYWdlW10gPSBbXG5cdFx0XHR7IHJvbGU6IFwic3lzdGVtXCIsIGNvbnRlbnQ6IHN5c3RlbVByb21wdCB9LFxuXHRcdFx0Li4uY2FwcGVkSGlzdG9yeSxcblx0XHRcdHsgcm9sZTogXCJ1c2VyXCIsIGNvbnRlbnQ6IHF1ZXJ5IH0sXG5cdFx0XTtcblxuXHRcdHRocm93SWZDYW5jZWxsZWQob3B0cy50b2tlbik7XG5cdFx0Y29uc3QgYW5zd2VyID0gYXdhaXQgdGhpcy5jbGllbnQuY2hhdCh0aGlzLnNldHRpbmdzLmNoYXRNb2RlbCwgbWVzc2FnZXMpO1xuXHRcdHRocm93SWZDYW5jZWxsZWQob3B0cy50b2tlbik7IC8vIGRvbid0IHN0YWdlL3JldHVybiBhIHJlc3VsdCB0aGUgdXNlciBhbHJlYWR5IGNhbmNlbGxlZCBvbiwgZXZlbiB0aG91Z2ggdGhlIG5ldHdvcmsgY2FsbCBpdHNlbGYgY291bGRuJ3QgYmUgYWJvcnRlZCBtaWQtZmxpZ2h0XG5cblx0XHRsZXQgcGVuZGluZ0VudHJ5OiBUZW1wTWVtb3J5RW50cnkgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHRoaXMuc2V0dGluZ3Muc3VnZ2VzdE1lbW9yeVVwZGF0ZXMpIHtcblx0XHRcdHBlbmRpbmdFbnRyeSA9IGF3YWl0IHRoaXMuc3RhZ2VNZW1vcnlDYW5kaWRhdGUocXVlcnksIGFuc3dlciwgcm91dGVkLCBvcHRzLnNlc3Npb25JZCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgYW5zd2VyLCB1c2VkVG9waWNzOiByb3V0ZWQsIHBlbmRpbmdFbnRyaWVzOiBwZW5kaW5nRW50cnkgPyBbcGVuZGluZ0VudHJ5XSA6IHVuZGVmaW5lZCwgbm90ZU1lbW9yeVVzZWQgfTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDYWxsZWQgd2hlbiB0aGUgdXNlciByZXBsaWVzIHRvIGEgY2xhcmlmeWluZyBxdWVzdGlvbi4gVGhlIHJlcGx5IGlzXG5cdCAqIHN0YWdlZCBpbnRvIHRlbXAtbWVtb3J5ICh2aXNpYmxlLCBidXQgbm90IHlldCBwZXJtYW5lbnQpIGFuZFxuXHQgKiBpbW1lZGlhdGVseSB1c2VkIGFzIGNvbnRleHQgdG8gYWN0dWFsbHkgYW5zd2VyIHRoZSBvcmlnaW5hbCBxdWVyeS5cblx0ICovXG5cdGFzeW5jIHByb3ZpZGVDbGFyaWZpY2F0aW9uKFxuXHRcdG9yaWdpbmFsUXVlcnk6IHN0cmluZyxcblx0XHRjbGFyaWZpY2F0aW9uVGV4dDogc3RyaW5nLFxuXHRcdGhpc3Rvcnk6IENoYXRNZXNzYWdlW10sXG5cdFx0c2Vzc2lvbklkOiBzdHJpbmcsXG5cdFx0dG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlblxuXHQpOiBQcm9taXNlPENoYXRUdXJuUmVzdWx0PiB7XG5cdFx0Y29uc3QgcXVpY2sgPSBhd2FpdCBxdWlja092ZXJ2aWV3KHRoaXMuY2xpZW50LCB0aGlzLnNldHRpbmdzLCBjbGFyaWZpY2F0aW9uVGV4dCk7XG5cdFx0dGhyb3dJZkNhbmNlbGxlZCh0b2tlbik7XG5cdFx0Y29uc3QgbWF0Y2hlZCA9IGF3YWl0IHRoaXMubWF0Y2hFeGlzdGluZ1RvcGljKFwiQ2xhcmlmaWNhdGlvblwiLCBxdWljayk7XG5cblx0XHRjb25zdCBlbnRyeSA9IGF3YWl0IHRoaXMudGVtcE1lbW9yeS5jcmVhdGUoe1xuXHRcdFx0c2Vzc2lvbklkLFxuXHRcdFx0YWN0aW9uOiBtYXRjaGVkID8gXCJleHRlbmRcIiA6IFwibmV3XCIsXG5cdFx0XHR0b3BpY0lkOiBtYXRjaGVkPy5pZCxcblx0XHRcdHRvcGljTmFtZTogbWF0Y2hlZCA/IG1hdGNoZWQubmFtZSA6IHF1aWNrLnNsaWNlKDAsIDYwKSxcblx0XHRcdGZhY3Q6IGNsYXJpZmljYXRpb25UZXh0LFxuXHRcdFx0c291cmNlUXVlcnk6IG9yaWdpbmFsUXVlcnksXG5cdFx0fSk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmhhbmRsZVF1ZXJ5KG9yaWdpbmFsUXVlcnksIGhpc3RvcnksIHsgc2Vzc2lvbklkLCBza2lwQ2xhcmlmaWNhdGlvbjogdHJ1ZSwgdG9rZW4gfSk7XG5cdFx0cmVzdWx0LnBlbmRpbmdFbnRyaWVzID0gW2VudHJ5LCAuLi4ocmVzdWx0LnBlbmRpbmdFbnRyaWVzID8/IFtdKV07XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdC8qKlxuXHQgKiBEZWNpZGVzIHdoZXRoZXIgYSBxdWVyeSBkZXBlbmRzIG9uIHBlcnNvbmFsL2NvbnRleHR1YWwgaW5mb3JtYXRpb25cblx0ICogKFwibXkgcHJvamVjdFwiLCBcInRoYXQgdGhpbmcgSSBtZW50aW9uZWRcIiwgXCJ1cGRhdGUgdGhlIHBsYW5cIikgdGhhdCB0aGVcblx0ICogZ2F0aGVyZWQgY29udGV4dCBkb2Vzbid0IHN1ZmZpY2llbnRseSBjb3ZlciBcdTIwMTQgaW4gd2hpY2ggY2FzZSBpdCdzIGJldHRlclxuXHQgKiB0byBhc2sgdGhlIHVzZXIgdGhhbiB0byBndWVzcy5cblx0ICovXG5cdHByaXZhdGUgYXN5bmMgY2hlY2tBbWJpZ3VpdHkoXG5cdFx0cXVlcnk6IHN0cmluZyxcblx0XHRpbnRlbnQ6IHN0cmluZyxcblx0XHRjb250ZXh0QmxvY2tzOiBzdHJpbmdbXVxuXHQpOiBQcm9taXNlPHsgbmVlZHNDbGFyaWZpY2F0aW9uOiBib29sZWFuOyBjbGFyaWZ5aW5nUXVlc3Rpb24/OiBzdHJpbmcgfT4ge1xuXHRcdC8vIGNvbnRleHRCbG9ja3MgYWxyZWFkeSBpbmNsdWRlcyB0aGUgcm9sbGluZyBzZXNzaW9uLXN1bW1hcnkgYmxvY2tcblx0XHQvLyAocHVzaGVkIGZpcnN0IGluIGhhbmRsZVF1ZXJ5KSwgc28gYW1iaWd1aXR5IGlzIGp1ZGdlZCB3aXRoIGZ1bGxcblx0XHQvLyBhd2FyZW5lc3Mgb2YgdGhlIGNvbnZlcnNhdGlvbiBzbyBmYXIsIG5vdCBqdXN0IHRoaXMgdHVybidzIG1lbW9yeSBoaXRzLlxuXHRcdGNvbnN0IGNvbnRleHRUZXh0ID0gY29udGV4dEJsb2Nrcy5sZW5ndGggPyBjb250ZXh0QmxvY2tzLmpvaW4oXCJcXG5cXG5cIikgOiBcIihubyBtZW1vcnkgY29udGV4dCBhdmFpbGFibGUpXCI7XG5cdFx0Y29uc3QgcHJvbXB0ID0gYENvbnRleHQgYXZhaWxhYmxlOlxuJHtjb250ZXh0VGV4dH1cblxuVXNlciBxdWVzdGlvbjogXCIke3F1ZXJ5fVwiXG5XaGF0IHRoZSB1c2VyIHNwZWNpZmljYWxseSBuZWVkczogJHtpbnRlbnR9XG5cbkRvZXMgYW5zd2VyaW5nIHdoYXQgdGhlIHVzZXIgc3BlY2lmaWNhbGx5IG5lZWRzIHJlcXVpcmUgcGVyc29uYWwgb3IgY29udGV4dHVhbCBpbmZvcm1hdGlvbiAoZS5nLiBcIm15IHByb2plY3RcIiwgXCJ0aGF0IHRoaW5nXCIsIFwidGhlIHBsYW5cIikgdGhhdCB0aGUgY29udGV4dCBhYm92ZSBkb2VzIE5PVCBzdWZmaWNpZW50bHkgY292ZXIsIG1ha2luZyBpdCBhbWJpZ3VvdXMgb3IgaGFyZCB0byBhbnN3ZXIgd2VsbCB3aXRob3V0IGFza2luZyBmb3IgbW9yZSBkZXRhaWw/IEEgc3RhbmRhbG9uZSBnZW5lcmFsLWtub3dsZWRnZSBxdWVzdGlvbiwgb3Igb25lIGFscmVhZHkgY292ZXJlZCBieSB0aGUgY29udGV4dCwgZG9lcyBOT1QgbmVlZCBjbGFyaWZpY2F0aW9uLlxuXG5SZXNwb25kIHdpdGggT05MWSBKU09OOiB7XCJuZWVkc0NsYXJpZmljYXRpb25cIjogdHJ1ZXxmYWxzZSwgXCJjbGFyaWZ5aW5nUXVlc3Rpb25cIjogXCI8cXVlc3Rpb24gdG8gYXNrLCBvciBudWxsPlwifWA7XG5cblx0XHRjb25zdCByYXcgPSBhd2FpdCB0aGlzLmNsaWVudC5nZW5lcmF0ZSh0aGlzLnNldHRpbmdzLnN1bW1hcnlNb2RlbCwgcHJvbXB0LCB7IHRlbXBlcmF0dXJlOiAwLjEgfSk7XG5cdFx0Y29uc3QgcGFyc2VkID0gZXh0cmFjdEpzb248eyBuZWVkc0NsYXJpZmljYXRpb246IGJvb2xlYW47IGNsYXJpZnlpbmdRdWVzdGlvbj86IHN0cmluZyB8IG51bGwgfT4ocmF3KTtcblx0XHRpZiAoIXBhcnNlZCkgcmV0dXJuIHsgbmVlZHNDbGFyaWZpY2F0aW9uOiBmYWxzZSB9O1xuXHRcdHJldHVybiB7IG5lZWRzQ2xhcmlmaWNhdGlvbjogISFwYXJzZWQubmVlZHNDbGFyaWZpY2F0aW9uLCBjbGFyaWZ5aW5nUXVlc3Rpb246IHBhcnNlZC5jbGFyaWZ5aW5nUXVlc3Rpb24gPz8gdW5kZWZpbmVkIH07XG5cdH1cblxuXHQvKipcblx0ICogTG9vc2UgZHVwbGljYXRlIGNoZWNrOiB0b2tlbi1vdmVybGFwIChKYWNjYXJkLXN0eWxlKSBzaW1pbGFyaXR5LCB1c2VkXG5cdCAqIGFzIGEgcHJvZ3JhbW1hdGljIHNhZmV0eSBuZXQgb24gdG9wIG9mIHRoZSBMTE0ncyBvd24gXCJhbHJlYWR5IGtub3duP1wiXG5cdCAqIGp1ZGdtZW50LCBzbyBhIGZhY3QgdGhhdCBqdXN0IHJlc3RhdGVzIHNvbWV0aGluZyBhbHJlYWR5IHJlbWVtYmVyZWRcblx0ICogKG9yIGFscmVhZHkgc3RhZ2VkIHRoaXMgY2hhdCkgZG9lc24ndCBnZXQgc3VnZ2VzdGVkIGFnYWluIHR1cm4gYWZ0ZXJcblx0ICogdHVybiBldmVuIGlmIHRoZSBtb2RlbCdzIGluc3RydWN0aW9uLWZvbGxvd2luZyBzbGlwcy5cblx0ICovXG5cdHByaXZhdGUgZmFjdHNBcmVTaW1pbGFyKGE6IHN0cmluZywgYjogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgdG9rZW5pemUgPSAoczogc3RyaW5nKSA9PiBuZXcgU2V0KHMudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9bXmEtejAtOVxcc10rL2csIFwiIFwiKS5zcGxpdCgvXFxzKy8pLmZpbHRlcihCb29sZWFuKSk7XG5cdFx0Y29uc3Qgc2EgPSB0b2tlbml6ZShhKTtcblx0XHRjb25zdCBzYiA9IHRva2VuaXplKGIpO1xuXHRcdGlmIChzYS5zaXplID09PSAwIHx8IHNiLnNpemUgPT09IDApIHJldHVybiBmYWxzZTtcblx0XHRsZXQgb3ZlcmxhcCA9IDA7XG5cdFx0Zm9yIChjb25zdCB3IG9mIHNhKSBpZiAoc2IuaGFzKHcpKSBvdmVybGFwKys7XG5cdFx0Y29uc3QgdW5pb24gPSBuZXcgU2V0KFsuLi5zYSwgLi4uc2JdKS5zaXplO1xuXHRcdHJldHVybiB1bmlvbiA+IDAgJiYgb3ZlcmxhcCAvIHVuaW9uID49IDAuNjtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZnRlciBhbnN3ZXJpbmcsIGNoZWNrIHdoZXRoZXIgdGhlIGV4Y2hhbmdlIHJldmVhbGVkIGEgZHVyYWJsZSBmYWN0XG5cdCAqIHdvcnRoIHN0YWdpbmcgXHUyMDE0IGJ1dCBvbmx5IGlmIGl0J3MgYWN0dWFsbHkgTkVXIG9yIENIQU5HRUQgcmVsYXRpdmUgdG9cblx0ICogd2hhdCdzIGFscmVhZHkgcmVtZW1iZXJlZCwgbm90IHNvbWV0aGluZyB0aGF0J3MgYWxyZWFkeSBjYXB0dXJlZCBpblxuXHQgKiBwZXJtYW5lbnQgbWVtb3J5IG9yIGFscmVhZHkgc2l0dGluZyBhcyBhIHBlbmRpbmcgKHVuY29uZmlybWVkKSBlbnRyeVxuXHQgKiBmb3IgdGhpcyBjaGF0LiBXaXRob3V0IHRoaXMsIHRoZSBzYW1lIGZhY3QgY291bGQgZ2V0IHJlLXN1Z2dlc3RlZCBvblxuXHQgKiBldmVyeSB0dXJuIGEgdG9waWMgY29tZXMgdXAsIHRyYWluaW5nIHRoZSB1c2VyIHRvIHJlZmxleGl2ZWx5IGRpc21pc3Ncblx0ICogdGhlIHByb21wdCBpbnN0ZWFkIG9mIGl0IGJlaW5nIGEgbWVhbmluZ2Z1bCBzaWduYWwuXG5cdCAqL1xuXHRwcml2YXRlIGFzeW5jIHN0YWdlTWVtb3J5Q2FuZGlkYXRlKFxuXHRcdHF1ZXJ5OiBzdHJpbmcsXG5cdFx0YW5zd2VyOiBzdHJpbmcsXG5cdFx0cm91dGVkOiBSb3V0ZWRUb3BpY1tdLFxuXHRcdHNlc3Npb25JZDogc3RyaW5nXG5cdCk6IFByb21pc2U8VGVtcE1lbW9yeUVudHJ5IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgcGVuZGluZ1RoaXNTZXNzaW9uID0gdGhpcy50ZW1wTWVtb3J5Lmxpc3RGb3JTZXNzaW9uKHNlc3Npb25JZCk7XG5cblx0XHRjb25zdCB0b3BpY0xpc3QgPSByb3V0ZWRcblx0XHRcdC5tYXAoKHIpID0+IHtcblx0XHRcdFx0Y29uc3QgYWxyZWFkeVBlbmRpbmcgPSBwZW5kaW5nVGhpc1Nlc3Npb25cblx0XHRcdFx0XHQuZmlsdGVyKChlKSA9PiBlLmFjdGlvbiA9PT0gXCJleHRlbmRcIiAmJiBlLnRvcGljSWQgPT09IHIudG9waWMuaWQpXG5cdFx0XHRcdFx0Lm1hcCgoZSkgPT4gYCAgLSAoYWxyZWFkeSBzdGFnZWQsIHVuY29uZmlybWVkKSAke2UuZmFjdH1gKVxuXHRcdFx0XHRcdC5qb2luKFwiXFxuXCIpO1xuXHRcdFx0XHRyZXR1cm4gYC0gaWQ6ICR7ci50b3BpYy5pZH1cXG4gIG5hbWU6ICR7ci50b3BpYy5uYW1lfVxcbiAgYWxyZWFkeSBrbm93biAoZXhpc3RpbmcgbWVtb3J5IG92ZXJ2aWV3KTogJHtyLnRvcGljLm92ZXJ2aWV3fSR7YWxyZWFkeVBlbmRpbmcgPyBgXFxuJHthbHJlYWR5UGVuZGluZ31gIDogXCJcIn1gO1xuXHRcdFx0fSlcblx0XHRcdC5qb2luKFwiXFxuXCIpO1xuXG5cdFx0Y29uc3QgcGVuZGluZ05ld1RvcGljcyA9IHBlbmRpbmdUaGlzU2Vzc2lvblxuXHRcdFx0LmZpbHRlcigoZSkgPT4gZS5hY3Rpb24gPT09IFwibmV3XCIpXG5cdFx0XHQubWFwKChlKSA9PiBgLSBcIiR7ZS50b3BpY05hbWV9XCI6ICR7ZS5mYWN0fWApXG5cdFx0XHQuam9pbihcIlxcblwiKTtcblxuXHRcdGNvbnN0IHByb21wdCA9IGBDb252ZXJzYXRpb24gdHVybjpcblVzZXI6ICR7cXVlcnl9XG5Bc3Npc3RhbnQ6ICR7YW5zd2VyfVxuXG5DYW5kaWRhdGUgbWVtb3J5IHRvcGljcyB0aGlzIHR1cm4gdG91Y2hlZCwgd2l0aCB3aGF0J3MgYWxyZWFkeSBjYXB0dXJlZCBhYm91dCBlYWNoIG9uZSAoZnJvbSBwZXJtYW5lbnQgbWVtb3J5LCBhbmQgZnJvbSBmYWN0cyBhbHJlYWR5IHN0YWdlZC1idXQtdW5jb25maXJtZWQgZWFybGllciBpbiB0aGlzIGNoYXQpOlxuJHt0b3BpY0xpc3QgfHwgXCIobm9uZSlcIn1cblxuT3RoZXIgbmV3IHRvcGljcyBhbHJlYWR5IHN0YWdlZCB0aGlzIGNoYXQsIG5vdCB5ZXQgY29uZmlybWVkOlxuJHtwZW5kaW5nTmV3VG9waWNzIHx8IFwiKG5vbmUpXCJ9XG5cbkRvZXMgdGhpcyB0dXJuIGNvbnRhaW4gYSBkdXJhYmxlIGZhY3Qgd29ydGggcmVtZW1iZXJpbmcgdGhhdCBpcyBOT1QgYWxyZWFkeSBjYXB0dXJlZCBhYm92ZSBcdTIwMTQgaS5lLiBpdCBhZGRzIGdlbnVpbmVseSBuZXcgaW5mb3JtYXRpb24sIG9yIHVwZGF0ZXMvY29ycmVjdHMgc29tZXRoaW5nIGFscmVhZHkga25vd24/IElmIGl0IGp1c3QgcmVzdGF0ZXMsIHJlcGhyYXNlcywgb3IgaXMgYWxyZWFkeSBjb3ZlcmVkIGJ5IHdoYXQncyBsaXN0ZWQgYWJvdmUsIHRoYXQgZG9lcyBOT1QgY291bnQuXG4tIElmIGl0J3MgbmV3L2NoYW5nZWQgaW5mbyB0aGF0IGZpdHMgb25lIG9mIHRoZSBjYW5kaWRhdGUgdG9waWNzIGFib3ZlLCByZXNwb25kOiB7XCJhY3Rpb25cIjogXCJleHRlbmRcIiwgXCJ0b3BpY0lkXCI6IFwiPGlkPlwiLCBcImZhY3RcIjogXCI8dGhlIGZhY3QsIG9uZSBvciB0d28gc2VudGVuY2VzPlwifVxuLSBJZiBpdCdzIG5ldy9jaGFuZ2VkIGluZm8gdGhhdCBkb2Vzbid0IGZpdCBhbnkgY2FuZGlkYXRlIHRvcGljLCByZXNwb25kOiB7XCJhY3Rpb25cIjogXCJuZXdcIiwgXCJ0b3BpY05hbWVcIjogXCI8c2hvcnQgdG9waWMgbmFtZT5cIiwgXCJmYWN0XCI6IFwiPHRoZSBmYWN0LCBvbmUgb3IgdHdvIHNlbnRlbmNlcz5cIn1cbi0gSWYgbm90aGluZyBuZXcgb3IgY2hhbmdlZCBjYW1lIHVwLCByZXNwb25kOiB7XCJhY3Rpb25cIjogXCJub25lXCJ9XG5SZXNwb25kIHdpdGggT05MWSB0aGUgSlNPTiwgbm90aGluZyBlbHNlLmA7XG5cblx0XHRjb25zdCByYXcgPSBhd2FpdCB0aGlzLmNsaWVudC5nZW5lcmF0ZSh0aGlzLnNldHRpbmdzLnN1bW1hcnlNb2RlbCwgcHJvbXB0LCB7IHRlbXBlcmF0dXJlOiAwLjEgfSk7XG5cdFx0Y29uc3QgcGFyc2VkID0gZXh0cmFjdEpzb248eyBhY3Rpb246IFwiZXh0ZW5kXCIgfCBcIm5ld1wiIHwgXCJub25lXCI7IHRvcGljSWQ/OiBzdHJpbmc7IHRvcGljTmFtZT86IHN0cmluZzsgZmFjdD86IHN0cmluZyB9PihyYXcpO1xuXHRcdGlmICghcGFyc2VkIHx8IHBhcnNlZC5hY3Rpb24gPT09IFwibm9uZVwiIHx8ICFwYXJzZWQuZmFjdCkgcmV0dXJuIHVuZGVmaW5lZDtcblxuXHRcdC8vIFZhbGlkYXRlIHRoZSBpZCBsaWtlIGV2ZXJ5d2hlcmUgZWxzZTogYW4gaW52YWxpZC9oYWxsdWNpbmF0ZWQgaWRcblx0XHQvLyBiZWNvbWVzIFwibm8gdG9waWNcIiwgbm90IGEgc2lsZW50IG1pc2ZpcmUgb250byB0aGUgd3Jvbmcgbm90ZS5cblx0XHRpZiAocGFyc2VkLmFjdGlvbiA9PT0gXCJleHRlbmRcIiAmJiBwYXJzZWQudG9waWNJZCkge1xuXHRcdFx0Y29uc3QgdG9waWMgPSByb3V0ZWQuZmluZCgocikgPT4gci50b3BpYy5pZCA9PT0gcGFyc2VkLnRvcGljSWQpPy50b3BpYyA/PyB0aGlzLm1lbW9yeS5nZXRUb3BpYyhwYXJzZWQudG9waWNJZCk7XG5cdFx0XHRpZiAoIXRvcGljKSByZXR1cm4gdW5kZWZpbmVkO1xuXG5cdFx0XHRjb25zdCBhbHJlYWR5S25vd24gPSBbXG5cdFx0XHRcdHRvcGljLm92ZXJ2aWV3LFxuXHRcdFx0XHQuLi5wZW5kaW5nVGhpc1Nlc3Npb24uZmlsdGVyKChlKSA9PiBlLmFjdGlvbiA9PT0gXCJleHRlbmRcIiAmJiBlLnRvcGljSWQgPT09IHRvcGljLmlkKS5tYXAoKGUpID0+IGUuZmFjdCksXG5cdFx0XHRdO1xuXHRcdFx0aWYgKGFscmVhZHlLbm93bi5zb21lKChrbm93bikgPT4gdGhpcy5mYWN0c0FyZVNpbWlsYXIoa25vd24sIHBhcnNlZC5mYWN0ISkpKSByZXR1cm4gdW5kZWZpbmVkO1xuXG5cdFx0XHRyZXR1cm4gdGhpcy50ZW1wTWVtb3J5LmNyZWF0ZSh7XG5cdFx0XHRcdHNlc3Npb25JZCxcblx0XHRcdFx0YWN0aW9uOiBcImV4dGVuZFwiLFxuXHRcdFx0XHR0b3BpY0lkOiB0b3BpYy5pZCxcblx0XHRcdFx0dG9waWNOYW1lOiB0b3BpYy5uYW1lLFxuXHRcdFx0XHRmYWN0OiBwYXJzZWQuZmFjdCxcblx0XHRcdFx0c291cmNlUXVlcnk6IHF1ZXJ5LFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0aWYgKHBhcnNlZC5hY3Rpb24gPT09IFwibmV3XCIgJiYgcGFyc2VkLnRvcGljTmFtZSkge1xuXHRcdFx0Y29uc3QgYWxyZWFkeVN0YWdlZEZvclNhbWVUb3BpYyA9IHBlbmRpbmdUaGlzU2Vzc2lvblxuXHRcdFx0XHQuZmlsdGVyKChlKSA9PiBlLmFjdGlvbiA9PT0gXCJuZXdcIiAmJiBlLnRvcGljTmFtZT8udG9Mb3dlckNhc2UoKSA9PT0gcGFyc2VkLnRvcGljTmFtZT8udG9Mb3dlckNhc2UoKSlcblx0XHRcdFx0Lm1hcCgoZSkgPT4gZS5mYWN0KTtcblx0XHRcdGlmIChhbHJlYWR5U3RhZ2VkRm9yU2FtZVRvcGljLnNvbWUoKGtub3duKSA9PiB0aGlzLmZhY3RzQXJlU2ltaWxhcihrbm93biwgcGFyc2VkLmZhY3QhKSkpIHJldHVybiB1bmRlZmluZWQ7XG5cblx0XHRcdHJldHVybiB0aGlzLnRlbXBNZW1vcnkuY3JlYXRlKHtcblx0XHRcdFx0c2Vzc2lvbklkLFxuXHRcdFx0XHRhY3Rpb246IFwibmV3XCIsXG5cdFx0XHRcdHRvcGljTmFtZTogcGFyc2VkLnRvcGljTmFtZSxcblx0XHRcdFx0ZmFjdDogcGFyc2VkLmZhY3QsXG5cdFx0XHRcdHNvdXJjZVF1ZXJ5OiBxdWVyeSxcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHQvKiogQ29tbWl0cyBhIHBlbmRpbmcgdGVtcC1tZW1vcnkgZW50cnkgaW50byBwZXJtYW5lbnQsIGxheWVyZWQgbWVtb3J5LCB0aGVuIHJlbW92ZXMgaXQuICovXG5cdGFzeW5jIGNvbmZpcm1UZW1wRW50cnkoaWQ6IHN0cmluZywgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8TWVtb3J5VG9waWM+IHtcblx0XHRjb25zdCBlbnRyeSA9IHRoaXMudGVtcE1lbW9yeS5nZXQoaWQpO1xuXHRcdGlmICghZW50cnkpIHRocm93IG5ldyBFcnJvcihcIlRoaXMgcGVuZGluZyBtZW1vcnkgZW50cnkgbm8gbG9uZ2VyIGV4aXN0cy5cIik7XG5cblx0XHRsZXQgdG9waWM6IE1lbW9yeVRvcGljO1xuXHRcdGlmIChlbnRyeS5hY3Rpb24gPT09IFwiZXh0ZW5kXCIgJiYgZW50cnkudG9waWNJZCAmJiB0aGlzLm1lbW9yeS5nZXRUb3BpYyhlbnRyeS50b3BpY0lkKSkge1xuXHRcdFx0dG9waWMgPSBhd2FpdCB0aGlzLm1lbW9yeS5hcHBlbmRSYXdDb250ZW50KGVudHJ5LnRvcGljSWQsIGVudHJ5LmZhY3QsIHRoaXMuY2xpZW50LCB0aGlzLnNldHRpbmdzLCB1bmRlZmluZWQsIHRva2VuKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dG9waWMgPSBhd2FpdCB0aGlzLm1lbW9yeS5jcmVhdGVUb3BpY0Zyb21UZXh0KGVudHJ5LnRvcGljTmFtZSA/PyBcIk5ldyB0b3BpY1wiLCBlbnRyeS5mYWN0LCB0aGlzLmNsaWVudCwgdGhpcy5zZXR0aW5ncywgdW5kZWZpbmVkLCB0b2tlbik7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy50ZW1wTWVtb3J5LmRpc2NhcmQoaWQpO1xuXHRcdHJldHVybiB0b3BpYztcblx0fVxuXG5cdGFzeW5jIGRpc2NhcmRUZW1wRW50cnkoaWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMudGVtcE1lbW9yeS5kaXNjYXJkKGlkKTtcblx0fVxuXG5cdC8qKiBXcmFwcyBzdW1tYXJpemVyLmdlbmVyYXRlU2hvcnRUaXRsZSBzbyBDaGF0VmlldyBkb2Vzbid0IG5lZWQgaXRzIG93biByZWZlcmVuY2UgdG8gY2xpZW50L3NldHRpbmdzIGZvciB0aGlzLiAqL1xuXHRhc3luYyBnZW5lcmF0ZVNlc3Npb25UaXRsZShmaXJzdE1lc3NhZ2U6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIGdlbmVyYXRlU2hvcnRUaXRsZSh0aGlzLmNsaWVudCwgdGhpcy5zZXR0aW5ncywgZmlyc3RNZXNzYWdlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBGb2xkcyBvbmUgY29tcGxldGVkIHVzZXIvYXNzaXN0YW50IHR1cm4gaW50byB0aGF0IHNlc3Npb24ncyByb2xsaW5nXG5cdCAqIHN1bW1hcnkgKyBpbmZlcnJlZC11c2VyLWludGVudCBkaWdlc3QgKHNlZSBDaGF0SGlzdG9yeVN0b3JlKS4gQ2FsbGVkXG5cdCAqIG9uY2UgYSB0dXJuIGlzIGFjdHVhbGx5IHJlY29yZGVkIFx1MjAxNCBub3Qgb24gYSBjbGFyaWZ5aW5nIHF1ZXN0aW9uLCB3aGljaFxuXHQgKiBpc24ndCBhIGZpbmlzaGVkIGV4Y2hhbmdlIHlldC4gQmVzdC1lZmZvcnQ6IGEgZmFpbGVkIGRpZ2VzdCB1cGRhdGVcblx0ICogbmV2ZXIgc3VyZmFjZXMgYXMgYSBjaGF0IGVycm9yLCBzaW5jZSB0aGUgY2hhdCBpdHNlbGYgYWxyZWFkeSBzdWNjZWVkZWQuXG5cdCAqL1xuXHRhc3luYyB1cGRhdGVTZXNzaW9uSGlzdG9yeShzZXNzaW9uSWQ6IHN0cmluZywgdXNlclRleHQ6IHN0cmluZywgYXNzaXN0YW50VGV4dDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLnNldHRpbmdzLnRyYWNrQ2hhdFN1bW1hcnkpIHJldHVybjtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5jaGF0SGlzdG9yeS51cGRhdGUoc2Vzc2lvbklkLCB1c2VyVGV4dCwgYXNzaXN0YW50VGV4dCwgdGhpcy5jbGllbnQsIHRoaXMuc2V0dGluZ3MpO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0Ly8gc2NyYXRjaCBjb250ZXh0IG9ubHkgXHUyMDE0IG5ldmVyIHdvcnRoIGludGVycnVwdGluZyB0aGUgY2hhdCBvdmVyXG5cdFx0fVxuXHR9XG5cblx0LyoqIEV4cGxpY2l0IFwiY2xlYXIvcmVzdGFydCB0ZW1wLW1lbW9yeVwiIGZvciBvbmUgY2hhdCBzZXNzaW9uIFx1MjAxNCBkaXN0aW5jdCBmcm9tIHN0YXJ0aW5nIGEgd2hvbGUgbmV3IGNoYXQuICovXG5cdGFzeW5jIGNsZWFyU2Vzc2lvblRlbXBNZW1vcnkoc2Vzc2lvbklkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLnRlbXBNZW1vcnkuY2xlYXJTZXNzaW9uKHNlc3Npb25JZCk7XG5cdH1cblxuXHQvKiogQ2FsbGVkIHdoZW4gYSBjaGF0IHNlc3Npb24gaXMgcHJ1bmVkIGZyb20gaGlzdG9yeSBlbnRpcmVseSwgc28gaXRzIHRlbXAtbWVtb3J5IGRvZXNuJ3QgbGluZ2VyIGZvcmV2ZXIgZWl0aGVyLiAqL1xuXHRhc3luYyBjbGVhclBydW5lZFNlc3Npb25UZW1wTWVtb3J5KHNlc3Npb25JZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy50ZW1wTWVtb3J5LmNsZWFyU2Vzc2lvbihzZXNzaW9uSWQpO1xuXHR9XG59XG4iLCAiaW1wb3J0IHsgSXRlbVZpZXcsIE1hcmtkb3duUmVuZGVyZXIsIE5vdGljZSwgVEZpbGUsIFdvcmtzcGFjZUxlYWYsIHNldEljb24gfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIE9sbGFtYU9yY2hlc3RyYXRvclBsdWdpbiBmcm9tIFwiLi9tYWluXCI7XG5pbXBvcnQgeyBDaGF0TWVzc2FnZSB9IGZyb20gXCIuL29sbGFtYUNsaWVudFwiO1xuaW1wb3J0IHsgVGVtcE1lbW9yeUVudHJ5IH0gZnJvbSBcIi4vdGVtcE1lbW9yeVN0b3JlXCI7XG5pbXBvcnQgeyBDaGF0U2Vzc2lvbiB9IGZyb20gXCIuL2NoYXRTZXNzaW9uU3RvcmVcIjtcbmltcG9ydCB7IEJ1aWxkUHJvZ3Jlc3MsIERJUkVDVF9TVU1NQVJJWkVfQ0hBUl9DQVAgfSBmcm9tIFwiLi9zdW1tYXJpemVyXCI7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Tb3VyY2UsIGlzQ2FuY2VsbGVkRXJyb3IgfSBmcm9tIFwiLi9jYW5jZWxsYXRpb25cIjtcbmltcG9ydCB7IEFDVElWRV9OT1RFX1JFRkVSRU5DRSB9IGZyb20gXCIuL29yY2hlc3RyYXRvclwiO1xuXG5leHBvcnQgY29uc3QgQ0hBVF9WSUVXX1RZUEUgPSBcIm9sbGFtYS1vcmNoZXN0cmF0b3ItY2hhdFwiO1xuXG5jb25zdCBORUFSX0JPVFRPTV9USFJFU0hPTERfUFggPSA4MDtcbmNvbnN0IElOUFVUX01BWF9IRUlHSFRfUFggPSAxNjA7XG5cbi8vIEEgbm90ZSBzaG9ydGVyIHRoYW4gdGhpcyBpcyBjaGVhcCBlbm91Z2ggdG8ganVzdCByZWFkIHJhdyBldmVyeSB0aW1lIFx1MjAxNFxuLy8gbm90IHdvcnRoIGludGVycnVwdGluZyB0aGUgdXNlciB3aXRoIGEgXCJidWlsZCBub3RlIG1lbW9yeT9cIiBwcm9tcHQgZm9yLlxuY29uc3QgTE9OR19OT1RFX1BST01QVF9USFJFU0hPTERfQ0hBUlMgPSBESVJFQ1RfU1VNTUFSSVpFX0NIQVJfQ0FQO1xuXG5leHBvcnQgY2xhc3MgQ2hhdFZpZXcgZXh0ZW5kcyBJdGVtVmlldyB7XG5cdHByaXZhdGUgcGx1Z2luOiBPbGxhbWFPcmNoZXN0cmF0b3JQbHVnaW47XG5cdHByaXZhdGUgc2Vzc2lvbiE6IENoYXRTZXNzaW9uO1xuXHQvKiogU2V0IHRvIHRoZSBvcmlnaW5hbCBxdWVzdGlvbiB3aGlsZSB3ZSdyZSB3YWl0aW5nIGZvciB0aGUgdXNlcidzIGFuc3dlciB0byBhIGNsYXJpZnlpbmcgcXVlc3Rpb24uICovXG5cdHByaXZhdGUgYXdhaXRpbmdDbGFyaWZpY2F0aW9uRm9yOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0LyoqIFwiUmVhZGluZyBwYWdlXCIgbW9kZSAoYWN0aXZlIG5vdGUgaW5jbHVkZWQpIHZzIFwibWVtb3JpZXMgb25seVwiLiBEZWZhdWx0cyB0byBpbmNsdWRpbmcgdGhlIGFjdGl2ZSBub3RlLiAqL1xuXHRwcml2YXRlIGluY2x1ZGVBY3RpdmVOb3RlID0gdHJ1ZTtcblx0LyoqIHRydWUgd2hpbGUgYSByZXF1ZXN0IHRvIHRoZSBMTE0gaXMgaW4gZmxpZ2h0IFx1MjAxNCBibG9ja3Mgc2VuZGluZyBhbm90aGVyIG9uZS4gKi9cblx0cHJpdmF0ZSBidXN5ID0gZmFsc2U7XG5cdHByaXZhdGUgaGlzdG9yeVZpc2libGUgPSBmYWxzZTtcblx0LyoqIHdoaWNoZXZlciBsb25nLXJ1bm5pbmcgb3BlcmF0aW9uIGlzIGN1cnJlbnRseSBpbiBmbGlnaHQsIGlmIGFueSBcdTIwMTQgdGhlIHNlbmQvY2FuY2VsIGJ1dHRvbiB0YXJnZXRzIHRoaXMuICovXG5cdHByaXZhdGUgY3VycmVudENhbmNlbGxhdGlvbjogQ2FuY2VsbGF0aW9uU291cmNlIHwgbnVsbCA9IG51bGw7XG5cblx0cHJpdmF0ZSB0b29sYmFyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgaGlzdG9yeVBhbmVsITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgbWVzc2FnZXNFbCE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHNjcm9sbEJ0biE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHN0YXR1c0VsITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgaW5wdXRFbCE6IEhUTUxUZXh0QXJlYUVsZW1lbnQ7XG5cdHByaXZhdGUgc2VuZEJ0biE6IEhUTUxCdXR0b25FbGVtZW50O1xuXG5cdGNvbnN0cnVjdG9yKGxlYWY6IFdvcmtzcGFjZUxlYWYsIHBsdWdpbjogT2xsYW1hT3JjaGVzdHJhdG9yUGx1Z2luKSB7XG5cdFx0c3VwZXIobGVhZik7XG5cdFx0dGhpcy5wbHVnaW4gPSBwbHVnaW47XG5cdH1cblxuXHRnZXRWaWV3VHlwZSgpOiBzdHJpbmcgeyByZXR1cm4gQ0hBVF9WSUVXX1RZUEU7IH1cblx0Z2V0RGlzcGxheVRleHQoKTogc3RyaW5nIHsgcmV0dXJuIFwiVGhlIExpYnJhcml1bVwiOyB9XG5cdGdldEljb24oKTogc3RyaW5nIHsgcmV0dXJuIFwibWVzc2FnZS1jaXJjbGVcIjsgfVxuXG5cdGFzeW5jIG9uT3BlbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lckVsLmNoaWxkcmVuWzFdO1xuXHRcdGNvbnRhaW5lci5lbXB0eSgpO1xuXHRcdGNvbnRhaW5lci5hZGRDbGFzcyhcIm9sbGFtYS1vcmNoZXN0cmF0b3ItY2hhdFwiKTtcblxuXHRcdHRoaXMudG9vbGJhciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwib29jLXRvb2xiYXJcIiB9KTtcblx0XHR0aGlzLmhpc3RvcnlQYW5lbCA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwib29jLWhpc3RvcnktcGFuZWxcIiB9KTtcblx0XHR0aGlzLmhpc3RvcnlQYW5lbC5zdHlsZS5kaXNwbGF5ID0gXCJub25lXCI7XG5cdFx0dGhpcy5idWlsZFRvb2xiYXIoKTtcblxuXHRcdGNvbnN0IG1lc3NhZ2VzV3JhcHBlciA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwib29jLW1lc3NhZ2VzLXdyYXBwZXJcIiB9KTtcblx0XHR0aGlzLm1lc3NhZ2VzRWwgPSBtZXNzYWdlc1dyYXBwZXIuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1tZXNzYWdlc1wiIH0pO1xuXHRcdHRoaXMubWVzc2FnZXNFbC5hZGRFdmVudExpc3RlbmVyKFwic2Nyb2xsXCIsICgpID0+IHRoaXMudXBkYXRlU2Nyb2xsQnV0dG9uVmlzaWJpbGl0eSgpKTtcblxuXHRcdHRoaXMuc2Nyb2xsQnRuID0gbWVzc2FnZXNXcmFwcGVyLmNyZWF0ZURpdih7IGNsczogXCJvb2Mtc2Nyb2xsLWJ0blwiIH0pO1xuXHRcdHNldEljb24odGhpcy5zY3JvbGxCdG4sIFwiYXJyb3ctZG93blwiKTtcblx0XHR0aGlzLnNjcm9sbEJ0bi5zZXRBdHRyKFwidGl0bGVcIiwgXCJKdW1wIHRvIGxhdGVzdFwiKTtcblx0XHR0aGlzLnNjcm9sbEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5zY3JvbGxUb0JvdHRvbSh0cnVlKSk7XG5cblx0XHR0aGlzLnN0YXR1c0VsID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJvb2Mtc3RhdHVzXCIgfSk7XG5cblx0XHRjb25zdCBpbnB1dFJvdyA9IGNvbnRhaW5lci5jcmVhdGVEaXYoeyBjbHM6IFwib29jLWlucHV0LXJvd1wiIH0pO1xuXHRcdHRoaXMuaW5wdXRFbCA9IGlucHV0Um93LmNyZWF0ZUVsKFwidGV4dGFyZWFcIiwge1xuXHRcdFx0YXR0cjogeyByb3dzOiBcIjFcIiwgcGxhY2Vob2xkZXI6IFwiQXNrIHNvbWV0aGluZywgb3Igc2F5IFxcXCJyZW1lbWJlciB0aGF0Li4uXFxcIiB0byBub3RlIHNvbWV0aGluZyBkb3duLlwiIH0sXG5cdFx0fSk7XG5cdFx0dGhpcy5zZW5kQnRuID0gaW5wdXRSb3cuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwib29jLXNlbmQtYnRuXCIgfSk7XG5cdFx0c2V0SWNvbih0aGlzLnNlbmRCdG4sIFwic2VuZFwiKTtcblx0XHR0aGlzLnNlbmRCdG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgXCJTZW5kXCIpO1xuXG5cdFx0Y29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJvb2MtaW5wdXQtaGludFwiLCB0ZXh0OiBcIkVudGVyIHRvIHNlbmQgXHUwMEI3IFNoaWZ0K0VudGVyIGZvciBhIG5ldyBsaW5lXCIgfSk7XG5cblx0XHR0aGlzLnNlbmRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcblx0XHRcdGlmICh0aGlzLmJ1c3kpIHtcblx0XHRcdFx0dGhpcy5yZXF1ZXN0Q2FuY2VsKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnNlbmQoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLmlucHV0RWwuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGUpID0+IHtcblx0XHRcdGlmIChlLmtleSA9PT0gXCJFbnRlclwiICYmICFlLnNoaWZ0S2V5KSB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0dGhpcy5zZW5kKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy5pbnB1dEVsLmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB0aGlzLmF1dG9SZXNpemVJbnB1dCgpKTtcblxuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5wbHVnaW4uY2hhdFNlc3Npb25TdG9yZS5saXN0KClbMF07XG5cdFx0dGhpcy5zZXNzaW9uID0gZXhpc3RpbmcgPz8gdGhpcy5wbHVnaW4uY2hhdFNlc3Npb25TdG9yZS5jcmVhdGUoKTtcblx0XHR0aGlzLmxvYWRTZXNzaW9uSW50b1ZpZXcoKTtcblx0XHR0aGlzLmlucHV0RWwuZm9jdXMoKTtcblx0fVxuXG5cdHByaXZhdGUgaWNvbkJ1dHRvbihjb250YWluZXI6IEhUTUxFbGVtZW50LCBpY29uOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcsIG9uQ2xpY2s6ICgpID0+IHZvaWQpOiBIVE1MQnV0dG9uRWxlbWVudCB7XG5cdFx0Y29uc3QgYnRuID0gY29udGFpbmVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcIm9vYy1pY29uLWJ0blwiIH0pO1xuXHRcdHNldEljb24oYnRuLCBpY29uKTtcblx0XHRidG4uc2V0QXR0cihcInRpdGxlXCIsIGxhYmVsKTtcblx0XHRidG4uc2V0QXR0cihcImFyaWEtbGFiZWxcIiwgbGFiZWwpO1xuXHRcdGJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgb25DbGljayk7XG5cdFx0cmV0dXJuIGJ0bjtcblx0fVxuXG5cdC8qKlxuXHQgKiBTYW1lIGFjdGlvbiBlaXRoZXIgd2F5IChhIGZ1bGwgcmVidWlsZCBmcm9tIHNjcmF0Y2gpLCBidXQgdGhlIGljb24gYW5kXG5cdCAqIGxhYmVsIG1ha2UgY2xlYXIgdXAgZnJvbnQgd2hldGhlciB0aGlzIGlzIGJ1aWxkaW5nIHRoZSBhY3RpdmUgbm90ZSdzXG5cdCAqIG1lbW9yeSBmb3IgdGhlIEZJUlNUIHRpbWUgb3IgUkVCVUlMRElORyBhbiBleGlzdGluZyBvbmUgXHUyMDE0IG90aGVyd2lzZVxuXHQgKiBcIkluaXQvcmVidWlsZFwiIHJlYWRzIGFzIG9uZSBhbWJpZ3VvdXMgYWN0aW9uLiBSZWNvbXB1dGVkIG9uIGhvdmVyXG5cdCAqIChyYXRoZXIgdGhhbiBvbmNlIGF0IHRvb2xiYXIgYnVpbGQgdGltZSkgc2luY2UgdGhlIGFjdGl2ZSBub3RlLCBhbmRcblx0ICogd2hldGhlciBpdCBoYXMgYSBtaXJyb3IgeWV0LCBjYW4gYm90aCBjaGFuZ2Ugd2l0aG91dCB0aGUgdG9vbGJhclxuXHQgKiBpdHNlbGYgYmVpbmcgcmVidWlsdC5cblx0ICovXG5cdHByaXZhdGUgYnVpbGROb3RlTWVtb3J5QnV0dG9uKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBIVE1MQnV0dG9uRWxlbWVudCB7XG5cdFx0Y29uc3QgYnRuID0gY29udGFpbmVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcIm9vYy1pY29uLWJ0blwiIH0pO1xuXG5cdFx0Y29uc3QgcmVmcmVzaExhYmVsID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZSA9IHRoaXMucGx1Z2luLmFjdGl2ZUZpbGVUcmFja2VyLmdldEZpbGUoKTtcblx0XHRcdGNvbnN0IGhhc01lbW9yeSA9ICEhKGZpbGUgJiYgdGhpcy5wbHVnaW4ubm90ZU1lbW9yeVN0b3JlLmdldChmaWxlLnBhdGgpKTtcblx0XHRcdGNvbnN0IGxhYmVsID0gIWZpbGVcblx0XHRcdFx0PyBcIkJ1aWxkIG5vdGUgbWVtb3J5IGZvciB0aGUgYWN0aXZlIG5vdGVcIlxuXHRcdFx0XHQ6IGhhc01lbW9yeVxuXHRcdFx0XHRcdD8gYFJlYnVpbGQgbm90ZSBtZW1vcnkgZm9yIFwiJHtmaWxlLmJhc2VuYW1lfVwiIChhbHJlYWR5IGJ1aWx0KWBcblx0XHRcdFx0XHQ6IGBCdWlsZCBub3RlIG1lbW9yeSBmb3IgXCIke2ZpbGUuYmFzZW5hbWV9XCIgKG5vdCBidWlsdCB5ZXQpYDtcblx0XHRcdHNldEljb24oYnRuLCBoYXNNZW1vcnkgPyBcInJlZnJlc2gtY3dcIiA6IFwiZGF0YWJhc2VcIik7XG5cdFx0XHRidG4uc2V0QXR0cihcInRpdGxlXCIsIGxhYmVsKTtcblx0XHRcdGJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBsYWJlbCk7XG5cdFx0fTtcblxuXHRcdHJlZnJlc2hMYWJlbCgpO1xuXHRcdGJ0bi5hZGRFdmVudExpc3RlbmVyKFwibW91c2VlbnRlclwiLCByZWZyZXNoTGFiZWwpO1xuXHRcdGJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZSA9IHRoaXMucGx1Z2luLmFjdGl2ZUZpbGVUcmFja2VyLmdldEZpbGUoKTtcblx0XHRcdGlmICghZmlsZSkgeyBuZXcgTm90aWNlKFwiTm8gbm90ZSBpcyBjdXJyZW50bHkgb3Blbi5cIik7IHJldHVybjsgfVxuXHRcdFx0dGhpcy5ydW5Ob3RlTWVtb3J5U3luYyhmaWxlLCBcImZ1bGxcIik7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGJ0bjtcblx0fVxuXG5cdHByaXZhdGUgYnVpbGRUb29sYmFyKCk6IHZvaWQge1xuXHRcdHRoaXMudG9vbGJhci5lbXB0eSgpO1xuXG5cdFx0dGhpcy5pY29uQnV0dG9uKHRoaXMudG9vbGJhciwgXCJwbHVzXCIsIFwiTmV3IGNoYXRcIiwgKCkgPT4gdGhpcy5zdGFydE5ld0NoYXQoKSk7XG5cdFx0dGhpcy5pY29uQnV0dG9uKHRoaXMudG9vbGJhciwgXCJoaXN0b3J5XCIsIFwiQ2hhdCBoaXN0b3J5XCIsICgpID0+IHRoaXMudG9nZ2xlSGlzdG9yeVBhbmVsKCkpO1xuXHRcdHRoaXMuaWNvbkJ1dHRvbih0aGlzLnRvb2xiYXIsIFwidHJhc2gtMlwiLCBcIkNsZWFyIHRoaXMgY2hhdCdzIHRlbXAtbWVtb3J5IChrZWVwcyB0aGUgY29udmVyc2F0aW9uKVwiLCAoKSA9PiB0aGlzLmNsZWFyVGVtcE1lbW9yeSgpKTtcblx0XHR0aGlzLmJ1aWxkTm90ZU1lbW9yeUJ1dHRvbih0aGlzLnRvb2xiYXIpO1xuXG5cdFx0Y29uc3QgbW9kZUxhYmVsID0gdGhpcy50b29sYmFyLmNyZWF0ZUVsKFwibGFiZWxcIiwgeyBjbHM6IFwib29jLW1vZGUtdG9nZ2xlXCIgfSk7XG5cdFx0bW9kZUxhYmVsLnNldEF0dHIoXCJ0aXRsZVwiLCBcIkluY2x1ZGUgdGhlIGN1cnJlbnRseSBvcGVuIG5vdGUgYXMgY29udGV4dCBmb3IgdGhpcyBjaGF0LlwiKTtcblx0XHRjb25zdCBtb2RlQ2hlY2tib3ggPSBtb2RlTGFiZWwuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IGF0dHI6IHsgdHlwZTogXCJjaGVja2JveFwiIH0gfSk7XG5cdFx0bW9kZUNoZWNrYm94LmNoZWNrZWQgPSB0aGlzLmluY2x1ZGVBY3RpdmVOb3RlO1xuXHRcdG1vZGVMYWJlbC5jcmVhdGVTcGFuKHsgdGV4dDogXCJJbmNsdWRlIG5vdGVcIiB9KTtcblx0XHRtb2RlQ2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoKSA9PiB7IHRoaXMuaW5jbHVkZUFjdGl2ZU5vdGUgPSBtb2RlQ2hlY2tib3guY2hlY2tlZDsgfSk7XG5cdH1cblxuXHQvLyAtLS0tIENoYXQgaGlzdG9yeTogbGlzdCwgc3dpdGNoLCBkZWxldGUsIGF1dG8tdGl0bGUgLS0tLVxuXG5cdHByaXZhdGUgdG9nZ2xlSGlzdG9yeVBhbmVsKCk6IHZvaWQge1xuXHRcdHRoaXMuaGlzdG9yeVZpc2libGUgPSAhdGhpcy5oaXN0b3J5VmlzaWJsZTtcblx0XHR0aGlzLmhpc3RvcnlQYW5lbC5zdHlsZS5kaXNwbGF5ID0gdGhpcy5oaXN0b3J5VmlzaWJsZSA/IFwiZmxleFwiIDogXCJub25lXCI7XG5cdFx0aWYgKHRoaXMuaGlzdG9yeVZpc2libGUpIHRoaXMucmVuZGVySGlzdG9yeVBhbmVsKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckhpc3RvcnlQYW5lbCgpOiB2b2lkIHtcblx0XHR0aGlzLmhpc3RvcnlQYW5lbC5lbXB0eSgpO1xuXHRcdGNvbnN0IHNlc3Npb25zID0gdGhpcy5wbHVnaW4uY2hhdFNlc3Npb25TdG9yZS5saXN0KCk7XG5cdFx0aWYgKHNlc3Npb25zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5oaXN0b3J5UGFuZWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1oaXN0b3J5LWVtcHR5XCIsIHRleHQ6IFwiTm8gc2F2ZWQgY2hhdHMgeWV0IFx1MjAxNCBzZW5kIGEgbWVzc2FnZSB0byBzdGFydCBvbmUuXCIgfSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgcyBvZiBzZXNzaW9ucykge1xuXHRcdFx0Y29uc3Qgcm93ID0gdGhpcy5oaXN0b3J5UGFuZWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1oaXN0b3J5LXJvd1wiICsgKHMuaWQgPT09IHRoaXMuc2Vzc2lvbi5pZCA/IFwiIG9vYy1oaXN0b3J5LWFjdGl2ZVwiIDogXCJcIikgfSk7XG5cdFx0XHRjb25zdCB0aXRsZVdyYXAgPSByb3cuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1oaXN0b3J5LXRpdGxlXCIgfSk7XG5cdFx0XHR0aXRsZVdyYXAuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcblx0XHRcdFx0dGhpcy5zd2l0Y2hTZXNzaW9uKHMuaWQpO1xuXHRcdFx0XHR0aGlzLnRvZ2dsZUhpc3RvcnlQYW5lbCgpO1xuXHRcdFx0fSk7XG5cdFx0XHR0aXRsZVdyYXAuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1oaXN0b3J5LXRpdGxlLXRleHRcIiwgdGV4dDogcy50aXRsZSB9KTtcblx0XHRcdGNvbnN0IGxhc3RNZXNzYWdlID0gcy5tZXNzYWdlc1tzLm1lc3NhZ2VzLmxlbmd0aCAtIDFdO1xuXHRcdFx0aWYgKGxhc3RNZXNzYWdlKSB7XG5cdFx0XHRcdGNvbnN0IHByZXZpZXcgPSBsYXN0TWVzc2FnZS5jb250ZW50Lmxlbmd0aCA+IDY0ID8gYCR7bGFzdE1lc3NhZ2UuY29udGVudC5zbGljZSgwLCA2NCl9XHUyMDI2YCA6IGxhc3RNZXNzYWdlLmNvbnRlbnQ7XG5cdFx0XHRcdHRpdGxlV3JhcC5jcmVhdGVEaXYoeyBjbHM6IFwib29jLWhpc3RvcnktcHJldmlld1wiLCB0ZXh0OiBwcmV2aWV3IH0pO1xuXHRcdFx0fVxuXHRcdFx0cm93LmNyZWF0ZURpdih7IGNsczogXCJvb2MtaGlzdG9yeS10aW1lXCIsIHRleHQ6IHRoaXMucmVsYXRpdmVUaW1lKHMudXBkYXRlZEF0KSB9KTtcblx0XHRcdGNvbnN0IGRlbEJ0biA9IHJvdy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJvb2MtaGlzdG9yeS1kZWxldGVcIiB9KTtcblx0XHRcdHNldEljb24oZGVsQnRuLCBcInhcIik7XG5cdFx0XHRkZWxCdG4uc2V0QXR0cihcInRpdGxlXCIsIFwiRGVsZXRlIHRoaXMgY2hhdFwiKTtcblx0XHRcdGRlbEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKGUpID0+IHtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5kZWxldGVTZXNzaW9uKHMuaWQpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWxhdGl2ZVRpbWUodHM6IG51bWJlcik6IHN0cmluZyB7XG5cdFx0Y29uc3QgbWlucyA9IE1hdGgucm91bmQoKERhdGUubm93KCkgLSB0cykgLyA2MDAwMCk7XG5cdFx0aWYgKG1pbnMgPCAxKSByZXR1cm4gXCJqdXN0IG5vd1wiO1xuXHRcdGlmIChtaW5zIDwgNjApIHJldHVybiBgJHttaW5zfW0gYWdvYDtcblx0XHRjb25zdCBob3VycyA9IE1hdGgucm91bmQobWlucyAvIDYwKTtcblx0XHRpZiAoaG91cnMgPCAyNCkgcmV0dXJuIGAke2hvdXJzfWggYWdvYDtcblx0XHRyZXR1cm4gYCR7TWF0aC5yb3VuZChob3VycyAvIDI0KX1kIGFnb2A7XG5cdH1cblxuXHRwcml2YXRlIGxvYWRTZXNzaW9uSW50b1ZpZXcoKTogdm9pZCB7XG5cdFx0dGhpcy5tZXNzYWdlc0VsLmVtcHR5KCk7XG5cdFx0dGhpcy5hd2FpdGluZ0NsYXJpZmljYXRpb25Gb3IgPSBudWxsO1xuXHRcdHRoaXMuc3RhdHVzRWwuc2V0VGV4dCgnQ2hhdHRpbmcgd2l0aCBtZW1vcmllcyBvbmx5LiBDaGVjayBcIkluY2x1ZGUgbm90ZVwiIHRvIGFsc28gcmVhZCB0aGUgYWN0aXZlIHBhZ2UuJyk7XG5cblx0XHRpZiAodGhpcy5zZXNzaW9uLm1lc3NhZ2VzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5yZW5kZXJFbXB0eVN0YXRlKCk7XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgbSBvZiB0aGlzLnNlc3Npb24ubWVzc2FnZXMpIHRoaXMuYXBwZW5kTWVzc2FnZShtLnJvbGUsIG0uY29udGVudCk7XG5cblx0XHQvLyBSZS1zdXJmYWNlIGFueSBzdGlsbC1wZW5kaW5nIHRlbXAtbWVtb3J5IGNhcmRzIGZvciB0aGlzIHNlc3Npb24gc29cblx0XHQvLyByZXZpc2l0aW5nIGFuIG9sZCBjaGF0IHNob3dzIGV4YWN0bHkgd2hhdCB3YXMgbGl2ZSBpbiBpdCwgbm90IGp1c3Rcblx0XHQvLyB0aGUgcGxhaW4gdHJhbnNjcmlwdC5cblx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMucGx1Z2luLnRlbXBNZW1vcnlTdG9yZS5saXN0Rm9yU2Vzc2lvbih0aGlzLnNlc3Npb24uaWQpLnJldmVyc2UoKSkge1xuXHRcdFx0dGhpcy5yZW5kZXJQZW5kaW5nQ2FyZChlbnRyeSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuaGlzdG9yeVZpc2libGUpIHRoaXMucmVuZGVySGlzdG9yeVBhbmVsKCk7XG5cdFx0dGhpcy5zY3JvbGxUb0JvdHRvbSh0cnVlKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyRW1wdHlTdGF0ZSgpOiB2b2lkIHtcblx0XHRjb25zdCBlbXB0eSA9IHRoaXMubWVzc2FnZXNFbC5jcmVhdGVEaXYoeyBjbHM6IFwib29jLWVtcHR5LXN0YXRlXCIgfSk7XG5cdFx0ZW1wdHkuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1lbXB0eS1zdGF0ZS10aXRsZVwiLCB0ZXh0OiBcIlN0YXJ0IGNoYXR0aW5nXCIgfSk7XG5cdFx0ZW1wdHkuY3JlYXRlRGl2KHtcblx0XHRcdGNsczogXCJvb2MtZW1wdHktc3RhdGUtc3ViXCIsXG5cdFx0XHR0ZXh0OiAnQXNrIHNvbWV0aGluZywgb3Igc2F5IFwicmVtZW1iZXIgdGhhdC4uLlwiIHRvIG5vdGUgc29tZXRoaW5nIGRvd24uIFlvdXIgbWVtb3JpZXMsIGFuZCB0aGUgY3VycmVudCBub3RlIGlmIGluY2x1ZGVkLCBncm91bmQgZXZlcnkgYW5zd2VyLicsXG5cdFx0fSk7XG5cdH1cblxuXHQvKiogU3dpdGNoZXMgdG8gYSBmcmVzaCBkcmFmdCBzZXNzaW9uIFx1MjAxNCBpbnZpc2libGUgaW4gaGlzdG9yeSBhbmQgbmV2ZXIgcGVyc2lzdGVkIHVubGVzcyBhIG1lc3NhZ2UgaXMgYWN0dWFsbHkgc2VudCBpbiBpdC4gKi9cblx0cHJpdmF0ZSBzdGFydE5ld0NoYXQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuYnVzeSkgcmV0dXJuO1xuXHRcdHRoaXMuc2Vzc2lvbiA9IHRoaXMucGx1Z2luLmNoYXRTZXNzaW9uU3RvcmUuY3JlYXRlKCk7XG5cdFx0dGhpcy5sb2FkU2Vzc2lvbkludG9WaWV3KCk7XG5cdFx0dGhpcy5pbnB1dEVsLmZvY3VzKCk7XG5cdH1cblxuXHRwcml2YXRlIHN3aXRjaFNlc3Npb24oaWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmJ1c3kpIHJldHVybjtcblx0XHRjb25zdCB0YXJnZXQgPSB0aGlzLnBsdWdpbi5jaGF0U2Vzc2lvblN0b3JlLmdldChpZCk7XG5cdFx0aWYgKCF0YXJnZXQpIHJldHVybjtcblx0XHR0aGlzLnNlc3Npb24gPSB0YXJnZXQ7XG5cdFx0dGhpcy5sb2FkU2Vzc2lvbkludG9WaWV3KCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRlbGV0ZVNlc3Npb24oaWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmJ1c3kpIHJldHVybjtcblx0XHR0aGlzLnNldEJ1c3kodHJ1ZSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHdhc0FjdGl2ZSA9IHRoaXMuc2Vzc2lvbi5pZCA9PT0gaWQ7XG5cdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5jaGF0U2Vzc2lvblN0b3JlLmRlbGV0ZVNlc3Npb24oaWQpO1xuXHRcdFx0aWYgKHdhc0FjdGl2ZSkge1xuXHRcdFx0XHRjb25zdCBuZXh0ID0gdGhpcy5wbHVnaW4uY2hhdFNlc3Npb25TdG9yZS5saXN0KClbMF07XG5cdFx0XHRcdHRoaXMuc2Vzc2lvbiA9IG5leHQgPz8gdGhpcy5wbHVnaW4uY2hhdFNlc3Npb25TdG9yZS5jcmVhdGUoKTtcblx0XHRcdFx0dGhpcy5sb2FkU2Vzc2lvbkludG9WaWV3KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnJlbmRlckhpc3RvcnlQYW5lbCgpO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLnNldEJ1c3koZmFsc2UpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY2xlYXJUZW1wTWVtb3J5KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmJ1c3kpIHJldHVybjtcblx0XHR0aGlzLnNldEJ1c3kodHJ1ZSk7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMucGx1Z2luLm9yY2hlc3RyYXRvci5jbGVhclNlc3Npb25UZW1wTWVtb3J5KHRoaXMuc2Vzc2lvbi5pZCk7XG5cdFx0XHR0aGlzLmxvYWRTZXNzaW9uSW50b1ZpZXcoKTtcblx0XHRcdHRoaXMuc3RhdHVzRWwuc2V0VGV4dChcIlRoaXMgY2hhdCdzIHRlbXAtbWVtb3J5IHdhcyBjbGVhcmVkLiBDb252ZXJzYXRpb24gaGlzdG9yeSBpcyB1bnRvdWNoZWQuXCIpO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0dGhpcy5zdGF0dXNFbC5zZXRUZXh0KGBFcnJvciBjbGVhcmluZyB0ZW1wLW1lbW9yeTogJHsoZXJyIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLnNldEJ1c3koZmFsc2UpO1xuXHRcdH1cblx0fVxuXG5cdC8vIC0tLS0gQnVzeSAvIGxvYWRpbmcgc3RhdGUgLS0tLVxuXG5cdHByaXZhdGUgc2V0QnVzeShidXN5OiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5idXN5ID0gYnVzeTtcblx0XHR0aGlzLmlucHV0RWwuZGlzYWJsZWQgPSBidXN5O1xuXHRcdC8vIFRoZSBzZW5kIGJ1dHRvbiBuZXZlciBkaXNhYmxlcyB3aGlsZSBidXN5IFx1MjAxNCBpdCBiZWNvbWVzIHRoZSBDYW5jZWxcblx0XHQvLyBidXR0b24gaW5zdGVhZCwgc28gdGhlcmUncyBhbHdheXMgYW4gb2J2aW91cyB3YXkgdG8gc3RvcCB3aGF0ZXZlcidzXG5cdFx0Ly8gcnVubmluZyByYXRoZXIgdGhhbiBqdXN0IHdhaXRpbmcgaXQgb3V0LlxuXHRcdHRoaXMuc2VuZEJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdHNldEljb24odGhpcy5zZW5kQnRuLCBidXN5ID8gXCJzcXVhcmVcIiA6IFwic2VuZFwiKTtcblx0XHR0aGlzLnNlbmRCdG4uc2V0QXR0cihcInRpdGxlXCIsIGJ1c3kgPyBcIkNhbmNlbFwiIDogXCJTZW5kXCIpO1xuXHRcdHRoaXMuc2VuZEJ0bi5zZXRBdHRyKFwiYXJpYS1sYWJlbFwiLCBidXN5ID8gXCJDYW5jZWxcIiA6IFwiU2VuZFwiKTtcblx0XHR0aGlzLnNlbmRCdG4udG9nZ2xlQ2xhc3MoXCJvb2Mtc2VuZC1idG4tYnVzeVwiLCBidXN5KTtcblx0XHR0aGlzLm1lc3NhZ2VzRWwudG9nZ2xlQ2xhc3MoXCJvb2MtYnVzeVwiLCBidXN5KTtcblx0XHR0aGlzLnRvb2xiYXIudG9nZ2xlQ2xhc3MoXCJvb2MtdG9vbGJhci1idXN5XCIsIGJ1c3kpO1xuXHRcdHRoaXMudG9vbGJhci5xdWVyeVNlbGVjdG9yQWxsKFwiYnV0dG9uLCBpbnB1dFwiKS5mb3JFYWNoKChlbCkgPT4ge1xuXHRcdFx0KGVsIGFzIEhUTUxCdXR0b25FbGVtZW50IHwgSFRNTElucHV0RWxlbWVudCkuZGlzYWJsZWQgPSBidXN5O1xuXHRcdH0pO1xuXHRcdHRoaXMuaGlzdG9yeVBhbmVsLnRvZ2dsZUNsYXNzKFwib29jLWhpc3RvcnktYnVzeVwiLCBidXN5KTtcblx0XHR0aGlzLmhpc3RvcnlQYW5lbC5xdWVyeVNlbGVjdG9yQWxsKFwiYnV0dG9uXCIpLmZvckVhY2goKGVsKSA9PiB7XG5cdFx0XHQoZWwgYXMgSFRNTEJ1dHRvbkVsZW1lbnQpLmRpc2FibGVkID0gYnVzeTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKiBDYW4ndCB0cnVseSBhYm9ydCBhbiBpbi1mbGlnaHQgSFRUUCBjYWxsIHRvIE9sbGFtYSAobm8gc2lnbmFsIHN1cHBvcnQpLCBidXQgdGhpcyBzdG9wcyBhbnkgZnVydGhlciBzdGVwcyBvZiBhIG11bHRpLXN0ZXAgYnVpbGQvc2VhcmNoIGZyb20gc3RhcnRpbmcsIGFuZCB0aGUgVUkgZGlzY2FyZHMgd2hhdGV2ZXIgc2luZ2xlIGNhbGwgaXMgc3RpbGwgZmluaXNoaW5nIGluIHRoZSBiYWNrZ3JvdW5kIGluc3RlYWQgb2YgYWN0aW5nIG9uIGl0LiAqL1xuXHRwcml2YXRlIHJlcXVlc3RDYW5jZWwoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmN1cnJlbnRDYW5jZWxsYXRpb24gfHwgdGhpcy5jdXJyZW50Q2FuY2VsbGF0aW9uLmlzQ2FuY2VsbGVkKSByZXR1cm47XG5cdFx0dGhpcy5jdXJyZW50Q2FuY2VsbGF0aW9uLmNhbmNlbCgpO1xuXHRcdHRoaXMuc3RhdHVzRWwuc2V0VGV4dChcIkNhbmNlbGxpbmdcdTIwMjZcIik7XG5cdH1cblxuXHQvLyAtLS0tIFNjcm9sbGluZyAtLS0tXG5cblx0cHJpdmF0ZSBpc05lYXJCb3R0b20oKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZWwgPSB0aGlzLm1lc3NhZ2VzRWw7XG5cdFx0cmV0dXJuIGVsLnNjcm9sbEhlaWdodCAtIGVsLnNjcm9sbFRvcCAtIGVsLmNsaWVudEhlaWdodCA8IE5FQVJfQk9UVE9NX1RIUkVTSE9MRF9QWDtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlU2Nyb2xsQnV0dG9uVmlzaWJpbGl0eSgpOiB2b2lkIHtcblx0XHR0aGlzLnNjcm9sbEJ0bi5zdHlsZS5kaXNwbGF5ID0gdGhpcy5pc05lYXJCb3R0b20oKSA/IFwibm9uZVwiIDogXCJmbGV4XCI7XG5cdH1cblxuXHQvKiogU2Nyb2xscyB0byB0aGUgbmV3ZXN0IG1lc3NhZ2UgXHUyMDE0IGJ1dCBvbmx5IGlmIHRoZSB1c2VyIGhhc24ndCBzY3JvbGxlZCB1cCB0byByZXJlYWQgc29tZXRoaW5nLCB1bmxlc3MgYGZvcmNlYCAoZS5nLiB0aGV5IGp1c3Qgc2VudCBhIG1lc3NhZ2UsIG9yIHN3aXRjaGVkIGNoYXRzKS4gKi9cblx0cHJpdmF0ZSBzY3JvbGxUb0JvdHRvbShmb3JjZSA9IGZhbHNlKTogdm9pZCB7XG5cdFx0aWYgKGZvcmNlIHx8IHRoaXMuaXNOZWFyQm90dG9tKCkpIHtcblx0XHRcdHRoaXMubWVzc2FnZXNFbC5zY3JvbGxUb3AgPSB0aGlzLm1lc3NhZ2VzRWwuc2Nyb2xsSGVpZ2h0O1xuXHRcdH1cblx0XHR0aGlzLnVwZGF0ZVNjcm9sbEJ1dHRvblZpc2liaWxpdHkoKTtcblx0fVxuXG5cdC8vIC0tLS0gSW5wdXQgLS0tLVxuXG5cdHByaXZhdGUgYXV0b1Jlc2l6ZUlucHV0KCk6IHZvaWQge1xuXHRcdHRoaXMuaW5wdXRFbC5zdHlsZS5oZWlnaHQgPSBcImF1dG9cIjtcblx0XHR0aGlzLmlucHV0RWwuc3R5bGUuaGVpZ2h0ID0gYCR7TWF0aC5taW4odGhpcy5pbnB1dEVsLnNjcm9sbEhlaWdodCwgSU5QVVRfTUFYX0hFSUdIVF9QWCl9cHhgO1xuXHR9XG5cblx0cHJpdmF0ZSBmb3JtYXRUaW1lKHRzOiBudW1iZXIpOiBzdHJpbmcge1xuXHRcdHJldHVybiBuZXcgRGF0ZSh0cykudG9Mb2NhbGVUaW1lU3RyaW5nKFtdLCB7IGhvdXI6IFwiMi1kaWdpdFwiLCBtaW51dGU6IFwiMi1kaWdpdFwiIH0pO1xuXHR9XG5cblx0Ly8gLS0tLSBNZXNzYWdlIHJlbmRlcmluZyAtLS0tXG5cblx0cHJpdmF0ZSBhcHBlbmRNZXNzYWdlKHJvbGU6IFwidXNlclwiIHwgXCJhc3Npc3RhbnRcIiwgdGV4dDogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xuXHRcdGNvbnN0IHJvdyA9IHRoaXMubWVzc2FnZXNFbC5jcmVhdGVEaXYoeyBjbHM6IGBvb2MtbXNnIG9vYy0ke3JvbGV9YCB9KTtcblx0XHRjb25zdCBoZWFkZXIgPSByb3cuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1tc2ctaGVhZGVyXCIgfSk7XG5cdFx0aGVhZGVyLmNyZWF0ZVNwYW4oeyBjbHM6IFwib29jLXJvbGVcIiwgdGV4dDogcm9sZSA9PT0gXCJ1c2VyXCIgPyBcIllvdVwiIDogXCJBc3Npc3RhbnRcIiB9KTtcblx0XHRoZWFkZXIuY3JlYXRlU3Bhbih7IGNsczogXCJvb2MtdGltZXN0YW1wXCIsIHRleHQ6IHRoaXMuZm9ybWF0VGltZShEYXRlLm5vdygpKSB9KTtcblxuXHRcdGNvbnN0IHRleHRFbCA9IHJvdy5jcmVhdGVEaXYoeyBjbHM6IFwib29jLXRleHRcIiB9KTtcblxuXHRcdGlmIChyb2xlID09PSBcImFzc2lzdGFudFwiKSB7XG5cdFx0XHQvLyBNYXJrZG93bi1yZW5kZXIgdGhlIGFuc3dlciAoaGVhZGluZ3MsIGxpc3RzLCBjb2RlIGJsb2NrcywgbGlua3MsXG5cdFx0XHQvLyBib2xkL2l0YWxpYykgaW5zdGVhZCBvZiBkdW1waW5nIHJhdyB0ZXh0IFx1MjAxNCByZS1jaGVja3Mgc2Nyb2xsXG5cdFx0XHQvLyBwb3NpdGlvbiBvbmNlIHJlbmRlcmluZyBmaW5pc2hlcywgc2luY2UgY29udGVudCBoZWlnaHQgY2FuIGdyb3dcblx0XHRcdC8vIChlLmcuIGEgY29kZSBibG9jaykgYWZ0ZXIgdGhlIGluaXRpYWwgc3luY2hyb25vdXMgc2Nyb2xsIGJlbG93LlxuXHRcdFx0TWFya2Rvd25SZW5kZXJlci5yZW5kZXIodGhpcy5hcHAsIHRleHQsIHRleHRFbCwgXCJcIiwgdGhpcykudGhlbigoKSA9PiB0aGlzLnNjcm9sbFRvQm90dG9tKCkpO1xuXG5cdFx0XHRjb25zdCBjb3B5QnRuID0gcm93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcIm9vYy1jb3B5LWJ0blwiIH0pO1xuXHRcdFx0c2V0SWNvbihjb3B5QnRuLCBcImNvcHlcIik7XG5cdFx0XHRjb3B5QnRuLnNldEF0dHIoXCJ0aXRsZVwiLCBcIkNvcHkgcmVzcG9uc2VcIik7XG5cdFx0XHRjb3B5QnRuLnNldEF0dHIoXCJhcmlhLWxhYmVsXCIsIFwiQ29weSByZXNwb25zZVwiKTtcblx0XHRcdGNvcHlCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dCh0ZXh0KTtcblx0XHRcdFx0XHRzZXRJY29uKGNvcHlCdG4sIFwiY2hlY2tcIik7XG5cdFx0XHRcdFx0c2V0VGltZW91dCgoKSA9PiBzZXRJY29uKGNvcHlCdG4sIFwiY29weVwiKSwgMTIwMCk7XG5cdFx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRcdG5ldyBOb3RpY2UoXCJDb3VsZG4ndCBjb3B5IHRvIGNsaXBib2FyZC5cIik7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0ZXh0RWwuc2V0VGV4dCh0ZXh0KTtcblx0XHR9XG5cblx0XHR0aGlzLnNjcm9sbFRvQm90dG9tKHJvbGUgPT09IFwidXNlclwiKTtcblx0XHRyZXR1cm4gcm93O1xuXHR9XG5cblx0cHJpdmF0ZSBhcHBlbmRTeXN0ZW1Ob3RlKHRleHQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMubWVzc2FnZXNFbC5jcmVhdGVEaXYoeyBjbHM6IFwib29jLXN5c3RlbS1ub3RlXCIsIHRleHQgfSk7XG5cdFx0dGhpcy5zY3JvbGxUb0JvdHRvbSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhcHBlbmRMb2FkaW5nQnViYmxlKCk6IEhUTUxFbGVtZW50IHtcblx0XHRjb25zdCByb3cgPSB0aGlzLm1lc3NhZ2VzRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1tc2cgb29jLWFzc2lzdGFudCBvb2MtbG9hZGluZ1wiIH0pO1xuXHRcdGNvbnN0IGhlYWRlciA9IHJvdy5jcmVhdGVEaXYoeyBjbHM6IFwib29jLW1zZy1oZWFkZXJcIiB9KTtcblx0XHRoZWFkZXIuY3JlYXRlU3Bhbih7IGNsczogXCJvb2Mtcm9sZVwiLCB0ZXh0OiBcIkFzc2lzdGFudFwiIH0pO1xuXHRcdGNvbnN0IGRvdHMgPSByb3cuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy10ZXh0IG9vYy1sb2FkaW5nLWRvdHNcIiB9KTtcblx0XHRkb3RzLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MjVDRlwiIH0pO1xuXHRcdGRvdHMuY3JlYXRlU3Bhbih7IHRleHQ6IFwiXHUyNUNGXCIgfSk7XG5cdFx0ZG90cy5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTI1Q0ZcIiB9KTtcblx0XHR0aGlzLnNjcm9sbFRvQm90dG9tKHRydWUpO1xuXHRcdHJldHVybiByb3c7XG5cdH1cblxuXHQvLyAtLS0tIE5vdGUtbWVtb3J5OiBsaXZlIFwidGhpbmtpbmdcIiB0cmFjZSB3aGlsZSBidWlsZGluZy9yZWZyZXNoaW5nIC0tLS1cblxuXHRwcml2YXRlIHJlbmRlclByb2dyZXNzTG9nKHRpdGxlVGV4dDogc3RyaW5nKTogeyBvblByb2dyZXNzOiAocDogQnVpbGRQcm9ncmVzcykgPT4gdm9pZDsgZmluaXNoOiAodGV4dDogc3RyaW5nKSA9PiB2b2lkIH0ge1xuXHRcdGNvbnN0IGNvbnRhaW5lciA9IHRoaXMubWVzc2FnZXNFbC5jcmVhdGVEaXYoeyBjbHM6IFwib29jLXByb2dyZXNzLWxvZ1wiIH0pO1xuXHRcdGNvbnN0IHRpdGxlUm93ID0gY29udGFpbmVyLmNyZWF0ZURpdih7IGNsczogXCJvb2MtcHJvZ3Jlc3MtdGl0bGUtcm93XCIgfSk7XG5cdFx0dGl0bGVSb3cuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1wcm9ncmVzcy10aXRsZVwiLCB0ZXh0OiB0aXRsZVRleHQgfSk7XG5cdFx0Y29uc3QgY2FuY2VsQnRuID0gdGl0bGVSb3cuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwib29jLXByb2dyZXNzLWNhbmNlbFwiLCB0ZXh0OiBcIkNhbmNlbFwiIH0pO1xuXHRcdGNhbmNlbEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gdGhpcy5yZXF1ZXN0Q2FuY2VsKCkpO1xuXHRcdGNvbnN0IGxpbmVzRWwgPSBjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1wcm9ncmVzcy1saW5lc1wiIH0pO1xuXHRcdHRoaXMuc2Nyb2xsVG9Cb3R0b20oKTtcblxuXHRcdGNvbnN0IG9uUHJvZ3Jlc3MgPSAocDogQnVpbGRQcm9ncmVzcykgPT4ge1xuXHRcdFx0aWYgKHAuc3RhdHVzID09PSBcInN0YXJ0aW5nXCIpIHtcblx0XHRcdFx0Y29uc3QgbGluZSA9IGxpbmVzRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1wcm9ncmVzcy1saW5lIG9vYy1wcm9ncmVzcy1hY3RpdmVcIiwgdGV4dDogYCR7cC5waGFzZX1cdTIwMjZgIH0pO1xuXHRcdFx0XHRsaW5lLmRhdGFzZXQubGF5ZXIgPSBTdHJpbmcocC5sYXllckluZGV4KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGFjdGl2ZSA9IGxpbmVzRWwucXVlcnlTZWxlY3RvcihgLm9vYy1wcm9ncmVzcy1hY3RpdmVbZGF0YS1sYXllcj1cIiR7cC5sYXllckluZGV4fVwiXWApIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcblx0XHRcdFx0aWYgKGFjdGl2ZSkge1xuXHRcdFx0XHRcdGFjdGl2ZS5yZW1vdmVDbGFzcyhcIm9vYy1wcm9ncmVzcy1hY3RpdmVcIik7XG5cdFx0XHRcdFx0YWN0aXZlLnNldFRleHQoYCR7cC5waGFzZX0gXHUyNzEzYCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bGluZXNFbC5jcmVhdGVEaXYoeyBjbHM6IFwib29jLXByb2dyZXNzLWxpbmVcIiwgdGV4dDogYCR7cC5waGFzZX0gXHUyNzEzYCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhpcy5zY3JvbGxUb0JvdHRvbSgpO1xuXHRcdH07XG5cblx0XHRjb25zdCBmaW5pc2ggPSAodGV4dDogc3RyaW5nKSA9PiB7XG5cdFx0XHRjYW5jZWxCdG4ucmVtb3ZlKCk7XG5cdFx0XHRjb250YWluZXIuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1wcm9ncmVzcy1kb25lXCIsIHRleHQgfSk7XG5cdFx0XHR0aGlzLnNjcm9sbFRvQm90dG9tKCk7XG5cdFx0fTtcblxuXHRcdHJldHVybiB7IG9uUHJvZ3Jlc3MsIGZpbmlzaCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBydW5Ob3RlTWVtb3J5U3luYyhmaWxlOiBURmlsZSwgbW9kZTogXCJmdWxsXCIgfCBcImluY3JlbWVudGFsXCIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5idXN5KSByZXR1cm47XG5cdFx0dGhpcy5jdXJyZW50Q2FuY2VsbGF0aW9uID0gbmV3IENhbmNlbGxhdGlvblNvdXJjZSgpO1xuXHRcdHRoaXMuc2V0QnVzeSh0cnVlKTtcblx0XHRjb25zdCBoYWRNZW1vcnkgPSAhIXRoaXMucGx1Z2luLm5vdGVNZW1vcnlTdG9yZS5nZXQoZmlsZS5wYXRoKTtcblx0XHRjb25zdCBsYWJlbCA9XG5cdFx0XHRtb2RlID09PSBcImluY3JlbWVudGFsXCJcblx0XHRcdFx0PyBgVXBkYXRpbmcgbm90ZSBtZW1vcnkgZm9yIFwiJHtmaWxlLmJhc2VuYW1lfVwiYFxuXHRcdFx0XHQ6IGhhZE1lbW9yeVxuXHRcdFx0XHRcdD8gYFJlYnVpbGRpbmcgbm90ZSBtZW1vcnkgZm9yIFwiJHtmaWxlLmJhc2VuYW1lfVwiYFxuXHRcdFx0XHRcdDogYEJ1aWxkaW5nIG5vdGUgbWVtb3J5IGZvciBcIiR7ZmlsZS5iYXNlbmFtZX1cImA7XG5cdFx0Y29uc3QgeyBvblByb2dyZXNzLCBmaW5pc2ggfSA9IHRoaXMucmVuZGVyUHJvZ3Jlc3NMb2cobGFiZWwpO1xuXHRcdHRyeSB7XG5cdFx0XHRpZiAobW9kZSA9PT0gXCJpbmNyZW1lbnRhbFwiKSB7XG5cdFx0XHRcdGNvbnN0IHsgZmVsbEJhY2tUb0Z1bGwgfSA9IGF3YWl0IHRoaXMucGx1Z2luLm5vdGVNZW1vcnlTdG9yZS5yZWZyZXNoSW5jcmVtZW50YWwoXG5cdFx0XHRcdFx0ZmlsZSwgdGhpcy5wbHVnaW4uY2xpZW50LCB0aGlzLnBsdWdpbi5zZXR0aW5ncywgb25Qcm9ncmVzcywgdGhpcy5jdXJyZW50Q2FuY2VsbGF0aW9uLnRva2VuXG5cdFx0XHRcdCk7XG5cdFx0XHRcdGZpbmlzaChmZWxsQmFja1RvRnVsbCA/IFwiV2Fzbid0IGEgY2xlYW4gYXBwZW5kIHNpbmNlIGxhc3Qgc3luYyBcdTIwMTQgZGlkIGEgZnVsbCByZWJ1aWxkIGluc3RlYWQuXCIgOiBcIlVwZGF0ZWQuXCIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4ubm90ZU1lbW9yeVN0b3JlLnJlZnJlc2hGdWxsKGZpbGUsIHRoaXMucGx1Z2luLmNsaWVudCwgdGhpcy5wbHVnaW4uc2V0dGluZ3MsIG9uUHJvZ3Jlc3MsIHRoaXMuY3VycmVudENhbmNlbGxhdGlvbi50b2tlbik7XG5cdFx0XHRcdGZpbmlzaChcIkRvbmUuXCIpO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0aWYgKGlzQ2FuY2VsbGVkRXJyb3IoZXJyKSkge1xuXHRcdFx0XHRmaW5pc2goXCJDYW5jZWxsZWQuXCIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZmluaXNoKGBFcnJvcjogJHsoZXJyIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuXHRcdFx0XHRuZXcgTm90aWNlKGBOb3RlIG1lbW9yeSBzeW5jIGZhaWxlZDogJHsoZXJyIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0aGlzLmN1cnJlbnRDYW5jZWxsYXRpb24gPSBudWxsO1xuXHRcdFx0dGhpcy5zZXRCdXN5KGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlck5vdGVNZW1vcnlIaW50KGZpbGVQYXRoOiBzdHJpbmcsIGZpbGVOYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBiYXIgPSB0aGlzLm1lc3NhZ2VzRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1ub3RlbWVtLWhpbnRcIiB9KTtcblx0XHRiYXIuY3JlYXRlU3Bhbih7IHRleHQ6IGBBbnN3ZXJlZCB1c2luZyB0aGUgbm90ZSBtZW1vcnkgZm9yIFwiJHtmaWxlTmFtZX1cIi4gYCB9KTtcblx0XHRjb25zdCByZWZyZXNoQnRuID0gYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJSZWZyZXNoIChmdWxsKVwiIH0pO1xuXHRcdGNvbnN0IGluY3JlbWVudGFsQnRuID0gYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJVcGRhdGUgKGluY3JlbWVudGFsKVwiIH0pO1xuXG5cdFx0Y29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmaWxlUGF0aCk7XG5cdFx0Y29uc3QgYXNGaWxlID0gZmlsZSBpbnN0YW5jZW9mIFRGaWxlID8gZmlsZSA6IG51bGw7XG5cblx0XHRyZWZyZXNoQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5idXN5KSB7IG5ldyBOb3RpY2UoXCJTb21ldGhpbmcgZWxzZSBpcyBhbHJlYWR5IHJ1bm5pbmcgXHUyMDE0IHdhaXQgZm9yIGl0IHRvIGZpbmlzaCBvciBjYW5jZWwgaXQgZmlyc3QuXCIpOyByZXR1cm47IH1cblx0XHRcdHJlZnJlc2hCdG4uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0aW5jcmVtZW50YWxCdG4uZGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0aWYgKGFzRmlsZSkgYXdhaXQgdGhpcy5ydW5Ob3RlTWVtb3J5U3luYyhhc0ZpbGUsIFwiZnVsbFwiKTtcblx0XHR9KTtcblx0XHRpbmNyZW1lbnRhbEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuYnVzeSkgeyBuZXcgTm90aWNlKFwiU29tZXRoaW5nIGVsc2UgaXMgYWxyZWFkeSBydW5uaW5nIFx1MjAxNCB3YWl0IGZvciBpdCB0byBmaW5pc2ggb3IgY2FuY2VsIGl0IGZpcnN0LlwiKTsgcmV0dXJuOyB9XG5cdFx0XHRyZWZyZXNoQnRuLmRpc2FibGVkID0gdHJ1ZTtcblx0XHRcdGluY3JlbWVudGFsQnRuLmRpc2FibGVkID0gdHJ1ZTtcblx0XHRcdGlmIChhc0ZpbGUpIGF3YWl0IHRoaXMucnVuTm90ZU1lbW9yeVN5bmMoYXNGaWxlLCBcImluY3JlbWVudGFsXCIpO1xuXHRcdH0pO1xuXHR9XG5cblx0Ly8gLS0tLSBQZW5kaW5nIG1lbW9yeSBjb25maXJtL2Rpc2NhcmQgY2FyZHMgLS0tLVxuXG5cdHByaXZhdGUgcmVuZGVyUGVuZGluZ0NhcmQoZW50cnk6IFRlbXBNZW1vcnlFbnRyeSk6IHZvaWQge1xuXHRcdGNvbnN0IGNhcmQgPSB0aGlzLm1lc3NhZ2VzRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1wZW5kaW5nLWNhcmRcIiB9KTtcblx0XHRjb25zdCBsYWJlbCA9IGVudHJ5LmFjdGlvbiA9PT0gXCJleHRlbmRcIlxuXHRcdFx0PyBgU2F2ZSB0byBtZW1vcnkgXHUyMDE0IGFkZCB0byBcIiR7ZW50cnkudG9waWNOYW1lfVwiP2Bcblx0XHRcdDogYFNhdmUgdG8gbWVtb3J5IFx1MjAxNCBuZXcgdG9waWMgXCIke2VudHJ5LnRvcGljTmFtZX1cIj9gO1xuXHRcdGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1wZW5kaW5nLWxhYmVsXCIsIHRleHQ6IGxhYmVsIH0pO1xuXHRcdGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1wZW5kaW5nLWZhY3RcIiwgdGV4dDogZW50cnkuZmFjdCB9KTtcblxuXHRcdGNvbnN0IGFjdGlvbnMgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJvb2MtcGVuZGluZy1hY3Rpb25zXCIgfSk7XG5cdFx0Y29uc3QgY29uZmlybUJ0biA9IGFjdGlvbnMuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlNhdmVcIiB9KTtcblx0XHRjb25zdCBkaXNjYXJkQnRuID0gYWN0aW9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiRGlzY2FyZFwiIH0pO1xuXG5cdFx0Y29uc3QgZGlzYWJsZUJvdGggPSAoKSA9PiB7IGNvbmZpcm1CdG4uZGlzYWJsZWQgPSB0cnVlOyBkaXNjYXJkQnRuLmRpc2FibGVkID0gdHJ1ZTsgfTtcblxuXHRcdGNvbmZpcm1CdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcblx0XHRcdGlmICh0aGlzLmJ1c3kpIHJldHVybjtcblx0XHRcdGRpc2FibGVCb3RoKCk7XG5cdFx0XHR0aGlzLmN1cnJlbnRDYW5jZWxsYXRpb24gPSBuZXcgQ2FuY2VsbGF0aW9uU291cmNlKCk7XG5cdFx0XHR0aGlzLnNldEJ1c3kodHJ1ZSk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCB0b3BpYyA9IGF3YWl0IHRoaXMucGx1Z2luLm9yY2hlc3RyYXRvci5jb25maXJtVGVtcEVudHJ5KGVudHJ5LmlkLCB0aGlzLmN1cnJlbnRDYW5jZWxsYXRpb24udG9rZW4pO1xuXHRcdFx0XHRjYXJkLmVtcHR5KCk7XG5cdFx0XHRcdGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1wZW5kaW5nLXJlc29sdmVkXCIsIHRleHQ6IGBTYXZlZCB0byBcIiR7dG9waWMubmFtZX1cIi5gIH0pO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdGNvbmZpcm1CdG4uZGlzYWJsZWQgPSBmYWxzZTtcblx0XHRcdFx0ZGlzY2FyZEJ0bi5kaXNhYmxlZCA9IGZhbHNlO1xuXHRcdFx0XHRpZiAoaXNDYW5jZWxsZWRFcnJvcihlcnIpKSB7XG5cdFx0XHRcdFx0Y2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwib29jLXBlbmRpbmctcmVzb2x2ZWRcIiwgdGV4dDogXCJDYW5jZWxsZWQgXHUyMDE0IHN0aWxsIHBlbmRpbmcuXCIgfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bmV3IE5vdGljZShgQ291bGRuJ3Qgc2F2ZTogJHsoZXJyIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuXHRcdFx0XHRcdGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1wZW5kaW5nLXJlc29sdmVkXCIsIHRleHQ6IGBFcnJvcjogJHsoZXJyIGFzIEVycm9yKS5tZXNzYWdlfWAgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdHRoaXMuY3VycmVudENhbmNlbGxhdGlvbiA9IG51bGw7XG5cdFx0XHRcdHRoaXMuc2V0QnVzeShmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRkaXNjYXJkQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5idXN5KSByZXR1cm47XG5cdFx0XHRkaXNhYmxlQm90aCgpO1xuXHRcdFx0dGhpcy5zZXRCdXN5KHRydWUpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5wbHVnaW4ub3JjaGVzdHJhdG9yLmRpc2NhcmRUZW1wRW50cnkoZW50cnkuaWQpO1xuXHRcdFx0XHRjYXJkLmVtcHR5KCk7XG5cdFx0XHRcdGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1wZW5kaW5nLXJlc29sdmVkXCIsIHRleHQ6IFwiRGlzY2FyZGVkLlwiIH0pO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0dGhpcy5zZXRCdXN5KGZhbHNlKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuc2Nyb2xsVG9Cb3R0b20oKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyUGVuZGluZ0VudHJpZXMoZW50cmllcz86IFRlbXBNZW1vcnlFbnRyeVtdKTogdm9pZCB7XG5cdFx0aWYgKCFlbnRyaWVzKSByZXR1cm47XG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB0aGlzLnJlbmRlclBlbmRpbmdDYXJkKGVudHJ5KTtcblx0fVxuXG5cdC8vIC0tLS0gU2VuZGluZyAtLS0tXG5cblx0cHJpdmF0ZSBnZXQgaGlzdG9yeSgpOiBDaGF0TWVzc2FnZVtdIHtcblx0XHRyZXR1cm4gdGhpcy5zZXNzaW9uLm1lc3NhZ2VzLm1hcCgobSkgPT4gKHsgcm9sZTogbS5yb2xlLCBjb250ZW50OiBtLmNvbnRlbnQgfSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWNvcmRUdXJuKHVzZXJUZXh0OiBzdHJpbmcsIGFzc2lzdGFudFRleHQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGlzRmlyc3RUdXJuID0gdGhpcy5zZXNzaW9uLm1lc3NhZ2VzLmxlbmd0aCA9PT0gMDtcblxuXHRcdGF3YWl0IHRoaXMucGx1Z2luLmNoYXRTZXNzaW9uU3RvcmUuYXBwZW5kTWVzc2FnZSh0aGlzLnNlc3Npb24uaWQsIHsgcm9sZTogXCJ1c2VyXCIsIGNvbnRlbnQ6IHVzZXJUZXh0IH0pO1xuXHRcdGF3YWl0IHRoaXMucGx1Z2luLmNoYXRTZXNzaW9uU3RvcmUuYXBwZW5kTWVzc2FnZSh0aGlzLnNlc3Npb24uaWQsIHsgcm9sZTogXCJhc3Npc3RhbnRcIiwgY29udGVudDogYXNzaXN0YW50VGV4dCB9KTtcblx0XHRpZiAodGhpcy5oaXN0b3J5VmlzaWJsZSkgdGhpcy5yZW5kZXJIaXN0b3J5UGFuZWwoKTtcblxuXHRcdC8vIEZpcmUtYW5kLWZvcmdldDogZm9sZCB0aGlzIHR1cm4gaW50byB0aGUgc2Vzc2lvbidzIHJvbGxpbmcgc3VtbWFyeVxuXHRcdC8vIGRpZ2VzdCB3aXRob3V0IG1ha2luZyB0aGUgdXNlciB3YWl0IG9uIGl0LlxuXHRcdHRoaXMucGx1Z2luLm9yY2hlc3RyYXRvci51cGRhdGVTZXNzaW9uSGlzdG9yeSh0aGlzLnNlc3Npb24uaWQsIHVzZXJUZXh0LCBhc3Npc3RhbnRUZXh0KS5jYXRjaCgoKSA9PiB2b2lkIDApO1xuXG5cdFx0aWYgKGlzRmlyc3RUdXJuKSB7XG5cdFx0XHQvLyBBdXRvbWF0aWNhbGx5IHJlbmFtZSB0aGUgY2hhdCBiYXNlZCBvbiB3aGF0IGl0J3MgYWN0dWFsbHkgYWJvdXQsXG5cdFx0XHQvLyB3aXRob3V0IGJsb2NraW5nIHRoZSByZXBseSB0aGUgdXNlciBpcyBhbHJlYWR5IGxvb2tpbmcgYXQuXG5cdFx0XHR0aGlzLnBsdWdpbi5vcmNoZXN0cmF0b3Jcblx0XHRcdFx0LmdlbmVyYXRlU2Vzc2lvblRpdGxlKHVzZXJUZXh0KVxuXHRcdFx0XHQudGhlbihhc3luYyAodGl0bGUpID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5jaGF0U2Vzc2lvblN0b3JlLnNldFRpdGxlKHRoaXMuc2Vzc2lvbi5pZCwgdGl0bGUpO1xuXHRcdFx0XHRcdGlmICh0aGlzLmhpc3RvcnlWaXNpYmxlKSB0aGlzLnJlbmRlckhpc3RvcnlQYW5lbCgpO1xuXHRcdFx0XHR9KVxuXHRcdFx0XHQuY2F0Y2goKCkgPT4geyAvKiBrZWVwIHRoZSB0cnVuY2F0ZWQgZmFsbGJhY2sgdGl0bGUgKi8gfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJSZXRyeSh0ZXh0OiBzdHJpbmcsIHdhc0NsYXJpZmljYXRpb25SZXBseTogYm9vbGVhbiwgb3JpZ2luYWxRdWVyeUZvckNsYXJpZmljYXRpb246IHN0cmluZyB8IG51bGwpOiB2b2lkIHtcblx0XHRjb25zdCByb3cgPSB0aGlzLm1lc3NhZ2VzRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1yZXRyeS1yb3dcIiB9KTtcblx0XHRyb3cuY3JlYXRlU3Bhbih7IHRleHQ6IFwiVGhhdCBkaWRuJ3QgZ28gdGhyb3VnaC4gXCIgfSk7XG5cdFx0Y29uc3QgcmV0cnlCdG4gPSByb3cuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlJldHJ5XCIgfSk7XG5cdFx0cmV0cnlCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcblx0XHRcdHJvdy5yZW1vdmUoKTtcblx0XHRcdGlmICh3YXNDbGFyaWZpY2F0aW9uUmVwbHkpIHRoaXMuYXdhaXRpbmdDbGFyaWZpY2F0aW9uRm9yID0gb3JpZ2luYWxRdWVyeUZvckNsYXJpZmljYXRpb247XG5cdFx0XHR0aGlzLmlucHV0RWwudmFsdWUgPSB0ZXh0O1xuXHRcdFx0dGhpcy5hdXRvUmVzaXplSW5wdXQoKTtcblx0XHRcdHRoaXMuc2VuZCgpO1xuXHRcdH0pO1xuXHRcdHRoaXMuc2Nyb2xsVG9Cb3R0b20odHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNlbmQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuYnVzeSkgcmV0dXJuO1xuXHRcdGNvbnN0IHRleHQgPSB0aGlzLmlucHV0RWwudmFsdWUudHJpbSgpO1xuXHRcdGlmICghdGV4dCkgcmV0dXJuO1xuXG5cdFx0Y29uc3Qgd2FzQ2xhcmlmaWNhdGlvblJlcGx5ID0gISF0aGlzLmF3YWl0aW5nQ2xhcmlmaWNhdGlvbkZvcjtcblx0XHRjb25zdCBvcmlnaW5hbFF1ZXJ5Rm9yQ2xhcmlmaWNhdGlvbiA9IHRoaXMuYXdhaXRpbmdDbGFyaWZpY2F0aW9uRm9yO1xuXG5cdFx0dGhpcy5pbnB1dEVsLnZhbHVlID0gXCJcIjtcblx0XHR0aGlzLmF1dG9SZXNpemVJbnB1dCgpO1xuXHRcdHRoaXMuYXBwZW5kTWVzc2FnZShcInVzZXJcIiwgdGV4dCk7XG5cblx0XHRpZiAoIXdhc0NsYXJpZmljYXRpb25SZXBseSkge1xuXHRcdFx0Y29uc3Qgb2ZmZXJlZCA9IGF3YWl0IHRoaXMubWF5YmVPZmZlck5vdGVNZW1vcnlCdWlsZCh0ZXh0KTtcblx0XHRcdGlmIChvZmZlcmVkKSByZXR1cm47IC8vIHdhaXRpbmcgb24gdGhlIHVzZXIncyBidWlsZC9za2lwIGNob2ljZSBiZWZvcmUgdGhpcyB0dXJuIGdldHMgYW5zd2VyZWRcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLnJ1blF1ZXJ5KHRleHQsIHdhc0NsYXJpZmljYXRpb25SZXBseSwgb3JpZ2luYWxRdWVyeUZvckNsYXJpZmljYXRpb24pO1xuXHR9XG5cblx0LyoqXG5cdCAqIElmIFwiSW5jbHVkZSBub3RlXCIgKG9yIGFuIGV4cGxpY2l0IFwidGhpcyBub3RlXCIgcmVmZXJlbmNlKSBwb2ludHMgYXQgYVxuXHQgKiBub3RlIHRoYXQgZG9lc24ndCBoYXZlIGEgbWVtb3J5IG1pcnJvciB5ZXQgYW5kIGlzIGxvbmcgZW5vdWdoIHRoYXRcblx0ICogYnVpbGRpbmcgb25lIHdvdWxkIGFjdHVhbGx5IGhlbHAsIGFzayBiZWZvcmUgc3BlbmRpbmcgdGhlIHRpbWUgb24gaXRcblx0ICogXHUyMDE0IHJhdGhlciB0aGFuIHNpbGVudGx5IGJ1aWxkaW5nIGl0ICh3aGljaCBjYW4gdGFrZSBmYXIgbG9uZ2VyIHRoYW4gYW5cblx0ICogb3JkaW5hcnkgcmVwbHkgYW5kIHVzZWQgdG8ganVzdCBoYXBwZW4gd2l0aG91dCB3YXJuaW5nKSBvciBzaWxlbnRseVxuXHQgKiBza2lwcGluZyBpdCBldmVyeSB0aW1lLiBTaG9ydCBub3RlcyBhcmUgY2hlYXAgdG8gcmVhZCByYXcsIHNvIHRob3NlXG5cdCAqIGFyZSBuZXZlciBwcm9tcHRlZCBmb3IuIFJldHVybnMgdHJ1ZSBpZiBhIHByb21wdCB3YXMgc2hvd24gXHUyMDE0IHRoZVxuXHQgKiBjYWxsZXIgc2hvdWxkIHN0b3AgYW5kIHdhaXQgZm9yIHRoZSB1c2VyJ3MgY2hvaWNlIGluc3RlYWQgb2Zcblx0ICogYW5zd2VyaW5nIHRoaXMgdHVybiBpbW1lZGlhdGVseS5cblx0ICovXG5cdHByaXZhdGUgYXN5bmMgbWF5YmVPZmZlck5vdGVNZW1vcnlCdWlsZChxdWVyeTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKCF0aGlzLnBsdWdpbi5zZXR0aW5ncy5hdXRvSW5pdE5vdGVNZW1vcnkpIHJldHVybiBmYWxzZTtcblxuXHRcdGNvbnN0IHdhbnRzQWN0aXZlTm90ZSA9IHRoaXMuaW5jbHVkZUFjdGl2ZU5vdGUgfHwgQUNUSVZFX05PVEVfUkVGRVJFTkNFLnRlc3QocXVlcnkpO1xuXHRcdGlmICghd2FudHNBY3RpdmVOb3RlKSByZXR1cm4gZmFsc2U7XG5cblx0XHRjb25zdCBmaWxlID0gdGhpcy5wbHVnaW4uYWN0aXZlRmlsZVRyYWNrZXIuZ2V0RmlsZSgpO1xuXHRcdGlmICghZmlsZSB8fCBmaWxlLmV4dGVuc2lvbiAhPT0gXCJtZFwiKSByZXR1cm4gZmFsc2U7XG5cdFx0aWYgKHRoaXMucGx1Z2luLm5vdGVNZW1vcnlTdG9yZS5nZXQoZmlsZS5wYXRoKSkgcmV0dXJuIGZhbHNlOyAvLyBhbHJlYWR5IGJ1aWx0XG5cblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5hcHAudmF1bHQucmVhZChmaWxlKTtcblx0XHRpZiAoY29udGVudC5sZW5ndGggPCBMT05HX05PVEVfUFJPTVBUX1RIUkVTSE9MRF9DSEFSUykgcmV0dXJuIGZhbHNlOyAvLyBzaG9ydCBlbm91Z2ggdG8ganVzdCByZWFkIHJhd1xuXG5cdFx0dGhpcy5yZW5kZXJOb3RlTWVtb3J5UHJvbXB0KGZpbGUsIHF1ZXJ5KTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyTm90ZU1lbW9yeVByb21wdChmaWxlOiBURmlsZSwgcXVlcnk6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGNhcmQgPSB0aGlzLm1lc3NhZ2VzRWwuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1wZW5kaW5nLWNhcmRcIiB9KTtcblx0XHRjYXJkLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFwib29jLXBlbmRpbmctbGFiZWxcIixcblx0XHRcdHRleHQ6IGBcIiR7ZmlsZS5iYXNlbmFtZX1cIiBpcyBsb25nIGFuZCBoYXNuJ3QgYmVlbiBhZGRlZCB0byBub3RlIG1lbW9yeSB5ZXQuYCxcblx0XHR9KTtcblx0XHRjYXJkLmNyZWF0ZURpdih7XG5cdFx0XHRjbHM6IFwib29jLXBlbmRpbmctZmFjdFwiLFxuXHRcdFx0dGV4dDogXCJCdWlsZGluZyBpdCBsZXRzIG1lIHNlYXJjaCBpdCBpbiBsYXllcnMgb2YgZGV0YWlsIGluc3RlYWQgb2YgcmVhZGluZyBpdCByYXcgZXZlcnkgdGltZSBcdTIwMTQgd29ydGggaXQgZm9yIGEgbm90ZSB0aGlzIHNpemUsIGJ1dCB0YWtlcyBhIGJpdCBsb25nZXIgdXAgZnJvbnQuXCIsXG5cdFx0fSk7XG5cblx0XHRjb25zdCBhY3Rpb25zID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwib29jLXBlbmRpbmctYWN0aW9uc1wiIH0pO1xuXHRcdGNvbnN0IGJ1aWxkQnRuID0gYWN0aW9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiQnVpbGQgbm90ZSBtZW1vcnlcIiB9KTtcblx0XHRjb25zdCBza2lwQnRuID0gYWN0aW9ucy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiU2tpcCwganVzdCBhbnN3ZXJcIiB9KTtcblx0XHRjb25zdCBkaXNhYmxlQm90aCA9ICgpID0+IHsgYnVpbGRCdG4uZGlzYWJsZWQgPSB0cnVlOyBza2lwQnRuLmRpc2FibGVkID0gdHJ1ZTsgfTtcblxuXHRcdGJ1aWxkQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5idXN5KSByZXR1cm47XG5cdFx0XHRkaXNhYmxlQm90aCgpO1xuXHRcdFx0Y2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwib29jLXBlbmRpbmctcmVzb2x2ZWRcIiwgdGV4dDogXCJCdWlsZGluZyBub3RlIG1lbW9yeVx1MjAyNlwiIH0pO1xuXG5cdFx0XHR0aGlzLmN1cnJlbnRDYW5jZWxsYXRpb24gPSBuZXcgQ2FuY2VsbGF0aW9uU291cmNlKCk7XG5cdFx0XHR0aGlzLnNldEJ1c3kodHJ1ZSk7XG5cdFx0XHRjb25zdCB7IG9uUHJvZ3Jlc3MsIGZpbmlzaCB9ID0gdGhpcy5yZW5kZXJQcm9ncmVzc0xvZyhgQnVpbGRpbmcgbm90ZSBtZW1vcnkgZm9yIFwiJHtmaWxlLmJhc2VuYW1lfVwiYCk7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnBsdWdpbi5ub3RlTWVtb3J5U3RvcmUuZW5zdXJlKGZpbGUsIHRoaXMucGx1Z2luLmNsaWVudCwgdGhpcy5wbHVnaW4uc2V0dGluZ3MsIG9uUHJvZ3Jlc3MsIHRoaXMuY3VycmVudENhbmNlbGxhdGlvbi50b2tlbik7XG5cdFx0XHRcdGZpbmlzaChcIk5vdGUgbWVtb3J5IHJlYWR5LlwiKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRmaW5pc2goaXNDYW5jZWxsZWRFcnJvcihlcnIpID8gXCJDYW5jZWxsZWQuXCIgOiBgRXJyb3I6ICR7KGVyciBhcyBFcnJvcikubWVzc2FnZX1gKTtcblx0XHRcdFx0aWYgKCFpc0NhbmNlbGxlZEVycm9yKGVycikpIG5ldyBOb3RpY2UoYE5vdGUgbWVtb3J5IGJ1aWxkIGZhaWxlZDogJHsoZXJyIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0dGhpcy5jdXJyZW50Q2FuY2VsbGF0aW9uID0gbnVsbDtcblx0XHRcdFx0dGhpcy5zZXRCdXN5KGZhbHNlKTtcblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgdGhpcy5ydW5RdWVyeShxdWVyeSwgZmFsc2UsIG51bGwpO1xuXHRcdH0pO1xuXG5cdFx0c2tpcEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuYnVzeSkgcmV0dXJuO1xuXHRcdFx0ZGlzYWJsZUJvdGgoKTtcblx0XHRcdGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcIm9vYy1wZW5kaW5nLXJlc29sdmVkXCIsIHRleHQ6IFwiU2tpcHBlZCBcdTIwMTQgYW5zd2VyaW5nIHdpdGhvdXQgaXQuXCIgfSk7XG5cdFx0XHRhd2FpdCB0aGlzLnJ1blF1ZXJ5KHF1ZXJ5LCBmYWxzZSwgbnVsbCk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLnNjcm9sbFRvQm90dG9tKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJ1blF1ZXJ5KHRleHQ6IHN0cmluZywgd2FzQ2xhcmlmaWNhdGlvblJlcGx5OiBib29sZWFuLCBvcmlnaW5hbFF1ZXJ5Rm9yQ2xhcmlmaWNhdGlvbjogc3RyaW5nIHwgbnVsbCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuY3VycmVudENhbmNlbGxhdGlvbiA9IG5ldyBDYW5jZWxsYXRpb25Tb3VyY2UoKTtcblx0XHR0aGlzLnNldEJ1c3kodHJ1ZSk7XG5cblx0XHRjb25zdCBsb2FkaW5nQnViYmxlID0gdGhpcy5hcHBlbmRMb2FkaW5nQnViYmxlKCk7XG5cdFx0dGhpcy5zdGF0dXNFbC5zZXRUZXh0KFwiUm91dGluZyBtZW1vcmllcyBhbmQgdGhpbmtpbmcuLi5cIik7XG5cblx0XHR0cnkge1xuXHRcdFx0aWYgKHdhc0NsYXJpZmljYXRpb25SZXBseSkge1xuXHRcdFx0XHR0aGlzLmF3YWl0aW5nQ2xhcmlmaWNhdGlvbkZvciA9IG51bGw7XG5cblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wbHVnaW4ub3JjaGVzdHJhdG9yLnByb3ZpZGVDbGFyaWZpY2F0aW9uKFxuXHRcdFx0XHRcdG9yaWdpbmFsUXVlcnlGb3JDbGFyaWZpY2F0aW9uISxcblx0XHRcdFx0XHR0ZXh0LFxuXHRcdFx0XHRcdHRoaXMuaGlzdG9yeSxcblx0XHRcdFx0XHR0aGlzLnNlc3Npb24uaWQsXG5cdFx0XHRcdFx0dGhpcy5jdXJyZW50Q2FuY2VsbGF0aW9uLnRva2VuXG5cdFx0XHRcdCk7XG5cdFx0XHRcdGxvYWRpbmdCdWJibGUucmVtb3ZlKCk7XG5cdFx0XHRcdHRoaXMuYXBwZW5kTWVzc2FnZShcImFzc2lzdGFudFwiLCByZXN1bHQuYW5zd2VyKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5yZWNvcmRUdXJuKG9yaWdpbmFsUXVlcnlGb3JDbGFyaWZpY2F0aW9uISwgcmVzdWx0LmFuc3dlcik7XG5cblx0XHRcdFx0Y29uc3QgdXNlZE5hbWVzID0gcmVzdWx0LnVzZWRUb3BpY3MubWFwKChyKSA9PiByLnRvcGljLm5hbWUpLmpvaW4oXCIsIFwiKTtcblx0XHRcdFx0dGhpcy5zdGF0dXNFbC5zZXRUZXh0KHVzZWROYW1lcyA/IGBVc2VkIG1lbW9yaWVzOiAke3VzZWROYW1lc31gIDogXCJObyBtZW1vcmllcyB1c2VkXCIpO1xuXHRcdFx0XHR0aGlzLnJlbmRlclBlbmRpbmdFbnRyaWVzKHJlc3VsdC5wZW5kaW5nRW50cmllcyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5wbHVnaW4ub3JjaGVzdHJhdG9yLmhhbmRsZVF1ZXJ5KHRleHQsIHRoaXMuaGlzdG9yeSwge1xuXHRcdFx0XHRzZXNzaW9uSWQ6IHRoaXMuc2Vzc2lvbi5pZCxcblx0XHRcdFx0aW5jbHVkZUFjdGl2ZU5vdGU6IHRoaXMuaW5jbHVkZUFjdGl2ZU5vdGUsXG5cdFx0XHRcdHRva2VuOiB0aGlzLmN1cnJlbnRDYW5jZWxsYXRpb24udG9rZW4sXG5cdFx0XHR9KTtcblx0XHRcdGxvYWRpbmdCdWJibGUucmVtb3ZlKCk7XG5cdFx0XHR0aGlzLmFwcGVuZE1lc3NhZ2UoXCJhc3Npc3RhbnRcIiwgcmVzdWx0LmFuc3dlcik7XG5cblx0XHRcdGlmIChyZXN1bHQubmVlZHNDbGFyaWZpY2F0aW9uKSB7XG5cdFx0XHRcdHRoaXMuYXdhaXRpbmdDbGFyaWZpY2F0aW9uRm9yID0gdGV4dDtcblx0XHRcdFx0dGhpcy5zdGF0dXNFbC5zZXRUZXh0KFwiV2FpdGluZyBmb3IgYSBiaXQgbW9yZSBkZXRhaWwuLi5cIik7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgdGhpcy5yZWNvcmRUdXJuKHRleHQsIHJlc3VsdC5hbnN3ZXIpO1xuXG5cdFx0XHRpZiAocmVzdWx0Lm1lbW9yeUNvbW1pdHRlZCkge1xuXHRcdFx0XHR0aGlzLmFwcGVuZFN5c3RlbU5vdGUoYFx1MjcxMyBTYXZlZCB0byBtZW1vcnk6IFwiJHtyZXN1bHQubWVtb3J5Q29tbWl0dGVkLnRvcGljLm5hbWV9XCJgKTtcblx0XHRcdFx0dGhpcy5zdGF0dXNFbC5zZXRUZXh0KFwiTWVtb3J5IHNhdmVkLlwiKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB1c2VkTmFtZXMgPSByZXN1bHQudXNlZFRvcGljcy5tYXAoKHIpID0+IHIudG9waWMubmFtZSkuam9pbihcIiwgXCIpO1xuXHRcdFx0dGhpcy5zdGF0dXNFbC5zZXRUZXh0KHVzZWROYW1lcyA/IGBVc2VkIG1lbW9yaWVzOiAke3VzZWROYW1lc31gIDogXCJObyBtZW1vcmllcyB1c2VkXCIpO1xuXHRcdFx0aWYgKHJlc3VsdC5ub3RlTWVtb3J5VXNlZCkgdGhpcy5yZW5kZXJOb3RlTWVtb3J5SGludChyZXN1bHQubm90ZU1lbW9yeVVzZWQuZmlsZVBhdGgsIHJlc3VsdC5ub3RlTWVtb3J5VXNlZC5maWxlTmFtZSk7XG5cdFx0XHR0aGlzLnJlbmRlclBlbmRpbmdFbnRyaWVzKHJlc3VsdC5wZW5kaW5nRW50cmllcyk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRsb2FkaW5nQnViYmxlLnJlbW92ZSgpO1xuXHRcdFx0aWYgKGlzQ2FuY2VsbGVkRXJyb3IoZXJyKSkge1xuXHRcdFx0XHR0aGlzLmFwcGVuZFN5c3RlbU5vdGUoXCJDYW5jZWxsZWQuXCIpO1xuXHRcdFx0XHR0aGlzLnN0YXR1c0VsLnNldFRleHQoXCJDYW5jZWxsZWQuXCIpO1xuXHRcdFx0XHRpZiAod2FzQ2xhcmlmaWNhdGlvblJlcGx5KSB0aGlzLmF3YWl0aW5nQ2xhcmlmaWNhdGlvbkZvciA9IG9yaWdpbmFsUXVlcnlGb3JDbGFyaWZpY2F0aW9uO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5zdGF0dXNFbC5zZXRUZXh0KGBFcnJvcjogJHsoZXJyIGFzIEVycm9yKS5tZXNzYWdlfWApO1xuXHRcdFx0XHRuZXcgTm90aWNlKGBUaGUgTGlicmFyaXVtIGVycm9yOiAkeyhlcnIgYXMgRXJyb3IpLm1lc3NhZ2V9YCk7XG5cdFx0XHRcdGlmICh3YXNDbGFyaWZpY2F0aW9uUmVwbHkpIHRoaXMuYXdhaXRpbmdDbGFyaWZpY2F0aW9uRm9yID0gb3JpZ2luYWxRdWVyeUZvckNsYXJpZmljYXRpb247XG5cdFx0XHRcdHRoaXMucmVuZGVyUmV0cnkodGV4dCwgd2FzQ2xhcmlmaWNhdGlvblJlcGx5LCBvcmlnaW5hbFF1ZXJ5Rm9yQ2xhcmlmaWNhdGlvbik7XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuY3VycmVudENhbmNlbGxhdGlvbiA9IG51bGw7XG5cdFx0XHR0aGlzLnNldEJ1c3koZmFsc2UpO1xuXHRcdFx0dGhpcy5pbnB1dEVsLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFBQUEsbUJBQXFEOzs7QUNtRDlDLElBQU0sbUJBQStDO0FBQUEsRUFDM0QsZUFBZTtBQUFBLEVBQ2YsV0FBVztBQUFBLEVBQ1gsY0FBYztBQUFBLEVB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QW1CLEtBQUssTUFBTTtBQUNoRCxTQUFLLGlCQUFpQixLQUFLLGNBQWMsb0JBQW9CO0FBQzdELFNBQUssaUJBQWlCLHVCQUF1QixLQUFLLFVBQVU7QUFDNUQsU0FBSyxrQkFBa0IsS0FBSyxnQkFBZ0IscUJBQXFCO0FBQ2pFLFNBQUssa0JBQWtCLEtBQUssZUFBZSxxQkFBcUI7QUFBQSxFQUNqRTtBQUFBLEVBRUEsTUFBTSxpQkFBZ0M7QUFDckMsVUFBTSxPQUFtQjtBQUFBLE1BQ3hCLFVBQVUsS0FBSztBQUFBLE1BQ2YsUUFBUSxLQUFLO0FBQUEsTUFDYixZQUFZLEtBQUs7QUFBQSxNQUNqQixZQUFZLEtBQUs7QUFBQSxNQUNqQixjQUFjLEtBQUs7QUFBQSxNQUNuQixhQUFhLEtBQUs7QUFBQSxJQUNuQjtBQUNBLFVBQU0sS0FBSyxTQUFTLElBQUk7QUFBQSxFQUN6QjtBQUFBLEVBRUEsTUFBTSxlQUE4QjtBQUNuQyxTQUFLLE9BQU8sV0FBVyxLQUFLLFNBQVMsYUFBYTtBQUNsRCxTQUFLLGNBQWM7QUFDbkIsVUFBTSxLQUFLLGVBQWU7QUFBQSxFQUMzQjtBQUFBLEVBRUEsV0FBaUI7QUFBQSxFQUVqQjtBQUNEOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImxheWVyRmlsZU5hbWUiLCAicmVuZGVyTGF5ZXJGaWxlIiwgInJlbmRlck9yaWdpbmFsRmlsZSIsICJpbXBvcnRfb2JzaWRpYW4iLCAiZXh0cmFjdEpzb24iLCAibGF5ZXIiLCAiaW1wb3J0X29ic2lkaWFuIiwgImV4dHJhY3RKc29uIiwgImltcG9ydF9vYnNpZGlhbiIsICJyZXN1bHQiLCAidXNlZE5hbWVzIl0KfQo=
