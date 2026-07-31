import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Report } from "@/types/database";

type ReportLookupResult = {
  data: Report | null;
  error: PostgrestError | null;
};

export async function findUserReportByIdentifier(
  supabase: SupabaseClient,
  userId: string,
  identifier: string
): Promise<ReportLookupResult> {
  const fields = isDatabaseUuid(identifier)
    ? ["id"]
    : ["report_id", "external_report_id"];

  for (const field of fields) {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("user_id", userId)
      .eq(field, identifier)
      .maybeSingle();

    if (error) {
      return { data: null, error };
    }
    if (data) {
      return { data: data as Report, error: null };
    }
  }

  return { data: null, error: null };
}

function isDatabaseUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
