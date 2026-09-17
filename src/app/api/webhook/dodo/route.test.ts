import { describe, expect, it, vi } from "vitest";

import type { DodoClient, DodoPayment, CasePaymentRepository } from "@/lib/payments-v22";
import type { VerifiedCreditRepository } from "@/lib/verified-credits-v22";
import type { CreditPaymentRepository } from "@/lib/credit-payments-v22";
import { createDodoWebhookHandler, type DodoWebhookDependencies } from "./route";

vi.mock("server-only", () => ({}));

const caseId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const productId = "prod_verified_credit";

function prospectRepository(): CasePaymentRepository {
  return {
    getEntitlementStatus: vi.fn(), getOpenCheckout: vi.fn(), createPendingOrder: vi.fn(),
    attachCheckoutSession: vi.fn(), markOrderFailed: vi.fn(), reserveEntitlement: vi.fn(),
    fulfill: vi.fn(async () => ({ fulfilled: true, idempotent: false, entitlement_status: "available" })),
    refund: vi.fn(async () => ({ refunded: true, idempotent: false })),
  } as unknown as CasePaymentRepository;
}

function verifiedRepository(overrides: Partial<VerifiedCreditRepository> = {}): VerifiedCreditRepository {
  return {
    getBalance: vi.fn(), getPendingCheckout: vi.fn(), createPendingOrder: vi.fn(),
    attachCheckoutSession: vi.fn(), markOrderFailed: vi.fn(),
    fulfill: vi.fn(async () => ({ fulfilled: true, idempotent: false, credits_added: 1, audit_credits: 1 })),
    refund: vi.fn(async () => ({ refunded: true, idempotent: false, reversal_applied: true, manual_review: false, audit_credits: 0 })),
    recordRefundReview: vi.fn(async input => ({
      review_id: "44444444-4444-4444-8444-444444444444",
      idempotent: false,
      status: "manual_review" as const,
      reason: input.reason,
    })),
    ...overrides,
  } as VerifiedCreditRepository;
}

function creditRepository(overrides: Partial<CreditPaymentRepository> = {}): CreditPaymentRepository {
  return {
    claimCheckout: vi.fn(), attachCheckoutSession: vi.fn(), markOrderFailed: vi.fn(),
    fulfill: vi.fn(async () => ({ fulfilled: true, idempotent: false, credits_added: 1, credit_balance: 6 })),
    refund: vi.fn(async () => ({ refunded: true, idempotent: false, reversal_applied: true, manual_review: false, credit_balance: 5 })),
    recordRefundReview: vi.fn(async input => ({
      review_id: "55555555-5555-4555-8555-555555555555",
      idempotent: false,
      status: "manual_review" as const,
      reason: input.reason,
    })),
    ...overrides,
  } as CreditPaymentRepository;
}

function payment(kind: string, status = "succeeded"): DodoPayment {
  return {
    payment_id: "pay_secret_reference",
    status,
    total_amount: 1900,
    currency: "USD",
    checkout_session_id: "cks_verified",
    product_cart: [{ product_id: kind === "case_verified_credit" ? productId : kind === "credit_purchase" ? "prod_credit" : "prod_prospect", quantity: 1 }],
    refund_status: "full" as const,
    metadata: kind === "credit_purchase"
      ? { clerk_user_id: "user_123", order_id: orderId, purchase_kind: kind }
      : { clerk_user_id: "user_123", case_id: caseId, order_id: orderId, purchase_kind: kind },
  };
}

function refund(overrides: Record<string, unknown> = {}) {
  return {
    business_id: "business_private",
    created_at: "2026-09-14T00:00:00Z",
    customer: { email: "private@example.com" },
    metadata: { purchase_kind: "attacker_controlled", order_id: "attacker_order" },
    payment_id: "pay_secret_reference",
    refund_id: "ref_secret_reference",
    status: "succeeded",
    is_partial: false,
    amount: 1900,
    currency: "USD",
    ...overrides,
  };
}

