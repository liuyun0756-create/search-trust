import { createHash, randomBytes } from "node:crypto";

import { isReportShareToken } from "./token-format";

export { buildReportShareUrl, isReportShareToken, REPORT_SHARE_TOKEN_PATTERN } from "./token-format";

export function createReportShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashReportShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
