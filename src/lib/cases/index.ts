import "server-only";

import { createServerClient } from "@/lib/supabase";
import { SupabaseCaseRepository } from "./repository";
import { createCaseService } from "./service";

export function createServerCaseService() {
  return createCaseService(new SupabaseCaseRepository(createServerClient()));
}

export type { CaseService, CaseResource, CasePage } from "./service";
