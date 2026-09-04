import type { BusinessIdentity, SearchTrustReportV2_2, TargetMarket } from "@/lib/report-v22";

export interface ConfirmedCompetitor {
  competitor_id: string;
  business_name: string;
  website_url: string;
  public_gbp_url: string | null;
  confirmation_source: "user" | "system";
}

export interface AnalyzeRequest {
  case_id: string;
  report_type: "prospect";
  business_identity: BusinessIdentity;
  primary_service: string;
  target_market: TargetMarket;
  queries: string[];
  competitors: ConfirmedCompetitor[];
  first_party_snapshots?: [];
  parent_report?: null;
}

export interface TaskCreateResponse {
  job_id: string;
  status: "queued";
  estimated_seconds: number;
}

export type AnalysisStage =
  | "queued"
  | "collecting_site"
  | "collecting_market"
  | "collecting_competitors"
  | "building_evidence"
  | "evaluating"
  | "generating_copy"
  | "validating"
  | "persisting"
  | "completed"
  | "failed";

export interface AnalysisError {
  error_code: string;
  user_message: string;
  retryable: boolean;
  stage: AnalysisStage;
  diagnostic_id: string;
}

export interface TaskStatusResponse {
  job_id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  stage: AnalysisStage;
  progress: number;
  message: string;
  report: SearchTrustReportV2_2 | null;
  error: AnalysisError | null;
  created_at: string;
  updated_at: string;
  database_report_id?: string | null;
}

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: Array<{ path: string; message: string }> };
