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

  it("claims checkout initialization only through the cross-instance-safe RPC", async () => {
    const claim = {
      action: "create",
      order_id: orderId,
      checkout_session_id: null,
      checkout_url: null,
      provider_product_id: "prod_verified",
      initialization_token: "44444444-4444-4444-8444-444444444444",
      retry_after_seconds: 0,
    };
    const rpcChain = { single: vi.fn(async () => ({ data: claim, error: null })) };
    const db = { from: vi.fn(), rpc: vi.fn(() => rpcChain) } as never;
    await expect(new SupabaseVerifiedCreditRepository(db).claimCheckout(userId, caseId, "prod_verified"))
      .resolves.toEqual(claim);
    expect((db as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "claim_v22_verified_credit_checkout",
      { p_user_id: userId, p_case_id: caseId, p_product_id: "prod_verified" },
    );
  });

  it("rejects an inconsistent checkout claim returned by the database", async () => {
    const rpcChain = { single: vi.fn(async () => ({ data: {
      action: "reuse",
      order_id: orderId,
      checkout_session_id: null,
      checkout_url: null,
      provider_product_id: "prod_verified",
      initialization_token: "44444444-4444-4444-8444-444444444444",
      retry_after_seconds: 0,
    }, error: null })) };
    const db = { from: vi.fn(), rpc: vi.fn(() => rpcChain) } as never;
    await expect(new SupabaseVerifiedCreditRepository(db).claimCheckout(userId, caseId, "prod_verified"))
      .rejects.toThrow("persistence failed");
  });

  it("atomically attaches a checkout and rejects an invalid zero-row result", async () => {
    const attached = {
      checkout_session_id: "cks_1",
      checkout_url: "https://test.checkout.dodopayments.com/session/cks_1",
      idempotent: false,
    };
    const rpcChain = { single: vi.fn()
      .mockResolvedValueOnce({ data: attached, error: null })
      .mockResolvedValueOnce({ data: null, error: null }) };
    const db = { from: vi.fn(), rpc: vi.fn(() => rpcChain) } as never;
    const repo = new SupabaseVerifiedCreditRepository(db);
    const input = {
      userId, caseId, orderId,
      initializationToken: "44444444-4444-4444-8444-444444444444",
      productId: "prod_verified",
      sessionId: "cks_1",
      checkoutUrl: attached.checkout_url,
    };
    await expect(repo.attachCheckoutSession(input)).resolves.toEqual(attached);
    await expect(repo.attachCheckoutSession(input)).rejects.toThrow("persistence failed");
    expect((db as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "attach_v22_verified_credit_checkout",
      expect.objectContaining({ p_order_id: orderId, p_initialization_token: input.initializationToken }),
    );
  });

  it("fulfills and refunds only through the Verified credit RPCs", async () => {
    const fulfillResult = { fulfilled: true, idempotent: false, credits_added: 1, audit_credits: 4 };
    const refundResult = { refunded: true, idempotent: false, reversal_applied: true, manual_review: false, audit_credits: 3 };
    const rpcChain = { single: vi.fn().mockResolvedValueOnce({ data: fulfillResult, error: null }).mockResolvedValueOnce({ data: refundResult, error: null }) };
    const db = { from: vi.fn(), rpc: vi.fn(() => rpcChain) } as never;
    const repo = new SupabaseVerifiedCreditRepository(db);
    const input = { localOrderId: orderId, paymentId: "pay_1", clerkUserId: "user_123", caseId, amount: 1900, currency: "USD", checkoutSessionId: "cks_1", productId: "prod_1" };
    await expect(repo.fulfill(input)).resolves.toEqual(fulfillResult);
    await expect(repo.refund(input)).resolves.toEqual(refundResult);
    expect((db as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls.map((call) => call[0])).toEqual([
      "fulfill_v22_verified_credit_payment",
      "refund_v22_verified_credit_payment",
    ]);
    expect((db as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls[0][1]).toMatchObject({
      p_checkout_session_id: "cks_1",
      p_product_id: "prod_1",
    });
  });

  it("persists a refund review through the dedicated idempotent RPC", async () => {
    const reviewResult = {
      review_id: "44444444-4444-4444-8444-444444444444",
      idempotent: false,
      status: "manual_review",
      reason: "partial_refund",
    };
    const rpcChain = { single: vi.fn(async () => ({ data: reviewResult, error: null })) };
    const db = { from: vi.fn(), rpc: vi.fn(() => rpcChain) } as never;
    const repo = new SupabaseVerifiedCreditRepository(db);
    await expect(repo.recordRefundReview({
      providerRefundId: "ref_1",
      localOrderId: orderId,
      paymentId: "pay_1",
      clerkUserId: "user_123",
      caseId,
      paymentAmount: 1900,
      paymentCurrency: "USD",
      checkoutSessionId: "cks_1",
      productId: "prod_1",
      reason: "partial_refund",
      refundAmount: 950,
      refundCurrency: "USD",
      isPartial: true,
      paymentRefundStatus: "partial",
    })).resolves.toEqual(reviewResult);
    expect((db as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith(
      "record_v22_verified_credit_refund_review",
      expect.objectContaining({ p_provider_refund_id: "ref_1", p_product_id: "prod_1" }),
    );
  });
});
