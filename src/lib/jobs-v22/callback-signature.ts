import { createHmac, timingSafeEqual } from "node:crypto";

export const CALLBACK_SIGNATURE_VERSION = "v1";

export function signCallbackBody(
  secret: string,
  timestamp: number,
  body: string,
  version = CALLBACK_SIGNATURE_VERSION,
) {
  const digest = createHmac("sha256", secret)
    .update(`${version}.${timestamp}.`, "utf8")
    .update(body, "utf8")
    .digest("hex");
  return `sha256=${digest}`;
}

export function verifyCallbackSignature(input: {
  secret: string;
  timestamp: string;
  body: string;
  version: string;
  signature: string;
  nowSeconds: number;
  allowedClockSkewSeconds: number;
}) {
  if (!input.secret || input.version !== CALLBACK_SIGNATURE_VERSION) return false;
  if (!/^\d{1,12}$/.test(input.timestamp)) return false;
  const timestamp = Number(input.timestamp);
  if (!Number.isSafeInteger(timestamp)) return false;
  if (Math.abs(input.nowSeconds - timestamp) > input.allowedClockSkewSeconds) return false;
  if (!/^sha256=[a-f0-9]{64}$/.test(input.signature)) return false;

  const expected = signCallbackBody(input.secret, timestamp, input.body, input.version);
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(input.signature, "utf8");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

