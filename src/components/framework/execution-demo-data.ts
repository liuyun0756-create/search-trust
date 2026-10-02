export const executionSteps = [
  {
    title: "Confirm business information",
    summary: "Verify service areas, repair work, limitations and contact details.",
    completion: "The client has confirmed accuracy; any unconfirmed details are clearly marked.",
    location: "The business information used throughout the existing service page.",
    instructions: ["Confirm the actual service areas and repairs the business can undertake.", "Check equipment or service limitations with the client.", "Confirm contact details and mark anything still awaiting approval."],
    materials: "A client-approved service list, service areas, limitations and contact details.",
  },
  {
    title: "Improve the service introduction",
    summary: "Explain who the service is for, which problems it covers and its service area.",
    completion: "Visitors can understand what the business does and does not provide.",
    location: "The service introduction on the existing service page.",
    instructions: ["Keep business information that is already accurate.", "Add confirmed repair services and service areas.", "Make eligibility conditions and limitations clear.", "Remove service promises that cannot be verified."],
    materials: "The client-confirmed service list, service area and relevant limitations.",
  },
  {
    title: "Explain the service process",
    summary: "Describe the real process from enquiry and initial checks to arranging the work.",
    completion: "The process matches how the business actually operates.",
    location: "The service process section on the same page.",
    instructions: ["Ask the client what happens after an enquiry.", "Describe the actual confirmation, appointment and repair steps.", "Remove unconfirmed turnaround times or guarantees."],
    materials: "The client-approved enquiry, appointment and repair process.",
  },
  {
    title: "Clarify the contact path",
    summary: "Add enquiry guidance and check existing phone and form entry points.",
    completion: "Visitors know what to do next and the contact path works.",
    location: "The enquiry copy and existing phone or form links on the service page.",
    instructions: ["Explain which equipment and location details the visitor should provide.", "Use confirmed contact details and the existing enquiry route.", "Check that the phone link or form works on desktop and mobile."],
    materials: "Confirmed contact details, enquiry requirements and access to test the existing contact path.",
  },
  {
    title: "Publish and check",
    summary: "Check page presentation, links, mobile behavior and relevant events.",
    completion: "Changes are live and the page and contact path have been checked.",
    location: "The published service page and its relevant measurement setup.",
    instructions: ["Have the responsible person publish the approved changes.", "Check the live content, links and mobile presentation.", "Check relevant event collection and record the actual implementation date."],
    materials: "Approved content, publishing access, measurement access and the SEO-confirmed implementation date.",
  },
] as const;

export const draftSections = [
  { key: "title", label: "Suggested page title", note: "Keep the service, area and business name accurate.", value: "Air conditioning repair | [Service area] | [Business name]" },
  { key: "introduction", label: "Service introduction", note: "Addresses the original page’s unclear service explanation.", value: "[Business name] provides [Confirmed repair services] in [Service area]. When contacting us, describe the equipment type, fault symptoms and your location so we can confirm whether your request is within our service scope and discuss the next steps." },
  { key: "scope", label: "Service scope", note: "Helps visitors decide whether the service fits their needs.", value: "We can provide:\n• [Confirmed repair service one]\n• [Confirmed repair service two]\n• [Confirmed repair service three]\n\nService area: [Confirmed service area].\n\nIf you are unsure whether your equipment or problem is covered, please check through [Enquiry channel] first." },
  { key: "process", label: "Service process", note: "Explains what happens after the visitor gets in touch.", value: "Confirm the following process against the business’s actual way of working:\n\n1. Submit equipment and fault details.\n2. Confirm the service scope and next steps.\n3. Inspect and address the issue as appropriate.\n4. Explain the outcome and any follow-up advice.\n\n[Confirm the actual service process with the client]" },
  { key: "contact", label: "Contact guidance", note: "Makes the visitor’s next step clear.", value: "Need to check your repair requirements?\n\nTell us about your equipment and location through [Phone number or enquiry channel]." },
] as const;

export type DraftKey = (typeof draftSections)[number]["key"];
export type DemoDraft = Record<DraftKey, string>;
export const createExecutionDraft = (): DemoDraft => Object.fromEntries(draftSections.map(({ key, value }) => [key, value])) as DemoDraft;
export const serializeExecutionDraft = (draft: DemoDraft) => draftSections.map(({ key, label }) => `${label}\n${draft[key]}`).join("\n\n");
export const hasDraftPlaceholders = (draft: DemoDraft) => /\[[^\]]*\]|【[^】]*】/u.test(serializeExecutionDraft(draft));

export type ReviewScope = "search" | "onsite";
export type ReviewScenario = "positive" | "unchanged" | "insufficient";
export type DemoMetric = { label: string; before: number; after: number | null; change: string; percentage?: boolean };
export const reviewScenarios = {
  positive: { label: "Positive change", status: "Comparable — simulated", explanation: "Relevant metrics move in the expected direction, supporting further review of the current approach. Interpret this alongside demand changes, other work during the period and measurement conditions." },
  unchanged: { label: "No clear change", status: "Comparable — simulated", explanation: "No clear change appears in this comparison. Check that implementation is complete and the observation period is appropriate before deciding to keep observing or adjust the approach." },
  insufficient: { label: "Insufficient data", status: "Insufficient for comparison — simulated", explanation: "A complete, aligned post-implementation period is missing, and collection of the example key event has not been confirmed. The available data cannot support a reliable judgment. Missing values are not zero, and no improvement conclusion can be drawn." },
} as const;

export function getReviewMetrics(scope: ReviewScope, scenario: ReviewScenario): DemoMetric[] {
  const positive = scenario === "positive";
  const missing = scenario === "insufficient";
  return scope === "search" ? [
    { label: "Impressions", before: 6000, after: missing ? null : positive ? 6250 : 6000, change: missing ? "Not comparable" : positive ? "+4.2%" : "0%" },
    { label: "Clicks", before: 120, after: missing ? null : positive ? 150 : 120, change: missing ? "Not comparable" : positive ? "+25%" : "0%" },
    { label: "CTR", before: 2, after: missing ? null : positive ? 2.4 : 2, change: missing ? "Not comparable" : positive ? "+0.4 percentage points" : "0 percentage points", percentage: true },
  ] : [
    { label: "Google organic sessions", before: 100, after: missing ? null : positive ? 125 : 100, change: missing ? "Not comparable" : positive ? "+25%" : "0%" },
    { label: "Example enquiry key-event count", before: 4, after: missing ? null : positive ? 5 : 4, change: missing ? "Not comparable" : positive ? "+1 event" : "0 events" },
  ];
}

export function formatDemoMetric(value: number | null, percentage?: boolean) {
  if (value === null) return "Not available";
  return percentage ? `${value.toFixed(1)}%` : value.toLocaleString("en-US");
}
