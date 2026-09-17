import { isUuid, type DodoPayment } from "@/lib/payments-v22";

export const CREDIT_PURCHASE = "credit_purchase" as const;
export const CREDIT_PRICE_CENTS = 1900;
export const CREDIT_CURRENCY = "USD" as const;
export const CREDIT_CHECKOUT_INITIALIZATION_STALE_SECONDS = 60;

export interface CreditPaymentMetadata {
  clerk_user_id: string;
  order_id: string;
  purchase_kind: typeof CREDIT_PURCHASE;
}

export interface CreditCheckoutClaimResult {
  action: "create" | "reuse" | "initializing";
  order_id: string;
  checkout_session_id: string | null;
  checkout_url: string | null;
  provider_product_id: string;
  initialization_token: string;
  retry_after_seconds: number;
}

export interface CreditCheckoutAttachResult {
  checkout_session_id: string;
  checkout_url: string;
  idempotent: boolean;
}

export interface CreditFulfillmentResult {
  fulfilled: true;
  idempotent: boolean;
  credits_added: number;
  credit_balance: number;
}

export interface CreditRefundResult {
  refunded: true;
  idempotent: boolean;
  reversal_applied: boolean;
  manual_review: boolean;
  credit_balance: number;
}

export type CreditRefundReviewReason =
  | "partial_refund"
  | "amount_mismatch"
  | "currency_mismatch"
  | "payment_refund_status_mismatch"
  | "credit_already_spent";

export interface CreditRefundReviewResult {
  review_id: string;
  idempotent: boolean;
  status: "manual_review";
  reason: CreditRefundReviewReason;
}

export function parseCreditPaymentMetadata(value: unknown): CreditPaymentMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;
  if (typeof metadata.clerk_user_id !== "string" || !metadata.clerk_user_id
    || !isUuid(metadata.order_id) || metadata.purchase_kind !== CREDIT_PURCHASE) return null;
  return {
    clerk_user_id: metadata.clerk_user_id,
    order_id: metadata.order_id,
    purchase_kind: CREDIT_PURCHASE,
  };
}

export function isExactCreditPayment(payment: DodoPayment): payment is DodoPayment & {
  checkout_session_id: string;
  product_cart: [{ product_id: string; quantity: 1 }];
} {
  return payment.total_amount === CREDIT_PRICE_CENTS
    && payment.currency === CREDIT_CURRENCY
    && typeof payment.checkout_session_id === "string"
    && payment.checkout_session_id.length > 0
    && payment.product_cart?.length === 1
    && payment.product_cart[0].product_id.length > 0
    && payment.product_cart[0].quantity === 1;
}

function isBalance(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function parseCreditCheckoutClaimResult(value: unknown): CreditCheckoutClaimResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  const action = result.action;
  if (!isUuid(result.order_id) || !isUuid(result.initialization_token)
    || typeof result.provider_product_id !== "string" || !result.provider_product_id.trim()
    || (action !== "create" && action !== "reuse" && action !== "initializing")
    || !Number.isSafeInteger(result.retry_after_seconds)
    || (result.retry_after_seconds as number) < 0 || (result.retry_after_seconds as number) > 60) return null;
  if (action === "reuse") {
    if (typeof result.checkout_session_id !== "string" || !result.checkout_session_id
      || typeof result.checkout_url !== "string" || !result.checkout_url
      || result.retry_after_seconds !== 0) return null;
  } else if (result.checkout_session_id !== null || result.checkout_url !== null
    || (action === "initializing") !== ((result.retry_after_seconds as number) > 0)) return null;
  return result as unknown as CreditCheckoutClaimResult;
}

export function parseCreditCheckoutAttachResult(value: unknown): CreditCheckoutAttachResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (typeof result.checkout_session_id !== "string" || !result.checkout_session_id
    || typeof result.checkout_url !== "string" || !result.checkout_url
    || typeof result.idempotent !== "boolean") return null;
  return result as unknown as CreditCheckoutAttachResult;
}

export function parseCreditFulfillmentResult(value: unknown): CreditFulfillmentResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (result.fulfilled !== true || typeof result.idempotent !== "boolean"
    || !isBalance(result.credits_added) || !isBalance(result.credit_balance)
    || (result.idempotent ? result.credits_added !== 0 : result.credits_added !== 1)) return null;
  return result as unknown as CreditFulfillmentResult;
}

export function parseCreditRefundResult(value: unknown): CreditRefundResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (result.refunded !== true || typeof result.idempotent !== "boolean"
    || typeof result.reversal_applied !== "boolean" || typeof result.manual_review !== "boolean"
    || result.reversal_applied === result.manual_review || !isBalance(result.credit_balance)) return null;
  return result as unknown as CreditRefundResult;
}

export function parseCreditRefundReviewResult(value: unknown): CreditRefundReviewResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (!isUuid(result.review_id) || typeof result.idempotent !== "boolean"
    || result.status !== "manual_review"
    || !["partial_refund", "amount_mismatch", "currency_mismatch", "payment_refund_status_mismatch", "credit_already_spent"].includes(String(result.reason))) return null;
  return result as unknown as CreditRefundReviewResult;
}
