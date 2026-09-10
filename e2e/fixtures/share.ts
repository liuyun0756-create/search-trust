import { E2E_IDS } from "./ids";
import { E2E_NOW } from "./preflight";
import { prospectReportFixture } from "./report";

export const E2E_SHARE_TOKEN = "searchtrust_e2e_share_token_000000000000000";

export const activeShareFixture = {
  id: E2E_IDS.shareId,
  created_at: E2E_NOW,
  expires_at: "2026-10-10T08:00:00.000Z",
  revoked_at: null,
} as const;

export const createdShareFixture = {
  id: E2E_IDS.shareId,
  expiresAt: activeShareFixture.expires_at,
  url: `http://127.0.0.1:3100/share#${E2E_SHARE_TOKEN}`,
} as const;

export const resolvedShareFixture = {
  report: prospectReportFixture,
  share: activeShareFixture,
} as const;

export const revokedShareFixture = { error: "Report share was not found." } as const;
