import { isUuid, type DodoPayment } from "@/lib/payments-v22/contracts";

export const CASE_VERIFIED_CREDIT_PURCHASE = "case_verified_credit" as const;

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

export function isExactVerifiedCreditPayment(payment: DodoPayment, productId: string): payment is DodoPayment & {
  checkout_session_id: string;
  product_cart: [{ product_id: string; quantity: 1 }];
} {
  return Boolean(productId)
    && typeof payment.checkout_session_id === "string"
    && payment.checkout_session_id.length > 0
    && payment.product_cart?.length === 1
    && payment.product_cart[0].product_id === productId
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
