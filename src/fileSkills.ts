import { App, TFile, normalizePath } from "obsidian";
import { ActiveFileTracker } from "./activeFileTracker";

/** Thin wrapper around Obsidian's vault API, exposed as "skills" the orchestrator can call. */
export class FileSkills {
	constructor(
		private app: App,
		private activeFileTracker?: ActiveFileTracker
	) {}

	async readFile(path: string): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(normalizePath(path));
		if (!(file instanceof TFile)) throw new Error(`Not a file: ${path}`);
		return this.app.vault.read(file);
	}

	async writeFile(path: string, content: string): Promise<void> {
		const normalized = normalizePath(path);
		const existing = this.app.vault.getAbstractFileByPath(normalized);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, content);
		} else {
			await this.app.vault.create(normalized, content);
		}
	}

	async appendToFile(path: string, content: string): Promise<void> {
		const normalized = normalizePath(path);
		const existing = this.app.vault.getAbstractFileByPath(normalized);
		if (existing instanceof TFile) {
			await this.app.vault.append(existing, content);
		} else {
			await this.app.vault.create(normalized, content);
		}
	}

	async listMarkdownFiles(folder?: string): Promise<TFile[]> {
		const all = this.app.vault.getMarkdownFiles();
		if (!folder) return all;
		const prefix = normalizePath(folder) + "/";
		return all.filter((f) => f.path.startsWith(prefix));
	}

	getActiveFile(): TFile | null {
		// Prefer the tracker (survives focus moving into the chat panel);
		// fall back to Obsidian's own accessor if no tracker was wired up.
		return this.activeFileTracker?.getFile() ?? this.app.workspace.getActiveFile();
	}
}
