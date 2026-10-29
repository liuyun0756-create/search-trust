import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "./contracts/capability.schema.json";
import type { AnalysisInputManifest, BusinessScope, CapabilityReport, DeliveryRevision } from "./generated/types";
import { canonicalDigest } from "../verified-analysis-v22/digest";
import { priorityMatches } from "./priority";
import { deliveryOrderConstraints, validDeliveryOrder } from "./order";

const ajv = new Ajv2020({ allErrors: true, strict: true, coerceTypes: false, useDefaults: false });
addFormats(ajv);
ajv.addSchema(schema, "capability");
const structure: ValidateFunction<CapabilityReport> = ajv.getSchema<CapabilityReport>("capability#/$defs/CapabilityReport")!;
const revisionStructure: ValidateFunction<DeliveryRevision> = ajv.getSchema<DeliveryRevision>("capability#/$defs/DeliveryRevision")!;
const manifestStructure: ValidateFunction<AnalysisInputManifest> = ajv.getSchema<AnalysisInputManifest>("capability#/$defs/AnalysisInputManifest")!;
const businessStructure: ValidateFunction<BusinessScope> = ajv.getSchema<BusinessScope>("capability#/$defs/BusinessScope")!;
const order = ["site", "serp", "competitor", "public_gbp", "gsc", "ga4", "official_gbp"];
const sourceSchemas = ["site_inventory_snapshot_v1", "serp_market_snapshot_v1", "competitor_collection_snapshot_v1", "customer_public_gbp_snapshot_v1", "gsc_sync_v1", "ga4_sync_v1", "gbp_sync_v1"];
const unique = (values: unknown[]) => new Set(values).size === values.length;
const instant = (value: string) => BigInt(Date.parse(`${value.slice(0, 19)}Z`)) * BigInt(1000)
  + BigInt((value.match(/\.(\d+)Z$/)?.[1] ?? "").padEnd(6, "0") || "0");

export function validateBusinessScope(value: unknown): value is BusinessScope {
  if (!businessStructure(value)) return false;
  if (Object.hasOwn(value, "execution_conditions") && value.execution_conditions == null) return false;
  try {
  const domains = [value.site_url, ...value.competitor_sites].map((site) => {
    const parsed = new URL(site);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Invalid site");
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  });
  return unique(domains);
  } catch { return false; }
}

function manifestValid(m: AnalysisInputManifest) {
  if (!validateBusinessScope(m.business) || m.business.user_id !== m.user_id || m.business.case_id !== m.case_id || instant(m.business.confirmed_at) > instant(m.evaluated_at)) return false;
  const kinds = m.snapshots.map((s) => s.source_kind);
  if (!unique(kinds) || !unique(m.snapshots.map((s) => s.snapshot_id))) return false;
  if (kinds.join() !== [...kinds].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join()) return false;
  if (!order.slice(0, m.mode === "acquisition" ? 4 : 6).every((kind) => kinds.includes(kind as typeof kinds[number]))) return false;
  if (m.mode === "acquisition" && kinds.length !== 4) return false;
  for (const s of m.snapshots) {
    if (s.case_id !== m.case_id || s.schema_version !== sourceSchemas[order.indexOf(s.source_kind)]
      || instant(s.fetched_at) > instant(m.evaluated_at) || instant(s.expires_at) <= instant(m.evaluated_at)
      || ["gsc", "ga4", "official_gbp"].includes(s.source_kind) !== (s.binding_id !== null)) return false;
  }
  if (["acquisition", "first_service"].includes(m.mode)) {
    if (m.previous_report !== null) return false;
  } else if (!m.previous_report || m.previous_report.case_id !== m.case_id
    || m.previous_report.report_type !== (m.mode === "after_acquisition" ? "prospect" : "verified_execution")) return false;
  if (m.previous_report?.report_id === m.job_id) return false;
  if ((m.mode === "review") !== (m.implementation !== null)) return false;
  const { input_checksum, ...content } = m;
  return canonicalDigest(content) === input_checksum;
}

export function validateAnalysisManifest(value: unknown): value is AnalysisInputManifest {
  try { return manifestStructure(value) && manifestValid(value); } catch { return false; }
}

export type CapabilityValidation = { ok: true; report: CapabilityReport } | { ok: false; code: "CAPABILITY_REPORT_INVALID" };

