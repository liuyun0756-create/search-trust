import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CASE_VERIFIED_CREDIT_PURCHASE,
  parseVerifiedCreditFulfillmentResult,
  parseVerifiedCreditRefundResult,
  type VerifiedCreditFulfillmentResult,
  type VerifiedCreditRefundResult,
} from "./contracts";

export interface PendingVerifiedCreditOrder { id: string }

export interface PendingVerifiedCreditCheckout {
  id: string;
  checkout_session_id: string | null;
  checkout_url: string | null;
  status: "pending";
  provider_product_id: string | null;
}

export interface VerifiedCreditPaymentInput {
  localOrderId: string;
  paymentId: string;
  clerkUserId: string;
  caseId: string;
  amount: number;
  currency: string;
  checkoutSessionId: string;
  productId: string;
}

export interface VerifiedCreditRepository {
  getBalance(userId: string): Promise<number>;
  getPendingCheckout(userId: string, caseId: string): Promise<PendingVerifiedCreditCheckout | null>;
  createPendingOrder(userId: string, caseId: string, productId: string): Promise<PendingVerifiedCreditOrder>;
  attachCheckoutSession(orderId: string, sessionId: string, checkoutUrl: string): Promise<void>;
  markOrderFailed(orderId: string): Promise<void>;
  fulfill(input: VerifiedCreditPaymentInput): Promise<VerifiedCreditFulfillmentResult>;
  refund(input: VerifiedCreditPaymentInput): Promise<VerifiedCreditRefundResult>;
}

export class VerifiedCreditPersistenceError extends Error {
  constructor() {
    super("Verified credit payment persistence failed.");
    this.name = "VerifiedCreditPersistenceError";
  }
}

export class SupabaseVerifiedCreditRepository implements VerifiedCreditRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getBalance(userId: string): Promise<number> {
    const { data, error } = await this.supabase.from("users").select("audit_credits")
      .eq("id", userId).maybeSingle();
    const balance = data?.audit_credits;
    if (error || typeof balance !== "number" || !Number.isSafeInteger(balance) || balance < 0) {
      throw new VerifiedCreditPersistenceError();
    }
    return balance;
  }

  async getPendingCheckout(userId: string, caseId: string): Promise<PendingVerifiedCreditCheckout | null> {
    const { data, error } = await this.supabase.from("orders")
      .select("id,checkout_session_id,checkout_url,status,provider_product_id")
      .eq("user_id", userId).eq("case_id", caseId)
      .eq("purchase_kind", CASE_VERIFIED_CREDIT_PURCHASE).eq("status", "pending")
      .limit(1).maybeSingle();
    if (error) throw new VerifiedCreditPersistenceError();
    return data as PendingVerifiedCreditCheckout | null;
  }

  async createPendingOrder(userId: string, caseId: string, productId: string): Promise<PendingVerifiedCreditOrder> {
    const { data, error } = await this.supabase.from("orders").insert({
      user_id: userId,
      case_id: caseId,
      purchase_kind: CASE_VERIFIED_CREDIT_PURCHASE,
      amount: 1900,
      currency: "USD",
      credits_purchased: 1,
      status: "pending",
      provider_product_id: productId,
    }).select("id").single();
    if (error || !data || typeof data.id !== "string") throw new VerifiedCreditPersistenceError();
    return { id: data.id };
  }

  async attachCheckoutSession(orderId: string, sessionId: string, checkoutUrl: string): Promise<void> {
    const { error } = await this.supabase.from("orders")
      .update({ checkout_session_id: sessionId, checkout_url: checkoutUrl })
      .eq("id", orderId).eq("purchase_kind", CASE_VERIFIED_CREDIT_PURCHASE).eq("status", "pending");
    if (error) throw new VerifiedCreditPersistenceError();
  }

  async markOrderFailed(orderId: string): Promise<void> {
    const { error } = await this.supabase.from("orders").update({ status: "failed" })
      .eq("id", orderId).eq("purchase_kind", CASE_VERIFIED_CREDIT_PURCHASE).eq("status", "pending");
    if (error) throw new VerifiedCreditPersistenceError();
  }

  async fulfill(input: VerifiedCreditPaymentInput): Promise<VerifiedCreditFulfillmentResult> {
    const { data, error } = await this.supabase.rpc("fulfill_v22_verified_credit_payment", {
      p_local_order_id: input.localOrderId,
      p_payment_id: input.paymentId,
      p_clerk_user_id: input.clerkUserId,
      p_case_id: input.caseId,
      p_amount: input.amount,
      p_currency: input.currency,
      p_checkout_session_id: input.checkoutSessionId,
      p_product_id: input.productId,
    }).single();
    const parsed = parseVerifiedCreditFulfillmentResult(data);
    if (error || !parsed) throw new VerifiedCreditPersistenceError();
    return parsed;
  }

  async refund(input: VerifiedCreditPaymentInput): Promise<VerifiedCreditRefundResult> {
    const { data, error } = await this.supabase.rpc("refund_v22_verified_credit_payment", {
      p_local_order_id: input.localOrderId,
      p_payment_id: input.paymentId,
      p_clerk_user_id: input.clerkUserId,
      p_case_id: input.caseId,
      p_amount: input.amount,
      p_currency: input.currency,
      p_checkout_session_id: input.checkoutSessionId,
      p_product_id: input.productId,
    }).single();
    const parsed = parseVerifiedCreditRefundResult(data);
    if (error || !parsed) throw new VerifiedCreditPersistenceError();
    return parsed;
  }
}
