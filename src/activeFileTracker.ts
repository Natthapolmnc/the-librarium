import { App, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";

/**
 * `workspace.getActiveFile()` reflects whichever leaf is currently active —
 * and the moment the user clicks into this plugin's own chat panel (to type
 * a question, or just to scroll), THAT leaf becomes active. Since the chat
 * panel isn't a file-backed view, `getActiveFile()` then returns null, even
 * though from the user's perspective "the note I have open" hasn't changed
 * at all. Left unhandled, this silently skips "reading page" mode and
 * note-memory auto-init on exactly the turn where the user just switched
 * focus into chat to ask about their note — which in practice is most
 * first-time asks.
 *
 * This tracks the last file that was ACTUALLY shown in a real markdown
 * view, and keeps reporting it as "the active note" until a *different*
 * markdown view genuinely takes over — regardless of whatever else gets
 * focused in between (like the chat input).
 */
export class ActiveFileTracker {
	private lastFile: TFile | null = null;

	constructor(private app: App) {
		this.lastFile = app.workspace.getActiveViewOfType(MarkdownView)?.file ?? null;
	}

	/** Wire this to `workspace.on("active-leaf-change", ...)` in onload(). */
	handleActiveLeafChange(leaf: WorkspaceLeaf | null): void {
		if (leaf?.view instanceof MarkdownView && leaf.view.file) {
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
	getFile(): TFile | null {
		const active = this.app.workspace.getActiveFile();
		if (active) return active;
		if (this.lastFile && this.app.vault.getAbstractFileByPath(this.lastFile.path) === this.lastFile) {
			return this.lastFile;
		}
		return null;
	}
}
