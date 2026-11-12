import {keywordVisibilityView} from "./keyword-visibility";
import type { CapabilityReport, DeliveryRevision } from "./generated/types";
import { validateCapabilityReport, validateDeliveryRevision } from "./validate";
import { actionNeedsVerification, clientActionIds } from "./action-visibility";
import { canonicalDigest } from "../verified-analysis-v22/digest";

function rationale(report: CapabilityReport, action: DeliveryRevision["actions"][number], sequence: number, clientIds?:string[]) {
  const trace = report.prioritization;
  const decision = trace?.candidates.find(e => e.input.action_id === action.id);
  const pool=report.action_candidates ?? report.actions;
  const source = pool.find(a => a.id === action.id);
  if (!trace || !decision || !source) return {};
  const {finding_ids: _findings, dependencies: _dependencies, ...editable} = source;
  const current = {id:action.id, title:action.title, target:action.target, steps:action.steps,
    completion:action.completion, review:action.review, materials:action.materials};
  return { whyNow: {
    explanation: decision.explanation,
    systemPosition: decision.selected_order,
    ...(["2.2.7", "2.2.8", "2.2.9"].includes(report.schema_version) ? {candidateSelection:decision.selected_order === null} : {}),
    systemTarget: source.target,
    systemTitle: source.title,
    deliveryChanged: sequence !== decision.selected_order || canonicalDigest(current) !== canonicalDigest(editable),
    prerequisites: [
      ...decision.input.dependencies.filter(id=>!clientIds || clientIds.includes(id)).map(id => pool.find(a => a.id === id)!.title),
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
export function projectCapabilityReport(report: CapabilityReport, approved?: DeliveryRevision, clientOnly=false) {
  if (!validateCapabilityReport(report).ok) throw new Error("Valid report required");
  if (approved && (approved.status !== "approved" || !validateDeliveryRevision(approved, report))) throw new Error("Approved revision required");
  const visibleIds=clientActionIds(report,approved);
  const actions=(approved?.actions ?? report.actions).filter(a=>!clientOnly || visibleIds.includes(a.id));
  return {
    ...(["2.2.7", "2.2.8", "2.2.9"].includes(report.schema_version) ? {hideSourceIdentifiers:true} : {}),
    ...(report.keyword_visibility ? {keywordVisibility:keywordVisibilityView(report.keyword_visibility,clientOnly)} : {}),
    reportId: report.id,
    title: approved?.title ?? report.title,
    summary: approved?.summary ?? report.summary,
    clientNote: approved?.client_note ?? null,
    actionState: actions.some(a=>visibleIds.includes(a.id)) ? "actions_supported" as const : "insufficient_basis" as const,
    actions: actions.map((a, index) => ({
      id: a.id, sequence: index + 1, title: a.title, target: a.target,
      steps: [...a.steps], completion: [...a.completion], review: a.review,
      materials: a.materials.map((m) => ({ ...m, evidence_ids: [...m.evidence_ids], confirmation_items: [...m.confirmation_items] })),
      ...(["2.2.5", "2.2.6", "2.2.7", "2.2.8", "2.2.9"].includes(report.schema_version) ? {clientVisible:visibleIds.includes(a.id),needsVerification:actionNeedsVerification(report,a.id)} : {}),
      ...rationale(report, a, index + 1, clientOnly ? visibleIds : undefined),
    })),
    ...(report.contact_checks ? {contactChecks: report.contact_checks.map(c=>({...c,
      compared_components:[...c.compared_components], omitted_components:[...c.omitted_components], evidence_ids:[...c.evidence_ids]}))} : {}),
    evidence: report.evidence.map((e) => ({ ...e, limitations: [...e.limitations] })),
    findings: report.findings.map((f) => ({ ...f, ...(f.coverage ? {coverage:f.coverage.map(c=>({...c}))} : {}), evidence_ids: [...f.evidence_ids], limitations: [...f.limitations] })),
    limitations: [...report.limitations],
  };
}
