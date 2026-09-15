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
  ConnectionCenterVerifiedJobInput,
} from "./projector";

type ProjectionData = Omit<ConnectionCenterProjectionInput, "flags">;

export interface ConnectionCenterRevision {
  case_updated_at: string;
  binding_signature: string;
  audit_credits: number;
  verified_job_signature: string;
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
type ReportRow = {
  id: string;
  case_id: string | null;
  report_type?: string | null;
  parent_report_id?: string | null;
  report_v2_2: unknown;
};
type VerifiedJobRow = {
  id: string;
  status: string;
  report_id: string | null;
  error_code: string | null;
  created_at: string;
};
type ChargeRow = { state: string };

const CASE_FIELDS = "id,business_name,site_url,business_identity,latest_report_id,updated_at";
const CONNECTION_FIELDS = "id,status,granted_scopes";
const BINDING_FIELDS = "id,source_type,connection_id,external_resource_id,external_resource_name,identity_match_status,confirmed_at,updated_at";
const JOB_FIELDS = "id,binding_id,source_type,status,attempt_count,error_code,created_at,completed_at";
const SNAPSHOT_FIELDS = "id,binding_id,source_type,health_status,health_reasons,fetched_at,expires_at,coverage_start,coverage_end,raw_content_deleted_at";
const REPORT_FIELDS = "id,case_id,report_type,parent_report_id,report_v2_2";
const VERIFIED_JOB_FIELDS = "id,status,report_id,error_code,created_at";

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

export function parseConnectionCenterParentReport(
  row: ReportRow | null,
  caseRow: CaseRow,
  currentLineage = true,
): ConnectionCenterParentReportInput | null {
  if (!row || row.case_id !== caseRow.id) return null;
  const validated = validateReportV22(row.report_v2_2);
  if (!validated.ok || validated.report.identity.case_id !== caseRow.id) return null;
  const report = validated.report;
  if (report.report_version.report_id !== row.id
    || report.report_version.report_type !== "prospect"
    || report.report_version.parent_report_id !== null
    || (row.report_type != null && row.report_type !== "prospect")
    || (row.parent_report_id != null && row.parent_report_id !== report.report_version.parent_report_id)) return null;
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
    current_lineage: currentLineage,
  };
}

export function verifiedJobProjection(job: VerifiedJobRow | null, charge: ChargeRow | null): ConnectionCenterVerifiedJobInput | null {
  if (!job) return null;
  if (!["queued", "running", "succeeded", "failed"].includes(job.status)
    || !charge || !["reserved", "consumed", "compensated"].includes(charge.state)) {
    throw new ConnectionCenterRepositoryError();
  }
  return {
    id: job.id,
    status: job.status as ConnectionCenterVerifiedJobInput["status"],
    report_id: job.report_id,
    charge_state: charge.state as ConnectionCenterVerifiedJobInput["charge_state"],
    error_code: text(job.error_code),
  };
}

