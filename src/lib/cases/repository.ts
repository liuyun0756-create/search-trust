import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessIdentity } from "@/lib/report-v22/generated/types";
import type { ClientCase } from "@/types/database";
import type { CaseListQuery, CaseLocation, CaseOperatingModel, CaseStatus } from "./contracts";

export type CaseRecord = Omit<ClientCase, "business_identity" | "target_market"> & {
  business_identity: BusinessIdentity;
  target_market: CaseLocation;
};

export interface CreateCaseRecord {
  user_id: string;
  site_url: string;
  normalized_domain: string;
  business_name: string;
  business_identity: BusinessIdentity;
  operating_model: CaseOperatingModel;
  primary_service: string;
  target_market: CaseLocation;
}

export interface UpdateCaseRecord {
  business_name?: string;
  business_identity?: BusinessIdentity;
  operating_model?: CaseOperatingModel;
  primary_service?: string;
  target_market?: CaseLocation;
  status?: CaseStatus;
  archived_at?: string | null;
}

export interface CaseListResult {
  items: CaseRecord[];
  total: number;
}

export interface CaseRepository {
  create(input: CreateCaseRecord): Promise<CaseRecord>;
  findById(userId: string, caseId: string): Promise<CaseRecord | null>;
  findDuplicate(
    userId: string,
    normalizedDomain: string,
    locationKey: string,
    excludeCaseId?: string,
  ): Promise<CaseRecord | null>;
  list(userId: string, query: CaseListQuery): Promise<CaseListResult>;
  updateActive(userId: string, caseId: string, input: UpdateCaseRecord): Promise<CaseRecord | null>;
  archiveActive(userId: string, caseId: string, archivedAt: string): Promise<CaseRecord | null>;
  restoreArchived(userId: string, caseId: string): Promise<CaseRecord | null>;
}

export class CasePersistenceError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "CasePersistenceError";
    this.code = code;
  }
}

const CASE_COLUMNS = "id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market,status,latest_report_id,location_key,archived_at,created_at,updated_at";

function persistenceError(error: { message: string; code?: string | null }): CasePersistenceError {
  return new CasePersistenceError(error.message, error.code ?? null);
}

export class SupabaseCaseRepository implements CaseRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: CreateCaseRecord): Promise<CaseRecord> {
    const { data, error } = await this.supabase
      .from("client_cases")
      .insert(input)
      .select(CASE_COLUMNS)
      .single();
    if (error || !data) throw persistenceError(error ?? { message: "Case insert returned no row." });
    return data as CaseRecord;
  }

  async findById(userId: string, caseId: string): Promise<CaseRecord | null> {
    const { data, error } = await this.supabase
      .from("client_cases")
      .select(CASE_COLUMNS)
      .eq("user_id", userId)
      .eq("id", caseId)
      .maybeSingle();
    if (error) throw persistenceError(error);
    return data as CaseRecord | null;
  }

  async findDuplicate(
    userId: string,
    normalizedDomain: string,
    locationKey: string,
    excludeCaseId?: string,
  ): Promise<CaseRecord | null> {
    let query = this.supabase
      .from("client_cases")
      .select(CASE_COLUMNS)
      .eq("user_id", userId)
      .eq("normalized_domain", normalizedDomain)
      .eq("location_key", locationKey);
    if (excludeCaseId) query = query.neq("id", excludeCaseId);
    const { data, error } = await query.limit(1).maybeSingle();
    if (error) throw persistenceError(error);
    return data as CaseRecord | null;
  }

  async list(userId: string, query: CaseListQuery): Promise<CaseListResult> {
    let request = this.supabase
      .from("client_cases")
      .select(CASE_COLUMNS, { count: "exact" })
      .eq("user_id", userId);
    if (query.status !== "all") request = request.eq("status", query.status);
    const { data, error, count } = await request
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .range(query.offset, query.offset + query.limit - 1);
    if (error) throw persistenceError(error);
    return { items: (data ?? []) as CaseRecord[], total: count ?? 0 };
  }

  async updateActive(userId: string, caseId: string, input: UpdateCaseRecord): Promise<CaseRecord | null> {
    const { data, error } = await this.supabase
      .from("client_cases")
      .update(input)
      .eq("user_id", userId)
      .eq("id", caseId)
      .eq("status", "active")
      .select(CASE_COLUMNS)
      .maybeSingle();
    if (error) throw persistenceError(error);
    return data as CaseRecord | null;
  }

  async archiveActive(userId: string, caseId: string, archivedAt: string): Promise<CaseRecord | null> {
    const { data, error } = await this.supabase
      .from("client_cases")
      .update({ status: "archived", archived_at: archivedAt })
      .eq("user_id", userId)
      .eq("id", caseId)
      .eq("status", "active")
      .select(CASE_COLUMNS)
      .maybeSingle();
    if (error) throw persistenceError(error);
    return data as CaseRecord | null;
  }

  async restoreArchived(userId: string, caseId: string): Promise<CaseRecord | null> {
    const { data, error } = await this.supabase
      .from("client_cases")
      .update({ status: "active", archived_at: null })
      .eq("user_id", userId)
      .eq("id", caseId)
      .eq("status", "archived")
      .select(CASE_COLUMNS)
      .maybeSingle();
    if (error) throw persistenceError(error);
    return data as CaseRecord | null;
  }
}
