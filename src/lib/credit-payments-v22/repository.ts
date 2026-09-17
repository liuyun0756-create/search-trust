import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CREDIT_PURCHASE,
  parseCreditCheckoutAttachResult,
  parseCreditCheckoutClaimResult,
  parseCreditFulfillmentResult,
  parseCreditRefundResult,
  parseCreditRefundReviewResult,
  type CreditCheckoutAttachResult,
  type CreditCheckoutClaimResult,
  type CreditFulfillmentResult,
  type CreditRefundResult,
  type CreditRefundReviewReason,
  type CreditRefundReviewResult,
} from "./contracts";

export interface CreditPaymentInput {
  localOrderId: string;
  paymentId: string;
  clerkUserId: string;
  amount: number;
  currency: string;
  checkoutSessionId: string;
  productId: string;
}

export interface CreditRefundReviewInput extends CreditPaymentInput {
  providerRefundId: string;
  reason: CreditRefundReviewReason;
  refundAmount: number | null;
  refundCurrency: string | null;
  isPartial: boolean;
  paymentRefundStatus: "partial" | "full" | null;
}

export interface CreditPaymentRepository {
  claimCheckout(userId: string, productId: string): Promise<CreditCheckoutClaimResult>;
  attachCheckoutSession(input: {
    userId: string;
    orderId: string;
    initializationToken: string;
    productId: string;
    sessionId: string;
    checkoutUrl: string;
  }): Promise<CreditCheckoutAttachResult>;
  markOrderFailed(orderId: string): Promise<void>;
  fulfill(input: CreditPaymentInput): Promise<CreditFulfillmentResult>;
  refund(input: CreditPaymentInput & { providerRefundId: string }): Promise<CreditRefundResult>;
  recordRefundReview(input: CreditRefundReviewInput): Promise<CreditRefundReviewResult>;
}

export class CreditPaymentPersistenceError extends Error {
  constructor() {
    super("Credit payment persistence failed.");
    this.name = "CreditPaymentPersistenceError";
  }
}

export class SupabaseCreditPaymentRepository implements CreditPaymentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async claimCheckout(userId: string, productId: string) {
    const { data, error } = await this.supabase.rpc("claim_v22_credit_checkout", {
      p_user_id: userId, p_product_id: productId,
    }).single();
    const parsed = parseCreditCheckoutClaimResult(data);
    if (error || !parsed) throw new CreditPaymentPersistenceError();
    return parsed;
  }

  async attachCheckoutSession(input: {
    userId: string; orderId: string; initializationToken: string;
    productId: string; sessionId: string; checkoutUrl: string;
  }) {
    const { data, error } = await this.supabase.rpc("attach_v22_credit_checkout", {
      p_user_id: input.userId,
      p_order_id: input.orderId,
      p_initialization_token: input.initializationToken,
      p_product_id: input.productId,
      p_checkout_session_id: input.sessionId,
      p_checkout_url: input.checkoutUrl,
    }).single();
    const parsed = parseCreditCheckoutAttachResult(data);
    if (error || !parsed) throw new CreditPaymentPersistenceError();
    return parsed;
  }

  async markOrderFailed(orderId: string) {
    const { error } = await this.supabase.from("orders").update({ status: "failed" })
      .eq("id", orderId).eq("purchase_kind", CREDIT_PURCHASE).eq("status", "pending");
    if (error) throw new CreditPaymentPersistenceError();
  }

  async fulfill(input: CreditPaymentInput) {
    const { data, error } = await this.supabase.rpc("fulfill_v22_credit_payment", {
      p_local_order_id: input.localOrderId,
      p_payment_id: input.paymentId,
      p_clerk_user_id: input.clerkUserId,
      p_amount: input.amount,
      p_currency: input.currency,
      p_checkout_session_id: input.checkoutSessionId,
      p_product_id: input.productId,
    }).single();
    const parsed = parseCreditFulfillmentResult(data);
    if (error || !parsed) throw new CreditPaymentPersistenceError();
    return parsed;
  }

  async refund(input: CreditPaymentInput & { providerRefundId: string }) {
    const { data, error } = await this.supabase.rpc("refund_v22_credit_payment", {
      p_provider_refund_id: input.providerRefundId,
      p_local_order_id: input.localOrderId,
      p_payment_id: input.paymentId,
      p_clerk_user_id: input.clerkUserId,
      p_amount: input.amount,
      p_currency: input.currency,
      p_checkout_session_id: input.checkoutSessionId,
      p_product_id: input.productId,
    }).single();
    const parsed = parseCreditRefundResult(data);
    if (error || !parsed) throw new CreditPaymentPersistenceError();
    return parsed;
  }

  async recordRefundReview(input: CreditRefundReviewInput) {
    const { data, error } = await this.supabase.rpc("record_v22_credit_refund_review", {
      p_provider_refund_id: input.providerRefundId,
      p_local_order_id: input.localOrderId,
      p_payment_id: input.paymentId,
      p_clerk_user_id: input.clerkUserId,
      p_payment_amount: input.amount,
      p_payment_currency: input.currency,
      p_checkout_session_id: input.checkoutSessionId,
      p_product_id: input.productId,
      p_reason: input.reason,
      p_refund_amount: input.refundAmount,
      p_refund_currency: input.refundCurrency,
      p_is_partial: input.isPartial,
      p_payment_refund_status: input.paymentRefundStatus,
    }).single();
    const parsed = parseCreditRefundReviewResult(data);
    if (error || !parsed) throw new CreditPaymentPersistenceError();
    return parsed;
  }
}
