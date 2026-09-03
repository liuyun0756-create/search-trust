import type { WorkGoal } from "./contracts";
import { parseDiscoveryRequest, parseDiscoveryStatusResponse, parsePreflightResponse } from "./validate";
import {
  createNewCaseDraft,
  DRAFT_SCHEMA_VERSION,
  reduceWorkspaceState,
  type BusinessConfirmation,
  type NewCaseDraft,
  type WorkspaceStage,
} from "./state-machine";

export const NEW_CASE_DRAFT_STORAGE_KEY = "searchtrust:v2.2:new-case-draft";

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const goals = new Set<WorkGoal>(["win_new_client", "work_existing_client"]);
const stages = new Set<WorkspaceStage>([
  "goal_website", "preflight_running", "preflight_failed", "business_confirmation",
  "competitor_discovery_running", "competitor_confirmation", "competitor_discovery_failed", "coverage", "auth_handoff",
]);
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const topLevelKeys = new Set([
  "schema_version", "created_at", "updated_at", "expires_at", "stage", "goal", "draft_case_id", "site_url", "gbp_url",
  "preflight", "preflight_error", "business_confirmation", "discovery_job_id", "discovery_idempotency_key", "discovery_status",
  "supplemental_website_urls", "selected_competitor_ids",
]);

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeUrlInput(value: unknown): string {
  return typeof value === "string" && value.length <= 2083 && !/[\u0000-\u001f]/.test(value) ? value : "";
}

function safeGoal(value: unknown): WorkGoal {
  return typeof value === "string" && goals.has(value as WorkGoal) ? value as WorkGoal : "win_new_client";
}

function recoverSafe(value: unknown, now: Date): NewCaseDraft {
  const record = object(value) ? value : {};
  const gbp = record.gbp_url;
  return createNewCaseDraft(now, crypto.randomUUID(), {
    goal: safeGoal(record.goal),
    site_url: safeUrlInput(record.site_url),
    gbp_url: gbp === null ? null : safeUrlInput(gbp) || null,
  });
}

function validBusinessConfirmation(value: unknown): value is BusinessConfirmation {
  if (!object(value) || Object.keys(value).some((key) => !["business_identity", "primary_service", "target_market"].includes(key))) return false;
  const probe = {
    case_id: "11111111-1111-4111-8111-111111111111",
    business_identity: value.business_identity,
    primary_service: value.primary_service,
    target_market: value.target_market,
    queries: ["one", "two", "three"],
  };
  return parseDiscoveryRequest(probe).ok;
}

export function parseDraft(value: unknown, now = new Date()): NewCaseDraft | null {
  if (!object(value) || Object.keys(value).some((key) => !topLevelKeys.has(key))) return null;
  if (value.schema_version !== DRAFT_SCHEMA_VERSION || !goals.has(value.goal as WorkGoal) || !stages.has(value.stage as WorkspaceStage)) return null;
  if (typeof value.created_at !== "string" || typeof value.updated_at !== "string" || typeof value.expires_at !== "string") return null;
  const createdAt = Date.parse(value.created_at);
  const updatedAt = Date.parse(value.updated_at);
  const expiresAt = Date.parse(value.expires_at);
  if (![createdAt, updatedAt, expiresAt].every(Number.isFinite) || updatedAt < createdAt || expiresAt <= updatedAt || expiresAt <= now.getTime()) return null;
  if (typeof value.draft_case_id !== "string" || !uuidV4.test(value.draft_case_id)) return null;
  if (typeof value.site_url !== "string" || !(typeof value.gbp_url === "string" || value.gbp_url === null)) return null;
  if (value.preflight !== null && !parsePreflightResponse(value.preflight).ok) return null;
  if (value.discovery_status !== null && !parseDiscoveryStatusResponse(value.discovery_status).ok) return null;
  if (value.business_confirmation !== null && !validBusinessConfirmation(value.business_confirmation)) return null;
  if (!(value.discovery_job_id === null || (typeof value.discovery_job_id === "string" && uuidV4.test(value.discovery_job_id)))) return null;
  if (!(value.discovery_idempotency_key === null || (typeof value.discovery_idempotency_key === "string" && /^[A-Za-z0-9._:-]{8,200}$/.test(value.discovery_idempotency_key)))) return null;
  if (!Array.isArray(value.supplemental_website_urls) || value.supplemental_website_urls.length > 3 || !value.supplemental_website_urls.every((item) => typeof item === "string" && item.length <= 2083)) return null;
  if (!Array.isArray(value.selected_competitor_ids) || value.selected_competitor_ids.length > 3 || !value.selected_competitor_ids.every((item) => typeof item === "string") || new Set(value.selected_competitor_ids).size !== value.selected_competitor_ids.length) return null;
  if (!(value.preflight_error === null || (object(value.preflight_error) && typeof value.preflight_error.code === "string" && typeof value.preflight_error.message === "string"))) return null;
  return value as unknown as NewCaseDraft;
}

export function loadDraft(storage: DraftStorage, now = new Date()): NewCaseDraft {
  const raw = storage.getItem(NEW_CASE_DRAFT_STORAGE_KEY);
  if (!raw) return createNewCaseDraft(now);
  let value: unknown;
  try { value = JSON.parse(raw); } catch {
    storage.removeItem(NEW_CASE_DRAFT_STORAGE_KEY);
    return createNewCaseDraft(now);
  }
  const parsed = parseDraft(value, now);
  if (parsed) {
    const discoveryExpiry = parsed.discovery_status?.result?.expires_at;
    return discoveryExpiry && Date.parse(discoveryExpiry) <= now.getTime()
      ? reduceWorkspaceState(parsed, { type: "DISCOVERY_EXPIRED" }, now)
      : parsed;
  }
  storage.removeItem(NEW_CASE_DRAFT_STORAGE_KEY);
  return recoverSafe(value, now);
}

export function saveDraft(storage: DraftStorage, draft: NewCaseDraft): void {
  const parsed = parseDraft(draft, new Date(Date.parse(draft.updated_at)));
  if (!parsed) throw new Error("INVALID_NEW_CASE_DRAFT");
  storage.setItem(NEW_CASE_DRAFT_STORAGE_KEY, JSON.stringify(parsed));
}

export function clearDraft(storage: DraftStorage): void {
  storage.removeItem(NEW_CASE_DRAFT_STORAGE_KEY);
}
