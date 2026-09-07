import type { GoogleConnectionStatus } from "../google-connections/contracts";
import { sourceHasRequiredScopes, type GoogleSource } from "../google-connections/scopes";
import {
  CONNECTION_CENTER_SCHEMA_VERSION,
  type ConnectionCenterAction,
  type ConnectionCenterBlocker,
  type ConnectionCenterJobSummary,
  type ConnectionCenterResponse,
  type ConnectionCenterSnapshotSummary,
  type ConnectionCenterSource,
  type ConnectionCenterSourceKey,
} from "./contracts";

export interface ConnectionCenterCaseInput {
  id: string;
  business_name: string;
  site_url: string;
  updated_at: string;
  latest_report_id: string | null;
  public_gbp_url: string | null;
}

export interface ConnectionCenterParentReportInput {
  id: string;
  case_id: string;
  identity_matches_case: boolean;
  public_gbp_url: string | null;
  public_gbp_snapshot_id: string | null;
  public_gbp_fetched_at: string | null;
  public_gbp_health_status: string;
  public_gbp_identity_match_status: string;
}

export interface ConnectionCenterConnectionInput {
  id: string;
  status: GoogleConnectionStatus;
  granted_scopes: string[];
}

export interface ConnectionCenterBindingInput {
  id: string;
  source_type: GoogleSource;
  connection_id: string | null;
  external_resource_id: string;
  external_resource_name: string;
  identity_match_status: string;
  confirmed_at: string | null;
}

export interface ConnectionCenterJobInput {
  id: string;
  binding_id: string;
  source_type: GoogleSource;
  status: "queued" | "running" | "succeeded" | "failed";
  attempt_count: number;
  error_code: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ConnectionCenterSnapshotInput {
  id: string;
  binding_id: string | null;
  source_type: GoogleSource;
  health_status: string;
  health_reasons: unknown;
  fetched_at: string;
  expires_at: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  raw_content_deleted_at: string | null;
}

export interface ConnectionCenterProjectionInput {
  case: ConnectionCenterCaseInput;
  parent_report: ConnectionCenterParentReportInput | null;
  connections: ConnectionCenterConnectionInput[];
  bindings: ConnectionCenterBindingInput[];
  jobs: ConnectionCenterJobInput[];
  snapshots: ConnectionCenterSnapshotInput[];
  flags: {
    gsc_sync_enabled: boolean;
    ga4_sync_enabled: boolean;
    official_gbp_sync_enabled: boolean;
    verified_generation_enabled: boolean;
  };
}

const TITLES: Record<ConnectionCenterSourceKey, string> = {
  public_gbp: "Public Business Profile",
  gsc: "Search Console",
  ga4: "Google Analytics",
  gbp: "Official Business Profile",
  official_gbp_performance: "Official GBP Performance",
};

const ACTIVE_JOB_STATUSES = new Set(["queued", "running"]);

function action(code: ConnectionCenterAction["code"], label: string, sourceKey: ConnectionCenterSourceKey | null): ConnectionCenterAction {
  return { code, label, source_key: sourceKey };
}

function latestBy<T>(values: T[], timestamp: (value: T) => string): T | null {
  return [...values].sort((left, right) => timestamp(right).localeCompare(timestamp(left)))[0] ?? null;
}

function safeCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && /^[A-Z0-9_]{1,120}$/.test(item)).slice(0, 20);
}

function safeErrorCode(value: string | null): string | null {
  return value && /^[A-Z0-9_]{1,120}$/.test(value) ? value : null;
}

function jobSummary(job: ConnectionCenterJobInput | null): ConnectionCenterJobSummary | null {
  return job ? {
    id: job.id,
    status: job.status,
    attempt_count: job.attempt_count,
    error_code: safeErrorCode(job.error_code),
    created_at: job.created_at,
    completed_at: job.completed_at,
  } : null;
}

function snapshotSummary(snapshot: ConnectionCenterSnapshotInput | null, effectiveHealth: string, contentAvailable: boolean): ConnectionCenterSnapshotSummary | null {
  return snapshot ? {
    id: snapshot.id,
    health_status: snapshot.health_status,
    effective_health_status: effectiveHealth,
    health_reasons: safeCodes(snapshot.health_reasons),
    fetched_at: snapshot.fetched_at,
    expires_at: snapshot.expires_at,
    coverage_start: snapshot.coverage_start,
    coverage_end: snapshot.coverage_end,
    content_available: contentAvailable,
  } : null;
}

