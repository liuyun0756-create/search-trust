import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { scanArtifacts } from "../src/lib/security-v22/artifact-scan";
import { configuredArtifactMarkers } from "./security-artifact-markers";

async function main() {
  loadEnvConfig(process.cwd());
  const markers = configuredArtifactMarkers();
  const roots = [
    path.resolve(process.cwd(), ".next/static"),
    path.resolve(process.cwd(), "output/playwright/test-results"),
  ];
  const results = await Promise.all(roots.map((root) => scanArtifacts(root, markers)));
  const result = {
    ok: results.every((entry) => entry.ok),
    filesScanned: results.reduce((sum, entry) => sum + entry.filesScanned, 0),
    secretValuesChecked: markers.length,
    findings: results.flatMap((entry, rootIndex) => entry.findings.map((finding) => ({
      file: `${rootIndex === 0 ? "static" : "browser"}/${finding.file}`,
      marker: finding.marker,
    }))),
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.ok) process.exitCode = 2;
}

main().catch(() => {
  process.stdout.write(`${JSON.stringify({ ok: false, code: "SECURITY_SCAN_FAILED" })}\n`);
  process.exitCode = 1;
});
