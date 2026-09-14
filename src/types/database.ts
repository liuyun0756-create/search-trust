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
  latest_verified_report_id: string | null;
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
  refresh_lease_id: string | null;
  refresh_lease_expires_at: string | null;
  status: "active" | "error" | "reauth_required" | "revoked" | "deleted";
  last_error_code: string | null;
  last_error_message: string | null;
  connected_at: string;
  revoked_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleOAuthSession {
  id: string;
  user_id: string;
  case_id: string | null;
  connection_id: string | null;
  state_digest: string;
  pkce_verifier_ciphertext: string;
  pkce_verifier_iv: string;
  pkce_verifier_auth_tag: string;
  encryption_key_version: string;
  requested_sources: Array<"gsc" | "ga4" | "gbp">;
  requested_scopes: string[];
  return_path: string;
  expires_at: string;
  consumed_at: string | null;
  outcome_code: string | null;
  created_at: string;
}

export interface GoogleConnectionEvent {
  id: string;
  user_id: string;
  connection_id: string | null;
  case_id: string | null;
  event_type:
    | "authorization_started"
    | "authorization_succeeded"
    | "authorization_denied"
    | "authorization_failed"
    | "scope_extended"
    | "refresh_succeeded"
    | "refresh_failed"
    | "revoked"
    | "deleted";
  requested_sources: Array<"gsc" | "ga4" | "gbp">;
  covered_sources: Array<"gsc" | "ga4" | "gbp">;
  result_code: string;
  request_id: string;
  created_at: string;
}

export interface GoogleTokenBrokerRequest {
  request_id: string;
  nonce_digest: string;
  connection_id: string;
  source_type: "gsc" | "ga4" | "gbp";
  requested_at: string;
  expires_at: string;
  created_at: string;
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
  state_revision: number;
  terminal_effects_revision: number;
  created_at: string;
  updated_at: string;
}

export interface JobCostSummary {
  job_id: string;
  case_id: string;
  job_kind:
    | "competitor_discovery"
    | "prospect_report"
    | "verified_report"
    | "gsc_sync"
    | "ga4_sync"
    | "gbp_sync";
  status: "succeeded" | "failed";
  attempt_count: number;
  ledger_revision: number;
  cost_counters: JsonObject;
  started_at: string;
  completed_at: string;
  created_at: string;
  updated_at: string;
}

export interface VerifiedAnalysisInput {
  job_id: string;
  case_id: string;
  parent_report_id: string;
  gsc_snapshot_id: string;
  ga4_snapshot_id: string;
  public_gbp_snapshot_id: string;
  parent_snapshot_ids: string[];
  parent_payload: SearchTrustReportV2_2;
  parent_payload_checksum: string;
  input_schema_version: "v22_verified_job_input_v1";
  created_at: string;
}

export interface StartV22VerifiedAnalysisArgs {
  p_user_id: string;
  p_case_id: string;
  p_job_id: string;
  p_idempotency_key: string;
  p_parent_payload_checksum: string;
  p_expected_parent_report_id: string;
  p_previous_job_id?: string | null;
}

export interface StartV22VerifiedAnalysisResult {
  job_id: string;
  created: boolean;
  idempotent: boolean;
  parent_report_id: string;
  gsc_snapshot_id: string;
  ga4_snapshot_id: string;
  public_gbp_snapshot_id: string;
  audit_credits: number;
}

export interface ResolveV22VerifiedAnalysisInputArgs {
  p_job_id: string;
  p_case_id: string;
  p_run_generation: number;
}

export interface VerifiedResolvedSourceSnapshot {
  snapshot_id: string;
  case_id: string;
  source_type: "site" | "serp" | "competitor";
  schema_version: string;
  normalized_payload: JsonObject;
  payload_checksum: string;
  created_at: string;
  fetched_at: string;
  expires_at: string | null;
}

export interface VerifiedResolvedPublicGbpSnapshot extends Omit<VerifiedResolvedSourceSnapshot, "source_type" | "expires_at"> {
  source_type: "gbp";
  schema_version: "customer_public_gbp_snapshot_v1";
  expires_at: string;
  reference: {
    case_id: string;
    site_url: string;
    public_gbp_url: string;
    entity_keys: Array<{ kind: "place_id" | "data_id" | "cid"; value: string }>;
    confirmation_source: "user";
    confirmed_at: string;
  };
}

export interface VerifiedResolvedFirstPartySnapshot {
  snapshot_id: string;
  case_id: string;
  binding_id: string;
  source_type: "gsc" | "ga4";
  schema_version: "gsc_sync_v1" | "ga4_sync_v1";
  fetched_at: string;
  expires_at: string;
  identity_match_status: "matched";
  health_status: "healthy";
  health_reasons: Json[];
  normalized_payload: JsonObject;
  raw_payload: null;
  payload_checksum: string;
  external_resource_id: string;
  coverage_start: string;
  coverage_end: string;
}

