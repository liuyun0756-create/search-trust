import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import type { CaseService } from "@/lib/cases/service";
import type { DodoClient } from "@/lib/payments-v22";
import {
  createVerifiedCreditConfirmHandler,
  createVerifiedCreditHandlers,
  refundVerifiedCreditPayment,
  type VerifiedCreditHandlerDependencies,
} from "./handlers";
import type { VerifiedCreditRepository } from "./repository";

const caseId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const user = { userId: "33333333-3333-4333-8333-333333333333", clerkUserId: "user_123" };
const context = { params: Promise.resolve({ id: caseId }) };

function repository(overrides: Partial<VerifiedCreditRepository> = {}): VerifiedCreditRepository {
  return {
    getBalance: vi.fn(async () => 2),
    getPendingCheckout: vi.fn(async () => null),
    createPendingOrder: vi.fn(async () => ({ id: orderId })),
    attachCheckoutSession: vi.fn(async () => undefined),
    markOrderFailed: vi.fn(async () => undefined),
    fulfill: vi.fn(async () => ({ fulfilled: true, idempotent: false, credits_added: 1, audit_credits: 3 })),
    refund: vi.fn(async () => ({ refunded: true, idempotent: false, reversal_applied: true, manual_review: false, audit_credits: 2 })),
    ...overrides,
  };
}

function dependencies(repo: VerifiedCreditRepository, overrides: Partial<VerifiedCreditHandlerDependencies> = {}): VerifiedCreditHandlerDependencies {
  const dodo = {
    createCheckout: vi.fn(async () => ({
      session_id: "cks_verified",
      checkout_url: "https://test.checkout.dodopayments.com/session/cks_verified",
    })),
    getPayment: vi.fn(async () => ({
      payment_id: "pay_verified",
      status: "succeeded",
      total_amount: 1900,
      currency: "USD",
      metadata: {
        clerk_user_id: user.clerkUserId,
        case_id: caseId,
        order_id: orderId,
        purchase_kind: "case_verified_credit",
      },
    })),
  } as unknown as DodoClient;
  return {
    getCurrentUser: vi.fn(async () => user),
    createCaseService: () => ({ get: vi.fn(async () => ({ id: caseId })) }) as unknown as CaseService,
    createRepository: () => repo,
    createDodoClient: () => dodo,
    isCheckoutEnabled: () => true,
    getProductId: () => "prod_verified_credit",
    getBaseUrl: () => "https://searchtrust.example",
    isDodoConfigured: () => true,
    ...overrides,
  };
}

