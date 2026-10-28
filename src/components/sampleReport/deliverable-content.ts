import type { DeliveryPlanAction } from "@/lib/report-delivery/plan";
import {
  sampleCase,
  sampleReports,
  type ReportStage,
} from "./sample-report-data";

export { sampleCase };
export type { ReportStage };
export const chapters = [
  ["summary", "Summary"],
  ["evidence", "Evidence & open questions"],
  ["actions", "Proposed actions"],
  ["inputs", "Client input"],
  ["review", "Review & limits"],
] as const;
export type Chapter = (typeof chapters)[number][0];
export type Evidence = {
  source: string;
  finding: string;
  supports: string;
  scope: string;
  pending: string;
};
export type Deliverable = {
  stage: ReportStage;
  name: string;
  moment: string;
  purpose: string;
  scope: string;
  headline: string;
  summary: string[];
  decision: string;
  caution: string;
  evidence: Evidence[];
  actions: DeliveryPlanAction[];
  inputs: string[];
  review: { title: string; detail: string }[];
  limits: string[];
};

const plan = (
  actionId: string,
  title: string,
  target: string,
  steps: string,
  completion: string,
  owner: string,
  schedule: string,
  review: string,
): DeliveryPlanAction => ({
  actionId,
  title,
  target,
  steps,
  completion,
  owner,
  schedule,
  review,
});