export interface ResolveV22VerifiedAnalysisInputResult {
  schema_version: "v22_verified_resolved_input_v1";
  job_id: string;
  case_id: string;
  parent_report: SearchTrustReportV2_2;
  parent_payload_checksum: string;
  site_snapshot: VerifiedResolvedSourceSnapshot;
  serp_snapshot: VerifiedResolvedSourceSnapshot;
  competitor_snapshot: VerifiedResolvedSourceSnapshot;
  public_gbp_snapshot: VerifiedResolvedPublicGbpSnapshot;
  first_party_snapshots: [VerifiedResolvedFirstPartySnapshot, VerifiedResolvedFirstPartySnapshot];
}

export interface PersistV22VerifiedResultArgs extends ResolveV22VerifiedAnalysisInputArgs {
  p_report_payload: SearchTrustReportV2_2;
}

export interface PersistV22VerifiedResultResult {
  report_id: string;
  idempotent: boolean;
}

export interface ExpireV22StaleVerifiedJobsArgs {
  p_now: string;
  p_limit?: number;
}

export interface VerifiedAnalysisDatabaseFunctions {
  start_v22_verified_analysis: { Args: StartV22VerifiedAnalysisArgs; Returns: StartV22VerifiedAnalysisResult[] };
  resolve_v22_verified_analysis_input: { Args: ResolveV22VerifiedAnalysisInputArgs; Returns: ResolveV22VerifiedAnalysisInputResult };
  persist_v22_verified_result: { Args: PersistV22VerifiedResultArgs; Returns: PersistV22VerifiedResultResult[] };
  expire_v22_stale_verified_jobs: { Args: ExpireV22StaleVerifiedJobsArgs; Returns: Array<{ job_id: string }> };
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
  payment_id?: string | null;
  order_id: string | null;
  case_id?: string | null;
  purchase_kind?: "legacy_credit" | "case_prospect_report" | "case_verified_credit";
  checkout_session_id?: string | null;
  checkout_url?: string | null;
  provider_product_id?: string | null;
  amount: number;
  currency?: string | null;
  credits_purchased: number;
  status: "pending" | "paid" | "failed" | "refunded";
  created_at: string;
  paid_at: string | null;
}

export interface AuditCreditLedger {
  id: string;
  user_id: string;
  case_id: string | null;
  job_id: string | null;
  order_id: string | null;
  kind: "attempt_debit" | "technical_failure_credit" | "purchase_credit"
    | "payment_refund_debit" | "payment_refund_manual_review";
  delta: -1 | 0 | 1;
  balance_after: number;
  created_at: string;
}

export interface FulfillV22VerifiedCreditPaymentArgs {
  p_local_order_id: string;
  p_payment_id: string;
  p_clerk_user_id: string;
  p_case_id: string;
  p_amount: number;
  p_currency: string;
  p_checkout_session_id: string;
  p_product_id: string;
}

export interface FulfillV22VerifiedCreditPaymentResult {
  fulfilled: boolean;
  idempotent: boolean;
  credits_added: number;
  audit_credits: number;
}

export type RefundV22VerifiedCreditPaymentArgs = FulfillV22VerifiedCreditPaymentArgs;

export interface RefundV22VerifiedCreditPaymentResult {
  refunded: boolean;
  idempotent: boolean;
  /** On replay, reports whether the original refund debited the credit. */
  reversal_applied: boolean;
  manual_review: boolean;
  audit_credits: number;
}

export interface VerifiedCreditPaymentDatabaseFunctions {
  fulfill_v22_verified_credit_payment: {
    Args: FulfillV22VerifiedCreditPaymentArgs;
    Returns: FulfillV22VerifiedCreditPaymentResult[];
  };
  refund_v22_verified_credit_payment: {
    Args: RefundV22VerifiedCreditPaymentArgs;
    Returns: RefundV22VerifiedCreditPaymentResult[];
  };
}

export interface CaseReportEntitlement {
  id: string;
  user_id: string;
  case_id: string;
  order_id: string;
  report_type: "prospect";
  status: "available" | "reserved" | "consumed" | "payment_refunded";
  reserved_job_id: string | null;
  consumed_report_id: string | null;
  reserved_at: string | null;
  consumed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportShare {
  id: string;
  user_id: string;
  case_id: string;
  report_id: string;
  token_hash: string;
  view_mode: "client";
  expires_at: string;
  revoked_at: string | null;
  last_accessed_at: string | null;
  created_at: string;
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
