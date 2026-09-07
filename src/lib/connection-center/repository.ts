import type { SupabaseClient } from "@supabase/supabase-js";

import { validateReportV22 } from "../report-v22/validate";
import type {
  ConnectionCenterBindingInput,
  ConnectionCenterCaseInput,
  ConnectionCenterConnectionInput,
  ConnectionCenterJobInput,
  ConnectionCenterParentReportInput,
  ConnectionCenterProjectionInput,
  ConnectionCenterSnapshotInput,
} from "./projector";

type ProjectionData = Omit<ConnectionCenterProjectionInput, "flags">;

export interface ConnectionCenterRevision {
  case_updated_at: string;
  binding_signature: string;
}

export interface ConnectionCenterRead {
  data: ProjectionData;
  revision: ConnectionCenterRevision;
}

export interface ConnectionCenterRepository {
  read(userId: string, caseId: string): Promise<ConnectionCenterRead | null>;
  isCurrent(userId: string, caseId: string, revision: ConnectionCenterRevision): Promise<boolean>;
}

export class ConnectionCenterRepositoryError extends Error {
  constructor() {
    super("Connection Center data could not be loaded.");
    this.name = "ConnectionCenterRepositoryError";
  }
}

type CaseRow = {
  id: string;
  business_name: string;
  site_url: string;
  updated_at: string;
  latest_report_id: string | null;
  business_identity: Record<string, unknown>;
};

type BindingRow = ConnectionCenterBindingInput & { updated_at: string };
type ReportRow = { id: string; case_id: string | null; report_v2_2: unknown };

const CASE_FIELDS = "id,business_name,site_url,business_identity,latest_report_id,updated_at";
const CONNECTION_FIELDS = "id,status,granted_scopes";
const BINDING_FIELDS = "id,source_type,connection_id,external_resource_id,external_resource_name,identity_match_status,confirmed_at,updated_at";
const JOB_FIELDS = "id,binding_id,source_type,status,attempt_count,error_code,created_at,completed_at";
const SNAPSHOT_FIELDS = "id,binding_id,source_type,health_status,health_reasons,fetched_at,expires_at,coverage_start,coverage_end,raw_content_deleted_at";

function fail(error: unknown): void {
  if (error) throw new ConnectionCenterRepositoryError();
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function bindingSignature(bindings: BindingRow[]): string {
  return bindings
    .map((binding) => `${binding.source_type}:${binding.id}:${binding.updated_at}`)
    .sort()
    .join("|");
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function publicGbpUrl(row: CaseRow): string | null {
  return text(row.business_identity.public_gbp_url);
}

export function parseConnectionCenterParentReport(row: ReportRow | null, caseRow: CaseRow): ConnectionCenterParentReportInput | null {
  if (!row || row.case_id !== caseRow.id) return null;
  const validated = validateReportV22(row.report_v2_2);
  if (!validated.ok || validated.report.identity.case_id !== caseRow.id) return null;
  const report = validated.report;
  const reportUrl = report.identity.business.public_gbp_url ?? null;
  const coverage = report.data_coverage.sources.find((source) => source.source_type === "gbp");
  const publicEvidence = report.evidence_index.find((item) =>
    item.source_type === "gbp" && item.source_locator.url === reportUrl,
  );
  return {
    id: row.id,
    case_id: caseRow.id,
    identity_matches_case: stable(report.identity.business) === stable(caseRow.business_identity),
    public_gbp_url: reportUrl,
    public_gbp_snapshot_id: publicEvidence?.snapshot_id ?? coverage?.snapshot_ids?.[0] ?? null,
    public_gbp_fetched_at: publicEvidence?.collected_at ?? report.report_version.generated_at,
    public_gbp_health_status: coverage?.health_status ?? "not_checked",
    public_gbp_identity_match_status: coverage?.identity_match_status ?? "not_checked",
  };
}

function caseInput(row: CaseRow): ConnectionCenterCaseInput {
  return {
    id: row.id,
    business_name: row.business_name,
    site_url: row.site_url,
    updated_at: row.updated_at,
    latest_report_id: row.latest_report_id,
    public_gbp_url: publicGbpUrl(row),
  };
}

export class SupabaseConnectionCenterRepository implements ConnectionCenterRepository {
  constructor(private readonly db: SupabaseClient) {}

  private async activeCase(userId: string, caseId: string): Promise<CaseRow | null> {
    const result = await this.db.from("client_cases").select(CASE_FIELDS)
      .eq("id", caseId).eq("user_id", userId).eq("status", "active").maybeSingle();
    fail(result.error);
    return result.data as CaseRow | null;
  }

  private async activeBindings(caseId: string): Promise<BindingRow[]> {
    const result = await this.db.from("case_source_bindings").select(BINDING_FIELDS)
      .eq("case_id", caseId).eq("is_active", true).order("source_type");
    fail(result.error);
    return (result.data ?? []) as BindingRow[];
  }

  async read(userId: string, caseId: string): Promise<ConnectionCenterRead | null> {
    const ownedCase = await this.activeCase(userId, caseId);
    if (!ownedCase) return null;

    const [connectionsResult, bindings, reportResult] = await Promise.all([
      this.db.from("google_connections").select(CONNECTION_FIELDS).eq("user_id", userId)
        .in("status", ["active", "error", "reauth_required"]),
      this.activeBindings(caseId),
      ownedCase.latest_report_id
        ? this.db.from("reports").select("id,case_id,report_v2_2").eq("id", ownedCase.latest_report_id)
          .eq("user_id", userId).eq("case_id", caseId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    fail(connectionsResult.error);
    fail(reportResult.error);

    const bindingIds = bindings.map((binding) => binding.id);
    let jobs: ConnectionCenterJobInput[] = [];
    let snapshots: ConnectionCenterSnapshotInput[] = [];
    if (bindingIds.length > 0) {
      const [jobsResult, snapshotsResult] = await Promise.all([
        this.db.from("google_sync_jobs").select(JOB_FIELDS).eq("user_id", userId).eq("case_id", caseId)
          .in("binding_id", bindingIds).order("created_at", { ascending: false }).limit(30),
        this.db.from("data_snapshots").select(SNAPSHOT_FIELDS).eq("case_id", caseId)
          .in("binding_id", bindingIds).order("fetched_at", { ascending: false }).limit(30),
      ]);
      fail(jobsResult.error);
      fail(snapshotsResult.error);
      jobs = (jobsResult.data ?? []) as ConnectionCenterJobInput[];
      snapshots = (snapshotsResult.data ?? []) as ConnectionCenterSnapshotInput[];
    }

    return {
      data: {
        case: caseInput(ownedCase),
        parent_report: parseConnectionCenterParentReport(reportResult.data as ReportRow | null, ownedCase),
        connections: (connectionsResult.data ?? []) as ConnectionCenterConnectionInput[],
        bindings,
        jobs,
        snapshots,
      },
      revision: { case_updated_at: ownedCase.updated_at, binding_signature: bindingSignature(bindings) },
    };
  }

  async isCurrent(userId: string, caseId: string, revision: ConnectionCenterRevision): Promise<boolean> {
    const ownedCase = await this.activeCase(userId, caseId);
    if (!ownedCase || ownedCase.updated_at !== revision.case_updated_at) return false;
    const bindings = await this.activeBindings(caseId);
    return bindingSignature(bindings) === revision.binding_signature;
  }
}
