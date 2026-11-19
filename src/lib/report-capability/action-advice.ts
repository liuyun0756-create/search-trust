import type {CapabilityReport, DeliveryRevision} from "./generated/types";
import {canonicalDigest} from "../verified-analysis-v22/digest";
import {evidenceFieldLabel, evidenceSourceLabel, evidenceValue, readerTarget} from "./reader-copy";

type Advice = NonNullable<CapabilityReport["action_advice"]>[number];
type DeliveryAction = DeliveryRevision["actions"][number];
const CONFIDENCE = {low: 0, medium: 1, high: 2};
const EFFORT = {
  title_brief: "small", service_brief: "large", profile_correction: "small",
  technical_check: "medium", measurement_check: "medium",
} as const;

export const ADVICE_REJECTIONS = {
  not_attempted: "Example generation was not attempted.",
  no_approved_copy: "This action does not have an approved example format.",
  provider_unavailable: "The example service was unavailable.",
  timeout: "Example generation timed out.",
  invalid_response: "The example service returned an invalid response.",
  unsupported_copy: "The example did not match the approved evidence and wording.",
  restricted_claim: "The example contained restricted claim wording.",
  binding_changed: "The action was edited after the text was checked.",
  target_scope_unverified: "The saved evidence does not confirm the same service on every target page.",
} as const;

const unique = <T,>(values: T[]): T[] => [...new Set(values)];

export function actionAdviceValid(report: CapabilityReport) {
  const advice = report.action_advice;
  const pool = report.action_candidates;
  if (!advice || !pool || advice.length !== pool.length || !report.landing_page_comparison || !report.local_entity_coverage) return false;
  const siteEvidence = Object.values(report.landing_page_comparison.rows[0].metrics).flatMap(metric => metric.evidence);
  const findings = new Map(report.findings.map(item => [item.id, item]));
  const ranks = new Map(report.actions.map((item, i) => [item.id, i + 1]));
  return advice.every((item, index) => {
    const action = pool[index];
    const basis = action.finding_ids.map(id => findings.get(id));
    if (basis.some(finding => !finding)) return false;
    const all = basis as CapabilityReport["findings"];
    const eligible = all.filter(finding => finding.status === "confirmed" && finding.confidence !== "low");
    const used = eligible.length ? eligible : all;
    if (!used.length) return false;
    const confidence = used.reduce((lowest, f) => CONFIDENCE[f.confidence] < CONFIDENCE[lowest] ? f.confidence : lowest, used[0].confidence);
    const fix = item.reference ? ["Reuse the cited passage on the proposed page.", ...action.steps.slice(0, 11)] : action.steps;
    if (item.action_id !== action.id || item.priority !== (ranks.get(action.id) ?? null)
      || item.where !== action.target || item.confidence !== confidence
      || item.effort !== (action.materials[0] ? EFFORT[action.materials[0].kind] : "not_assessed")
      || canonicalDigest([item.problem, item.why_important, item.evidence_ids, item.fix, item.verification]) !== canonicalDigest([
        unique(used.map(f => f.observed_fact)), unique(used.map(f => f.impact_path)),
        unique(used.flatMap(f => f.evidence_ids)).slice(0, 50), fix, action.completion,
      ])) return false;
    if ([item.reference, item.example, item.rejection_reason].filter(value => value != null).length !== 1) return false;
    const reference = item.reference;
    if (reference || item.example) {
      const target = new URL(action.target);
      const site = new URL(report.input_manifest.business.site_url);
      if (!eligible.some(finding => finding.rule_id === "v22_capability.service_title_review")
        || !["title_brief", "service_brief"].includes(action.materials[0]?.kind ?? "")
        || /\s/.test(action.target) || target.username || target.password
        || !["http:", "https:"].includes(target.protocol)
        || target.hostname.replace(/^www\./, "") !== site.hostname.replace(/^www\./, "")
        || /\/(?:tags?|categor(?:y|ies))(?:\/|$)/i.test(target.pathname)) return false;
      if (reference) {
        const cited = new URL(reference.url);
        if (!["http:", "https:"].includes(cited.protocol) || cited.username || cited.password
          || cited.hostname.replace(/^www\./, "") !== site.hostname.replace(/^www\./, "")
          || cited.pathname.replace(/\/$/, "") === target.pathname.replace(/\/$/, "")
          || /\/(?:tags?|categor(?:y|ies))(?:\/|$)/i.test(cited.pathname)
          || !report.local_entity_coverage?.evidence.some(entry => entry.location === "body" && entry.url === reference.url)) return false;
      }
    }
    if (reference && !siteEvidence.some(entry =>
      entry.location === "body" && entry.url === reference.url && entry.path === reference.path
        && entry.quote === reference.text && entry.snapshot_id === reference.snapshot_id)) return false;
    if (item.example) {
      const service = report.input_manifest.business.primary_service;
      const expected = item.example.template === "contact" ? `Get in touch about ${service}.` : `Contact us to discuss ${service}.`;
      if (!eligible.length || !item.priority || item.example.text !== expected
        || canonicalDigest(item.example.evidence_ids) !== canonicalDigest(item.evidence_ids)) return false;
    }
    return true;
  });
}

function readerAdviceText(text: string): string {
  return readerTarget(text).replace(/\s*\(rank_source=[a-z_]+\)/g, "")
    .replace(/\bv22_[a-zA-Z0-9_.-]+\b/g, "")
    .replace(/[-+]?\d{1,3}\.\d{3,}\s*,\s*[-+]?\d{1,3}\.\d{3,}/g, "")
    .replace(/\/payload\/[^\s]+/g, "").trim();
}

export function actionAdviceView(report: CapabilityReport, action: DeliveryAction, priority: number, clientOnly: boolean) {
  const advice: Advice | undefined = report.action_advice?.find(item => item.action_id === action.id);
  if (!advice) return undefined;
  const source = report.action_candidates?.find(item => item.id === action.id);
  const unchanged = source?.title === action.title && source.target === action.target
    && canonicalDigest(source.steps) === canonicalDigest(action.steps)
    && canonicalDigest(source.materials) === canonicalDigest(action.materials);
  const text = readerAdviceText;
  const evidence = report.evidence.filter(item => advice.evidence_ids.includes(item.id));
  return {
    problem: advice.problem.map(text),
    evidence: unique(evidence.map(item => text(`${evidenceSourceLabel(item.source_kind)} · ${evidenceFieldLabel(item.field_path)}: ${evidenceValue(item.value)}`))),
    whyImportant: advice.why_important.map(text),
    fix: (unchanged ? advice.fix : action.steps).map(text),
    where: text(action.target),
    priority,
    effort: unchanged ? advice.effort : "not_assessed",
    confidence: advice.confidence,
    verification: action.completion.map(text),
    ...(unchanged && advice.reference ? {reference: {text: advice.reference.text, url: advice.reference.url}} : {}),
    ...(unchanged && advice.example ? {example: advice.example.text} : {}),
    ...(!clientOnly ? {technical: {
      evidenceIds: advice.evidence_ids,
      ...(unchanged && advice.reference ? {source: `${advice.reference.snapshot_id} ${advice.reference.path}`} : {}),
      ...(unchanged && advice.example ? {policy: advice.example.version} : {}),
      rejection: unchanged && advice.rejection_reason ? ADVICE_REJECTIONS[advice.rejection_reason]
        : !unchanged ? ADVICE_REJECTIONS.binding_changed : undefined,
    }} : {}),
  };
}

export type ActionAdviceView = NonNullable<ReturnType<typeof actionAdviceView>>;
