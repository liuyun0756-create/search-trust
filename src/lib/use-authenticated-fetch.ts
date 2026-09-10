"use client";

import { useCallback } from "react";

import { useAppAuth } from "@/lib/client-auth";

export type AuthenticatedFetch = typeof fetch;

export function useAuthenticatedFetch(): AuthenticatedFetch {
  const { getToken } = useAppAuth();

  return useCallback(async (input: RequestInfo | URL, init?: RequestInit) => {
    const requestUrl = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
      window.location.origin,
    );

    if (requestUrl.origin !== window.location.origin) {
      throw new Error("Authenticated requests must use the current site origin");
    }

    const token = await getToken();
    const headers = new Headers(init?.headers);
    if (token) headers.set("Authorization", `Bearer ${token}`);

    return fetch(input, { ...init, headers });
  }, [getToken]) as AuthenticatedFetch;
}
