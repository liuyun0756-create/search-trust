import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import type { CreditRepository } from "./repository";

interface Dependencies {
  getCurrentUser(): Promise<{ userId: string } | null>;
  createRepository(): CreditRepository;
}

export function createCreditAccountHandler(dependencies: Dependencies) {
  return async function GET() {
    const requestId = randomUUID();
    const user = await dependencies.getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in to view credits." } }, {
        status: 401,
        headers: { "x-request-id": requestId, "cache-control": "no-store" },
      });
    }
    try {
      const summary = await dependencies.createRepository().getAccountSummary(user.userId);
      return NextResponse.json(summary, {
        headers: { "x-request-id": requestId, "cache-control": "private, no-store" },
      });
    } catch (error) {
      console.error("Credit account request failed", {
        route: "GET /api/v2/credits",
        request_id: requestId,
        error_type: error instanceof Error ? error.name : "UnknownError",
      });
      return NextResponse.json({ error: { code: "CREDIT_ACCOUNT_UNAVAILABLE", message: "Credits could not be loaded yet." } }, {
        status: 503,
        headers: { "x-request-id": requestId, "cache-control": "no-store" },
      });
    }
  };
}
