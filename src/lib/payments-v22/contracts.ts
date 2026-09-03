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
  if (
    typeof paymentId !== "string" || !paymentId ||
    typeof payment.status !== "string" ||
    typeof amount !== "number" || !Number.isInteger(amount) || amount < 0 ||
    typeof currency !== "string" || !currency ||
    !payment.metadata || typeof payment.metadata !== "object" || Array.isArray(payment.metadata)
  ) return null;
  return {
    payment_id: paymentId,
    status: payment.status,
    total_amount: amount,
    currency,
    metadata: payment.metadata as Record<string, unknown>,
  };
}