function dependencies(
  event: unknown,
  prospect = prospectRepository(),
  verified = verifiedRepository(),
  trustedPayment = payment("case_verified_credit"),
  credit = creditRepository(),
): DodoWebhookDependencies & { dodo: { getPayment: ReturnType<typeof vi.fn> } } {
  const dodo = { getPayment: vi.fn(async () => trustedPayment) };
  return {
    getHeaders: vi.fn(async () => new Headers({
      "webhook-id": "msg_1", "webhook-signature": "sig_1", "webhook-timestamp": "123",
    })),
    getWebhookSecret: () => "whsec_test",
    verify: vi.fn(() => event),
    createCaseRepository: () => prospect,
    createVerifiedCreditRepository: () => verified,
    createCreditPaymentRepository: () => credit,
    createDodoClient: () => dodo as unknown as DodoClient,
    dodo,
  };
}

describe("Dodo purchase-kind webhook dispatch", () => {
  it.each([
    ["case_prospect_report", "prospect"],
    ["case_verified_credit", "verified"],
    ["credit_purchase", "credit"],
  ] as const)("dispatches succeeded %s payments only to the matching repository", async (kind, target) => {
    const prospect = prospectRepository();
    const verified = verifiedRepository();
    const credit = creditRepository();
    const response = await createDodoWebhookHandler(dependencies(
      { type: "payment.succeeded", data: payment(kind) }, prospect, verified, payment(kind), credit,
    ))(new Request("https://searchtrust.example/api/webhook/dodo", { method: "POST", body: "signed body" }));
    expect(response.status).toBe(200);
    expect(target === "prospect" ? prospect.fulfill : target === "verified" ? verified.fulfill : credit.fulfill).toHaveBeenCalledOnce();
    if (target !== "prospect") expect(prospect.fulfill).not.toHaveBeenCalled();
    if (target !== "verified") expect(verified.fulfill).not.toHaveBeenCalled();
    if (target !== "credit") expect(credit.fulfill).not.toHaveBeenCalled();
  });

  it("safely ignores unknown payment purchase kinds", async () => {
    const prospect = prospectRepository();
    const verified = verifiedRepository();
    const response = await createDodoWebhookHandler(dependencies(
      { type: "payment.succeeded", data: payment("future_product") }, prospect, verified,
    ))(new Request("https://searchtrust.example", { method: "POST", body: "private unknown payload" }));
    expect(await response.json()).toEqual({ received: true, ignored: true });
    expect(prospect.fulfill).not.toHaveBeenCalled();
    expect(verified.fulfill).not.toHaveBeenCalled();
  });

  it("handles the official refund.succeeded payload by reloading the original Payment", async () => {
    const verified = verifiedRepository();
    const deps = dependencies({ type: "refund.succeeded", data: refund() }, prospectRepository(), verified);
    const response = await createDodoWebhookHandler(deps)(new Request(
      "https://searchtrust.example", { method: "POST", body: "signed refund" },
    ));
    expect(response.status).toBe(200);
    expect(deps.dodo.getPayment).toHaveBeenCalledWith("pay_secret_reference");
    expect(verified.refund).toHaveBeenCalledOnce();
    expect(verified.refund).toHaveBeenCalledWith(expect.objectContaining({
      paymentId: "pay_secret_reference", checkoutSessionId: "cks_verified", productId,
    }));
  });

  it("reverses an exact unified credit refund through the unified repository", async () => {
    const credit = creditRepository();
    const trusted = payment("credit_purchase");
    const deps = dependencies(
      { type: "refund.succeeded", data: refund() },
      prospectRepository(), verifiedRepository(), trusted, credit,
    );
    const response = await createDodoWebhookHandler(deps)(new Request(
      "https://searchtrust.example", { method: "POST", body: "signed refund" },
    ));
    expect(response.status).toBe(200);
    expect(credit.refund).toHaveBeenCalledWith(expect.objectContaining({
      providerRefundId: "ref_secret_reference",
      localOrderId: orderId,
      productId: "prod_credit",
    }));
  });

  it("persists a partial unified credit refund for manual review", async () => {
    const credit = creditRepository();
    const trusted = { ...payment("credit_purchase"), refund_status: "partial" as const };
    const deps = dependencies(
      { type: "refund.succeeded", data: refund({ is_partial: true, amount: 950 }) },
      prospectRepository(), verifiedRepository(), trusted, credit,
    );
    const response = await createDodoWebhookHandler(deps)(new Request(
      "https://searchtrust.example", { method: "POST", body: "signed refund" },
    ));
    expect(await response.json()).toMatchObject({ received: true, manual_review: true });
    expect(credit.refund).not.toHaveBeenCalled();
    expect(credit.recordRefundReview).toHaveBeenCalledWith(expect.objectContaining({
      providerRefundId: "ref_secret_reference",
      reason: "partial_refund",
      refundAmount: 950,
    }));
  });

  it("settles the frozen Payment product without consulting current product configuration", async () => {
    const verified = verifiedRepository();
    const deps = dependencies({ type: "payment.succeeded", data: payment("case_verified_credit") }, prospectRepository(), verified);
    const response = await createDodoWebhookHandler(deps)(new Request(
      "https://searchtrust.example", { method: "POST", body: "signed body" },
    ));
    expect(response.status).toBe(200);
    expect(verified.fulfill).toHaveBeenCalledWith(expect.objectContaining({ productId }));
  });

  it.each([
    ["partial", { is_partial: true, amount: 950 }],
    ["amount mismatch", { amount: 1800 }],
    ["currency mismatch", { currency: "EUR" }],
  ])("routes %s refunds to a redacted manual-review outcome without reversing credit", async (_label, patch) => {
    const verified = verifiedRepository();
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const deps = dependencies({ type: "refund.succeeded", data: refund(patch) }, prospectRepository(), verified);
    const response = await createDodoWebhookHandler(deps)(new Request(
      "https://searchtrust.example", { method: "POST", body: "card=4242424242424242" },
    ));
    expect(await response.json()).toMatchObject({ received: true, manual_review: true });
    expect(verified.refund).not.toHaveBeenCalled();
    expect(verified.recordRefundReview).toHaveBeenCalledWith(expect.objectContaining({
      providerRefundId: "ref_secret_reference",
      paymentId: "pay_secret_reference",
      checkoutSessionId: "cks_verified",
      productId,
      reason: _label === "partial" ? "partial_refund" : _label === "amount mismatch" ? "amount_mismatch" : "currency_mismatch",
    }));
    expect(JSON.stringify(warning.mock.calls)).not.toContain("4242424242424242");
    expect(JSON.stringify(warning.mock.calls)).not.toContain("pay_secret_reference");
    warning.mockRestore();
  });

  it("persists one review across a repeated refund webhook", async () => {
    const reviewId = "44444444-4444-4444-8444-444444444444";
    const verified = verifiedRepository({
      recordRefundReview: vi.fn()
        .mockResolvedValueOnce({ review_id: reviewId, idempotent: false, status: "manual_review", reason: "partial_refund" })
        .mockResolvedValueOnce({ review_id: reviewId, idempotent: true, status: "manual_review", reason: "partial_refund" }),
    });
    const deps = dependencies({ type: "refund.succeeded", data: refund({ is_partial: true, amount: 950 }) }, prospectRepository(), verified);
    const handler = createDodoWebhookHandler(deps);
    const first = await handler(new Request("https://searchtrust.example", { method: "POST", body: "signed refund" }));
    const second = await handler(new Request("https://searchtrust.example", { method: "POST", body: "signed refund" }));
    expect(await first.json()).toMatchObject({ manual_review: true, review_id: reviewId, already_processed: false });
    expect(await second.json()).toMatchObject({ manual_review: true, review_id: reviewId, already_processed: true });
    expect(verified.recordRefundReview).toHaveBeenCalledTimes(2);
  });

  it("returns 500 so Dodo retries when a refund review cannot be persisted", async () => {
    const verified = verifiedRepository({ recordRefundReview: vi.fn(async () => { throw new Error("database unavailable"); }) });
    const response = await createDodoWebhookHandler(dependencies(
      { type: "refund.succeeded", data: refund({ is_partial: true, amount: 950 }) }, prospectRepository(), verified,
    ))(new Request("https://searchtrust.example", { method: "POST", body: "signed refund" }));
    expect(response.status).toBe(500);
    expect(verified.refund).not.toHaveBeenCalled();
  });

  it("persists an exact-value refund whose Payment refund status is not full", async () => {
    const verified = verifiedRepository();
    const trustedPayment = { ...payment("case_verified_credit"), refund_status: "partial" as const };
    const response = await createDodoWebhookHandler(dependencies(
      { type: "refund.succeeded", data: refund() }, prospectRepository(), verified, trustedPayment,
    ))(new Request("https://searchtrust.example", { method: "POST", body: "signed refund" }));
    expect(response.status).toBe(200);
    expect(verified.recordRefundReview).toHaveBeenCalledWith(expect.objectContaining({
      reason: "payment_refund_status_mismatch",
      paymentRefundStatus: "partial",
    }));
  });

  it("rejects a refund Payment with an extra product before recording review", async () => {
    const verified = verifiedRepository();
    const trustedPayment = {
      ...payment("case_verified_credit"),
      product_cart: [{ product_id: productId, quantity: 1 }, { product_id: "prod_extra", quantity: 1 }],
    };
    const response = await createDodoWebhookHandler(dependencies(
      { type: "refund.succeeded", data: refund({ is_partial: true, amount: 950 }) },
      prospectRepository(), verified, trustedPayment,
    ))(new Request("https://searchtrust.example", { method: "POST", body: "signed refund" }));
    expect(response.status).toBe(400);
    expect(verified.recordRefundReview).not.toHaveBeenCalled();
  });

  it("records a structured redacted warning when the full-refund RPC needs manual review", async () => {
    const verified = verifiedRepository({
      refund: vi.fn(async () => ({ refunded: true, idempotent: false, reversal_applied: false, manual_review: true, audit_credits: 0 })),
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await createDodoWebhookHandler(dependencies(
      { type: "refund.succeeded", data: refund() }, prospectRepository(), verified,
    ))(new Request("https://searchtrust.example", { method: "POST", body: "card=4242424242424242" }));
    expect(response.status).toBe(200);
    expect(warning).toHaveBeenCalledWith("[DodoWebhook] Verified credit refund requires manual review", {
      event_type: "refund.succeeded",
      purchase_kind: "case_verified_credit",
      manual_review: true,
      already_processed: false,
    });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("pay_secret_reference");
    warning.mockRestore();
  });

  it("preserves Prospect refunds through the official event and trusted Payment metadata", async () => {
    const prospect = prospectRepository();
    const deps = dependencies(
      { type: "refund.succeeded", data: refund() }, prospect, verifiedRepository(), payment("case_prospect_report"),
    );
    const response = await createDodoWebhookHandler(deps)(new Request("https://searchtrust.example", { method: "POST", body: "signed body" }));
    expect(response.status).toBe(200);
    expect(prospect.refund).toHaveBeenCalledOnce();
  });

  it("does not trust the legacy payment.refunded payload", async () => {
    const verified = verifiedRepository();
    const response = await createDodoWebhookHandler(dependencies(
      { type: "payment.refunded", data: payment("case_verified_credit", "refunded") }, prospectRepository(), verified,
    ))(new Request("https://searchtrust.example", { method: "POST", body: "signed body" }));
    expect(await response.json()).toEqual({ received: true });
    expect(verified.refund).not.toHaveBeenCalled();
  });

  it("marks failed checkouts in the matching repository", async () => {
    const prospect = prospectRepository();
    const verified = verifiedRepository();
    await createDodoWebhookHandler(dependencies(
      { type: "payment.failed", data: payment("case_verified_credit", "failed") }, prospect, verified,
    ))(new Request("https://searchtrust.example", { method: "POST", body: "signed body" }));
    expect(verified.markOrderFailed).toHaveBeenCalledWith(orderId);
    expect(prospect.markOrderFailed).not.toHaveBeenCalled();
  });
});
