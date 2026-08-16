import type {
  ActionPriority,
  BusinessPresenceArea,
  BusinessPresenceProposalAction,
} from "./types";

export interface ClientBusinessPresenceOpportunity {
  id: string;
  priority: ActionPriority;
  businessArea: BusinessPresenceArea;
  title: string;
  currentSituation: string;
  recommendedAction: string;
  expectedBenefit?: string;
}

export const NO_ADDITIONAL_PROPOSAL_TASKS_MESSAGE =
  "No additional off-site tasks were identified from the checked business-presence data. Page-level fixes are already listed in the Trust Layer Breakdown and Implementation Roadmap.";

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
      headline: "No additional off-site tasks identified",
      summary:
        "The checked GBP and recent-review data did not produce another client task. Page-level work remains documented in the earlier report sections.",
    };
  }

  return {
    headline: `${count} client-ready ${count === 1 ? "task" : "tasks"} identified`,
    summary:
      "Each task below explains why the work is needed and what the agency should deliver. These off-site tasks do not change the eight-layer page score.",
  };
}

export function getProposalActionDisplayCopy(
  action: BusinessPresenceProposalAction,
): Pick<BusinessPresenceProposalAction, "title" | "rationale" | "recommended_scope"> {
  const count = action.rationale.match(/\b(\d+)\b/)?.[1];

  switch (action.id) {
    case "bp-action-add-photos":
      return {
        title: "Create and publish a current GBP photo set",
        rationale:
          "The GBP profile has no public photos, so prospective customers cannot see current visual proof of the business, team or completed work.",
        recommended_scope: [
          "Prepare an approved set of authentic exterior, team, service and completed-work photos.",
          "Upload the approved images to GBP with clear, accurate descriptions.",
          "Provide the client with a reusable photo checklist for future updates.",
        ],
      };
    case "bp-action-add-posts":
      return {
        title: "Publish the first GBP business update",
        rationale:
          "The GBP profile has no published updates, leaving no recent public signal about services, availability or completed work.",
        recommended_scope: [
          "Draft and publish one accurate update about a current service, availability or completed job.",
          "Include an approved image and a clear next step for prospective customers.",
          "Provide a simple topic plan for the next three GBP updates.",
        ],
      };
    case "bp-action-low-rating-replies":
      return {
        title: "Resolve unanswered low-rating reviews",
        rationale: `${count ? `${count} recent` : "Recent"} 1-3 star review${count === "1" ? "" : "s"} ${count === "1" ? "has" : "have"} no owner reply. ${count === "1" ? "This review needs" : "These reviews need"} a timely response and may require service-recovery follow-up.`,
        recommended_scope: [
          "Review each unanswered 1-3 star review with the client and identify any service-recovery case.",
          "Prepare a factual, non-defensive, individualized reply for each review.",
          "Deliver an approval-ready reply list and flag cases that need private follow-up before publishing.",
        ],
      };
    case "bp-action-review-backlog":
      return {
        title: "Complete replies for the remaining recent reviews",
        rationale: `${count ? `${count} additional recent` : "Some recent"} review${count === "1" ? "" : "s"} ${count === "1" ? "has" : "have"} no owner reply. Completing ${count === "1" ? "this reply" : "these replies"} gives the client a consistent review-response process.`,
        recommended_scope: [
          "Prepare a concise, specific reply for each remaining unanswered recent review.",
          "Personalize every reply to the customer's feedback and avoid repeated templates.",
          "Deliver the replies in an approval-ready list with a recommended publishing order.",
        ],
      };
    case "bp-action-proof-candidates":
      return {
        title: "Turn detailed reviews into approved customer proof",
        rationale: `${count || "Several"} recent 4-5 star review${count === "1" ? "" : "s"} ${count === "1" ? "includes" : "include"} specific customer detail that could support relevant service pages, case examples and client proposals.`,
        recommended_scope: [
          "Select 3-5 reviews with specific service, response or outcome details.",
          "Organize the strongest proof into reusable themes without changing the reviewer meaning.",
          "Recommend where each approved quote should appear, such as a service page, case example or proposal.",
          "Obtain client approval and confirm platform rules before publishing any quote.",
        ],
      };
    default:
      return {
        title: action.title,
        rationale: action.rationale,
        recommended_scope: action.recommended_scope,
      };
  }
}

