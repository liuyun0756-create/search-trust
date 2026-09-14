import { describe, expect, it, vi } from "vitest";

import type { DodoClient, CasePaymentRepository } from "@/lib/payments-v22";
import type { VerifiedCreditRepository } from "@/lib/verified-credits-v22";
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
    ...overrides,
  } as VerifiedCreditRepository;
}

function payment(kind: string, status = "succeeded") {
  return {
    payment_id: "pay_secret_reference",
    status,
    total_amount: 1900,
    currency: "USD",
    checkout_session_id: "cks_verified",
    product_cart: [{ product_id: kind === "case_verified_credit" ? productId : "prod_prospect", quantity: 1 }],
    refund_status: "full" as const,
    metadata: { clerk_user_id: "user_123", case_id: caseId, order_id: orderId, purchase_kind: kind },
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
    createDodoClient: () => dodo as unknown as DodoClient,
    getVerifiedProductId: () => productId,
    dodo,
  };
}

describe("Dodo purchase-kind webhook dispatch", () => {
  it.each([
    ["case_prospect_report", "prospect"],
    ["case_verified_credit", "verified"],
  ] as const)("dispatches succeeded %s payments only to the matching repository", async (kind, target) => {
    const prospect = prospectRepository();
    const verified = verifiedRepository();
    const response = await createDodoWebhookHandler(dependencies(
      { type: "payment.succeeded", data: payment(kind) }, prospect, verified,
    ))(new Request("https://searchtrust.example/api/webhook/dodo", { method: "POST", body: "signed body" }));
    expect(response.status).toBe(200);
    expect(target === "prospect" ? prospect.fulfill : verified.fulfill).toHaveBeenCalledOnce();
    expect(target === "prospect" ? verified.fulfill : prospect.fulfill).not.toHaveBeenCalled();
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
    expect(JSON.stringify(warning.mock.calls)).not.toContain("4242424242424242");
    expect(JSON.stringify(warning.mock.calls)).not.toContain("pay_secret_reference");
    warning.mockRestore();
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
