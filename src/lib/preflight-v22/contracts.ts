import type { BusinessIdentity, TargetMarket } from "@/lib/report-v22/generated/types";

export type WorkGoal = "win_new_client" | "work_existing_client";
export type Confidence = "low" | "medium" | "high";
export type IdentityComparisonField = "business_name" | "phone" | "address" | "service_area";
export type IdentityComparisonStatus = "exact_match" | "partial_match" | "not_matched" | "error";

export interface PreflightRequest {
  site_url: string;
  gbp_url?: string | null;
  primary_service?: string | null;
  target_market?: TargetMarket | null;
}

export interface IdentityFieldComparison {
  field: IdentityComparisonField;
  site_value: string | null;
  gbp_value: string | null;
  status: IdentityComparisonStatus;
  reason: string;
}

export interface BusinessIdentityCandidate {
  business: BusinessIdentity;
  confidence: Confidence;
  match_reasons: string[];
  requires_confirmation: boolean;
  field_comparisons: IdentityFieldComparison[];
}

export interface TextCandidate {
  value: string;
  confidence: Confidence;
  evidence_summary: string;
}

export interface MarketCandidate {
  market: TargetMarket;
  confidence: Confidence;
  evidence_summary: string;
}

export interface CompetitorCandidate {
  competitor_id: string;
  business_name: string;
  website_url: string;
  public_gbp_url: string | null;
  query_appearance_count: number;
  best_position: number;
  relevance_reason: string;
  confidence: Confidence;
}

export interface DataGap {
  gap_code: string;
  message: string;
  blocking: boolean;
  resolution: string;
}

export interface ModuleAvailability {
  module_key:
    | "site_inventory"
    | "site_deep_analysis"
    | "serp_maps"
    | "serp_local_pack"
    | "serp_organic"
    | "public_gbp"
    | "competitor_analysis"
    | "pagespeed";
  available: boolean;
  reason: string;
}

export interface PreflightResponse {
  preflight_id: string;
  normalized_site_url: string;
  identity_candidates: BusinessIdentityCandidate[];
  service_candidates: TextCandidate[];
  market_candidates: MarketCandidate[];
  competitor_candidates: CompetitorCandidate[];
  module_availability: ModuleAvailability[];
  data_gaps: DataGap[];
  estimated_duration_bucket: "under_5_minutes" | "5_to_10_minutes" | "10_to_15_minutes";
  coverage_summary: string;
}

export interface CompetitorDiscoveryRequest {
  case_id: string;
  business_identity: BusinessIdentity;
  primary_service: string;
  target_market: TargetMarket;
  queries: string[];
  search_language?: string;
  search_device?: "desktop" | "mobile";
  supplemental_website_urls?: string[];
}

export interface CompetitorDiscoveryTaskCreateResponse {
  discovery_job_id: string;
  status: "queued";
  estimated_seconds: number;
}

export type CompetitorDiscoveryStage =
  | "queued"
  | "collecting_market"
  | "ranking_candidates"
  | "validating_supplements"
  | "completed"
  | "failed";

export interface CompetitorDiscoveryError {
  error_code: string;
  user_message: string;
  retryable: boolean;
  stage: CompetitorDiscoveryStage;
  diagnostic_id: string;
}

export interface CompetitorDiscoveryResult {
  discovery_id: string;
  case_id: string;
  input_digest: string;
  candidate_digest: string;
  market_snapshot_id: string;
  market_snapshot_checksum: string;
  candidates: CompetitorCandidate[];
  ready_for_confirmation: boolean;
  data_gaps: DataGap[];
  limitations: string[];
  created_at: string;
  expires_at: string;
}

export interface CompetitorDiscoveryStatusResponse {
  discovery_job_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  stage: CompetitorDiscoveryStage;
  progress: number;
  message: string;
  result: CompetitorDiscoveryResult | null;
  error: CompetitorDiscoveryError | null;
  created_at: string;
  updated_at: string;
}

export interface CompetitorDiscoveryRetryResponse {
  discovery_job_id: string;
  status: "queued";
  attempt_count: number;
}

export interface ApiErrorPayload {
  error: { code: string; message: string };
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: Array<{ path: string; message: string }> };
