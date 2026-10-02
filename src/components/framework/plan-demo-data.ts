export type DemoPlanFields = {
  title: string;
  target: string;
  steps: string;
  completion: string;
  owner: string;
  schedule: string;
  review: string;
};

export type DemoPlanAction = DemoPlanFields & { id: string };

export const demoRecommendations = [
  {
    id: "core-service",
    title: "Improve the core service page",
    target: "The confirmed service page",
    steps: "Add accurate service scope and process details.\nClarify the next step for contacting the business.\nCheck relevant key-event measurement.",
    completion: "Business information is accurate, changes are implemented and the contact path works.",
    owner: "SEO lead and content specialist",
    schedule: "Agree the implementation date with the client",
    review: "Review the same page’s search performance, engagement and checked key events. Agree a review date after implementation.",
    finding: "The existing service page has specific information gaps and already receives relevant search visits.",
    impact: "Service-page relevance and the contact path after arrival.",
    reason: "Relevant demand already exists, and there are specific information gaps.",
    conditions: "Confirm business details, any planned redesign and whether relevant key events can support review.",
  },
  {
    id: "business-contact",
    title: "Verify and align business contact details",
    target: "The website and public business information",
    steps: "Confirm the correct contact details with the client.\nCorrect the conflicting website and public business information.",
    completion: "The client has confirmed the details and the checked sources show consistent information.",
    owner: "SEO lead and business owner",
    schedule: "Schedule after the client confirms the correct details",
    review: "Recheck the affected information after updates. Confirm that the published contact details work.",
    finding: "The observed website and public business information contain contact details that need checking.",
    impact: "Business information consistency and reliable customer contact.",
    reason: "An information conflict needs client confirmation.",
    conditions: "Confirm the current contact details and who can update each source.",
  },
  {
    id: "other-service",
    title: "Improve another service page’s explanation",
    target: "The corresponding service page",
    steps: "Collect accurate business-specific material.\nClarify the service offering on the existing page.",
    completion: "The page explains the service accurately using approved business material.",
    owner: "Content specialist and business owner",
    schedule: "Schedule once the business material is available",
    review: "Check implementation first, then review the relevant page’s performance at an agreed date.",
    finding: "The checked page has specific content gaps that need business-specific material.",
    impact: "Clearer service information and page relevance.",
    reason: "Specific content gaps need supporting business material.",
    conditions: "Confirm service accuracy, available material and the service’s current business priority.",
  },
] as const;

export const demoFieldLabels: Record<keyof DemoPlanFields, string> = {
  title: "Action title",
  target: "Target page or work scope",
  steps: "Implementation steps",
  completion: "Completion criteria",
  owner: "Owner",
  schedule: "Planned timing",
  review: "Review metrics and timing",
};

export function createDemoPlan(): DemoPlanAction[] {
  return demoRecommendations.map((source) => ({
    id: source.id,
    title: source.title,
    target: source.target,
    steps: source.steps,
    completion: source.completion,
    owner: source.owner,
    schedule: source.schedule,
    review: source.review,
  }));
}

export function reorderDemoPlan(plan: DemoPlanAction[], sourceId: string, targetIndex: number) {
  const sourceIndex = plan.findIndex((action) => action.id === sourceId);
  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= plan.length || sourceIndex === targetIndex) return plan;
  const next = [...plan];
  const [action] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, action);
  return next;
}
