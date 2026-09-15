import { isUuid, type DodoPayment } from "@/lib/payments-v22/contracts";

export const CASE_VERIFIED_CREDIT_PURCHASE = "case_verified_credit" as const;
export const VERIFIED_CHECKOUT_INITIALIZATION_STALE_SECONDS = 60;

export interface VerifiedCreditPaymentMetadata {
  clerk_user_id: string;
  case_id: string;
  order_id: string;
  purchase_kind: typeof CASE_VERIFIED_CREDIT_PURCHASE;
}

export interface VerifiedCreditFulfillmentResult {
  fulfilled: boolean;
  idempotent: boolean;
  credits_added: number;
  audit_credits: number;
}

export interface VerifiedCreditRefundResult {
  refunded: boolean;
  idempotent: boolean;
  reversal_applied: boolean;
  manual_review: boolean;
  audit_credits: number;
}

export type VerifiedCreditRefundReviewReason =
  | "partial_refund"
  | "amount_mismatch"
  | "currency_mismatch"
  | "payment_refund_status_mismatch";

export interface VerifiedCreditRefundReviewResult {
  review_id: string;
  idempotent: boolean;
  status: "manual_review";
  reason: VerifiedCreditRefundReviewReason;
}

export type VerifiedCreditCheckoutClaimAction = "create" | "reuse" | "initializing";

export interface VerifiedCreditCheckoutClaimResult {
  action: VerifiedCreditCheckoutClaimAction;
  order_id: string;
  checkout_session_id: string | null;
  checkout_url: string | null;
  provider_product_id: string;
  initialization_token: string;
  retry_after_seconds: number;
}

export interface VerifiedCreditCheckoutAttachResult {
  checkout_session_id: string;
  checkout_url: string;
  idempotent: boolean;
}

export function parseVerifiedCreditPaymentMetadata(value: unknown): VerifiedCreditPaymentMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;
  if (
    typeof metadata.clerk_user_id !== "string" || !metadata.clerk_user_id ||
    !isUuid(metadata.case_id) ||
    !isUuid(metadata.order_id) ||
    metadata.purchase_kind !== CASE_VERIFIED_CREDIT_PURCHASE
  ) return null;
  return {
    clerk_user_id: metadata.clerk_user_id,
    case_id: metadata.case_id,
    order_id: metadata.order_id,
    purchase_kind: CASE_VERIFIED_CREDIT_PURCHASE,
  };
}

export function isExactVerifiedCreditPayment(payment: DodoPayment): payment is DodoPayment & {
  checkout_session_id: string;
  product_cart: [{ product_id: string; quantity: 1 }];
} {
  return typeof payment.checkout_session_id === "string"
    && payment.checkout_session_id.length > 0
    && payment.product_cart?.length === 1
    && payment.product_cart[0].product_id.length > 0
    && payment.product_cart[0].quantity === 1;
}

function isBalance(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function parseVerifiedCreditFulfillmentResult(value: unknown): VerifiedCreditFulfillmentResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (
    result.fulfilled !== true || typeof result.idempotent !== "boolean" ||
    !isBalance(result.credits_added) || !isBalance(result.audit_credits) ||
    (result.idempotent && result.credits_added !== 0) ||
    (!result.idempotent && result.credits_added !== 1)
  ) return null;
  return result as unknown as VerifiedCreditFulfillmentResult;
}

export function parseVerifiedCreditRefundResult(value: unknown): VerifiedCreditRefundResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (
    result.refunded !== true || typeof result.idempotent !== "boolean" ||
    typeof result.reversal_applied !== "boolean" || typeof result.manual_review !== "boolean" ||
    result.reversal_applied === result.manual_review || !isBalance(result.audit_credits)
  ) return null;
  return result as unknown as VerifiedCreditRefundResult;
}

export function parseVerifiedCreditRefundReviewResult(value: unknown): VerifiedCreditRefundReviewResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (!isUuid(result.review_id) || typeof result.idempotent !== "boolean" || result.status !== "manual_review"
    || !["partial_refund", "amount_mismatch", "currency_mismatch", "payment_refund_status_mismatch"].includes(String(result.reason))) {
    return null;
  }
  return result as unknown as VerifiedCreditRefundReviewResult;
}

export function parseVerifiedCreditCheckoutClaimResult(value: unknown): VerifiedCreditCheckoutClaimResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  const action = result.action;
  const sessionId = result.checkout_session_id;
  const checkoutUrl = result.checkout_url;
  const retryAfter = result.retry_after_seconds;
  if (!isUuid(result.order_id) || !isUuid(result.initialization_token)
    || typeof result.provider_product_id !== "string" || !result.provider_product_id.trim()
    || (action !== "create" && action !== "reuse" && action !== "initializing")
    || !Number.isSafeInteger(retryAfter) || (retryAfter as number) < 0 || (retryAfter as number) > 60) {
    return null;
  }
  if (action === "reuse") {
    if (typeof sessionId !== "string" || !sessionId || typeof checkoutUrl !== "string" || !checkoutUrl) return null;
  } else if (sessionId !== null || checkoutUrl !== null) {
    return null;
  }
  if (action === "initializing" ? retryAfter === 0 : retryAfter !== 0) return null;
  return result as unknown as VerifiedCreditCheckoutClaimResult;
}

export function parseVerifiedCreditCheckoutAttachResult(value: unknown): VerifiedCreditCheckoutAttachResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (typeof result.checkout_session_id !== "string" || !result.checkout_session_id
    || typeof result.checkout_url !== "string" || !result.checkout_url
    || typeof result.idempotent !== "boolean") return null;
  return result as unknown as VerifiedCreditCheckoutAttachResult;
}
