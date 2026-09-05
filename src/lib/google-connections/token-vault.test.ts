import { describe, expect, it } from "vitest";

import { GoogleConnectionError } from "./errors";
import { TokenVault, type SecretContext } from "./token-vault";

const keyV1 = Buffer.alloc(32, 1).toString("base64");
const keyV2 = Buffer.alloc(32, 2).toString("base64");
const context: SecretContext = {
  recordType: "connection",
  userId: "11111111-1111-4111-8111-111111111111",
  recordId: "22222222-2222-4222-8222-222222222222",
  secretKind: "refresh_token",
};

describe("Google token vault", () => {
  it("round trips AES-256-GCM without deterministic ciphertext", () => {
    const vault = TokenVault.fromBase64Keys("v2", { v1: keyV1, v2: keyV2 });
    const first = vault.encrypt("refresh-secret", context);
    const second = vault.encrypt("refresh-secret", context);

    expect(first.keyVersion).toBe("v2");
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(vault.decrypt(first, context)).toBe("refresh-secret");
  });

  it("reads historical keys while writing only the active version", () => {
    const oldVault = TokenVault.fromBase64Keys("v1", { v1: keyV1 });
    const oldCiphertext = oldVault.encrypt("old-token", context);
    const rotatedVault = TokenVault.fromBase64Keys("v2", { v1: keyV1, v2: keyV2 });

    expect(rotatedVault.decrypt(oldCiphertext, context)).toBe("old-token");
    expect(rotatedVault.encrypt("new-token", context).keyVersion).toBe("v2");
  });

  it("rejects context substitution, auth tag changes, and unknown key versions safely", () => {
    const vault = TokenVault.fromBase64Keys("v1", { v1: keyV1 });
    const encrypted = vault.encrypt("secret", context);
    const cases = [
      () => vault.decrypt(encrypted, { ...context, userId: "other-user" }),
      () => vault.decrypt({ ...encrypted, authTag: Buffer.alloc(16, 9).toString("base64") }, context),
      () => vault.decrypt({ ...encrypted, keyVersion: "missing" }, context),
    ];
    for (const run of cases) {
      expect(run).toThrowError(GoogleConnectionError);
      try { run(); } catch (error) {
        expect((error as GoogleConnectionError).code).toBe("GOOGLE_TOKEN_DECRYPTION_FAILED");
        expect((error as Error).message).not.toContain("secret");
      }
    }
  });

  it("rejects non-256-bit keys and malformed encrypted values", () => {
    expect(() => TokenVault.fromBase64Keys("bad", { bad: Buffer.alloc(31).toString("base64") }))
      .toThrowError(GoogleConnectionError);
    const vault = TokenVault.fromBase64Keys("v1", { v1: keyV1 });
    expect(() => vault.decrypt({
      keyVersion: "v1",
      ciphertext: "not-base64!",
      iv: "bad",
      authTag: "bad",
    }, context)).toThrowError(GoogleConnectionError);
  });
});
