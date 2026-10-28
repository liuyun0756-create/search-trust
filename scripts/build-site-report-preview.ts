/** Standalone artifact, never a public route. All assets bundled locally. */
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

async function main() {
const root = path.resolve(import.meta.dirname, "..");
execFileSync(path.join(root, "node_modules/.bin/tsx"), ["scripts/export-site-report-candidates.ts", "--check"], { cwd: root, stdio: "inherit" });
const result = await build({
  absWorkingDir: root, bundle: true, write: false, minify: true, format: "iife", platform: "browser",
  jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' },
  stdin: { resolveDir: root, loader: "tsx", contents: `
    import React from "react";
    import {createRoot} from "react-dom/client";
    import {ReleaseReportPreview} from "./src/components/sampleReport/ReleaseReportPreview";
    import data from "./src/lib/site-report-candidates/generated/reports.json";
    createRoot(document.getElementById("preview")).render(<ReleaseReportPreview {...data}/>);
  ` },
});
const css = await postcss([tailwind({ base: root })]).process(
  '@import "tailwindcss" source(none);\n@source "../src/components/report/CapabilityReportDocument.tsx";\n' +
  readFileSync(path.join(root, "src/components/sampleReport/release-report-preview.css"), "utf8"),
  { from: path.join(root, "scripts/site-preview.css") },
);
const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SearchTrust · Report release review</title><style>body{margin:0;background:#f7faf6}' + css.css.replace(/<\/style/gi, "<\\/style") +
  '</style></head><body><div id="preview"></div><script>' + result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script") + '</script></body></html>';
const out = path.join(root, "output/site-report-preview");
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "index.html"), html);
console.log(JSON.stringify({ ok: true, artifact: path.join(out, "index.html"), bytes: Buffer.byteLength(html) }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
