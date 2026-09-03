import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import type { CaseService } from "@/lib/cases/service";
import type { DodoClient } from "./dodo";
import {
  createCasePaymentConfirmHandler,
  createCasePaymentHandlers,
  fulfillVerifiedCasePayment,
  type CasePaymentHandlerDependencies,
} from "./handlers";
import type { CasePaymentRepository } from "./repository";

const caseId = "11111111-1111-4111-8111-111111111111";
const orderId = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ id: caseId }) };
const user = { userId: "33333333-3333-4333-8333-333333333333", clerkUserId: "user_123" };

function repository(overrides: Partial<CasePaymentRepository> = {}): CasePaymentRepository {
  return {
    getEntitlementStatus: vi.fn(async (_userId: string, _caseId: string) => "locked" as const),
    getOpenCheckout: vi.fn(async () => null),
    createPendingOrder: vi.fn(async () => ({ id: orderId })),
    attachCheckoutSession: vi.fn(async () => undefined),
    markOrderFailed: vi.fn(async () => undefined),
    reserveEntitlement: vi.fn(async () => ({ reserved: true, idempotent: false })),
    fulfill: vi.fn(async () => ({ fulfilled: true, idempotent: false, entitlement_status: "available" as const })),
    refund: vi.fn(async () => ({ refunded: true, idempotent: false })),
    ...overrides,
  };
}

function dependencies(repo: CasePaymentRepository, overrides: Partial<CasePaymentHandlerDependencies> = {}): CasePaymentHandlerDependencies {
  const caseService = { get: vi.fn(async () => ({ id: caseId })) } as unknown as CaseService;
  const dodo = {
    createCheckout: vi.fn(async () => ({
      session_id: "cks_123",
      checkout_url: "https://test.checkout.dodopayments.com/session/cks_123",
    })),
    getPayment: vi.fn(async () => ({
      payment_id: "pay_123",
      status: "succeeded",
      total_amount: 1900,
      currency: "USD",
      metadata: {
        clerk_user_id: user.clerkUserId,
        case_id: caseId,
        order_id: orderId,
        purchase_kind: "case_prospect_report",
      },
    })),
  } as unknown as DodoClient;
  return {
    getCurrentUser: vi.fn(async () => user),
    createCaseService: () => caseService,
    createRepository: () => repo,
    createDodoClient: () => dodo,
    getProductId: () => "prod_report",
    getBaseUrl: () => "https://searchtrust.example",
    ...overrides,
  };
}

describe("v2.2 Case payment handlers", () => {
  it("creates a Case-scoped checkout and persists its session", async () => {
    const repo = repository();
    const deps = dependencies(repo);
    const response = await createCasePaymentHandlers(deps).POST(
      new NextRequest(`https://searchtrust.example/api/v2/cases/${caseId}/checkout`, { method: "POST" }),
      context,
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ case_id: caseId, order_id: orderId, checkout_session_id: "cks_123" });
    expect(repo.attachCheckoutSession).toHaveBeenCalledWith(
      orderId,
      "cks_123",
      "https://test.checkout.dodopayments.com/session/cks_123",
    );
    expect((deps.createDodoClient().createCheckout as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      metadata: { case_id: caseId, order_id: orderId, clerk_user_id: user.clerkUserId },
    });
  });

  it("does not open another checkout after the Case is unlocked", async () => {
    const repo = repository({ getEntitlementStatus: vi.fn(async () => "available" as const) });
    const deps = dependencies(repo);
    const response = await createCasePaymentHandlers(deps).POST(
      new NextRequest(`https://searchtrust.example/api/v2/cases/${caseId}/checkout`, { method: "POST" }),
      context,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "CASE_REPORT_ALREADY_UNLOCKED" } });
    expect(repo.createPendingOrder).not.toHaveBeenCalled();
  });

  it("reuses an existing hosted checkout instead of creating a duplicate order", async () => {
    const repo = repository({
      getOpenCheckout: vi.fn(async () => ({
        id: orderId,
        checkout_session_id: "cks_existing",
        checkout_url: "https://test.checkout.dodopayments.com/session/cks_existing",
        status: "pending" as const,
      })),
    });
    const deps = dependencies(repo);
    const response = await createCasePaymentHandlers(deps).POST(
      new NextRequest(`https://searchtrust.example/api/v2/cases/${caseId}/checkout`, { method: "POST" }),
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ reused: true, order_id: orderId });
    expect(repo.createPendingOrder).not.toHaveBeenCalled();
    expect(deps.createDodoClient().createCheckout).not.toHaveBeenCalled();
  });

  it("confirms only a payment belonging to the signed-in user and Case", async () => {
    const repo = repository();
    const deps = dependencies(repo);
    const handler = createCasePaymentConfirmHandler(deps);
    const response = await handler.POST(new NextRequest(
      `https://searchtrust.example/api/v2/cases/${caseId}/checkout/confirm`,
      { method: "POST", body: JSON.stringify({ payment_id: "pay_123" }) },
    ), context);
    expect(response.status).toBe(200);
    expect(repo.fulfill).toHaveBeenCalledWith(expect.objectContaining({ caseId, localOrderId: orderId }));

    const mismatched = await fulfillVerifiedCasePayment({
      payment: {
        payment_id: "pay_wrong",
        status: "succeeded",
        total_amount: 1900,
        currency: "USD",
        metadata: {
          clerk_user_id: user.clerkUserId,
          case_id: "44444444-4444-4444-8444-444444444444",
          order_id: orderId,
          purchase_kind: "case_prospect_report",
        },
      },
      expectedClerkUserId: user.clerkUserId,
      expectedCaseId: caseId,
      repository: repo,
    }).catch((error) => error);
    expect(mismatched).toMatchObject({ code: "PAYMENT_CASE_MISMATCH", status: 403 });
  });
});
