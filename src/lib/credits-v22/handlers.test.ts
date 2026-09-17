import { describe, expect, it, vi } from "vitest";

import { createCreditAccountHandler } from "./handlers";

const summary = {
  credit_balance: 4,
  transactions: [{
    kind: "prospect_debit" as const,
    delta: -1 as const,
    balance_after: 4,
    created_at: "2026-09-17T00:00:00Z",
  }],
};

describe("GET /api/v2/credits", () => {
  it("returns only the authenticated account summary without caching", async () => {
    const getAccountSummary = vi.fn().mockResolvedValue(summary);
    const response = await createCreditAccountHandler({
      getCurrentUser: async () => ({ userId: "11111111-1111-4111-8111-111111111111" }),
      createRepository: () => ({ getAccountSummary }),
    })();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual(summary);
    expect(getAccountSummary).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111");
  });

  it("rejects an anonymous request before reading financial state", async () => {
    const getAccountSummary = vi.fn();
    const response = await createCreditAccountHandler({
      getCurrentUser: async () => null,
      createRepository: () => ({ getAccountSummary }),
    })();

    expect(response.status).toBe(401);
    expect(getAccountSummary).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });
});
