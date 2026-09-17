import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import type { DodoClient } from "@/lib/payments-v22";
import {
  createCreditPaymentConfirmHandler,
  createCreditPaymentHandlers,
  type CreditPaymentHandlerDependencies,
} from "./handlers";
import type { CreditPaymentRepository } from "./repository";

const user = { userId: "11111111-1111-4111-8111-111111111111", clerkUserId: "user_123" };
const orderId = "22222222-2222-4222-8222-222222222222";
const token = "33333333-3333-4333-8333-333333333333";

function repository(overrides: Partial<CreditPaymentRepository> = {}): CreditPaymentRepository {
  return {
    claimCheckout: vi.fn(async () => ({
      action: "create", order_id: orderId, checkout_session_id: null, checkout_url: null,
      provider_product_id: "prod_credit", initialization_token: token, retry_after_seconds: 0,
    })),
    attachCheckoutSession: vi.fn(async input => ({
      checkout_session_id: input.sessionId, checkout_url: input.checkoutUrl, idempotent: false,
    })),
    markOrderFailed: vi.fn(),
    fulfill: vi.fn(async () => ({ fulfilled: true, idempotent: false, credits_added: 1, credit_balance: 6 })),
    refund: vi.fn(), recordRefundReview: vi.fn(),
    ...overrides,
  } as CreditPaymentRepository;
}

function dependencies(repo: CreditPaymentRepository): CreditPaymentHandlerDependencies & { dodo: DodoClient } {
  const dodo = {
    createCheckout: vi.fn(async () => ({
      session_id: "cks_credit",
      checkout_url: "https://test.checkout.dodopayments.com/session/cks_credit",
    })),
    getPayment: vi.fn(async () => ({
      payment_id: "pay_credit", status: "succeeded", total_amount: 1900, currency: "USD",
      checkout_session_id: "cks_credit", product_cart: [{ product_id: "prod_credit", quantity: 1 }],
      refund_status: null,
      metadata: { clerk_user_id: user.clerkUserId, order_id: orderId, purchase_kind: "credit_purchase" },
    })),
  } as unknown as DodoClient;
  return {
    getCurrentUser: vi.fn(async () => user),
    createRepository: () => repo,
    createDodoClient: () => dodo,
    isDodoConfigured: () => true,
    getProductId: () => "prod_credit",
    getBaseUrl: () => "https://searchtrust.example",
    dodo,
  };
}

describe("unified credit payment handlers", () => {
  it("creates a one-credit checkout with no Case metadata", async () => {
    const repo = repository();
    const deps = dependencies(repo);
    const response = await createCreditPaymentHandlers(deps).POST(new NextRequest(
      "https://searchtrust.example/api/v2/credits/checkout", { method: "POST" },
    ));
    expect(response.status).toBe(201);
    const input = vi.mocked(deps.dodo.createCheckout).mock.calls[0][0];
    expect(input.metadata).toEqual({
      clerk_user_id: user.clerkUserId, order_id: orderId, purchase_kind: "credit_purchase",
    });
    expect(input.metadata).not.toHaveProperty("case_id");
    expect(new URL(input.returnUrl).pathname).toBe("/pricing");
  });

  it("returns an attached checkout without starting any workflow", async () => {
    const repo = repository();
    const response = await createCreditPaymentHandlers(dependencies(repo)).POST(new NextRequest(
      "https://searchtrust.example/api/v2/credits/checkout", { method: "POST" },
    ));
    expect(await response.json()).toMatchObject({
      order_id: orderId, checkout_session_id: "cks_credit", reused: false,
    });
    expect(repo.fulfill).not.toHaveBeenCalled();
  });

  it("confirms an exact payment and returns the new unified balance", async () => {
    const repo = repository();
    const response = await createCreditPaymentConfirmHandler(dependencies(repo)).POST(new NextRequest(
      "https://searchtrust.example/api/v2/credits/checkout/confirm",
      { method: "POST", body: JSON.stringify({ payment_id: "pay_credit" }) },
    ));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true, payment_id: "pay_credit", credits_added: 1, credit_balance: 6, already_confirmed: false,
    });
    expect(repo.fulfill).toHaveBeenCalledWith(expect.objectContaining({
      clerkUserId: user.clerkUserId, localOrderId: orderId, amount: 1900,
    }));
  });

  it("does not create a duplicate checkout while initialization is active", async () => {
    const repo = repository({
      claimCheckout: vi.fn(async () => ({
        action: "initializing" as const, order_id: orderId, checkout_session_id: null, checkout_url: null,
        provider_product_id: "prod_credit", initialization_token: token, retry_after_seconds: 42,
      })),
    });
    const deps = dependencies(repo);
    const response = await createCreditPaymentHandlers(deps).POST(new NextRequest(
      "https://searchtrust.example/api/v2/credits/checkout", { method: "POST" },
    ));
    expect(response.status).toBe(409);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(deps.dodo.createCheckout).not.toHaveBeenCalled();
  });
});
