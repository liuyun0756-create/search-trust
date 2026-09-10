import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";

import { prepareArtifactUpload, scanArtifacts } from "./artifact-scan";

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

  it("opens trace archives and accepts a clean trace", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "searchtrust-security-"));
    directories.push(directory);
    await writeFile(path.join(directory, "trace.zip"), zipSync({
      "trace.trace": strToU8('{"event":"page loaded","url":"http://127.0.0.1:3100/cases/new"}'),
    }));
    await expect(scanArtifacts(directory, [])).resolves.toMatchObject({ ok: true, filesScanned: 1 });
  });

  it.each([
    "Authorization: Bearer secret-test-token",
    "https://example.invalid/callback?code=oauth-code-value",
    `https://example.invalid/share#${"a".repeat(43)}`,
    '"refresh_token":"refresh-token-value"',
  ])("rejects a credential-shaped browser artifact without echoing it", async (sensitive) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "searchtrust-security-"));
    directories.push(directory);
    await writeFile(path.join(directory, "trace.zip"), zipSync({ "trace.trace": strToU8(sensitive) }));
    const result = await scanArtifacts(directory, []);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(sensitive);
  });

  it("copies only safe final-failure artifacts into the upload directory", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "searchtrust-security-"));
    const prepared = await mkdtemp(path.join(os.tmpdir(), "searchtrust-prepared-"));
    directories.push(directory, prepared);
    await writeFile(path.join(directory, "safe.png"), Buffer.from("safe screenshot"));
    await writeFile(path.join(directory, "unsafe.trace"), "Authorization: Bearer private-test-token");

    const result = await prepareArtifactUpload(directory, prepared, []);
    expect(result).toMatchObject({ ok: false, filesScanned: 2, filesCopied: 1 });
    await expect(access(path.join(prepared, "safe.png"))).resolves.toBeUndefined();
    await expect(access(path.join(prepared, "unsafe.trace"))).rejects.toThrow();
  });
});
