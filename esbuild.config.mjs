import esbuild from "esbuild";
import process from "process";
import { builtinModules as builtins } from "node:module";

// Static banner — no timestamp. A timestamp here makes every build
// byte-different even from identical source/dependencies, which breaks
// reproducible-build verification (e.g. Obsidian's release-asset check).
const banner = `/* The Librarium (Ollama Orchestrator) */`;

const prod = process.argv[2] === "production";

const ctx = await esbuild.context({
	banner: { js: banner },
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: [
		"obsidian",
		"electron",
		"@codemirror/autocomplete",
		"@codemirror/collab",
		"@codemirror/commands",
		"@codemirror/language",
		"@codemirror/lint",
		"@codemirror/search",
		"@codemirror/state",
		"@codemirror/view",
		"@lezer/common",
		"@lezer/highlight",
		"@lezer/lr",
		...builtins,
	],
	format: "cjs",
	target: "es2020",
	logLevel: "info",
	sourcemap: prod ? false : "inline",
	treeShaking: true,
	outfile: "main.js",
	minify: prod,
});

if (prod) {
	await ctx.rebuild();
	process.exit(0);
} else {
	await ctx.watch();
}
