import { describe, expect, it, vi } from "vitest";

import { SupabaseVerifiedCreditRepository } from "./repository";

vi.mock("server-only", () => ({}));

const userId = "33333333-3333-4333-8333-333333333333";
const caseId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";

function query(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of ["select", "eq", "insert", "update", "limit"]) chain[name] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => result);
  chain.single = vi.fn(async () => result);
  return chain;
}

describe("SupabaseVerifiedCreditRepository", () => {
  it("reads the current account credit balance", async () => {
    const users = query({ data: { audit_credits: 7 }, error: null });
    const db = { from: vi.fn(() => users), rpc: vi.fn() } as never;
    await expect(new SupabaseVerifiedCreditRepository(db).getBalance(userId)).resolves.toBe(7);
    expect(users.eq).toHaveBeenCalledWith("id", userId);
  });

  it("creates exactly one $19 USD credit pending order", async () => {
    const orders = query({ data: { id: orderId }, error: null });
    const db = { from: vi.fn(() => orders), rpc: vi.fn() } as never;
    await expect(new SupabaseVerifiedCreditRepository(db).createPendingOrder(userId, caseId)).resolves.toEqual({ id: orderId });
    expect(orders.insert).toHaveBeenCalledWith({
      user_id: userId,
      case_id: caseId,
      purchase_kind: "case_verified_credit",
      amount: 1900,
      currency: "USD",
      credits_purchased: 1,
      status: "pending",
    });
  });

  it("queries only a pending Verified checkout so paid orders do not block repurchase", async () => {
    const orders = query({ data: null, error: null });
    const db = { from: vi.fn(() => orders), rpc: vi.fn() } as never;
    await new SupabaseVerifiedCreditRepository(db).getPendingCheckout(userId, caseId);
    expect(orders.eq).toHaveBeenCalledWith("purchase_kind", "case_verified_credit");
    expect(orders.eq).toHaveBeenCalledWith("status", "pending");
  });

  it("fulfills and refunds only through the Verified credit RPCs", async () => {
    const fulfillResult = { fulfilled: true, idempotent: false, credits_added: 1, audit_credits: 4 };
    const refundResult = { refunded: true, idempotent: false, reversal_applied: true, manual_review: false, audit_credits: 3 };
    const rpcChain = { single: vi.fn().mockResolvedValueOnce({ data: fulfillResult, error: null }).mockResolvedValueOnce({ data: refundResult, error: null }) };
    const db = { from: vi.fn(), rpc: vi.fn(() => rpcChain) } as never;
    const repo = new SupabaseVerifiedCreditRepository(db);
    const input = { localOrderId: orderId, paymentId: "pay_1", clerkUserId: "user_123", caseId, amount: 1900, currency: "USD" };
    await expect(repo.fulfill(input)).resolves.toEqual(fulfillResult);
    await expect(repo.refund(input)).resolves.toEqual(refundResult);
    expect((db as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls.map((call) => call[0])).toEqual([
      "fulfill_v22_verified_credit_payment",
      "refund_v22_verified_credit_payment",
    ]);
  });
});
