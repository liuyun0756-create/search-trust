import type { BusinessPresenceProposalAction } from "./types";

export const NO_ADDITIONAL_PROPOSAL_TASKS_MESSAGE =
  "No additional proposal-ready opportunities were identified from the checked business-presence data. Any overlapping page remediation is already covered in the Trust Layer Breakdown and Implementation Roadmap.";

export function getAdditionalBusinessPresenceActions(
  actions?: BusinessPresenceProposalAction[] | null,
): BusinessPresenceProposalAction[] {
  return (Array.isArray(actions) ? actions : []).filter(
    (action) => action.business_area !== "identity_alignment",
  );
}

export function getProposalOpportunityCopy(count: number): {
  headline: string;
  summary: string;
} {
  if (count === 0) {
    return {
      headline: "No additional proposal-ready opportunities identified",
      summary:
        "No additional off-site work was identified from the checked business-presence data. Overlapping page remediation remains documented in the earlier report sections.",
    };
  }

  return {
    headline: `${count} proposal-ready ${count === 1 ? "opportunity" : "opportunities"} identified`,
    summary: `The checked business-presence data produced ${count} additional off-site operational ${count === 1 ? "opportunity" : "opportunities"} not already covered in the Trust Layer Breakdown and Implementation Roadmap.`,
  };
}
