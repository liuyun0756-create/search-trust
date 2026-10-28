import type { BusinessScope, CapabilityAction, CapabilityFinding, PrioritizationTrace, PriorityCandidateInput, PriorityDecision } from "./generated/types";
import { canonicalDigest } from "../verified-analysis-v22/digest";

const objectives: Record<string, string[]> = {
  service_visibility: ["title_brief", "service_brief"], contact_path: ["service_brief", "profile_correction"],
  business_identity: ["profile_correction"],
};
const ranks = { low: 0, medium: 1, high: 2, critical: 3 };
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const uniqueSorted = (items: string[]) => [...new Set(items)].sort(compare);
export const priorityLimit = "Business return is unknown. This order is not a revenue forecast or evidence that SEO caused a change.";

export function priorityCandidate(action: CapabilityAction): PriorityCandidateInput {
  return { action_id: action.id, target: action.target, finding_ids: [...action.finding_ids].sort(compare) as PriorityCandidateInput["finding_ids"],
    dependencies: [...action.dependencies].sort(compare) as PriorityCandidateInput["dependencies"], material_kinds: uniqueSorted(action.materials.map(m => m.kind)) as PriorityCandidateInput["material_kinds"],
    readiness: uniqueSorted(action.materials.map(m => m.readiness)) as PriorityCandidateInput["readiness"] };
}
function page(value: string, site: string): string | null {
  try {
    const p = new URL(value), b = new URL(site);
    const host = (u: URL) => u.hostname.toLowerCase().replace(/^www\./, "");
    if (!/^https?:\/\//.test(value) || p.username || p.password || host(p) !== host(b)) return null;
    // Preserve path/query spelling. Do not turn a different page into a focus match.
    const raw = value.match(/^https?:\/\/[^/?#]+([^?#]*)(?:\?([^#]*))?/);
    return JSON.stringify([host(p), p.port || null, raw?.[1] || "/", raw?.[2] || ""]);
  } catch { return null; }
}
function measurement(rule: string) {
  return ["V22.FIRST_PARTY.GSC.MEASUREMENT_COVERAGE", "V22.FIRST_PARTY.GA4.MEASUREMENT_CONFIGURATION", "V22.FIRST_PARTY.GBP.PROFILE_OR_MEASUREMENT"].some(p => rule.startsWith(`${p}.`))
    || ["V22.CROSS_SOURCE.GSC_GA4.PAGE_DIRECTION_CONFLICT", "V22.CROSS_SOURCE.GSC_GA4.AGGREGATE_DIRECTION_CONFLICT", "V22.CROSS_SOURCE.GSC_GBP.VISIBILITY_CONFLICT", "V22.CROSS_SOURCE.GA4_GBP.BEHAVIOR_CONFLICT", "V22.CROSS_SOURCE.GSC_GA4.WEEKLY_CONFLICT"].includes(rule);
}

/** Replay the ordinal backend rules. Persisted explanations cannot contradict their inputs. */
export function replayPriority(inputs: PriorityCandidateInput[], findings: CapabilityFinding[], business: BusinessScope, checksum: string,
  rulesVersion: PrioritizationTrace["rules_version"] = "v22_business_priority_v1"): PrioritizationTrace {
  const conditions = business.execution_conditions ?? {capacity:"unknown", publishing_access:"unknown"};
  const byId = new Map(findings.map(f => [f.id, f]));
  const ids = new Set(inputs.map(c => c.action_id));
  if (ids.size !== inputs.length) throw new Error("Duplicate priority candidate");
  const pages = new Set(business.target_pages.map(p => page(p, business.site_url)).filter((p): p is string => p !== null));
  const objective = business.priority && Object.hasOwn(objectives, business.priority) ? business.priority : null;
  const entries: PriorityDecision[] = structuredClone([...inputs]).sort((a, b) => compare(a.action_id, b.action_id)).map(input => {
    for (const list of [input.finding_ids, input.dependencies, input.material_kinds, input.readiness]) {
      if (JSON.stringify(list) !== JSON.stringify(uniqueSorted(list))) throw new Error("Noncanonical priority input");
    }
    if (!input.finding_ids.length || input.finding_ids.some(id => !byId.has(id)) || input.dependencies.some(id => !ids.has(id) || id === input.action_id)) throw new Error("Invalid priority reference");
    const linked = input.finding_ids.map(id => byId.get(id)!);
    const prerequisite = linked.some(f => ["v22_public.site_http_error", "v22_public.site_explicit_noindex"].includes(f.rule_id)) ? "access_indexing"
      : linked.some(f => measurement(f.rule_id)) ? "measurement" : "none";
    const business_match = input.target.split("\n").some(t => pages.has(page(t, business.site_url) ?? "")) ? "confirmed_target"
      : objective && (input.material_kinds.some(k => objectives[objective].includes(k))
        || rulesVersion === "v22_business_priority_v2" && objective === "contact_path" && linked.some(f => ["V22.FIRST_PARTY.GA4.ENGAGEMENT_GAP", "V22.FIRST_PARTY.GA4.CONVERSION_GAP"].includes(f.rule_id))) ? "confirmed_objective" : pages.size || objective ? "not_matched" : "unknown";
    const evidence_support = linked.some(f => f.interpretation === "conflicting") ? "conflicting"
      : linked.some(f => f.interpretation === "needs_verification" || f.classification === "estimate") ? "needs_verification" : "supported";
    const publishing = input.material_kinds.some(k => ["title_brief", "service_brief", "profile_correction"].includes(k));
    const execution = input.readiness.some(r => r === "requires_confirmation") || (rulesVersion === "v22_business_priority_v2" && publishing && conditions.publishing_access === "needs_approval") ? "confirmation_required"
      : input.readiness.length && input.readiness.every(r => r === "ready_to_use") ? "ready_to_use" : "instructions_only";
    const severity = [...linked].sort((a,b) => ranks[b.severity]-ranks[a.severity])[0].severity;
    const confidence = [...linked].sort((a,b) => ranks[b.confidence]-ranks[a.confidence])[0].confidence;
    const reason_codes = [`prerequisite_${prerequisite}`, `business_${business_match}`, `evidence_${evidence_support}`, `execution_${execution}`, `severity_${severity}`, `confidence_${confidence}`, "return_unknown", "stable_identity_tiebreak"];
    if (input.dependencies.length) reason_codes.push("dependencies_first");
    if (rulesVersion === "v22_business_priority_v2") reason_codes.push(`capacity_${conditions.capacity}`, `publishing_${conditions.publishing_access}`);
    let explanation = prerequisite === "access_indexing" ? "Check access and indexing before optimizing affected pages."
      : prerequisite === "measurement" ? "Establish reliable measurement before interpreting performance." : {
        confirmed_target: "This work addresses an explicitly confirmed target page.",
        confirmed_objective: "This work matches the explicitly confirmed business objective.",
        not_matched: "No direct match to the confirmed focus; this is not a low-value judgment.",
        unknown: "Business focus is not specified; order uses evidence and problem attributes, not assumed business value.",
      }[business_match];
    if (evidence_support === "conflicting") explanation += " Conflicting evidence calls for investigation, not a claimed business cause.";
    else if (evidence_support === "needs_verification") explanation += " Confirm the stated assumptions before changing anything.";
    if (execution === "confirmation_required") explanation += " Business details or approval are still required.";
    if (rulesVersion === "v22_business_priority_v2") {
      if (publishing && conditions.capacity === "limited") explanation += " Limited execution capacity is confirmed; reserve a separate slot for changes. No duration is estimated.";
      if (publishing && conditions.publishing_access === "unknown") explanation += " Publishing access is unknown, not assumed blocked or approved.";
    }
    return { input, prerequisite, business_match, evidence_support, execution,
      severity, confidence,
      impact_paths: [...new Set(linked.map(f => f.impact_path))] as PriorityDecision["impact_paths"],
      comparison_scopes: [...new Set(linked.map(f => f.comparison_scope))] as PriorityDecision["comparison_scopes"],
      reason_codes: reason_codes as PriorityDecision["reason_codes"], explanation, selected_order: null };
  });
  const key = (e: PriorityDecision) => [
    {access_indexing:0, measurement:1, none:2}[e.prerequisite],
    {confirmed_target:0, confirmed_objective:1, not_matched:2, unknown:2}[e.business_match],
    {supported:0, needs_verification:1, conflicting:2}[e.evidence_support], -ranks[e.severity], -ranks[e.confidence],
    Number(rulesVersion === "v22_business_priority_v2" && conditions.capacity === "limited" && e.input.material_kinds.some(k => ["title_brief", "service_brief", "profile_correction"].includes(k))),
    {ready_to_use:0, instructions_only:1, confirmation_required:2}[e.execution],
  ];
  const pending = [...entries], ordered = new Set<string>(), action_order: string[] = [];
  while (pending.length) {
    const available = pending.filter(e => e.input.dependencies.every(id => ordered.has(id)));
    if (!available.length) throw new Error("Cyclic priority dependencies");
    available.sort((a,b) => {
      const ak = key(a), bk = key(b);
      for (let i=0; i<ak.length; i++) if (ak[i] !== bk[i]) return ak[i]-bk[i];
      return compare(a.input.action_id, b.input.action_id);
    });
    const entry = available[0];
    ordered.add(entry.input.action_id);
    if (action_order.length < 3) { action_order.push(entry.input.action_id); entry.selected_order = action_order.length; }
    else entry.reason_codes.push("outside_delivery_budget");
    pending.splice(pending.indexOf(entry), 1);
  }
  return { rules_version:rulesVersion, input_checksum:checksum, business_priority:business.priority,
    target_pages:[...business.target_pages], action_order: action_order as PrioritizationTrace["action_order"], candidates:entries, limitations:[priorityLimit] };
}

export function priorityMatches(trace: PrioritizationTrace, report: {actions: CapabilityAction[]; findings: CapabilityFinding[]; input_manifest: {business: BusinessScope; input_checksum: string}}) {
  const replay = replayPriority(trace.candidates.map(e => e.input), report.findings, report.input_manifest.business, report.input_manifest.input_checksum, trace.rules_version);
  return canonicalDigest(trace) === canonicalDigest(replay) && JSON.stringify(trace.action_order) === JSON.stringify(report.actions.map(a => a.id))
    && report.actions.every(a => canonicalDigest(priorityCandidate(a)) === canonicalDigest(trace.candidates.find(e => e.input.action_id === a.id)?.input));
}
