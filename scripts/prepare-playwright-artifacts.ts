import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { prepareArtifactUpload } from "../src/lib/security-v22/artifact-scan";
import { configuredArtifactMarkers } from "./security-artifact-markers";

async function main() {
  loadEnvConfig(process.cwd());
  const result = await prepareArtifactUpload(
    path.resolve(process.cwd(), "output/playwright/test-results"),
    path.resolve(process.cwd(), "output/playwright/prepared"),
    configuredArtifactMarkers(),
  );
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch(() => {
  process.stdout.write(`${JSON.stringify({ ok: false, code: "ARTIFACT_PREPARATION_FAILED" })}\n`);
  process.exitCode = 1;
});
