import { createHash, randomBytes } from "node:crypto";

export const REPORT_SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createReportShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashReportShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isReportShareToken(token: string): boolean {
  return REPORT_SHARE_TOKEN_PATTERN.test(token);
}

export function buildReportShareUrl(origin: string, token: string): string {
  if (!isReportShareToken(token)) throw new Error("Cannot build a URL for an invalid share token.");
  const url = new URL("/share", origin);
  url.hash = token;
  return url.toString();
}