function verifiedJobSignature(job: ConnectionCenterVerifiedJobInput | null): string {
  return job ? `${job.id}:${job.status}:${job.report_id ?? ""}:${job.charge_state}:${job.error_code ?? ""}` : "";
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

  private async latestVerifiedJob(userId: string, caseId: string): Promise<{ job: VerifiedJobRow | null; charge: ChargeRow | null }> {
    const jobResult = await this.db.from("analysis_jobs").select(VERIFIED_JOB_FIELDS)
      .eq("case_id", caseId).eq("job_type", "verified_report")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    fail(jobResult.error);
    const job = jobResult.data as VerifiedJobRow | null;
    if (!job) return { job: null, charge: null };
    const chargeResult = await this.db.from("analysis_attempt_charges").select("state")
      .eq("user_id", userId).eq("case_id", caseId).eq("job_id", job.id).maybeSingle();
    fail(chargeResult.error);
    return { job, charge: chargeResult.data as ChargeRow | null };
  }

  private async parentReport(userId: string, ownedCase: CaseRow, latest: ReportRow | null): Promise<ConnectionCenterParentReportInput | null> {
    if (!latest || latest.case_id !== ownedCase.id) return null;
    const validated = validateReportV22(latest.report_v2_2);
    if (!validated.ok
      || validated.report.identity.case_id !== ownedCase.id
      || validated.report.report_version.report_id !== latest.id) return null;
    const reportVersion = validated.report.report_version;
    if (reportVersion.report_type === "prospect" && reportVersion.parent_report_id === null) {
      return parseConnectionCenterParentReport(latest, ownedCase, true);
    }
    if (reportVersion.report_type !== "verified_execution"
      || !reportVersion.parent_report_id
      || latest.report_type !== "verified_execution"
      || latest.parent_report_id !== reportVersion.parent_report_id) return null;
    const parentResult = await this.db.from("reports").select(REPORT_FIELDS)
      .eq("id", reportVersion.parent_report_id).eq("user_id", userId)
      .eq("case_id", ownedCase.id).eq("report_type", "prospect").maybeSingle();
    fail(parentResult.error);
    return parseConnectionCenterParentReport(parentResult.data as ReportRow | null, ownedCase, true);
  }

  async read(userId: string, caseId: string): Promise<ConnectionCenterRead | null> {
    const ownedCase = await this.activeCase(userId, caseId);
    if (!ownedCase) return null;

    const [connectionsResult, bindings, reportResult, balanceResult, verifiedRead] = await Promise.all([
      this.db.from("google_connections").select(CONNECTION_FIELDS).eq("user_id", userId)
        .in("status", ["active", "error", "reauth_required"]),
      this.activeBindings(caseId),
      ownedCase.latest_report_id
        ? this.db.from("reports").select(REPORT_FIELDS).eq("id", ownedCase.latest_report_id)
          .eq("user_id", userId).eq("case_id", caseId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      this.db.from("users").select("audit_credits").eq("id", userId).maybeSingle(),
      this.latestVerifiedJob(userId, caseId),
    ]);
    fail(connectionsResult.error);
    fail(reportResult.error);
    fail(balanceResult.error);
    const auditCredits = (balanceResult.data as { audit_credits?: unknown } | null)?.audit_credits;
    if (!Number.isSafeInteger(auditCredits) || (auditCredits as number) < 0) throw new ConnectionCenterRepositoryError();
    const verifiedJob = verifiedJobProjection(verifiedRead.job, verifiedRead.charge);
    const parentReport = await this.parentReport(userId, ownedCase, reportResult.data as ReportRow | null);

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
        parent_report: parentReport,
        connections: (connectionsResult.data ?? []) as ConnectionCenterConnectionInput[],
        bindings,
        jobs,
        snapshots,
        audit_credits: auditCredits as number,
        verified_job: verifiedJob,
      },
      revision: {
        case_updated_at: ownedCase.updated_at,
        binding_signature: bindingSignature(bindings),
        audit_credits: auditCredits as number,
        verified_job_signature: verifiedJobSignature(verifiedJob),
      },
    };
  }

  async isCurrent(userId: string, caseId: string, revision: ConnectionCenterRevision): Promise<boolean> {
    const ownedCase = await this.activeCase(userId, caseId);
    if (!ownedCase || ownedCase.updated_at !== revision.case_updated_at) return false;
    const [bindings, balanceResult, verifiedRead] = await Promise.all([
      this.activeBindings(caseId),
      this.db.from("users").select("audit_credits").eq("id", userId).maybeSingle(),
      this.latestVerifiedJob(userId, caseId),
    ]);
    fail(balanceResult.error);
    const auditCredits = (balanceResult.data as { audit_credits?: unknown } | null)?.audit_credits;
    if (!Number.isSafeInteger(auditCredits) || (auditCredits as number) < 0) throw new ConnectionCenterRepositoryError();
    const verifiedJob = verifiedJobProjection(verifiedRead.job, verifiedRead.charge);
    return bindingSignature(bindings) === revision.binding_signature
      && auditCredits === revision.audit_credits
      && verifiedJobSignature(verifiedJob) === revision.verified_job_signature;
  }
}
