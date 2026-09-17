import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { parseCreditAccountSummary, type CreditAccountSummary } from "./contracts";

export interface CreditRepository {
  getAccountSummary(userId: string): Promise<CreditAccountSummary>;
}

export class CreditPersistenceError extends Error {
  constructor() {
    super("Credit account persistence failed.");
    this.name = "CreditPersistenceError";
  }
}

export class SupabaseCreditRepository implements CreditRepository {
  constructor(private readonly db: SupabaseClient) {}

  async getAccountSummary(userId: string): Promise<CreditAccountSummary> {
    const [account, ledger] = await Promise.all([
      this.db.from("users").select("credit_balance").eq("id", userId).maybeSingle(),
      this.db.from("credit_ledger").select("kind,delta,balance_after,created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    ]);
    const parsed = parseCreditAccountSummary({
      credit_balance: account.data?.credit_balance,
      transactions: ledger.data,
    });
    if (account.error || ledger.error || !parsed) throw new CreditPersistenceError();
    return parsed;
  }
}
