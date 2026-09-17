import { describe, expect, it } from "vitest";

import {
  isExactCreditPayment,
  parseCreditCheckoutClaimResult,
  parseCreditPaymentMetadata,
} from "./contracts";

const orderId = "22222222-2222-4222-8222-222222222222";

describe("unified credit payment contracts", () => {
  it("accepts account-level metadata without a Case binding", () => {
    expect(parseCreditPaymentMetadata({
      clerk_user_id: "user_123", order_id: orderId, purchase_kind: "credit_purchase",
    })).toEqual({ clerk_user_id: "user_123", order_id: orderId, purchase_kind: "credit_purchase" });
    expect(parseCreditPaymentMetadata({
      clerk_user_id: "user_123", order_id: orderId, purchase_kind: "case_verified_credit",
    })).toBeNull();
  });

  it("requires exactly one $19 USD product", () => {
    const payment = {
      payment_id: "pay_1", status: "succeeded", total_amount: 1900, currency: "USD",
      checkout_session_id: "cks_1", product_cart: [{ product_id: "prod_1", quantity: 1 }] as [{ product_id: string; quantity: 1 }],
      refund_status: null, metadata: {},
    };
    expect(isExactCreditPayment(payment)).toBe(true);
    expect(isExactCreditPayment({ ...payment, total_amount: 1800 })).toBe(false);
    expect(isExactCreditPayment({ ...payment, product_cart: [{ product_id: "prod_1", quantity: 2 }] })).toBe(false);
  });

  it("rejects inconsistent checkout claims", () => {
    const base = {
      action: "reuse", order_id: orderId, checkout_session_id: "cks_1",
      checkout_url: "https://checkout.dodopayments.com/cks_1", provider_product_id: "prod_1",
      initialization_token: "33333333-3333-4333-8333-333333333333", retry_after_seconds: 0,
    };
    expect(parseCreditCheckoutClaimResult(base)).toEqual(base);
    expect(parseCreditCheckoutClaimResult({ ...base, checkout_url: null })).toBeNull();
  });
});
