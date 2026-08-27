import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { signCallbackBody, verifyCallbackSignature } from "./callback-signature";

describe("v2.2 job callback signatures", () => {
  it("matches the shared Python signature fixture", async () => {
    const fixture = JSON.parse(await readFile(
      path.resolve(process.cwd(), "src/lib/jobs-v22/fixtures/v22_job_callback_signature.json"),
      "utf8",
    ));

    expect(signCallbackBody(fixture.secret, fixture.timestamp, fixture.body, fixture.version))
      .toBe(fixture.signature);
    expect(verifyCallbackSignature({
      secret: fixture.secret,
      timestamp: String(fixture.timestamp),
      body: fixture.body,
      version: fixture.version,
      signature: fixture.signature,
      nowSeconds: fixture.timestamp,
      allowedClockSkewSeconds: 300,
    })).toBe(true);
  });

  it("rejects bad signatures, unsupported versions, and stale timestamps", () => {
    const input = {
      secret: "secret",
      timestamp: "1000",
      body: "{}",
      version: "v1",
      signature: signCallbackBody("secret", 1000, "{}", "v1"),
      nowSeconds: 1000,
      allowedClockSkewSeconds: 300,
    };

    expect(verifyCallbackSignature({ ...input, signature: `sha256:${"0".repeat(64)}` })).toBe(false);
    expect(verifyCallbackSignature({ ...input, version: "v2" })).toBe(false);
    expect(verifyCallbackSignature({ ...input, nowSeconds: 1301 })).toBe(false);
  });
});

