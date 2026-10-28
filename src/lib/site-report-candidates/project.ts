import { projectCapabilityReport } from "../report-capability/projection";
import { validateCapabilityReport } from "../report-capability/validate";
import type { CapabilityReadingDocument } from "../report-capability/reading-document";

/** Allowlist for controlled synthetic candidates, NOT a customer-data anonymizer. */
export function projectSiteCandidate(raw: unknown): CapabilityReadingDocument {
  const checked = validateCapabilityReport(raw);
  if (!checked.ok) throw new Error("Invalid candidate report");
  const doc = projectCapabilityReport(checked.report);
  const evidenceIds = new Map(doc.evidence.map((e, i) => [e.id, `evidence-${i + 1}`]));
  const refs = (ids: string[]) => ids.map(id => {
    const ref = evidenceIds.get(id);
    if (!ref) throw new Error("Missing candidate evidence");
    return ref;
  });
  return {
    title: doc.title, summary: doc.summary, clientNote: doc.clientNote,
    actionState: doc.actionState, limitations: [...doc.limitations],
    evidence: doc.evidence.map((e) => ({
      id: evidenceIds.get(e.id)!, object: e.object, field_path: e.field_path,
      value: e.value, unit: e.unit, observed_at: e.observed_at,
    })),
    findings: doc.findings.map((f, i) => ({
      id: `finding-${i + 1}`, target: f.target, observed_fact: f.observed_fact,
      judgment: f.judgment, impact_path: f.impact_path, comparison_scope: f.comparison_scope,
      observed_at: f.observed_at, evidence_ids: refs(f.evidence_ids), limitations: [...f.limitations],
    })),
    actions: doc.actions.map((a, i) => ({
      id: `action-${i + 1}`, sequence: a.sequence, title: a.title, target: a.target,
      steps: [...a.steps], completion: [...a.completion], review: a.review,
      materials: a.materials.map((m, j) => ({
        id: `action-${i + 1}-material-${j + 1}`, kind: m.kind, title: m.title,
        body: m.body, target: m.target, readiness: m.readiness,
        evidence_ids: refs(m.evidence_ids) as typeof m.evidence_ids,
        confirmation_items: [...m.confirmation_items],
      })),
      // The priority explanation is already a display-only projection.
      ...(a.whyNow ? { whyNow: structuredClone(a.whyNow) } : {}),
    })),
  };
}

export type CandidateId = "prospect" | "verified" | "diagnosis";
export type SiteCandidate = {
  id: CandidateId;
  label: string;
  context: string;
  document: CapabilityReadingDocument;
};
export const candidateCopy: Record<CandidateId, { label: string; context: string }> = {
  prospect: { label: "Prospect report", context: "Before analytics access · A specific observation and a first scope to discuss." },
  verified: { label: "Verified plan", context: "Same Case, after access · Public checks, search evidence and on-site data inform the next plan." },
  diagnosis: { label: "Diagnosis only", context: "Separate outcome · A complete diagnosis can contain no recommended action. A completed analysis still uses 1 credit; it is not refunded." },
};
