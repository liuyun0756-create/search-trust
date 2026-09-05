import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { GoogleConnectionError } from "./errors";

export interface SecretContext {
  recordType: "connection" | "oauth_session";
  userId: string;
  recordId: string;
  secretKind: "access_token" | "refresh_token" | "pkce_verifier";
}

export interface EncryptedSecret {
  keyVersion: string;
  ciphertext: string;
  iv: string;
  authTag: string;
}

function configurationError(): GoogleConnectionError {
  return new GoogleConnectionError("GOOGLE_OAUTH_NOT_CONFIGURED", { status: 503 });
}

function decryptionError(): GoogleConnectionError {
  return new GoogleConnectionError("GOOGLE_TOKEN_DECRYPTION_FAILED", { status: 409 });
}

function decodeBase64(value: string, expectedLength?: number): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) throw decryptionError();
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || (expectedLength !== undefined && bytes.length !== expectedLength)) {
    throw decryptionError();
  }
  return bytes;
}

function aad(context: SecretContext, keyVersion: string): Buffer {
  return Buffer.from(JSON.stringify([
    "searchtrust.google-secret.v1",
    context.recordType,
    context.userId,
    context.recordId,
    context.secretKind,
    keyVersion,
  ]), "utf8");
}

export class TokenVault {
  private constructor(
    private readonly activeVersion: string,
    private readonly keys: ReadonlyMap<string, Buffer>,
  ) {}

  static fromBase64Keys(activeVersion: string, base64Keys: Readonly<Record<string, string>>): TokenVault {
    try {
      if (!activeVersion.trim() || !Object.prototype.hasOwnProperty.call(base64Keys, activeVersion)) {
        throw configurationError();
      }
      const keys = new Map<string, Buffer>();
      for (const [version, encoded] of Object.entries(base64Keys)) {
        if (!version.trim() || typeof encoded !== "string") throw configurationError();
        let key: Buffer;
        try {
          key = decodeBase64(encoded, 32);
        } catch {
          throw configurationError();
        }
        keys.set(version, key);
      }
      return new TokenVault(activeVersion, keys);
    } catch (error) {
      if (error instanceof GoogleConnectionError) throw error;
      throw configurationError();
    }
  }

  encrypt(plaintext: string, context: SecretContext): EncryptedSecret {
    if (!plaintext) throw decryptionError();
    const key = this.keys.get(this.activeVersion);
    if (!key) throw configurationError();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(aad(context, this.activeVersion));
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      keyVersion: this.activeVersion,
      ciphertext: ciphertext.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
    };
  }

  decrypt(encrypted: EncryptedSecret, context: SecretContext): string {
    try {
      const key = this.keys.get(encrypted.keyVersion);
      if (!key) throw decryptionError();
      const ciphertext = decodeBase64(encrypted.ciphertext);
      const iv = decodeBase64(encrypted.iv, 12);
      const authTag = decodeBase64(encrypted.authTag, 16);
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAAD(aad(context, encrypted.keyVersion));
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      throw decryptionError();
    }
  }
}