export const deliverables: Record<ReportStage, Deliverable> = {
  prospect: {
    stage: "prospect",
    name: sampleReports[0].name,
    moment: "Before client analytics access",
    purpose: "A first scope to discuss with a potential client.",
    scope:
      "Public website pages, available business information and one confirmed competitor. Private search, analytics, lead and revenue data are not available.",
    headline: "Confirm the right service page before proposing a new one.",
    summary: [
      "Within the pages checked, the repair service is explained across broader content. Service coverage, the repair process and the next contact step are not clear enough to define a confident first scope.",
      "A relevant competitor explains the same service on a dedicated page. That raises a useful question about page coverage, but it does not establish that another page is missing or that copying the competitor would improve rankings.",
    ],
    decision:
      "Confirm the page currently used for this service. If a suitable page already exists, define improvements there before considering another URL.",
    caution:
      "Not found in the checked pages does not mean the page does not exist.",
    evidence: [
      {
        source: "Public website pages",
        finding:
          "The repair service is described across broader pages, without a clearly established service-page target in the material checked.",
        supports:
          "Confirm the intended page and review whether it explains the service clearly.",
        scope:
          "The inspected public pages; not an exhaustive URL inventory or technical crawl.",
        pending:
          "Whether another service page exists, which URL the business uses and whether a replacement is planned.",
      },
      {
        source: "Service information & contact path",
        finding:
          "The checked content does not clearly set out supported repairs, coverage, the process and the next contact step.",
        supports:
          "Review the information a potential customer needs before making contact.",
        scope:
          "The visible service explanation and contact route on the inspected pages.",
        pending:
          "Accurate service details, intended contact methods and any recent business changes. Enquiry loss is not established.",
      },
      {
        source: "Confirmed competitor",
        finding:
          "A competitor offering the same service in a comparable local context uses a dedicated service page.",
        supports:
          "Compare how the service is explained, without automatically copying the page structure.",
        scope: "A comparable service and location context.",
        pending:
          "The client’s own coverage and existing pages. The competitor’s page does not establish a ranking cause.",
      },
    ],
    actions: [
      plan(
        "prospect-1",
        "Confirm the page and business priority.",
        "Existing pages relevant to the core repair service.",
        "Review the available page inventory with the client. Confirm the intended URL, service area and business priority. Record any planned page replacement.",
        "The intended page and business priority are recorded, or the unresolved coverage question is explicitly retained.",
        "SEO, with client confirmation",
        "Before agreeing to create or rewrite a service page",
        "Use the confirmed target in subsequent page and analytics checks.",
      ),
      plan(
        "prospect-2",
        "Define the service and contact improvements.",
        "The service page confirmed with the client.",
        "Identify missing service coverage, repair-process information and contact instructions. Prepare a proposed change list using business-approved details.",
        "An agreed change list with accurate content requirements and a clear intended contact step.",
        "SEO; business details approved by the client",
        "After the page target and business facts are confirmed",
        "Check that eventual page changes match the agreed scope.",
      ),
      plan(
        "prospect-3",
        "Agree what to verify after access.",
        "The confirmed page, relevant queries and associated on-site measurement.",
        "Request appropriate access. Check available Search Console and GA4 coverage. Record questions about demand, landing behavior and key-event collection.",
        "Available sources, missing access and unresolved measurement questions are documented.",
        "SEO, supported by the account owner",
        "When the client is ready to provide access",
        "Revisit the proposal in the same Case using eligible evidence.",
      ),
    ],
    inputs: [
      "Which page currently represents the repair service?",
      "Which services and locations are accurate and commercially important?",
      "What service details and supporting materials can we use?",
      "Are any page replacements, redesigns or tracking changes planned?",
      "Can appropriate analytics access be provided for the next review?",
    ],
    review: [
      {
        title: "Next review",
        detail:
          "After the page and business details are confirmed, revisit the recommendation using eligible client data. Keep the same question attached to the same Case so the reason for any change remains clear.",
      },
    ],
    limits: [
      "Public observations do not establish traffic, qualified enquiries or revenue.",
      "A competitor’s page is context, not proof of a ranking cause.",
      "These actions are proposed. No implementation or improved result is recorded.",
    ],
  },
  verified: {
    stage: "verified",
    name: sampleReports[1].name,
    moment: "After client confirmation and eligible data access",
    purpose: "A supported plan to adapt, execute and review.",
    scope:
      "Client confirmation, eligible Search Console page and query evidence, renewed page inspection and a GA4 measurement review.",
    headline: "Improve the existing service page first.",
    summary: [
      "The client confirms an existing page for the repair service. Search Console shows relevant impressions and clicks for that page. The renewed inspection still finds unclear service coverage, process and contact steps.",
      "Improve the confirmed page rather than open a duplicate-page task. Review this candidate against the client’s other priorities before fixing the final action order.",
    ],
    decision:
      "Clarify the approved service information and contact path on the existing page. Establish suitable measurement before interpreting the outcome.",
    caution:
      "Search exposure and clicks support investigating the page. They do not prove that its content caused fewer enquiries.",
    evidence: [
      {
        source: "Client confirmation",
        finding:
          "An existing page represents the service, and the service is a current business priority.",
        supports:
          "Retain the existing page as the work target instead of assuming a new page is required.",
        scope: "The client-confirmed service and intended page.",
        pending:
          "Accurate service details, page ownership and any planned replacement or redesign.",
      },
      {
        source: "Search Console",
        finding:
          "The confirmed page receives impressions and clicks for relevant service queries.",
        supports:
          "A search-demand basis for inspecting and improving that page.",
        scope: "The corresponding page and relevant query scope.",
        pending:
          "Appropriate comparison periods, source coverage and other changes affecting interpretation. This report does not establish an enquiry cause.",
      },
      {
        source: "Renewed page inspection",
        finding:
          "Service coverage, the repair process and the next contact step remain unclear.",
        supports:
          "A defined content and contact-path improvement for the confirmed page.",
        scope: "The existing repair-service page.",
        pending:
          "Client-approved facts and whether the contact route matches the actual business process.",
      },
      {
        source: "GA4 measurement review",
        finding:
          "Landing behavior and relevant key events require a measurement check before enquiry conclusions can be drawn.",
        supports:
          "Verify event meaning and collection before using those events to assess the work.",
        scope: "Applicable landing-page and key-event evidence.",
        pending:
          "Event definitions, collection reliability, traffic scope and whether an event represents a meaningful enquiry.",
      },
    ],
    actions: [
      plan(
        "verified-1",
        "Clarify the existing repair-service page.",
        "The existing repair-service page confirmed by the client.",
        "Add approved service coverage, supported repairs and process information. Review claims and supporting material with the client before publication.",
        "The agreed information is live on the confirmed page and has been checked against the approved content.",
        "SEO scopes the work; client approves facts; publishing owner implements",
        "After business information is approved; record the actual publication date",
        "Recheck the published page. Later compare the same page and relevant query scope over suitable periods.",
      ),
      plan(
        "verified-2",
        "Make the contact route clear and usable.",
        "Contact links, calls to action and relevant forms on the confirmed page.",
        "Clarify the contact instruction. Check destinations and business details. Test the intended route on desktop and mobile.",
        "Each agreed contact route works and reaches the intended destination on the tested devices.",
        "SEO or implementation owner, with client confirmation",
        "Coordinate with the page update; verify before sign-off",
        "Record the tested route and unresolved issues. A working route alone does not establish increased enquiries.",
      ),
      plan(
        "verified-3",
        "Set up a defensible follow-up review.",
        "The confirmed page’s relevant Search Console scope and applicable GA4 evidence.",
        "Verify event definitions and collection. Record the available baseline, implementation date, comparison scope and concurrent changes. Agree when the evidence will be suitable for review.",
        "Measurement checks and the review arrangement are documented; unresolved data issues remain visible.",
        "SEO, with the analytics or implementation owner",
        "Check measurement and capture an available baseline before publication where possible",
        "Compare suitable periods. Retain, revise or investigate the recommendation. Do not attribute change to a page edit without sufficient evidence.",
      ),
    ],
    inputs: [
      "Confirm the approved service details and supporting material.",
      "Approve the page content and intended contact route.",
      "Identify who will publish and check the changes.",
      "Explain what relevant enquiry events represent.",
      "Flag concurrent website, tracking or business changes.",
    ],
    review: [
      {
        title: "Implementation",
        detail:
          "Confirm what went live, on which page and when. A generated recommendation is not completed work.",
      },
      {
        title: "Evidence",
        detail:
          "Compare the same page and relevant query or landing scope over suitable periods. Check source health and measurement changes first.",
      },
      {
        title: "Next decision",
        detail:
          "Retain, revise or investigate the action. Record competing explanations where the cause remains uncertain.",
      },
    ],
    limits: [
      "This is a proposed plan, not a record of completed work.",
      "No ranking, traffic, enquiry or revenue improvement is claimed.",
      "A key event is not automatically a qualified enquiry. No single source establishes why business results changed.",
    ],
  },
};

