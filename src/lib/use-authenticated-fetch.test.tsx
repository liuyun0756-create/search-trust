// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppAuthProvider } from "./client-auth";
import { E2E_IDENTITY } from "./e2e-v22/config";
import { useAuthenticatedFetch } from "./use-authenticated-fetch";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("useAuthenticatedFetch", () => {
  it("adds the local synthetic bearer only to same-origin requests", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_TEST_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_E2E_BASE_URL", "http://localhost:3000");
    const request = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", request);
    const { result } = renderHook(() => useAuthenticatedFetch(), { wrapper: AppAuthProvider });

    await result.current("/api/v2/cases");
    const headers = new Headers(request.mock.calls[0][1]?.headers);
    expect(headers.get("authorization")).toBe(`Bearer ${E2E_IDENTITY.bearerToken}`);

    await expect(result.current("https://example.com/private")).rejects.toThrow(
      "current site origin",
    );
    expect(request).toHaveBeenCalledOnce();
  });
});
