import type { SearchTrustReportV2_2 } from "@/lib/report-v22/generated/types";

export type JsonPrimitive = string | number | boolean | null;
export type Json = JsonPrimitive | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };

export interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  name: string | null;
  audit_credits: number;
  created_at: string;
  updated_at: string;
}

export interface ClientCase {
  id: string;
  user_id: string;
  site_url: string;
  normalized_domain: string;
  business_name: string;
  business_identity: JsonObject;
  operating_model: "storefront" | "service_area" | "hybrid";
  primary_service: string;
  target_market: JsonObject;
  status: "active" | "archived";
  latest_report_id: string | null;
  location_key: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleConnection {
  id: string;
  user_id: string;
  google_subject: string;
  account_email: string | null;
  account_display_name: string | null;
  granted_scopes: string[];
  access_token_ciphertext: string | null;
  access_token_iv: string | null;
  access_token_auth_tag: string | null;
  refresh_token_ciphertext: string | null;
  refresh_token_iv: string | null;
  refresh_token_auth_tag: string | null;
  encryption_key_version: string | null;
  token_expires_at: string | null;
  status: "active" | "error" | "revoked" | "deleted";
  last_error_code: string | null;
  last_error_message: string | null;
  connected_at: string;
  revoked_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaseSourceBinding {
  id: string;
  case_id: string;
  connection_id: string | null;
  source_type: "gsc" | "ga4" | "gbp";
  external_resource_id: string;
  external_resource_name: string;
  identity_match_status: "not_checked" | "matched" | "mismatch" | "needs_confirmation";
  identity_match_evidence: JsonObject;
  health_status: "not_checked" | "healthy" | "unhealthy" | "unavailable" | "expired" | "error";
  health_reasons: Json[];
  is_active: boolean;
  confirmed_by_user_id: string | null;
  confirmed_at: string | null;
  last_synced_at: string | null;
  disconnected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataSnapshot {
  id: string;
  case_id: string;
  binding_id: string | null;
  source_type: "site" | "serp" | "competitor" | "gsc" | "gbp" | "ga4" | "pagespeed";
  schema_version: string;
  coverage_start: string | null;
  coverage_end: string | null;
  fetched_at: string;
  expires_at: string | null;
  sync_trigger: "report_generation" | "user_sync" | "retry" | "migration";
  health_status: "not_checked" | "healthy" | "unhealthy" | "unavailable" | "expired" | "error";
  health_reasons: Json[];
  normalized_payload: JsonObject;
  raw_payload: JsonObject | Json[] | null;
  payload_checksum: string;
  provider_request_context: JsonObject;
  retention_policy: "standard" | "gbp_content_30d";
  raw_content_deleted_at: string | null;
  supersedes_snapshot_id: string | null;
  created_at: string;
}

export interface AnalysisJob {
  id: string;
  case_id: string;
  report_id: string | null;
  job_type: "prospect_report" | "verified_report" | "source_sync";
  status: "queued" | "running" | "succeeded" | "failed";
  current_stage: string;
  progress: number;
  attempt_count: number;
  idempotency_key: string;
  error_code: string | null;
  user_message: string | null;
  cost_counters: JsonObject;
  started_at: string | null;
  heartbeat_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  report_id: string;
  external_report_id?: string | null;
  user_id: string;
  page_url: string;
  page_type: string | null;
  gbp_url: string | null;
  gbp_connected?: boolean | null;
  task_id: string | null;
  status: "pending" | "free_preview" | "paid_full" | "failed";
  access_type?: "free_trial" | "paid_credit" | "unlocked";
  completed_at?: string | null;
  analysis_started_at?: string | null;
  last_progress_at?: string | null;
  estimated_completion_at?: string | null;
  trust_status: string | null;
  ranking_potential: string | null;
  risk_level: string | null;
  generated_at: string | null;
  module_1_overview: Record<string, any> | null;
  module_2_page_level: Record<string, any> | null;
  module_3_key_problems: Record<string, any> | null;
  module_4_eight_layers: Record<string, any> | null;
  module_5_optimization: Record<string, any> | null;
  report_v2_1?: unknown | null;
  pipeline_diagnostics?: Record<string, any> | null;
  source_facts?: Record<string, any> | null;
  case_id?: string | null;
  report_type?: "prospect" | "verified_execution" | null;
  schema_version?: string | null;
  version_number?: number | null;
  parent_report_id?: string | null;
  report_v2_2?: SearchTrustReportV2_2 | null;
  snapshot_ids?: string[] | null;
  coverage_state?: JsonObject | null;
  version_diff?: JsonObject | null;
  generation_config?: JsonObject | null;
  ruleset_version?: string | null;
  copy_model_version?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  user_message?: string | null;
  retryable?: boolean | null;
  validation_errors?: string[] | null;
  warnings?: string[] | null;
  failure_reason?: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  order_id: string;
  amount: number;
  credits_purchased: number;
  status: "pending" | "paid" | "failed" | "refunded";
  created_at: string;
  paid_at: string | null;
}

export type GenerateReportRequest = {
  url: string;
  page_type: string;
  gbp_url: string;
};

export type GenerateReportResponse = {
  report_id: string;
  database_report_id?: string | null;
  page_url: string;
  page_type: string;
  gbp_url: string | null;
  gbp_connected?: boolean | null;
  task_id: string;
  created_at: string;
  trust_status: string | null;
  ranking_potential: string | null;
  risk_level: string | null;
  module_1_overview: Record<string, any>;
  module_2_page_level: Record<string, any>;
  module_3_key_problems: Record<string, any>;
  module_4_eight_layers: Record<string, any>;
  module_5_optimization: Record<string, any>;
  report_v2_1?: unknown | null;
  pipeline_diagnostics?: Record<string, any> | null;
  source_facts?: Record<string, any> | null;
};
