export type EvidenceVisualKind =
  | "public-evidence"
  | "page-decision"
  | "identity-conflict"
  | "search-path"
  | "priority-stack"
  | "review-timeline";

export type UseCaseScene = {
  number: string;
  group: string;
  shortTitle: string;
  trigger: string;
  title: string;
  moment: string;
  problem: string;
  realIssue: string;
  analysis: string[];
  handling: string;
  decision: string;
  outcomes: Array<{ label: string; text: string }>;
  seoKeeps: string;
  transition?: string;
  visual: EvidenceVisualKind;
  link?: { label: string; href: string };
};

export const useCaseScenes: UseCaseScene[] = [
  {
    number: "01",
    group: "Win the work",
    shortTitle: "Before the first call",
    trigger: "Before analytics access",
    title: "Build the first client conversation on evidence.",
    moment:
      "A prospect wants a useful answer before sharing Search Console or GA4 access.",
    problem:
      "You need to say something specific about this business while private performance data is still unavailable.",
    realIssue:
      "The client needs a credible reason to continue the conversation. A generic audit score cannot define a responsible first scope.",
    analysis: [
      "Check which services and locations are genuinely in scope.",
      "Separate visible business facts from questions only the client can answer.",
      "Confirm at least one real competitor in the same service and search context.",
    ],
    handling:
      "SearchTrust connects the site, public business identity, search context and a confirmed competitor. It keeps observed facts, interpretation and client questions visibly separate.",
    decision:
      "Open with this business’s specific problem—not a generic audit checklist.",
    outcomes: [
      { label: "Finding", text: "A concrete issue worth discussing now." },
      { label: "Evidence", text: "Public observations the SEO can trace." },
      {
        label: "Next move",
        text: "Three first-phase actions and client questions.",
      },
    ],
    seoKeeps:
      "You decide whether the prospect is a fit, how to define the scope and what belongs in the proposal.",
    transition:
      "Once the client wants to continue, the next question is often whether the right page already exists.",
    visual: "public-evidence",
    link: {
      label: "See the prospect diagnosis method",
      href: "/framework#prospect-diagnosis",
    },
  },
  {
    number: "02",
    group: "Clarify the work",
    shortTitle: "New page or improve one?",
    trigger: "When a competitor has a dedicated page",
    title: "Choose the right page move before creating more content.",
    moment:
      "A competitor explains a service on its own page while the client’s information appears inside a broader page.",
    problem:
      "It is tempting to call this a page gap and immediately recommend a new page.",
    realIssue:
      "A competitor’s structure is market evidence, not proof of the ranking cause or the correct action for this client.",
    analysis: [
      "Confirm whether an existing matching page was missed during the public review.",
      "Check whether an existing page already receives relevant queries and clicks.",
      "Confirm the service is commercially important and can be explained accurately.",
    ],
    handling:
      "SearchTrust keeps the initial observation visible, then combines client confirmation and eligible performance evidence to compare three responsible paths.",
    decision:
      "Improve the existing core service page before adding a possible duplicate.",
    outcomes: [
      { label: "Object", text: "The exact existing page to work on." },
      {
        label: "Action",
        text: "The service and contact information to clarify.",
      },
      {
        label: "Verification",
        text: "Completion checks and a later review method.",
      },
    ],
    seoKeeps:
      "You weigh the business priority, release timing and available resources before placing the action in the first three.",
    transition:
      "Page decisions become unreliable when the business identity behind them is inconsistent.",
    visual: "page-decision",
    link: {
      label: "Read the continuous report example",
      href: "/sample-report",
    },
  },
  {
    number: "03",
    group: "Clarify the work",
    shortTitle: "Conflicting business details",
    trigger: "When public information disagrees",
    title: "Turn a vague consistency concern into a correction plan.",
    moment:
      "The website and public business information use different names, phone numbers, locations or service-area language.",
    problem:
      "The team can see that something does not match, but not every difference means the same thing.",
    realIssue:
      "A source may be outdated, incomplete or describing a different operating context. The correct business information still has to come from the client.",
    analysis: [
      "Compare the same field rather than assigning one overall consistency score.",
      "Record the source and observation time for every conflicting value.",
      "Treat one-sided and two-sided missing required information as work to resolve.",
    ],
    handling:
      "SearchTrust classifies each field as matching, partially matching, conflicting or missing, then separates client confirmation from execution tasks.",
    decision:
      "Confirm the business truth first, then correct the exact sources that need it.",
    outcomes: [
      {
        label: "Conflict record",
        text: "The fields, sources and observed values.",
      },
      {
        label: "Client input",
        text: "A short list of facts that require confirmation.",
      },
      {
        label: "Correction work",
        text: "Specific sources to update and recheck.",
      },
    ],
    seoKeeps:
      "You confirm the real business information and decide which correction has the greatest immediate value.",
    transition:
      "Once the right page and business identity are clear, client data can show how search demand reaches the site.",
    visual: "identity-conflict",
  },
  {
    number: "04",
    group: "Measure before assuming",
    shortTitle: "Search without enough action",
    trigger: "After Search Console and GA4 connect",
    title: "Follow the same search need from discovery to the next action.",
    moment:
      "A page earns search impressions and clicks, but the client still does not see enough contact or business action.",
    problem:
      "A visible gap between search activity and enquiries can produce several plausible explanations.",
    realIssue:
      "A page issue, an unclear contact path and unreliable event measurement can look similar from one headline metric.",
    analysis: [
      "Tie relevant queries to the page that actually receives the search visit.",
      "Review the page experience and configured events in the same analysis scope.",
      "Check source health, time range and sample conditions before interpreting behaviour.",
    ],
    handling:
      "SearchTrust follows one evidence path across Search Console, the landing page and eligible GA4 behaviour, then marks support, conflict, uncertainty or a measurement dependency.",
    decision:
      "Narrow the next investigation before claiming why enquiries are low.",
    outcomes: [
      {
        label: "Supported",
        text: "Evidence that strengthens or challenges the initial view.",
      },
      {
        label: "Blocked",
        text: "A clear measurement issue when data is unreliable.",
      },
      {
        label: "Next question",
        text: "A smaller decision tied to the same page and event.",
      },
    ],
    seoKeeps:
      "Data narrows the decision; it does not automatically prove that one page factor caused the business outcome.",
    transition:
      "When several evidence-backed issues remain, the team still needs to decide which work comes first.",
    visual: "search-path",
  },
  {
    number: "05",
    group: "Turn findings into work",
    shortTitle: "Too many possible actions",
    trigger: "When resources cannot cover everything",
    title: "Turn a long issue list into work you can deliver.",
    moment:
      "The analysis has produced more findings than you can responsibly take on for this client now.",
    problem:
      "Everything cannot be urgent, but removing context from the list makes prioritisation arbitrary.",
    realIssue:
      "Priority depends on expected result impact, business value, severity, evidence and dependencies—not issue count alone.",
    analysis: [
      "Name the part of visibility, clicks, on-site action or measurement each action may improve.",
      "Compare the affected service and page with the client’s current business priorities.",
      "Keep evidence strength and prerequisites visible beside the recommendation.",
    ],
    handling:
      "SearchTrust proposes a ranked starting point with an object, reason, execution requirement and review method for every action.",
    decision: "Start with three actions you can explain, execute and review.",
    outcomes: [
      {
        label: "Order",
        text: "Three recommended actions with visible reasons.",
      },
      {
        label: "Execution",
        text: "Scope, requirements and acceptance criteria.",
      },
      {
        label: "Review",
        text: "Indicators, timing and unresolved dependencies.",
      },
    ],
    seoKeeps:
      "You can change the order or scope to match the client’s goal, release plan and your capacity.",
    transition:
      "A useful plan is only the beginning; delivery must keep planned, implemented and reviewed work separate.",
    visual: "priority-stack",
    link: {
      label: "See how priorities become a plan",
      href: "/framework#prioritization-title",
    },
  },
  {
    number: "06",
    group: "Run and review",
    shortTitle: "Explain what changed",
    trigger: "When the client asks what happened next",
    title: "Explain the work, the evidence and the next decision separately.",
    moment:
      "The client asks which work is complete, what changed afterwards and whether the original direction should continue.",
    problem:
      "A report can easily blur the difference between a recommendation, an implementation and a reviewed result.",
    realIssue:
      "A change after implementation is relevant evidence, but it is not automatic proof that one action caused the outcome.",
    analysis: [
      "Keep the original recommendation and planned scope available for comparison.",
      "Record what was actually implemented and when it became observable.",
      "Review the same object while noting concurrent changes and evidence limits.",
    ],
    handling:
      "SearchTrust preserves the reviewed plan and its evidence limits. The SEO records implementation and compares later evidence before explaining what changed.",
    decision:
      "Keep, adjust or pause the direction with the evidence and its limits visible.",
    outcomes: [
      {
        label: "Status",
        text: "Planned, implemented and reviewed states stay distinct.",
      },
      {
        label: "Change",
        text: "Important evidence is tied to the same action and object.",
      },
      {
        label: "Next decision",
        text: "A grounded recommendation for the following phase.",
      },
    ],
    seoKeeps:
      "You review the language before delivery and decide how the client should act on the conclusion.",
    visual: "review-timeline",
    link: { label: "See the report delivery view", href: "/sample-report" },
  },
];
