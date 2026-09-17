import type { BusinessIdentity, TargetMarket } from "@/lib/report-v22/generated/types";

import type {
  CompetitorDiscoveryStatusResponse,
  PreflightResponse,
  WorkGoal,
} from "./contracts";

export const DRAFT_SCHEMA_VERSION = "2.2-new-case-v2" as const;
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type WorkspaceStage =
  | "goal_website"
  | "preflight_running"
  | "preflight_failed"
  | "business_confirmation"
  | "prospect_start"
  | "competitor_discovery_running"
  | "competitor_confirmation"
  | "competitor_discovery_failed"
  | "coverage"
  | "auth_handoff";

export interface BusinessConfirmation {
  business_identity: BusinessIdentity;
  primary_service: string;
  target_market: TargetMarket;
}

export interface NewCaseDraft {
  schema_version: typeof DRAFT_SCHEMA_VERSION;
  created_at: string;
  updated_at: string;
  expires_at: string;
  stage: WorkspaceStage;
  goal: WorkGoal;
  draft_case_id: string;
  site_url: string;
  gbp_url: string | null;
  preflight: PreflightResponse | null;
  preflight_error: { code: string; message: string } | null;
  business_confirmation: BusinessConfirmation | null;
  prospect_workflow_id: string | null;
  discovery_job_id: string | null;
  discovery_idempotency_key: string | null;
  discovery_status: CompetitorDiscoveryStatusResponse | null;
  discovery_error: { code: string; message: string; retryable: boolean } | null;
  supplemental_website_urls: string[];
  selected_competitor_ids: string[];
  analysis_job_id: string | null;
  analysis_idempotency_key: string | null;
  previous_analysis_job_id: string | null;
}

export type WorkspaceEvent =
  | { type: "CHANGE_SOURCE"; goal: WorkGoal; site_url: string; gbp_url: string | null }
  | { type: "START_PREFLIGHT" }
  | { type: "PREFLIGHT_SUCCEEDED"; response: PreflightResponse }
  | { type: "PREFLIGHT_FAILED"; code: string; message: string }
  | { type: "CONFIRM_BUSINESS"; confirmation: BusinessConfirmation }
  | { type: "START_DISCOVERY"; workflow_id: string; job_id: string; idempotency_key: string; supplemental_website_urls?: string[] }
  | { type: "DISCOVERY_UPDATED"; status: CompetitorDiscoveryStatusResponse }
  | { type: "DISCOVERY_REQUEST_FAILED"; code: string; message: string; retryable?: boolean }
  | { type: "PROSPECT_START_REJECTED" }
  | { type: "SELECT_COMPETITORS"; competitor_ids: string[] }
  | { type: "CONFIRM_COMPETITORS" }
  | { type: "DISCOVERY_EXPIRED" }
  | { type: "EDIT_BUSINESS" }
  | { type: "EDIT_COMPETITORS" }
  | { type: "RETURN_TO_COVERAGE" }
  | { type: "BEGIN_AUTH_HANDOFF" }
  | { type: "START_ANALYSIS"; job_id: string; idempotency_key: string }
  | { type: "RESET_ANALYSIS" }
  | { type: "RESTART_PROSPECT" }
  | { type: "REPAIR_BUSINESS" }
  | { type: "CLEAR" };

function iso(now: Date) { return now.toISOString(); }

export function createNewCaseDraft(
  now = new Date(),
  id = crypto.randomUUID(),
  safe?: { goal?: WorkGoal; site_url?: string; gbp_url?: string | null },
): NewCaseDraft {
  return {
    schema_version: DRAFT_SCHEMA_VERSION,
    created_at: iso(now),
    updated_at: iso(now),
    expires_at: iso(new Date(now.getTime() + DRAFT_TTL_MS)),
    stage: "goal_website",
    goal: safe?.goal ?? "win_new_client",
    draft_case_id: id,
    site_url: safe?.site_url ?? "",
    gbp_url: safe?.gbp_url ?? null,
    preflight: null,
    preflight_error: null,
    business_confirmation: null,
    prospect_workflow_id: null,
    discovery_job_id: null,
    discovery_idempotency_key: null,
    discovery_status: null,
    discovery_error: null,
    supplemental_website_urls: [],
    selected_competitor_ids: [],
    analysis_job_id: null,
    analysis_idempotency_key: null,
    previous_analysis_job_id: null,
  };
}

function touch(state: NewCaseDraft, update: Partial<NewCaseDraft>, now: Date): NewCaseDraft {
  return { ...state, ...update, updated_at: iso(now) };
}

function clearDiscovery() {
  return {
    prospect_workflow_id: null,
    discovery_job_id: null,
    discovery_idempotency_key: null,
    discovery_status: null,
    discovery_error: null,
    supplemental_website_urls: [],
    selected_competitor_ids: [],
    analysis_job_id: null,
    analysis_idempotency_key: null,
    previous_analysis_job_id: null,
  } satisfies Partial<NewCaseDraft>;
}

export function canConfirmCompetitors(state: NewCaseDraft): boolean {
  const result = state.discovery_status?.result;
  if (!result?.ready_for_confirmation) return false;
  if (state.selected_competitor_ids.length < 1 || state.selected_competitor_ids.length > 3) return false;
  const available = new Set(result.candidates.map((candidate) => candidate.competitor_id));
  return new Set(state.selected_competitor_ids).size === state.selected_competitor_ids.length
    && state.selected_competitor_ids.every((id) => available.has(id));
}

