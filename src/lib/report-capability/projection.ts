import type { CapabilityReport, DeliveryRevision } from "./generated/types";
import { validateCapabilityReport, validateDeliveryRevision } from "./validate";
import { canonicalDigest } from "../verified-analysis-v22/digest";

function rationale(report: CapabilityReport, action: DeliveryRevision["actions"][number], sequence: number) {
  const trace = report.prioritization;
  const decision = trace?.candidates.find(e => e.input.action_id === action.id);
  const source = report.actions.find(a => a.id === action.id);
  if (!trace || !decision || !source || !decision.selected_order) return {};
  const {finding_ids: _findings, dependencies: _dependencies, ...editable} = source;
  const current = {id:action.id, title:action.title, target:action.target, steps:action.steps,
    completion:action.completion, review:action.review, materials:action.materials};
  return { whyNow: {
    explanation: decision.explanation,
    systemPosition: decision.selected_order,
    systemTarget: source.target,
    systemTitle: source.title,
    deliveryChanged: sequence !== decision.selected_order || canonicalDigest(current) !== canonicalDigest(editable),
    prerequisites: [
      ...decision.input.dependencies.map(id => report.actions.find(a => a.id === id)!.title),
      ...(decision.prerequisite === "access_indexing" ? ["Access and indexing check before optimization"]
        : decision.prerequisite === "measurement" ? ["Reliable measurement before performance interpretation"] : []),
    ],
    business: {
      confirmed_target: "Matches a confirmed target page.", confirmed_objective: "Matches the confirmed business objective.",
      not_matched: "No direct focus match; business value is not rated low.", unknown: "Business focus is unknown; evidence and problem attributes determine the order.",
    }[decision.business_match],
    evidence: `${{supported:"Supported within the checked scope; this is not proof of cause.", needs_verification:"Assumptions or evidence still need verification.", conflicting:"Conflicting evidence: investigate before drawing a conclusion."}[decision.evidence_support]} Issue severity: ${decision.severity}; confidence: ${decision.confidence}.`,
    execution: {confirmation_required:"Confirm business details or approval before publishing.", instructions_only:"Check instructions, not publish-ready content.", ready_to_use:"Ready for SEO review; not a claim of implementation."}[decision.execution],
    impactPaths: [...decision.impact_paths], comparisonScopes: [...new Set(decision.comparison_scopes.flatMap(scope => scope.split("\n")))],
    rulesVersion: trace.rules_version, reasonCodes: [...decision.reason_codes], limits: [...trace.limitations],
  } };
}

/** Shared reading/export input. Caller validates and selects the approved revision. */
export function projectCapabilityReport(report: CapabilityReport, approved?: DeliveryRevision) {
  if (!validateCapabilityReport(report).ok) throw new Error("Valid report required");
  if (approved && (approved.status !== "approved" || !validateDeliveryRevision(approved, report))) throw new Error("Approved revision required");
  return {
    reportId: report.id,
    title: approved?.title ?? report.title,
    summary: approved?.summary ?? report.summary,
    clientNote: approved?.client_note ?? null,
    actionState: report.action_state,
    actions: (approved?.actions ?? report.actions).map((a, index) => ({
      id: a.id, sequence: index + 1, title: a.title, target: a.target,
      steps: [...a.steps], completion: [...a.completion], review: a.review,
      materials: a.materials.map((m) => ({ ...m, evidence_ids: [...m.evidence_ids], confirmation_items: [...m.confirmation_items] })),
      ...rationale(report, a, index + 1),
    })),
    evidence: report.evidence.map((e) => ({ ...e, limitations: [...e.limitations] })),
    findings: report.findings.map((f) => ({ ...f, evidence_ids: [...f.evidence_ids], limitations: [...f.limitations] })),
    limitations: [...report.limitations],
  };
}
