import "server-only";

import { createServerClient } from "../supabase";
import { SupabaseReportShareRepository } from "./repository";
import { ReportShareService } from "./service";

export function createServerReportShareService() {
  return new ReportShareService(new SupabaseReportShareRepository(createServerClient()));
}