export const stageChanges = [
  ["Confirmed", "An existing service page and a current business priority."],
  ["Added evidence", "Relevant query impressions and clicks for that page."],
  ["Revised work", "Improve the existing page before considering another URL."],
  ["Still open", "Event collection and what the events say about enquiries."],
];

export const workflows = {
  prospect: {
    title: "Win the work",
    intro:
      "Give the prospect a specific problem, a first scope and a reason to continue the conversation.",
    short: [
      "Confirm the business",
      "Review the proposal",
      "Prepare client delivery",
    ],
    steps: [
      [
        "Confirm the business",
        "Enter the website and check the business, service and location details.",
      ],
      [
        "Build the evidence base",
        "Confirm relevant competitors and run the Prospect analysis using available public evidence.",
      ],
      [
        "Check the recommendation",
        "Inspect findings, sources, proposed actions and questions that need client confirmation.",
      ],
      [
        "Adapt the actions",
        "Adjust action order, target, steps and completion checks to fit the work you would offer.",
      ],
      [
        "Review the client version",
        "Save and approve an edited plan, then check what the client will receive.",
      ],
      [
        "Take it into the conversation",
        "Download a client PDF or create a client link. Send it through your usual communication channel.",
      ],
    ],
  },
  verified: {
    title: "Deliver the work",
    intro:
      "Revisit the first recommendation with client data and turn it into work you can execute and review.",
    short: ["Continue the Case", "Add client evidence", "Review the next plan"],
    steps: [
      [
        "Open the existing Case",
        "Choose the client’s completed Prospect Case. Its findings and open questions remain attached.",
      ],
      [
        "Connect the client’s data",
        "Connect the appropriate Search Console and GA4 resources using authorized access.",
      ],
      [
        "Check the available scope",
        "Review source availability, coverage and unresolved measurement conditions.",
      ],
      [
        "Generate the Verified Action Plan",
        "Revisit the earlier recommendations using eligible client evidence.",
      ],
      [
        "Review and adapt the work",
        "Keep, revise or defer recommendations. Save and approve the edited plan for delivery.",
      ],
      [
        "Deliver the next scope",
        "Share the client report, agree responsibilities and review arrangements, and use the plan to guide the work.",
      ],
    ],
  },
};

export const sampleFAQs = [
  {
    question: "Are these real client reports?",
    answer:
      "They use a fictional business and illustrative evidence to show the report structure and decision process. Actual reports depend on the confirmed business, available sources and supported data scope. No real client results are represented here.",
  },
  {
    question: "Why are there two reports for one business?",
    answer:
      "The Prospect report supports a first discussion before private analytics access. The Verified plan revisits those questions using client confirmation and eligible connected evidence in the same Case.",
  },
  {
    question: "Can I start directly with an existing service client?",
    answer:
      "Service analysis currently requires a Case with a completed Prospect report. Direct service-only setup is not available yet. Selecting a Case does not use a credit.",
  },
  {
    question: "What can I edit?",
    answer:
      "The supported action plan: order, titles, target scope, steps, completion standards, owners, timing and review arrangements. Original observations do not change, and a new target is not automatically supported by the original evidence.",
  },
  {
    question: "Can I add my own branding?",
    answer:
      "PDF exports support your logo, business name, client name and a footer note. These settings apply to that download, are not saved and do not brand the online share link. SearchTrust identification remains. A separate client logo and full white-label removal are not currently supported.",
  },
  {
    question: "Does this page change a real report or PDF?",
    answer:
      "No. The delivery showcase illustrates plan adaptation, client review and PDF identity. It does not edit, approve, export or send a real report. Those actions happen in your client Case workspace.",
  },
  {
    question: "What if the evidence is incomplete?",
    answer:
      "Missing evidence and unresolved conditions remain visible. A recommendation may require confirmation, a narrower scope or further investigation before implementation. Access alone does not establish causation.",
  },
  {
    question: "When is a credit used?",
    answer:
      "Entering a website and confirming the business is free. Starting competitor discovery and the full Prospect analysis uses one credit. Generating or regenerating a Verified Action Plan also uses one credit. Technical generation failures return the credit.",
  },
  {
    question: "Is this a replacement for a full technical audit?",
    answer:
      "No. SearchTrust supports evidence-based decisions and action planning for local SEO. It does not replace a full technical audit or your professional review of the client’s situation.",
  },
];
