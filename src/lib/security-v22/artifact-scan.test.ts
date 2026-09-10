import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { scanArtifacts } from "./artifact-scan";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("security artifact scan", () => {
  it("reports a redacted finding without echoing the secret", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "searchtrust-security-"));
    directories.push(directory);
    const secret = "UNIQUE_SECURITY_SENTINEL_123456";
    await writeFile(path.join(directory, "bundle.js"), `window.value=${JSON.stringify(secret)}`);
    const result = await scanArtifacts(directory, [secret]);
    expect(result.ok).toBe(false);
    expect(result.findings).toEqual([{ file: "bundle.js", marker: "[REDACTED]" }]);
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("passes clean artifacts and ignores unsafe short markers", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "searchtrust-security-"));
    directories.push(directory);
    await writeFile(path.join(directory, "bundle.js"), "safe");
    await expect(scanArtifacts(directory, ["short", "long-secret-marker"]))
      .resolves.toMatchObject({ ok: true, filesScanned: 1, secretValuesChecked: 1 });
  });
});
