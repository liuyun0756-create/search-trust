import type { BrowserContext, Request, Route, WebSocketRoute } from "@playwright/test";

const SAFE_SCHEMES = new Set(["about:", "blob:", "data:"]);

export function isAllowedE2ERequest(rawUrl: string, baseURL: string): boolean {
  const requestUrl = new URL(rawUrl);
  if (SAFE_SCHEMES.has(requestUrl.protocol)) return true;
  const base = new URL(baseURL);
  if (requestUrl.protocol === "ws:" || requestUrl.protocol === "wss:") {
    return requestUrl.hostname === base.hostname && requestUrl.port === base.port;
  }
  return requestUrl.origin === base.origin;
}

export type ExternalAttempt = Readonly<{
  transport: "http" | "websocket";
  url: string;
  resourceType: string;
}>;

export type ExternalRequestGuard = {
  attempts: readonly ExternalAttempt[];
  blockedOrigins: ReadonlySet<string>;
  assertClean(): void;
};

export async function installExternalRequestGuard(
  context: BrowserContext,
  baseURL: string,
): Promise<ExternalRequestGuard> {
  const blockedOrigins = new Set<string>();
  const attempts: ExternalAttempt[] = [];
  const attemptKeys = new Set<string>();

  const record = (transport: ExternalAttempt["transport"], rawUrl: string, resourceType: string) => {
    const key = `${transport}:${rawUrl}`;
    if (attemptKeys.has(key)) return;
    attemptKeys.add(key);
    attempts.push(Object.freeze({ transport, url: rawUrl, resourceType }));
    blockedOrigins.add(new URL(rawUrl).origin);
  };

  const auditRequest = (request: Request) => {
    if (!isAllowedE2ERequest(request.url(), baseURL)) {
      record("http", request.url(), request.resourceType());
    }
  };
  context.on("request", auditRequest);

  await context.routeWebSocket(
    (url) => !isAllowedE2ERequest(url.toString(), baseURL),
    async (webSocket: WebSocketRoute) => {
      record("websocket", webSocket.url(), "websocket");
      await webSocket.close({ code: 1008, reason: "External WebSocket blocked by offline E2E guard." });
    },
  );

  await context.route("**/*", async (route: Route, request: Request) => {
    if (isAllowedE2ERequest(request.url(), baseURL)) {
      await route.fallback();
      return;
    }

    record("http", request.url(), request.resourceType());
    await route.abort("blockedbyclient");
  });

  return {
    attempts,
    blockedOrigins,
    assertClean() {
      if (attempts.length > 0) {
        const summary = attempts.map((attempt) => `${attempt.transport}:${attempt.url}`).join(", ");
        throw new Error(`The browser attempted a forbidden external HTTP/WebSocket request: ${summary}`);
      }
    },
  };
}