export function defaultCompetitorSelection(
  candidates: NonNullable<CompetitorDiscoveryStatusResponse["result"]>["candidates"],
): string[] {
  const confidence = { high: 3, medium: 2, low: 1 } as const;
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) =>
      Number(Boolean(right.candidate.public_gbp_url)) - Number(Boolean(left.candidate.public_gbp_url)) ||
      confidence[right.candidate.confidence] - confidence[left.candidate.confidence] ||
      right.candidate.query_appearance_count - left.candidate.query_appearance_count ||
      left.candidate.best_position - right.candidate.best_position ||
      left.index - right.index)
    .slice(0, 3)
    .map(({ candidate }) => candidate.competitor_id);
}

export function reduceWorkspaceState(
  state: NewCaseDraft,
  event: WorkspaceEvent,
  now = new Date(),
): NewCaseDraft {
  switch (event.type) {
    case "CHANGE_SOURCE":
      return touch(state, {
        goal: event.goal,
        site_url: event.site_url,
        gbp_url: event.gbp_url,
        stage: "goal_website",
        preflight: null,
        preflight_error: null,
        business_confirmation: null,
        ...clearDiscovery(),
      }, now);
    case "START_PREFLIGHT":
      return state.stage === "preflight_running" ? state : touch(state, { stage: "preflight_running", preflight_error: null }, now);
    case "PREFLIGHT_SUCCEEDED":
      return touch(state, { stage: "business_confirmation", preflight: event.response, preflight_error: null, business_confirmation: null, ...clearDiscovery() }, now);
    case "PREFLIGHT_FAILED":
      return touch(state, { stage: "preflight_failed", preflight_error: { code: event.code, message: event.message } }, now);
    case "CONFIRM_BUSINESS":
      return touch(state, {
        stage: "prospect_start",
        business_confirmation: event.confirmation,
        ...clearDiscovery(),
        prospect_workflow_id: state.prospect_workflow_id,
      }, now);
    case "START_DISCOVERY":
      if (state.discovery_job_id && state.stage === "competitor_discovery_running") return state;
      return touch(state, {
        stage: "competitor_discovery_running",
        prospect_workflow_id: event.workflow_id,
        discovery_job_id: event.job_id,
        discovery_idempotency_key: event.idempotency_key,
        discovery_status: null,
        discovery_error: null,
        supplemental_website_urls: event.supplemental_website_urls ?? [],
        selected_competitor_ids: [],
      }, now);
    case "DISCOVERY_UPDATED": {
      if (event.status.discovery_job_id !== state.discovery_job_id) return state;
      if (event.status.status === "failed") return touch(state, {
        stage: "competitor_discovery_failed",
        discovery_status: event.status,
        discovery_error: event.status.error ? { code: event.status.error.error_code, message: event.status.error.user_message, retryable: event.status.error.retryable } : null,
        selected_competitor_ids: [],
      }, now);
      if (event.status.status !== "succeeded") return touch(state, { stage: "competitor_discovery_running", discovery_status: event.status }, now);
      const candidates = event.status.result?.candidates ?? [];
      return touch(state, {
        stage: "competitor_confirmation",
        discovery_status: event.status,
        selected_competitor_ids: defaultCompetitorSelection(candidates),
      }, now);
    }
    case "DISCOVERY_REQUEST_FAILED":
      return touch(state, { stage: "competitor_discovery_failed", discovery_error: { code: event.code, message: event.message, retryable: event.retryable ?? true }, selected_competitor_ids: [] }, now);
    case "PROSPECT_START_REJECTED":
      return touch(state, { stage: "prospect_start", ...clearDiscovery() }, now);
    case "SELECT_COMPETITORS": {
      const result = state.discovery_status?.result;
      if (!result || event.competitor_ids.length > 3) return state;
      const available = new Set(result.candidates.map((candidate) => candidate.competitor_id));
      const unique = [...new Set(event.competitor_ids)].filter((id) => available.has(id));
      return touch(state, { selected_competitor_ids: unique, stage: "competitor_confirmation" }, now);
    }
    case "CONFIRM_COMPETITORS":
      return canConfirmCompetitors(state) ? touch(state, { stage: "coverage" }, now) : state;
    case "DISCOVERY_EXPIRED":
      return touch(state, {
        stage: "prospect_start",
        ...clearDiscovery(),
        prospect_workflow_id: state.prospect_workflow_id,
      }, now);
    case "EDIT_BUSINESS":
      return touch(state, { stage: "business_confirmation" }, now);
    case "EDIT_COMPETITORS":
      return state.discovery_status?.result ? touch(state, { stage: "competitor_confirmation" }, now) : state;
    case "RETURN_TO_COVERAGE":
      return canConfirmCompetitors(state) ? touch(state, { stage: "coverage" }, now) : state;
    case "BEGIN_AUTH_HANDOFF":
      return state.stage === "coverage" ? touch(state, { stage: "auth_handoff" }, now) : state;
    case "START_ANALYSIS":
      return state.stage === "auth_handoff" && !state.analysis_job_id
        ? touch(state, { analysis_job_id: event.job_id, analysis_idempotency_key: event.idempotency_key }, now)
        : state;
    case "RESET_ANALYSIS":
      return touch(state, {
        previous_analysis_job_id: state.analysis_job_id,
        analysis_job_id: null,
        analysis_idempotency_key: null,
      }, now);
    case "RESTART_PROSPECT":
      return touch(state, { stage: "prospect_start", ...clearDiscovery() }, now);
    case "REPAIR_BUSINESS":
      return touch(state, { stage: "business_confirmation", ...clearDiscovery() }, now);
    case "CLEAR":
      return createNewCaseDraft(now);
  }
}
