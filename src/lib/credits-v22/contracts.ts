export const CREDIT_TRANSACTION_KINDS = [
  "welcome_grant",
  "credit_purchase",
  "prospect_debit",
  "verified_debit",
  "technical_failure_credit",
  "purchase_refund_debit",
] as const;

export type CreditTransactionKind = typeof CREDIT_TRANSACTION_KINDS[number];

export interface CreditTransactionSummary {
  kind: CreditTransactionKind;
  delta: -1 | 1 | 5;
  balance_after: number;
  created_at: string;
}

export interface CreditAccountSummary {
  credit_balance: number;
  transactions: CreditTransactionSummary[];
}

function isTransactionKind(value: unknown): value is CreditTransactionKind {
  return typeof value === "string" && CREDIT_TRANSACTION_KINDS.includes(value as CreditTransactionKind);
}

export function parseCreditAccountSummary(value: unknown): CreditAccountSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (!Number.isSafeInteger(result.credit_balance) || (result.credit_balance as number) < 0
    || !Array.isArray(result.transactions)) return null;
  const transactions: CreditTransactionSummary[] = [];
  for (const raw of result.transactions) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const item = raw as Record<string, unknown>;
    if (!isTransactionKind(item.kind)
      || ![-1, 1, 5].includes(item.delta as number)
      || !Number.isSafeInteger(item.balance_after) || (item.balance_after as number) < 0
      || typeof item.created_at !== "string" || !Number.isFinite(Date.parse(item.created_at))) return null;
    transactions.push(item as unknown as CreditTransactionSummary);
  }
  return { credit_balance: result.credit_balance as number, transactions };
}
