import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  digestGoogleBrokerNonce,
  signGoogleBrokerBody,
  verifyGoogleBrokerSignature,
} from "./broker-signature";

const input = {
  timestamp: 1_788_611_200,
  requestId: "request-11111111-1111-4111-8111-111111111111",
  nonce: "0123456789abcdef0123456789abcdef",
  body: '{"connection_id":"22222222-2222-4222-8222-222222222222","source":"ga4","purpose":"source_sync"}',
  version: "v1",
};

describe("Google token broker signatures", () => {
  it("matches the shared Python signature fixture", async () => {
    const fixture = JSON.parse(await readFile(path.resolve(
      process.cwd(),
      "src/lib/google-connections/fixtures/google_token_broker_signature.json",
    ), "utf8"));
    expect(signGoogleBrokerBody(fixture.secret, {
      timestamp: fixture.timestamp,
      requestId: fixture.request_id,
      nonce: fixture.nonce,
      body: fixture.body,
      version: fixture.version,
    })).toBe(fixture.signature);
  });

  it("signs every replay-sensitive field", () => {
    const secret = "broker-secret".repeat(4);
    const signature = signGoogleBrokerBody(secret, input);
    expect(verifyGoogleBrokerSignature({
      secret,
      timestamp: String(input.timestamp),
      requestId: input.requestId,
      nonce: input.nonce,
      body: input.body,
      version: input.version,
      signature,
      nowSeconds: input.timestamp,
      allowedClockSkewSeconds: 60,
    })).toBe(true);

    for (const changed of [
      { body: "{}" },
      { requestId: "request-other" },
      { nonce: "fedcba9876543210fedcba9876543210" },
      { timestamp: input.timestamp + 1 },
    ]) {
      const candidate = { ...input, ...changed };
      expect(verifyGoogleBrokerSignature({
        secret,
        timestamp: String(candidate.timestamp),
        requestId: candidate.requestId,
        nonce: candidate.nonce,
        body: candidate.body,
        version: candidate.version,
        signature,
        nowSeconds: candidate.timestamp,
        allowedClockSkewSeconds: 60,
      })).toBe(false);
    }
  });

  it("rejects stale, malformed, and unsupported requests", () => {
    const secret = "broker-secret".repeat(4);
    const signature = signGoogleBrokerBody(secret, input);
    const base = {
      secret,
      timestamp: String(input.timestamp),
      requestId: input.requestId,
      nonce: input.nonce,
      body: input.body,
      version: input.version,
      signature,
      nowSeconds: input.timestamp,
      allowedClockSkewSeconds: 60,
    };
    expect(verifyGoogleBrokerSignature({ ...base, nowSeconds: input.timestamp + 61 })).toBe(false);
    expect(verifyGoogleBrokerSignature({ ...base, timestamp: "not-time" })).toBe(false);
    expect(verifyGoogleBrokerSignature({ ...base, requestId: "spaces are invalid" })).toBe(false);
    expect(verifyGoogleBrokerSignature({ ...base, nonce: "short" })).toBe(false);
    expect(verifyGoogleBrokerSignature({ ...base, version: "v2" })).toBe(false);
    expect(verifyGoogleBrokerSignature({ ...base, signature: "sha256=bad" })).toBe(false);
  });

  it("creates a fixed-length digest without preserving the nonce", () => {
    const digest = digestGoogleBrokerNonce(input.nonce);
    expect(Buffer.from(digest, "base64")).toHaveLength(32);
    expect(digest).not.toContain(input.nonce);
  });
});
