export const methodChapters = [
  { id: "prospect-diagnosis", label: "Discover", phase: "Prospect", output: "Prospect Diagnosis" },
  { id: "verified-action", label: "Verify", phase: "Client evidence", output: "Verified judgment" },
  { id: "prioritization-title", label: "Prioritize", phase: "Work decision", output: "Priority action" },
  { id: "execution-title", label: "Execute", phase: "Working brief", output: "Execution plan" },
  { id: "practice-title", label: "Review", phase: "Result check", output: "Review criteria" },
  { id: "delivery-title", label: "Deliver", phase: "Client delivery", output: "Reviewed report" },
] as const;

export type MethodStageId = (typeof methodChapters)[number]["id"];

export const caseSnapshots: Record<MethodStageId, {
  stamp: string;
  question: string;
  observed: string;
  added: string;
  decision: string;
  output: string;
  stillOpen: string;
}> = {
  "prospect-diagnosis": {
    stamp: "PUBLIC OBSERVATION",
    question: "Does this core service need its own page?",
    observed: "In the pages checked, the service explanation appears scattered across general pages. A confirmed competitor has a dedicated page.",
    added: "Website, public business information and a confirmed competitor. No client analytics yet.",
    decision: "Check for an existing page before recommending a new one.",
    output: "A business-specific finding and a conditional first action.",
    stillOpen: "Whether a corresponding page already exists and whether this service is a business priority.",
  },
  "verified-action": {
    stamp: "JUDGMENT REVISED",
    question: "Is a new page still the right answer?",
    observed: "The initial public check suggested a possible page gap, not proof that a page was absent.",
    added: "In this fictional example, the client confirms an existing page and a priority service. Relevant queries already bring that page search exposure and clicks.",
    decision: "Investigate improving the existing page before creating a possible duplicate.",
    output: "A more specific action candidate linked to the confirmed page.",
    stillOpen: "Event quality and the cause of any enquiry shortfall are not established.",
  },
  "prioritization-title": {
    stamp: "ACTION CANDIDATE",
    question: "Why might this work come first?",
    observed: "The existing page serves a confirmed business priority and has a specific service-information gap.",
    added: "Relevant search exposure, an identified page and a feasible improvement are considered alongside other candidate actions.",
    decision: "Consider improving this page for the top-three plan; the SEO sets the final order.",
    output: "A recommendation with an impact direction, target, rationale and dependencies.",
    stillOpen: "Business materials, redesign timing and measurement suitability need confirmation.",
  },
  "execution-title": {
    stamp: "WORK PREPARED",
    question: "What would the team actually change?",
    observed: "A page-level recommendation is not yet an implementation record.",
    added: "The working brief specifies the target, content and contact-path changes, materials needed and completion checks.",
    decision: "Prepare page changes for SEO and client review before implementation.",
    output: "An editable working brief and review checklist—not a claim that work is complete.",
    stillOpen: "The client must confirm service facts; an implementer must verify the live change.",
  },
  "practice-title": {
    stamp: "REVIEW CONDITIONS",
    question: "How would we know whether the direction should change?",
    observed: "The proposed page work and its intended outcome are recorded separately.",
    added: "A real review needs implementation dates, the same page and comparable search and on-site data.",
    decision: "Check completion first; then examine performance and competing explanations before keeping or changing the plan.",
    output: "A review trail and next-decision criteria. No result is claimed for this fictional case.",
    stillOpen: "No real implementation log, post-change data or measured outcome has been supplied.",
  },
  "delivery-title": {
    stamp: "READY FOR SEO REVIEW",
    question: "What can the SEO confidently show the client?",
    observed: "The same finding and source boundaries remain visible in both reading views.",
    added: "SEO detail and client-readable language organize the same proposed action and outstanding conditions.",
    decision: "Review the evidence and final plan before sharing a client-facing version.",
    output: "A clear proposal or follow-up report, contingent on SEO approval.",
    stillOpen: "This demonstration does not create a real report, verify an outcome or send anything to a client.",
  },
};
