import { NextResponse } from "next/server";

import { resolveLocalE2ETestMode } from "@/lib/e2e-v22/config";

export const V22_PUBLIC_ENTRY_PAUSED = Object.freeze({
  error: Object.freeze({
    code: "V22_PUBLIC_ENTRY_PAUSED",
    message: "New report intake is temporarily paused. Existing Cases and reports remain available.",
  }),
});

type PublicEntryEnvironment = {
  V22_PUBLIC_ENTRY_ENABLED?: string;
  NEXT_PUBLIC_E2E_TEST_MODE?: string;
  NEXT_PUBLIC_E2E_BASE_URL?: string;
  VERCEL_ENV?: string;
};

export function resolveV22PublicEntryEnabled(environment: PublicEntryEnvironment): boolean {
  if (environment.V22_PUBLIC_ENTRY_ENABLED !== undefined) {
    return environment.V22_PUBLIC_ENTRY_ENABLED === "true";
  }
  return resolveLocalE2ETestMode(environment);
}

export function isV22PublicEntryEnabled(): boolean {
  return resolveV22PublicEntryEnabled({
    V22_PUBLIC_ENTRY_ENABLED: process.env.V22_PUBLIC_ENTRY_ENABLED,
    NEXT_PUBLIC_E2E_TEST_MODE: process.env.NEXT_PUBLIC_E2E_TEST_MODE,
    NEXT_PUBLIC_E2E_BASE_URL: process.env.NEXT_PUBLIC_E2E_BASE_URL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}

export function v22PublicEntryPausedResponse(): NextResponse {
  return NextResponse.json(V22_PUBLIC_ENTRY_PAUSED, {
    status: 503,
    headers: {
      "cache-control": "no-store",
      "retry-after": "300",
    },
  });
}

export function requireV22PublicEntry<Arguments extends unknown[]>(
  handler: (...args: Arguments) => Promise<Response>,
) {
  return async (...args: Arguments): Promise<Response> => {
    if (!isV22PublicEntryEnabled()) return v22PublicEntryPausedResponse();
    return handler(...args);
  };
}