/**
 * Converts the exact proposal-ready task list used by the Full Report into
 * client-facing copy. Filtering, count, order and priority remain shared with
 * the Full Report; only the presentation language changes here.
 */
export function getClientBusinessPresenceOpportunities(
  actions?: BusinessPresenceProposalAction[] | null,
): ClientBusinessPresenceOpportunity[] {
  return getAdditionalBusinessPresenceActions(actions).map((action) => ({
    id: action.id,
    priority: action.priority,
    businessArea: action.business_area,
    ...getClientProposalActionCopy(action),
  }));
}

function getClientProposalActionCopy(
  action: BusinessPresenceProposalAction,
): Pick<
  ClientBusinessPresenceOpportunity,
  "title" | "currentSituation" | "recommendedAction" | "expectedBenefit"
> {
  const count = action.rationale.match(/\b(\d+)\b/)?.[1];

  switch (action.id) {
    case "bp-action-add-photos":
      return {
        title: "Show more current business proof",
        currentSituation:
          "The public business profile does not currently show photos of the business, team, services or completed work.",
        recommendedAction:
          "Add an approved set of authentic, current photos with clear and accurate descriptions.",
        expectedBenefit:
          "Current visual proof can help prospective customers understand who they may be hiring and what the business delivers.",
      };
    case "bp-action-add-posts":
      return {
        title: "Keep the business profile visibly current",
        currentSituation:
          "The public business profile does not currently show recent updates about services, availability or completed work.",
        recommendedAction:
          "Publish an accurate business update with an approved image and a clear next step for prospective customers.",
        expectedBenefit:
          "Regular updates can give customers a clearer signal that the business is active and current.",
      };
    case "bp-action-low-rating-replies":
      return {
        title: "Address unanswered low-rating reviews",
        currentSituation: `${count ? `${count} recent` : "One or more recent"} 1-3 star review${count === "1" ? "" : "s"} ${count === "1" ? "is" : "are"} still waiting for a business response.`,
        recommendedAction:
          "Review each case and publish a factual, personalized response, with private follow-up where service recovery is needed.",
        expectedBenefit:
          "A clear response process shows that customer concerns are acknowledged and handled responsibly.",
      };
    case "bp-action-review-backlog":
      return {
        title: "Strengthen review response coverage",
        currentSituation: `${count ? `${count} recent customer` : "Some recent customer"} review${count === "1" ? " is" : "s are"} still waiting for a business response.`,
        recommendedAction:
          "Publish a concise, personalized response to each unanswered recent review.",
        expectedBenefit:
          "Consistent responses can help the business appear active, attentive and engaged with its customers.",
      };
    case "bp-action-proof-candidates":
      return {
        title: "Use strong reviews as customer proof",
        currentSituation: `${count || "Several"} recent high-rated review${count === "1" ? " contains" : "s contain"} specific service, response or outcome details that could support customer-facing materials.`,
        recommendedAction:
          "Select the strongest examples, confirm approval and place them on relevant service pages, case examples or proposals without changing their meaning.",
        expectedBenefit:
          "This turns existing customer feedback into credible proof that can support future buying decisions.",
      };
    default: {
      const displayCopy = getProposalActionDisplayCopy(action);
      return {
        title: displayCopy.title,
        currentSituation: displayCopy.rationale,
        recommendedAction:
          displayCopy.recommended_scope[0]
          || "Review this opportunity and agree on the next customer-facing action.",
      };
    }
  }
}
