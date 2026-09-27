import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { findUserReportByIdentifier } from "@/lib/server/reportLookup";
import { selectValidatedReportV22 } from "./access";
import type { SearchTrustReportV2_2 } from "./generated/types";

type LoadUserReportV22Result =
  | { ok: true; report: SearchTrustReportV2_2; databaseId: string }
  | { ok: false; reason: "not_found" | "invalid" };

export async function loadUserReportV22(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
  reportId: string,
): Promise<LoadUserReportV22Result> {
  const { data, error } = await findUserReportByIdentifier(supabase, userId, reportId);

  if (error) {
    return { ok: false, reason: "not_found" };
  }
  const selected = selectValidatedReportV22(data, caseId);
  if (!selected.ok) return selected;
  if (!data) return { ok: false, reason: "not_found" };
  return { ...selected, databaseId: data.id };
}
