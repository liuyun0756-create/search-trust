export type ReportStage = "prospect" | "verified";

export type EditableReport = {
  headline: string;
  summary: string;
  decision: string;
  actions: string[];
  clientRequest: string;
  review: string;
};

export type SampleReport = {
  stage: ReportStage;
  number: string;
  name: string;
  moment: string;
  purpose: string;
  sourceScope: string;
  client: EditableReport;
  seo: EditableReport;
  evidence: { source: string; finding: string; implication: string }[];
  judgment: { question: string; answer: string }[];
  limits: string[];
  status: { label: string; detail: string }[];
};

export const sampleCase = {
  name: "Local air-conditioning repair business",
  service: "Core air-conditioning repair service",
  location: "Illustrative local service area",
  note: "One fictional business · two consecutive report moments · no real client result",
};

export const sampleReports: SampleReport[] = [
  {
    stage: "prospect",
    number: "01",
    name: "Prospect Evidence Report",
    moment: "Before client analytics access",
    purpose: "Give the SEO a concrete, defensible starting point for a proposal—not a claim about private performance.",
    sourceScope: "Illustrative public website, public business information and one confirmed local competitor. No Search Console, GA4, lead or revenue data is available at this stage.",
    client: {
      headline: "There is a clearer way to explain the repair service to potential customers.",
      summary: "In the pages checked for this example, information about the core repair service is spread across a broader page. The service coverage, process and next contact step are not sufficiently clear. That gives us a specific issue to discuss before agreeing on work.",
      decision: "First confirm whether a dedicated service page already exists. If it does, improve that page before considering a new one. A competitor having a separate page does not by itself justify creating a duplicate.",
      actions: [
        "Confirm the existing service page and the business's priority for this repair service.",
        "Improve the approved service explanation and make the contact step clear on the right page.",
        "After access is granted, check search demand and on-site measurement before finalizing the longer-term priority.",
      ],
      clientRequest: "Please confirm the actual service area, the page currently used for this service, the service process and the business materials we may describe.",
      review: "Once analytics access is available, check whether the confirmed page receives relevant search demand and whether measurement is suitable for a follow-up decision.",
    },
    seo: {
      headline: "Validate page ownership before recommending a new repair-service landing page.",
      summary: "The inspected public pages do not clearly consolidate the core service. A confirmed competitor explains the same service on a dedicated page. This is a page-coverage question, not evidence that the competitor's structure caused its search visibility.",
      decision: "Treat an existing-page check as the first decision gate. Improve the current target if one is confirmed; only evaluate a new page after a genuine coverage gap and sufficient business material are established.",
      actions: [
        "Map the client's service, location and search intent to the existing URL inventory; confirm page ownership.",
        "Document missing service coverage, process, identity and contact information on the confirmed target.",
        "Request GSC and GA4 access to test demand, landing behavior and event quality before ranking this against other work.",
      ],
      clientRequest: "Confirm business priority, service area, current URL, accurate service details and any planned redesign. Record who approved each business claim.",
      review: "Carry the initial hypothesis into the same Case. After access, compare the relevant page and query scope with eligible GSC/GA4 evidence; do not infer traffic or enquiry quality from public observation.",
    },
    evidence: [
      { source: "Public page inspection", finding: "Within the pages checked, the repair service is mainly explained inside a broader page; service coverage and process are not clearly set out.", implication: "A defined page target and more complete service information may be needed, subject to checking the full URL inventory." },
      { source: "Public contact path", finding: "The checked page does not make the next step for an interested visitor sufficiently clear.", implication: "The contact path deserves a practical review; no conclusion about actual enquiry loss is available." },
      { source: "Confirmed competitor observation", finding: "One relevant local competitor has a dedicated page for the same service in a comparable service context.", implication: "Useful market context, not proof that copying its page structure improves rankings." },
    ],
    judgment: [
      { question: "What is observed?", answer: "A service-explanation and contact-path gap in the pages inspected." },
      { question: "What remains unknown?", answer: "Whether an existing dedicated page was missed; actual query demand, traffic, leads and business impact." },
      { question: "What is proposed?", answer: "Confirm the target and scope, then improve the appropriate page rather than immediately adding another URL." },
    ],
    limits: [
      "This is a fictional method example, not a real client diagnosis; no URLs, screenshots, dates or source snapshots are supplied.",
      "Public evidence cannot establish private traffic, lead quality, revenue or the cause of a ranking difference.",
      "The three actions are a proposal discussion scope, not a universal priority order or implemented work.",
    ],
    status: [
      { label: "Proposed", detail: "Three actions to review with the SEO and client." },
      { label: "Implemented", detail: "Nothing is recorded as completed." },
      { label: "Reviewed", detail: "No performance result is claimed." },
    ],
  },
  {
    stage: "verified",
    number: "02",
    name: "Verified Action Plan",
    moment: "After client confirmation and eligible data access",
    purpose: "Revisit the first report's open question and turn a supported diagnosis into an executable, reviewable plan.",
    sourceScope: "Illustrative client confirmation, eligible Search Console page/query evidence, GA4 landing-page behavior and a renewed inspection of the same page. No numeric data or actual source snapshot is supplied.",
    client: {
      headline: "First improve the service page that is already attracting relevant search visits.",
      summary: "The business confirms it already has a page for this priority service. In this example, Search Console shows relevant search exposure and clicks for that page. The page still leaves service coverage, process and the contact step unclear. The earlier idea of adding a new page therefore changes: improve the existing one first.",
      decision: "Improve the existing core service page, then check whether the changes were completed and how that same page performs. We are not treating a new page as the immediate next step.",
      actions: [
        "Approve accurate service coverage, process and business information for the existing page.",
        "Make the route to contact clear and test that it works on the updated page.",
        "Check key-event definitions and collection, then agree on a baseline and review window for the same page.",
      ],
      clientRequest: "Please confirm the service details, supply supporting business material, review the page copy and flag any parallel site changes.",
      review: "First confirm that the agreed page changes and contact path work. Then revisit comparable search, landing-page and relevant event evidence; explain other changes happening at the same time.",
    },
    seo: {
      headline: "Retain the existing service URL; prioritize its content and contact-path improvement.",
      summary: "The initial public-only hypothesis left page existence unresolved. Client confirmation identifies a current target URL and a business priority. Illustrative eligible GSC evidence indicates relevant impressions and clicks. Page inspection identifies actionable information gaps. GA4 participation merits investigation, but event semantics and collection must be checked before conversion interpretation.",
      decision: "Do not open a duplicate-page task. Place the existing-page improvement among action candidates because demand, business relevance and an identifiable page gap converge. Compare it with the other candidates before fixing the final top-three order.",
      actions: [
        "Specify the confirmed URL, approved service coverage, process, business identity and acceptance checks for the content change.",
        "Define and test the contact path, including mobile behavior and the exact expected event behavior.",
        "Record implementation date, eligible GSC/GA4 baseline, comparison scope and concurrent changes before a performance review.",
      ],
      clientRequest: "Confirm URL ownership, business priority, accurate materials, redesign timing, key-event meaning and the person who approves implementation.",
      review: "Compare the same URL and relevant query/landing scope over suitable aligned periods. Verify source health, sample sufficiency and event configuration. Separate completed work from observed performance and avoid a single-cause claim.",
    },
    evidence: [
      { source: "Client confirmation", finding: "An existing page covers the core service and the service is a current business priority.", implication: "The earlier missing-page possibility is revised; a duplicate page is not the immediate recommendation." },
      { source: "Search Console · illustrative eligible scope", finding: "The confirmed page receives exposure and clicks for relevant service queries.", implication: "It has a search-demand basis for improvement; this does not establish the cause of its current performance." },
      { source: "GA4 · illustrative eligible scope", finding: "Landing-page participation suggests a useful follow-up question; key-event meaning and collection still need checking.", implication: "No enquiry, lead-quality or revenue conclusion should be drawn yet." },
      { source: "Renewed page inspection", finding: "Service coverage, process and next contact step remain unclear on the existing target.", implication: "There is a concrete, executable content and contact-path scope to review." },
    ],
    judgment: [
      { question: "What changed from report 01?", answer: "A matching page is confirmed. Its relevant search exposure and clicks support inspecting that page, not adding a duplicate by default." },
      { question: "What is now actionable?", answer: "Improve the confirmed page's service explanation and contact path, subject to SEO and client approval." },
      { question: "What is not proven?", answer: "That content gaps caused lost enquiries, or that edits will lift rankings, traffic or leads." },
    ],
    limits: [
      "This is the same fictional example as report 01. No actual GSC/GA4 account, source snapshot, value, baseline or date is represented here.",
      "Eligible search and on-site behavior can support a work decision but do not prove the cause of lost enquiries or guarantee improvement.",
      "The plan is proposed only. Implementation and post-change review have not been recorded.",
    ],
    status: [
      { label: "Planned", detail: "SEO and client review are still needed." },
      { label: "Implemented", detail: "Not recorded; a recommendation is not completed work." },
      { label: "Reviewed", detail: "Not recorded; there is no post-change result." },
    ],
  },
];
