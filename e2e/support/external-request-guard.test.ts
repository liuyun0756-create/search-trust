import { describe, expect, it } from "vitest";

import { isAllowedE2ERequest } from "./external-request-guard";

const baseURL = "http://127.0.0.1:3100";

describe("E2E external request guard", () => {
  it.each([
    "http://127.0.0.1:3100/cases/new",
    "http://127.0.0.1:3100/api/v2/preflight",
    "about:blank",
    "data:text/plain,safe",
    "blob:http://127.0.0.1:3100/synthetic",
  ])("allows browser-internal or local application URL %s", (url) => {
    expect(isAllowedE2ERequest(url, baseURL)).toBe(true);
  });

  it.each([
    "https://project.supabase.co/rest/v1/cases",
    "https://service.up.railway.app/api/v2/analyze",
    "https://live.dodopayments.com/checkouts",
    "https://accounts.google.com/o/oauth2/v2/auth",
    "https://us.i.posthog.com/e/",
    "https://example.com/",
  ])("blocks external URL %s", (url) => {
    expect(isAllowedE2ERequest(url, baseURL)).toBe(false);
  });
});