function publicGbpSource(input: ConnectionCenterProjectionInput): ConnectionCenterSource {
  const report = input.parent_report;
  const hasUrl = Boolean(input.case.public_gbp_url);
  const sameIdentity = Boolean(
    report &&
    input.case.latest_report_id === report.id &&
    report.case_id === input.case.id &&
    report.identity_matches_case &&
    report.public_gbp_url === input.case.public_gbp_url,
  );
  const ready = Boolean(
    hasUrl &&
    sameIdentity &&
    report?.public_gbp_snapshot_id &&
    report.public_gbp_fetched_at &&
    report.public_gbp_health_status === "healthy" &&
    report.public_gbp_identity_match_status === "matched",
  );

  let userStatus: ConnectionCenterSource["user_status"] = "healthy";
  let summary = "Confirmed public Google Maps evidence is ready. No owner account is required.";
  let sourceAction: ConnectionCenterAction | null = action("view_evidence", "View public evidence", "public_gbp");
  if (!hasUrl) {
    userStatus = "needs_profile";
    summary = "Add and confirm this business's Google Maps profile before verified analysis.";
    sourceAction = action("confirm_public_gbp", "Add or confirm Business Profile", "public_gbp");
  } else if (!report) {
    userStatus = "needs_attention";
    summary = "A current prospect report is required to bind public Business Profile evidence.";
    sourceAction = action("create_prospect_report", "Create prospect report", "public_gbp");
  } else if (!ready) {
    userStatus = "needs_attention";
    summary = "The saved public Business Profile evidence is missing, stale, or not confirmed.";
    sourceAction = action("confirm_public_gbp", "Review Business Profile evidence", "public_gbp");
  }

  return {
    source_key: "public_gbp",
    title: TITLES.public_gbp,
    required_for_verified_core: true,
    user_status: userStatus,
    ready,
    summary,
    action: sourceAction,
    technical_status: {
      connection_status: null,
      binding_id: null,
      resource_id: input.case.public_gbp_url,
      resource_name: input.case.business_name,
      identity_match_status: report?.public_gbp_identity_match_status ?? "not_checked",
      job: null,
      snapshot: report?.public_gbp_snapshot_id && report.public_gbp_fetched_at ? {
        id: report.public_gbp_snapshot_id,
        health_status: report.public_gbp_health_status,
        effective_health_status: report.public_gbp_health_status,
        health_reasons: [],
        fetched_at: report.public_gbp_fetched_at,
        expires_at: null,
        coverage_start: null,
        coverage_end: null,
        content_available: true,
      } : null,
      warnings: [],
    },
  };
}

function sourceSyncEnabled(input: ConnectionCenterProjectionInput, source: GoogleSource): boolean {
  if (source === "gsc") return input.flags.gsc_sync_enabled;
  if (source === "ga4") return input.flags.ga4_sync_enabled;
  return input.flags.official_gbp_sync_enabled;
}

