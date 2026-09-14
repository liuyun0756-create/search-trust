import { describe, expect, it, vi } from "vitest";

import type { CasePaymentRepository } from "@/lib/payments-v22";
import type { VerifiedCreditRepository } from "@/lib/verified-credits-v22";
import { createDodoWebhookHandler, type DodoWebhookDependencies } from "./route";

vi.mock("server-only", () => ({}));

const caseId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";

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
    metadata: { clerk_user_id: "user_123", case_id: caseId, order_id: orderId, purchase_kind: kind },
  };
}

function dependencies(event: unknown, prospect = prospectRepository(), verified = verifiedRepository()): DodoWebhookDependencies {
  return {
    getHeaders: vi.fn(async () => new Headers({
      "webhook-id": "msg_1", "webhook-signature": "sig_1", "webhook-timestamp": "123",
    })),
    getWebhookSecret: () => "whsec_test",
    verify: vi.fn(() => event),
    createCaseRepository: () => prospect,
    createVerifiedCreditRepository: () => verified,
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

  it("safely ignores unknown purchase kinds", async () => {
    const prospect = prospectRepository();
    const verified = verifiedRepository();
    const response = await createDodoWebhookHandler(dependencies(
      { type: "payment.succeeded", data: payment("future_product") }, prospect, verified,
    ))(new Request("https://searchtrust.example", { method: "POST", body: "private unknown payload" }));
    expect(await response.json()).toEqual({ received: true, ignored: true });
    expect(prospect.fulfill).not.toHaveBeenCalled();
    expect(verified.fulfill).not.toHaveBeenCalled();
  });

  it("records a structured redacted warning when a Verified refund needs manual review", async () => {
    const verified = verifiedRepository({
      refund: vi.fn(async () => ({ refunded: true, idempotent: false, reversal_applied: false, manual_review: true, audit_credits: 0 })),
    });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await createDodoWebhookHandler(dependencies(
      { type: "payment.refunded", data: payment("case_verified_credit", "refunded") }, prospectRepository(), verified,
    ))(new Request("https://searchtrust.example", { method: "POST", body: "card=4242424242424242" }));
    expect(response.status).toBe(200);
    expect(warning).toHaveBeenCalledWith("[DodoWebhook] Verified credit refund requires manual review", {
      event_type: "payment.refunded",
      purchase_kind: "case_verified_credit",
      manual_review: true,
      already_processed: false,
    });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("4242424242424242");
    expect(JSON.stringify(warning.mock.calls)).not.toContain("pay_secret_reference");
    warning.mockRestore();
  });

  it("preserves Prospect refund handling when the refund payload omits payment status", async () => {
    const prospect = prospectRepository();
    const withoutStatus = payment("case_prospect_report") as Record<string, unknown>;
    delete withoutStatus.status;
    const response = await createDodoWebhookHandler(dependencies(
      { type: "payment.refunded", data: withoutStatus }, prospect, verifiedRepository(),
    ))(new Request("https://searchtrust.example", { method: "POST", body: "signed body" }));
    expect(response.status).toBe(200);
    expect(prospect.refund).toHaveBeenCalledOnce();
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
