import type { SupabaseClient } from "@supabase/supabase-js";

import type { CaseReportEntitlementStatus } from "./contracts";

export interface PendingCaseOrder {
  id: string;
}

export interface OpenCaseCheckout {
  id: string;
  checkout_session_id: string | null;
  checkout_url: string | null;
  status: "pending" | "paid";
}

export interface FulfillmentResult {
  fulfilled: boolean;
  idempotent: boolean;
  entitlement_status: Exclude<CaseReportEntitlementStatus, "locked">;
}

export interface CasePaymentRepository {
  getEntitlementStatus(userId: string, caseId: string): Promise<CaseReportEntitlementStatus>;
  getOpenCheckout(userId: string, caseId: string): Promise<OpenCaseCheckout | null>;
  createPendingOrder(userId: string, caseId: string): Promise<PendingCaseOrder>;
  attachCheckoutSession(orderId: string, sessionId: string, checkoutUrl: string): Promise<void>;
  markOrderFailed(orderId: string): Promise<void>;
  reserveEntitlement(userId: string, caseId: string, jobId: string): Promise<{
    reserved: boolean;
    idempotent: boolean;
  }>;
  fulfill(input: {
    localOrderId: string;
    paymentId: string;
    clerkUserId: string;
    caseId: string;
    amount: number;
    currency: string;
  }): Promise<FulfillmentResult>;
  refund(input: {
    localOrderId: string;
    paymentId: string;
    clerkUserId: string;
    caseId: string;
  }): Promise<{ refunded: boolean; idempotent: boolean }>;
}

export class CasePaymentPersistenceError extends Error {
  constructor() {
    super("Case payment persistence failed.");
    this.name = "CasePaymentPersistenceError";
  }
}

export class SupabaseCasePaymentRepository implements CasePaymentRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getEntitlementStatus(userId: string, caseId: string): Promise<CaseReportEntitlementStatus> {
    const { data, error } = await this.supabase
      .from("case_report_entitlements")
      .select("status")
      .eq("user_id", userId)
      .eq("case_id", caseId)
      .eq("report_type", "prospect")
      .maybeSingle();
    if (error) throw new CasePaymentPersistenceError();
    return (data?.status as CaseReportEntitlementStatus | undefined) ?? "locked";
  }

  async getOpenCheckout(userId: string, caseId: string): Promise<OpenCaseCheckout | null> {
    const { data, error } = await this.supabase
      .from("orders")
      .select("id,checkout_session_id,checkout_url,status")
      .eq("user_id", userId)
      .eq("case_id", caseId)
      .eq("purchase_kind", "case_prospect_report")
      .in("status", ["pending", "paid"])
      .limit(1)
      .maybeSingle();
    if (error) throw new CasePaymentPersistenceError();
    return data as OpenCaseCheckout | null;
  }

  async createPendingOrder(userId: string, caseId: string): Promise<PendingCaseOrder> {
    const { data, error } = await this.supabase
      .from("orders")
      .insert({
        user_id: userId,
        case_id: caseId,
        purchase_kind: "case_prospect_report",
        amount: 1900,
        currency: "USD",
        credits_purchased: 0,
        status: "pending",
      })
      .select("id")
      .single();
    if (error || !data) throw new CasePaymentPersistenceError();
    return { id: data.id as string };
  }

  async attachCheckoutSession(orderId: string, sessionId: string, checkoutUrl: string): Promise<void> {
    const { error } = await this.supabase
      .from("orders")
      .update({ checkout_session_id: sessionId, checkout_url: checkoutUrl })
      .eq("id", orderId)
      .eq("status", "pending");
    if (error) throw new CasePaymentPersistenceError();
  }

  async markOrderFailed(orderId: string): Promise<void> {
    const { error } = await this.supabase
      .from("orders")
      .update({ status: "failed" })
      .eq("id", orderId)
      .eq("status", "pending");
    if (error) throw new CasePaymentPersistenceError();
  }

  async reserveEntitlement(userId: string, caseId: string, jobId: string): Promise<{
    reserved: boolean;
    idempotent: boolean;
  }> {
    const { data, error } = await this.supabase.rpc("reserve_v22_case_report_entitlement", {
      p_user_id: userId,
      p_case_id: caseId,
      p_job_id: jobId,
    }).single<{ reserved: boolean; idempotent: boolean }>();
    if (error || !data) throw new CasePaymentPersistenceError();
    return data;
  }

  async fulfill(input: {
    localOrderId: string;
    paymentId: string;
    clerkUserId: string;
    caseId: string;
    amount: number;
    currency: string;
  }): Promise<FulfillmentResult> {
    const { data, error } = await this.supabase.rpc("fulfill_v22_case_payment", {
      p_local_order_id: input.localOrderId,
      p_payment_id: input.paymentId,
      p_clerk_user_id: input.clerkUserId,
      p_case_id: input.caseId,
      p_amount: input.amount,
      p_currency: input.currency,
    }).single<FulfillmentResult>();
    if (error || !data) throw new CasePaymentPersistenceError();
    return data;
  }

  async refund(input: {
    localOrderId: string;
    paymentId: string;
    clerkUserId: string;
    caseId: string;
  }): Promise<{ refunded: boolean; idempotent: boolean }> {
    const { data, error } = await this.supabase.rpc("refund_v22_case_payment", {
      p_local_order_id: input.localOrderId,
      p_payment_id: input.paymentId,
      p_clerk_user_id: input.clerkUserId,
      p_case_id: input.caseId,
    }).single<{ refunded: boolean; idempotent: boolean }>();
    if (error || !data) throw new CasePaymentPersistenceError();
    return data;
  }
}