function googleSource(input: ConnectionCenterProjectionInput, source: GoogleSource, now: Date, optional = false): ConnectionCenterSource {
  const sourceKey: ConnectionCenterSourceKey = optional ? "official_gbp_performance" : source;
  const binding = input.bindings.find((item) => item.source_type === source) ?? null;
  const connection = binding ? input.connections.find((item) => item.id === binding.connection_id) ?? null : null;
  const usableConnections = input.connections.filter((item) => item.status === "active" && sourceHasRequiredScopes(source, item.granted_scopes));
  const connectionUsable = Boolean(connection?.status === "active" && sourceHasRequiredScopes(source, connection.granted_scopes));
  const latestJob = binding ? latestBy(input.jobs.filter((item) => item.binding_id === binding.id && item.source_type === source), (item) => item.created_at) : null;
  const latestSnapshot = binding ? latestBy(input.snapshots.filter((item) => item.binding_id === binding.id && item.source_type === source), (item) => item.fetched_at) : null;
  const expired = Boolean(latestSnapshot?.expires_at && new Date(latestSnapshot.expires_at) <= now);
  const contentAvailable = Boolean(latestSnapshot && !expired && (source !== "gbp" || !latestSnapshot.raw_content_deleted_at));
  const effectiveHealth = !latestSnapshot ? "not_checked" : !contentAvailable ? "expired" : latestSnapshot.health_status;
  const identityMatched = binding?.identity_match_status === "matched" && Boolean(binding.confirmed_at);
  const ready = Boolean(connectionUsable && identityMatched && effectiveHealth === "healthy");
  const warnings: string[] = [];
  if (latestJob?.status === "failed" && ready) warnings.push("LATEST_SYNC_FAILED");

  let userStatus: ConnectionCenterSource["user_status"];
  let summary: string;
  let sourceAction: ConnectionCenterAction | null;
  if (!binding) {
    if (usableConnections.length > 0) {
      userStatus = "needs_resource";
      summary = `Choose the ${TITLES[source]} resource that belongs to this Case.`;
      sourceAction = action("select_resource", `Choose ${TITLES[source]} resource`, sourceKey);
    } else {
      userStatus = "needs_connection";
      summary = `Connect or reauthorize a Google account with ${TITLES[source]} access.`;
      sourceAction = action("connect_google", `Connect ${TITLES[source]}`, sourceKey);
    }
  } else if (!connectionUsable) {
    userStatus = "needs_connection";
    summary = "The selected Google account is unavailable or missing the required read-only permission.";
    sourceAction = action("connect_google", `Reconnect ${TITLES[source]}`, sourceKey);
  } else if (!identityMatched) {
    userStatus = binding.identity_match_status === "needs_confirmation" || binding.identity_match_status === "not_checked"
      ? "needs_identity_confirmation"
      : "needs_attention";
    summary = binding.identity_match_status === "mismatch"
      ? "This resource does not match the current Case. Choose a different resource."
      : "Confirm that this resource belongs to the current client.";
    sourceAction = binding.identity_match_status === "mismatch"
      ? action("select_resource", `Choose another ${TITLES[source]} resource`, sourceKey)
      : action("confirm_identity", "Confirm resource identity", sourceKey);
  } else if (latestJob && ACTIVE_JOB_STATUSES.has(latestJob.status)) {
    userStatus = "syncing";
    summary = ready ? "Refreshing data. The current healthy snapshot remains usable." : "Synchronization is in progress.";
    sourceAction = action("wait_for_sync", "View sync progress", sourceKey);
  } else if (!latestSnapshot) {
    userStatus = sourceSyncEnabled(input, source) ? "ready_to_sync" : "needs_attention";
    summary = sourceSyncEnabled(input, source)
      ? "The resource is confirmed and ready for its first data sync."
      : "Synchronization is not available in this environment.";
    sourceAction = sourceSyncEnabled(input, source) ? action("sync_source", `Sync ${TITLES[source]}`, sourceKey) : null;
  } else if (!ready) {
    userStatus = "needs_attention";
    summary = effectiveHealth === "expired"
      ? "The latest snapshot has expired. Refresh this source before verified analysis."
      : "The latest snapshot needs attention before it can support verified analysis.";
    sourceAction = latestJob?.status === "failed" && sourceSyncEnabled(input, source)
      ? action("retry_sync", `Retry ${TITLES[source]} sync`, sourceKey)
      : action("review_health", "Review health details", sourceKey);
  } else {
    userStatus = "healthy";
    summary = warnings.length > 0
      ? "Healthy evidence remains available, but the latest refresh failed."
      : "Healthy, identity-matched evidence is ready.";
    sourceAction = warnings.length > 0 && sourceSyncEnabled(input, source)
      ? action("retry_sync", `Retry ${TITLES[source]} sync`, sourceKey)
      : sourceSyncEnabled(input, source) ? action("sync_source", `Sync ${TITLES[source]} again`, sourceKey) : null;
  }

  return {
    source_key: sourceKey,
    title: TITLES[sourceKey],
    required_for_verified_core: !optional,
    user_status: userStatus,
    ready,
    summary,
    action: sourceAction,
    technical_status: {
      connection_status: connection?.status ?? null,
      binding_id: binding?.id ?? null,
      resource_id: binding?.external_resource_id ?? null,
      resource_name: binding?.external_resource_name ?? null,
      identity_match_status: binding?.identity_match_status ?? "not_checked",
      job: jobSummary(latestJob),
      snapshot: snapshotSummary(latestSnapshot, effectiveHealth, contentAvailable),
      warnings,
    },
  };
}

