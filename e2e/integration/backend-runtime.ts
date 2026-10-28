import { existsSync } from "node:fs";
import path from "node:path";

/** Only the isolated integration harness uses this checkout; no application env is loaded. */
export function backendRuntime(script: string) {
  const root = path.resolve(process.env.SEARCHTRUST_TEST_BACKEND_ROOT || "../SearchTrust-RD");
  const python = path.join(root, ".venv/bin/python");
  if (!existsSync(python) || !existsSync(path.join(root, script))) {
    throw new Error("Backend integration runtime is missing. Prepare the pinned backend checkout and its test virtual environment; set SEARCHTRUST_TEST_BACKEND_ROOT when it is not a sibling checkout.");
  }
  return { root, python };
}