export function validateCapabilityReport(value: unknown): CapabilityValidation {
  const invalid = { ok: false, code: "CAPABILITY_REPORT_INVALID" } as const;
  try {
    if (!structure(value)) return invalid;
    const r = value, m = r.input_manifest;
    if (!manifestValid(m) || r.id !== m.job_id || instant(r.generated_at) < instant(m.evaluated_at)
      || r.report_type !== (m.mode === "acquisition" ? "prospect" : "verified_execution")
      || r.version !== (m.previous_report ? m.previous_report.version + 1 : 1)
      || Boolean(r.actions.length) !== (r.action_state === "actions_supported")) return invalid;
    if (![r.evidence, r.findings, r.actions].every((items) => unique(items.map((item) => item.id)))) return invalid;
    const snapshots = new Map(m.snapshots.map((s) => [s.snapshot_id, s]));
    const evidence = new Map(r.evidence.map((e) => [e.id, e]));
    const findings = new Map(r.findings.map((f) => [f.id, f]));
    for (const e of r.evidence) {
      const s = snapshots.get(e.snapshot_id);
      if (!s || s.source_kind !== e.source_kind || e.observed_at !== s.fetched_at) return invalid;
    }
    for (const f of r.findings) {
      if (!unique(f.evidence_ids) || !f.evidence_ids.every((id) => evidence.has(id))) return invalid;
      const latest = f.evidence_ids.map((id) => instant(evidence.get(id)!.observed_at)).reduce((a, b) => a > b ? a : b);
      if (instant(f.observed_at) !== latest) return invalid;
    }
    const prior = new Set<string>();
    for (const a of r.actions) {
      if (!unique(a.finding_ids) || !a.finding_ids.every((id) => findings.has(id))
        || !unique(a.dependencies) || !a.dependencies.every((id) => prior.has(id))) return invalid;
      const allowedEvidence = new Set(a.finding_ids.flatMap((id) => findings.get(id)!.evidence_ids));
      if (!unique(a.materials.map((m) => m.id)) || !a.materials.every((m) => materialValid(m)
        && m.evidence_ids.every((id) => allowedEvidence.has(id)))) return invalid;
      prior.add(a.id);
    }
    if (!unique(r.changes.map((c) => c.finding_id))) return invalid;
    for (const c of r.changes) {
      if (!m.previous_report || !findings.has(c.finding_id) || c.previous_fingerprint === c.current_fingerprint
        || c.current_fingerprint !== canonicalDigest(findings.get(c.finding_id))) return invalid;
    }
    const ranked = ["v22_capability_public_v2", "v22_capability_service_v2", "v22_capability_public_v3", "v22_capability_service_v3", "v22_capability_public_v4", "v22_capability_service_v4", "v22_capability_public_v5"].includes(m.ruleset_version);
    if (Object.hasOwn(r, "prioritization") && r.prioritization == null) return invalid;
    if (ranked !== Boolean(r.prioritization) || (r.prioritization && !priorityMatches(r.prioritization, r))) return invalid;
    if (r.prioritization && r.prioritization.rules_version !== (/_v[345]$/.test(m.ruleset_version) ? "v22_business_priority_v2" : "v22_business_priority_v1")) return invalid;
    return { ok: true, report: r };
  } catch { return invalid; }
}

export function validatePreviousReport(current: CapabilityReport, previous: CapabilityReport): boolean {
  if (!validateCapabilityReport(current).ok || !validateCapabilityReport(previous).ok) return false;
  const ref = current.input_manifest.previous_report;
  if (!ref || ref.report_id !== previous.id || ref.case_id !== previous.input_manifest.case_id
    || current.input_manifest.user_id !== previous.input_manifest.user_id || ref.version !== previous.version
    || ref.report_type !== previous.report_type || ref.payload_checksum !== canonicalDigest(previous)) return false;
  const prior = new Map(previous.findings.map((f) => [f.id, canonicalDigest(f)]));
  return current.changes.every((c) => prior.get(c.finding_id) === c.previous_fingerprint);
}

export function validateDeliveryRevision(value: unknown, report: CapabilityReport): value is DeliveryRevision {
  try {
    if (!validateCapabilityReport(report).ok || !revisionStructure(value)) return false;
    const constraints = deliveryOrderConstraints(report);
    if (constraints && !validDeliveryOrder(value.actions.map(a => a.id), constraints)) return false;
    const m = report.input_manifest;
    return value.report_id === report.id && value.user_id === m.user_id && value.case_id === m.case_id
      && value.source_checksum === canonicalDigest(report) && unique(value.actions.map((a) => a.id))
      && value.actions.length === report.actions.length && value.actions.every((a) => {
        const original = report.actions.find((item) => item.id === a.id);
        return original && a.materials.length === original.materials.length && unique(a.materials.map((m) => m.id))
          && a.materials.every((m) => {
            const source = original.materials.find((item) => item.id === m.id);
            if (!source || !materialValid(m)) return false;
            const { title: _title, body: _body, ...metadata } = m;
            const { title: _sourceTitle, body: _sourceBody, ...sourceMetadata } = source;
            return canonicalDigest(metadata) === canonicalDigest(sourceMetadata);
          });
      });
  } catch { return false; }
}

function materialValid(m: CapabilityReport["actions"][number]["materials"][number]) {
  return unique(m.evidence_ids) && !(m.readiness === "ready_to_use" && m.confirmation_items.length)
    && !(m.readiness === "requires_confirmation" && !m.confirmation_items.length);
}