function optionalGbpSource(input: ConnectionCenterProjectionInput, now: Date): ConnectionCenterSource {
  if (input.flags.official_gbp_sync_enabled) return googleSource(input, "gbp", now, true);
  return {
    source_key: "official_gbp_performance",
    title: TITLES.official_gbp_performance,
    required_for_verified_core: false,
    user_status: "optional_unavailable",
    ready: false,
    summary: "Owner-only Business Profile Performance is optional and unavailable. It does not block Verified Core.",
    action: null,
    technical_status: {
      connection_status: null,
      binding_id: null,
      resource_id: null,
      resource_name: null,
      identity_match_status: "not_checked",
      job: null,
      snapshot: null,
      warnings: [],
    },
  };
}

function blockerFor(source: ConnectionCenterSource): ConnectionCenterBlocker | null {
  if (source.ready) return null;
  const code = source.source_key === "public_gbp"
    ? source.user_status === "needs_profile" ? "PUBLIC_GBP_MISSING" : "PUBLIC_GBP_NOT_READY"
    : `${source.source_key.toUpperCase()}_${
      source.user_status === "needs_connection" ? "CONNECTION_REQUIRED" :
        source.user_status === "needs_resource" ? "RESOURCE_REQUIRED" :
          source.user_status === "needs_identity_confirmation" ? "IDENTITY_CONFIRMATION_REQUIRED" :
            source.user_status === "ready_to_sync" ? "SYNC_REQUIRED" : "NOT_HEALTHY"
    }`;
  const fallback = action("review_health", "Review source", source.source_key);
  return { code, message: source.summary, source_key: source.source_key, action: source.action ?? fallback };
}

export function projectConnectionCenter(input: ConnectionCenterProjectionInput, now = new Date()): ConnectionCenterResponse {
  const publicGbp = publicGbpSource(input);
  const gsc = googleSource(input, "gsc", now);
  const ga4 = googleSource(input, "ga4", now);
  const officialGbp = optionalGbpSource(input, now);
  const blockers: ConnectionCenterBlocker[] = [];

  if (!input.parent_report || input.case.latest_report_id !== input.parent_report.id || input.parent_report.case_id !== input.case.id) {
    blockers.push({
      code: "PARENT_REPORT_MISSING",
      message: "Create a current prospect report for this Case before verified analysis.",
      source_key: null,
      action: action("create_prospect_report", "Create prospect report", null),
    });
  }
  if (!input.case.public_gbp_url) {
    blockers.push({ code: "PUBLIC_GBP_MISSING", message: publicGbp.summary, source_key: "public_gbp", action: publicGbp.action! });
  } else if (input.parent_report && !publicGbp.ready) {
    blockers.push({
      code: input.parent_report.identity_matches_case && input.parent_report.public_gbp_url === input.case.public_gbp_url
        ? "PUBLIC_GBP_NOT_READY" : "PUBLIC_GBP_IDENTITY_STALE",
      message: publicGbp.summary,
      source_key: "public_gbp",
      action: publicGbp.action!,
    });
  }
  for (const source of [gsc, ga4]) {
    const blocker = blockerFor(source);
    if (blocker) blockers.push(blocker);
  }

  const required = [publicGbp, gsc, ga4];
  const readySourceCount = required.filter((source) => source.ready).length;
  const verifiedCoreReady = blockers.length === 0 && readySourceCount === 3;
  const fullEvidenceReady = verifiedCoreReady && officialGbp.ready;
  const nextAction = blockers[0]?.action ?? (
    input.flags.verified_generation_enabled
      ? action("generate_verified_plan", "Generate Verified Client Action Plan", null)
      : action("wait_for_verified_analysis", "Ready for verified analysis", null)
  );

  return {
    schema_version: CONNECTION_CENTER_SCHEMA_VERSION,
    case: {
      id: input.case.id,
      business_name: input.case.business_name,
      site_url: input.case.site_url,
      updated_at: input.case.updated_at,
    },
    coverage: {
      verified_core_ready: verifiedCoreReady,
      full_evidence_ready: fullEvidenceReady,
      verified_generation_enabled: input.flags.verified_generation_enabled,
      ready_source_count: readySourceCount,
      required_source_count: 3,
      parent_report_id: input.parent_report?.id ?? null,
      eligible_snapshot_ids: {
        gsc: gsc.ready ? gsc.technical_status.snapshot?.id ?? null : null,
        ga4: ga4.ready ? ga4.technical_status.snapshot?.id ?? null : null,
        gbp_performance: officialGbp.ready ? officialGbp.technical_status.snapshot?.id ?? null : null,
      },
      blockers,
      next_action: nextAction,
    },
    sources: [publicGbp, gsc, ga4],
    optional_sources: [officialGbp],
  };
}
