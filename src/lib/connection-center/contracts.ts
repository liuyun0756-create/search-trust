import type { GoogleConnectionStatus } from "../google-connections/contracts";
import type { GoogleSource } from "../google-connections/scopes";

export const CONNECTION_CENTER_SCHEMA_VERSION = "connection_center_v1" as const;

export type ConnectionCenterSourceKey = "public_gbp" | GoogleSource | "official_gbp_performance";
export type ConnectionCenterUserStatus =
  | "needs_profile"
  | "needs_connection"
  | "needs_resource"
  | "needs_identity_confirmation"
  | "ready_to_sync"
  | "syncing"
  | "healthy"
  | "needs_attention"
  | "optional_unavailable";

export type ConnectionCenterActionCode =
  | "create_prospect_report"
  | "confirm_public_gbp"
  | "connect_google"
  | "select_resource"
  | "confirm_identity"
  | "sync_source"
  | "retry_sync"
  | "review_health"
  | "view_evidence"
  | "wait_for_sync"
  | "wait_for_verified_analysis"
  | "generate_verified_plan";

export interface ConnectionCenterAction {
  code: ConnectionCenterActionCode;
  label: string;
  source_key: ConnectionCenterSourceKey | null;
}

export interface ConnectionCenterJobSummary {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  attempt_count: number;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ConnectionCenterSnapshotSummary {
  id: string;
  health_status: string;
  effective_health_status: string;
  health_reasons: string[];
  fetched_at: string;
  expires_at: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  content_available: boolean;
}

export interface ConnectionCenterSource {
  source_key: ConnectionCenterSourceKey;
  title: string;
  required_for_verified_core: boolean;
  user_status: ConnectionCenterUserStatus;
  ready: boolean;
  summary: string;
  action: ConnectionCenterAction | null;
  technical_status: {
    connection_status: GoogleConnectionStatus | null;
    binding_id: string | null;
    resource_id: string | null;
    resource_name: string | null;
    identity_match_status: string;
    job: ConnectionCenterJobSummary | null;
    snapshot: ConnectionCenterSnapshotSummary | null;
    warnings: string[];
  };
}

export interface ConnectionCenterBlocker {
  code: string;
  message: string;
  source_key: ConnectionCenterSourceKey | null;
  action: ConnectionCenterAction;
}

export interface ConnectionCenterResponse {
  schema_version: typeof CONNECTION_CENTER_SCHEMA_VERSION;
  case: {
    id: string;
    business_name: string;
    site_url: string;
    updated_at: string;
  };
  coverage: {
    verified_core_ready: boolean;
    full_evidence_ready: boolean;
    verified_generation_enabled: boolean;
    ready_source_count: number;
    required_source_count: 3;
    parent_report_id: string | null;
    eligible_snapshot_ids: {
      gsc: string | null;
      ga4: string | null;
      gbp_performance: string | null;
    };
    blockers: ConnectionCenterBlocker[];
    next_action: ConnectionCenterAction;
  };
  sources: [ConnectionCenterSource, ConnectionCenterSource, ConnectionCenterSource];
  optional_sources: [ConnectionCenterSource];
}
