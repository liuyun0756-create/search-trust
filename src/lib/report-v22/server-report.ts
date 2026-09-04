import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { findUserReportByIdentifier } from "@/lib/server/reportLookup";
import { selectValidatedReportV22, type SelectReportV22Result } from "./access";

export async function loadUserReportV22(
  supabase: SupabaseClient,
  userId: string,
  caseId: string,
  reportId: string,
): Promise<SelectReportV22Result> {
  const { data, error } = await findUserReportByIdentifier(supabase, userId, reportId);

  if (error) {
    return { ok: false, reason: "not_found" };
  }
  return selectValidatedReportV22(data, caseId);
}
