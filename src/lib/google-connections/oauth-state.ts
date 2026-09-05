import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

type RandomBytes = (size: number) => Buffer;

function base64url(value: Buffer): string {
  return value.toString("base64url");
}

export function createOAuthState(random: RandomBytes = randomBytes): string {
  return base64url(random(32));
}

export function digestOAuthState(state: string): Buffer {
  return createHash("sha256").update(state, "utf8").digest();
}

export function createPkce(random: RandomBytes = randomBytes): { verifier: string; challenge: string } {
  const verifier = base64url(random(32));
  const challenge = base64url(createHash("sha256").update(verifier, "ascii").digest());
  return { verifier, challenge };
}

function bindingDigest(secret: string, sessionId: string, stateDigest: Buffer): Buffer {
  return createHmac("sha256", secret)
    .update("searchtrust.google-oauth-cookie.v1\0", "utf8")
    .update(sessionId, "utf8")
    .update("\0", "utf8")
    .update(stateDigest)
    .digest();
}

export function createOAuthCookieBinding(
  secret: string,
  sessionId: string,
  stateDigest: Buffer,
): string {
  return `${sessionId}.${base64url(bindingDigest(secret, sessionId, stateDigest))}`;
}

export function verifyOAuthCookieBinding(
  secret: string,
  cookie: string,
  sessionId: string,
  stateDigest: Buffer,
): boolean {
  const separator = cookie.indexOf(".");
  if (separator <= 0 || cookie.slice(0, separator) !== sessionId) return false;
  const suppliedText = cookie.slice(separator + 1);
  if (!/^[A-Za-z0-9_-]{43}$/.test(suppliedText)) return false;
  const supplied = Buffer.from(suppliedText, "base64url");
  const expected = bindingDigest(secret, sessionId, stateDigest);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
