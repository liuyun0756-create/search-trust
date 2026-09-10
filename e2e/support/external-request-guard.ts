import type { Page, Request, Route } from "@playwright/test";

const SAFE_SCHEMES = new Set(["about:", "blob:", "data:"]);

export function isAllowedE2ERequest(rawUrl: string, baseURL: string): boolean {
  const requestUrl = new URL(rawUrl);
  if (SAFE_SCHEMES.has(requestUrl.protocol)) return true;
  return requestUrl.origin === new URL(baseURL).origin;
}

export type ExternalRequestGuard = {
  blockedOrigins: ReadonlySet<string>;
  assertClean(): void;
};

export async function installExternalRequestGuard(
  page: Page,
  baseURL: string,
): Promise<ExternalRequestGuard> {
  const blockedOrigins = new Set<string>();

  await page.route("**/*", async (route: Route, request: Request) => {
    if (isAllowedE2ERequest(request.url(), baseURL)) {
      await route.continue();
      return;
    }

    blockedOrigins.add(new URL(request.url()).origin);
    await route.abort("blockedbyclient");
  });

  return {
    blockedOrigins,
    assertClean() {
      if (blockedOrigins.size > 0) {
        throw new Error("The browser attempted a forbidden external request.");
      }
    },
  };
}
