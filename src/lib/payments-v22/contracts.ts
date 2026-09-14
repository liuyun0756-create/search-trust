const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const CASE_PROSPECT_PURCHASE = "case_prospect_report" as const;

export type CaseReportEntitlementStatus =
  | "locked"
  | "available"
  | "reserved"
  | "consumed"
  | "payment_refunded";

export interface CasePaymentMetadata {
  clerk_user_id: string;
  case_id: string;
  order_id: string;
  purchase_kind: typeof CASE_PROSPECT_PURCHASE;
}

export interface DodoPayment {
  payment_id: string;
  status: string;
  total_amount: number;
  currency: string;
  metadata: Record<string, unknown>;
  checkout_session_id: string | null;
  product_cart: Array<{ product_id: string; quantity: number }> | null;
  refund_status: "partial" | "full" | null;
}

export interface DodoRefund {
  payment_id: string;
  refund_id: string;
  status: "succeeded";
  is_partial: boolean;
  amount: number | null;
  currency: string | null;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_V4.test(value);
}

export function parseCasePaymentMetadata(value: unknown): CasePaymentMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const metadata = value as Record<string, unknown>;
  if (
    typeof metadata.clerk_user_id !== "string" || !metadata.clerk_user_id ||
    !isUuid(metadata.case_id) ||
    !isUuid(metadata.order_id) ||
    metadata.purchase_kind !== CASE_PROSPECT_PURCHASE
  ) return null;
  return {
    clerk_user_id: metadata.clerk_user_id,
    case_id: metadata.case_id,
    order_id: metadata.order_id,
    purchase_kind: CASE_PROSPECT_PURCHASE,
  };
}

export function parseDodoPayment(value: unknown): DodoPayment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const payment = value as Record<string, unknown>;
  const paymentId = payment.payment_id ?? payment.id;
  const amount = payment.total_amount ?? payment.settlement_amount ?? payment.amount;
  const currency = payment.currency ?? payment.settlement_currency;
  const checkoutSessionId = payment.checkout_session_id ?? null;
  const rawCart = payment.product_cart ?? null;
  const refundStatus = payment.refund_status ?? null;
  let productCart: DodoPayment["product_cart"] = null;
  if (rawCart !== null) {
    if (!Array.isArray(rawCart)) return null;
    productCart = [];
    for (const value of rawCart) {
      if (!value || typeof value !== "object" || Array.isArray(value)) return null;
      const item = value as Record<string, unknown>;
      if (typeof item.product_id !== "string" || !item.product_id
        || typeof item.quantity !== "number" || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return null;
      productCart.push({ product_id: item.product_id, quantity: item.quantity });
    }
  }
  if (
    typeof paymentId !== "string" || !paymentId ||
    typeof payment.status !== "string" ||
    typeof amount !== "number" || !Number.isInteger(amount) || amount < 0 ||
    typeof currency !== "string" || !currency ||
    !payment.metadata || typeof payment.metadata !== "object" || Array.isArray(payment.metadata) ||
    (checkoutSessionId !== null && (typeof checkoutSessionId !== "string" || !checkoutSessionId)) ||
    (refundStatus !== null && refundStatus !== "partial" && refundStatus !== "full")
  ) return null;
  return {
    payment_id: paymentId,
    status: payment.status,
    total_amount: amount,
    currency,
    metadata: payment.metadata as Record<string, unknown>,
    checkout_session_id: checkoutSessionId,
    product_cart: productCart,
    refund_status: refundStatus,
  };
}

export function parseDodoRefund(value: unknown): DodoRefund | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const refund = value as Record<string, unknown>;
  if (
    typeof refund.payment_id !== "string" || !refund.payment_id ||
    typeof refund.refund_id !== "string" || !refund.refund_id ||
    refund.status !== "succeeded" || typeof refund.is_partial !== "boolean" ||
    (refund.amount !== null && refund.amount !== undefined
      && (typeof refund.amount !== "number" || !Number.isSafeInteger(refund.amount) || refund.amount < 0)) ||
    (refund.currency !== null && refund.currency !== undefined
      && (typeof refund.currency !== "string" || !refund.currency))
  ) return null;
  return {
    payment_id: refund.payment_id,
    refund_id: refund.refund_id,
    status: "succeeded",
    is_partial: refund.is_partial,
    amount: typeof refund.amount === "number" ? refund.amount : null,
    currency: typeof refund.currency === "string" ? refund.currency : null,
  };
}
