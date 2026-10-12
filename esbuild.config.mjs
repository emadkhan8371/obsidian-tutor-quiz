import esbuild from "esbuild";
await esbuild.build({
  entryPoints: ["main.ts"], bundle: true, outfile: "main.js",
  format: "cjs", platform: "browser", target: "es2018",
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*"],
  logLevel: "info", sourcemap: false, treeShaking: true,
});
