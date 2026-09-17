import { describe, expect, it } from "vitest";

import { parseCreditAccountSummary } from "./contracts";

describe("unified credit contracts", () => {
  it("accepts a bounded private balance summary", () => {
    expect(parseCreditAccountSummary({
      credit_balance: 5,
      transactions: [{
        kind: "welcome_grant",
        delta: 5,
        balance_after: 5,
        created_at: "2026-09-17T00:00:00Z",
      }],
    })).not.toBeNull();
  });

  it.each([
    null,
    { credit_balance: -1, transactions: [] },
    { credit_balance: 1.5, transactions: [] },
    { credit_balance: 1, transactions: [{ kind: "legacy_credit", delta: 1, balance_after: 1, created_at: "2026-09-17T00:00:00Z" }] },
    { credit_balance: 1, transactions: [{ kind: "credit_purchase", delta: 2, balance_after: 1, created_at: "2026-09-17T00:00:00Z" }] },
  ])("rejects malformed summaries: %j", (value) => {
    expect(parseCreditAccountSummary(value)).toBeNull();
  });
});
