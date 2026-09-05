import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const GOOGLE_BROKER_SIGNATURE_VERSION = "v1";

export interface GoogleBrokerSignatureInput {
  timestamp: number;
  requestId: string;
  nonce: string;
  body: string;
  version?: string;
}

function canonical(input: GoogleBrokerSignatureInput): string {
  return `${input.version ?? GOOGLE_BROKER_SIGNATURE_VERSION}.${input.timestamp}.${input.requestId}.${input.nonce}.${input.body}`;
}

export function signGoogleBrokerBody(secret: string, input: GoogleBrokerSignatureInput): string {
  return `sha256=${createHmac("sha256", secret).update(canonical(input), "utf8").digest("hex")}`;
}

export function digestGoogleBrokerNonce(nonce: string): string {
  return createHash("sha256").update(nonce, "utf8").digest("base64");
}

export function verifyGoogleBrokerSignature(input: {
  secret: string;
  timestamp: string;
  requestId: string;
  nonce: string;
  body: string;
  version: string;
  signature: string;
  nowSeconds: number;
  allowedClockSkewSeconds: number;
}): boolean {
  if (!input.secret || input.version !== GOOGLE_BROKER_SIGNATURE_VERSION) return false;
  if (!/^\d{1,12}$/.test(input.timestamp)) return false;
  const timestamp = Number(input.timestamp);
  if (!Number.isSafeInteger(timestamp) || Math.abs(input.nowSeconds - timestamp) > input.allowedClockSkewSeconds) {
    return false;
  }
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(input.requestId)) return false;
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(input.nonce)) return false;
  if (!/^sha256=[a-f0-9]{64}$/.test(input.signature)) return false;
  const expected = signGoogleBrokerBody(input.secret, {
    timestamp,
    requestId: input.requestId,
    nonce: input.nonce,
    body: input.body,
    version: input.version,
  });
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(input.signature, "utf8");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}