describe("Verified credit handlers", () => {
  it("returns the signed-in account balance", async () => {
    const response = await createVerifiedCreditHandlers(dependencies(repository())).GET(
      new NextRequest(`https://searchtrust.example/api/v2/cases/${caseId}/verified-credit/checkout`),
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ case_id: caseId, audit_credits: 2 });
  });

  it("creates the fixed one-credit checkout with connections return URLs", async () => {
    const repo = repository();
    const deps = dependencies(repo);
    const response = await createVerifiedCreditHandlers(deps).POST(
      new NextRequest(`https://searchtrust.example/api/v2/cases/${caseId}/verified-credit/checkout`, { method: "POST" }),
      context,
    );
    expect(response.status).toBe(201);
    const input = vi.mocked(deps.createDodoClient().createCheckout).mock.calls[0][0];
    expect(input).toMatchObject({
      productId: "prod_verified_credit",
      metadata: { purchase_kind: "case_verified_credit", case_id: caseId, order_id: orderId },
    });
    expect(new URL(input.returnUrl).pathname).toBe(`/cases/${caseId}/connections`);
    expect(new URL(input.cancelUrl).pathname).toBe(`/cases/${caseId}/connections`);
  });

  it("reuses only a pending checkout and does not treat a paid order as open", async () => {
    const pending = repository({
      getPendingCheckout: vi.fn(async () => ({ id: orderId, checkout_session_id: "cks_old", checkout_url: "https://test.checkout.dodopayments.com/session/cks_old", status: "pending" as const })),
    });
    const pendingDeps = dependencies(pending);
    const reused = await createVerifiedCreditHandlers(pendingDeps).POST(new NextRequest("https://searchtrust.example", { method: "POST" }), context);
    expect(await reused.json()).toMatchObject({ reused: true, order_id: orderId });
    expect(pending.createPendingOrder).not.toHaveBeenCalled();

    const afterPaid = repository();
    const fresh = await createVerifiedCreditHandlers(dependencies(afterPaid)).POST(new NextRequest("https://searchtrust.example", { method: "POST" }), context);
    expect(fresh.status).toBe(201);
    expect(afterPaid.createPendingOrder).toHaveBeenCalledOnce();
  });

  it("does not reuse a persisted checkout URL outside Dodo", async () => {
    const repo = repository({
      getPendingCheckout: vi.fn(async () => ({
        id: orderId,
        checkout_session_id: "cks_tampered",
        checkout_url: "https://attacker.example/collect",
        status: "pending" as const,
      })),
    });
    const response = await createVerifiedCreditHandlers(dependencies(repo)).POST(
      new NextRequest("https://searchtrust.example", { method: "POST" }), context,
    );
    expect(response.status).toBe(201);
    expect(repo.markOrderFailed).toHaveBeenCalledWith(orderId);
    expect(repo.createPendingOrder).toHaveBeenCalledOnce();
  });

  it("gates new checkout, while confirm remains usable after the flag closes", async () => {
    const repo = repository();
    const deps = dependencies(repo, { isCheckoutEnabled: () => false });
    const checkout = await createVerifiedCreditHandlers(deps).POST(new NextRequest("https://searchtrust.example", { method: "POST" }), context);
    expect(checkout.status).toBe(503);

    const confirm = await createVerifiedCreditConfirmHandler(deps).POST(new NextRequest(
      `https://searchtrust.example/api/v2/cases/${caseId}/verified-credit/checkout/confirm`,
      { method: "POST", body: JSON.stringify({ payment_id: "pay_verified" }) },
    ), context);
    expect(confirm.status).toBe(200);
    expect(await confirm.json()).toEqual({
      ok: true,
      case_id: caseId,
      payment_id: "pay_verified",
      credits_added: 1,
      audit_credits: 3,
      already_confirmed: false,
    });
  });

  it("confirms idempotently without ever submitting a Verified analysis", async () => {
    const repo = repository({
      fulfill: vi.fn(async () => ({ fulfilled: true, idempotent: true, credits_added: 0, audit_credits: 3 })),
    });
    const analysisRequest = vi.spyOn(globalThis, "fetch");
    const response = await createVerifiedCreditConfirmHandler(dependencies(repo)).POST(new NextRequest(
      `https://searchtrust.example/api/v2/cases/${caseId}/verified-credit/checkout/confirm`,
      { method: "POST", body: JSON.stringify({ payment_id: "pay_verified" }) },
    ), context);
    expect(await response.json()).toMatchObject({ already_confirmed: true, audit_credits: 3, credits_added: 1 });
    expect(repo.fulfill).toHaveBeenCalledOnce();
    expect(analysisRequest).not.toHaveBeenCalled();
    analysisRequest.mockRestore();
  });

  it("returns the structured manual-review outcome from a refund", async () => {
    const repo = repository({
      refund: vi.fn(async () => ({ refunded: true, idempotent: false, reversal_applied: false, manual_review: true, audit_credits: 0 })),
    });
    const result = await refundVerifiedCreditPayment({
      payment: {
        payment_id: "pay_verified",
        status: "refunded",
        total_amount: 1900,
        currency: "USD",
        metadata: { clerk_user_id: user.clerkUserId, case_id: caseId, order_id: orderId, purchase_kind: "case_verified_credit" },
      },
      repository: repo,
    });
    expect(result).toMatchObject({ manual_review: true, reversal_applied: false, audit_credits: 0 });
  });
});
