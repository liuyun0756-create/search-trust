export type StageId = "prospect" | "service";
export type ArtifactKind =
  "brief" | "comparison" | "plan" | "revision" | "review";

export type PracticeStage = {
  id: StageId;
  number: string;
  label: string;
  description: string;
  groupIds: string[];
};

export type PracticeGroup = {
  id: string;
  stageId: StageId;
  number: string;
  tabLabel: string;
  title: string;
  description: string;
  scenarioIds: string[];
};

export type PracticeScenario = {
  id: string;
  groupId: string;
  shortTitle: string;
  title: string;
  story: string;
  tension: string;
  assistance: string;
  artifact: {
    kind: ArtifactKind;
    label: string;
    title: string;
    items: { label: string; text: string }[];
  };
  nextMove: string;
  boundary: string;
  primaryCta: { label: string; href: string };
  sampleLink: { label: string; href: string };
  methodLink?: string;
};

const prospectStart = { label: "Start a Prospect Case", href: "/cases/new" };
const prospectReports = { label: "Open your Case reports", href: "/reports" };
const clientCase = { label: "Continue a client Case", href: "/cases/service" };
const currentPlan = { label: "Review your current plan", href: "/reports" };
const prospectSample = {
  label: "Read the Prospect report",
  href: "/sample-report#sample-prospect",
};
const prospectEvidence = {
  label: "See the evidence example",
  href: "/sample-report#sample-prospect-evidence",
};
const prospectActions = {
  label: "See the action example",
  href: "/sample-report#sample-prospect-actions",
};
const verifiedSample = {
  label: "Read the Verified plan",
  href: "/sample-report#sample-verified",
};
const verifiedActions = {
  label: "See the plan example",
  href: "/sample-report#sample-verified-actions",
};

export const practiceStages: PracticeStage[] = [
  {
    id: "prospect",
    number: "01",
    label: "Win the work",
    description:
      "Start a useful conversation and agree a first scope before private analytics access.",
    groupIds: ["first-conversations", "scope-engagement"],
  },
  {
    id: "service",
    number: "02",
    label: "Deliver the work",
    description:
      "Revisit the first judgment, make the work executable, and decide what deserves attention next.",
    groupIds: ["move-work", "replan-evidence", "reviews-next"],
  },
];

export const practiceGroups: PracticeGroup[] = [
  {
    id: "first-conversations",
    stageId: "prospect",
    number: "A",
    tabLabel: "First conversations",
    title: "Find a reason to begin the conversation.",
    description:
      "Before you have client access, bring one specific observation and the question it raises—not a pretend full diagnosis.",
    scenarioIds: [
      "first-conversation",
      "competitor-question",
      "beyond-free-audits",
    ],
  },
  {
    id: "scope-engagement",
    stageId: "prospect",
    number: "B",
    tabLabel: "Scope the engagement",
    title: "Turn interest into work you can define.",
    description:
      "Discuss what comes first, what the client must confirm, and what completion will mean before you promise a result.",
    scenarioIds: ["limited-budget", "first-scope", "set-expectations"],
  },
  {
    id: "move-work",
    stageId: "service",
    number: "C",
    tabLabel: "Move work forward",
    title: "Make the recommendation executable.",
    description:
      "Use client confirmation and eligible data to revise the call, define a task, and adapt to real delivery constraints.",
    scenarioIds: [
      "revisit-recommendation",
      "execution-brief",
      "blocked-dependencies",
    ],
  },
  {
    id: "replan-evidence",
    stageId: "service",
    number: "D",
    tabLabel: "Replan with evidence",
    title: "Decide whether new evidence changes the plan.",
    description:
      "Separate a signal worth investigating from a conclusion strong enough to change a client's priorities.",
    scenarioIds: [
      "clicks-declined",
      "traffic-without-enquiries",
      "next-priorities",
    ],
  },
  {
    id: "reviews-next",
    stageId: "service",
    number: "E",
    tabLabel: "Reviews & next steps",
    title: "Explain progress without inventing a result.",
    description:
      "Use the report and your own implementation record to discuss what happened and what is worth doing next.",
    scenarioIds: [
      "quiet-month-review",
      "explain-priority-change",
      "quarterly-next-phase",
    ],
  },
];

export const practiceScenarios: PracticeScenario[] = [
  {
    id: "first-conversation",
    groupId: "first-conversations",
    shortTitle: "Only a website",
    title: "Tomorrow’s first call. All you have is a website.",
    story:
      "An independent SEO is referred to a local dental practice. The first meeting is tomorrow; she has its website but no Search Console, GA4 or booking data. A free, exhaustive audit is neither possible nor the best opening.",
    tension:
      "Saying ‘your SEO needs work’ shows no understanding of the practice. Claiming to know why bookings are low would go beyond the available evidence.",
    assistance:
      "SearchTrust brings checked public pages, available business details and a confirmed relevant competitor into a first finding, with questions still for the practice.",
    artifact: {
      kind: "brief",
      label: "First conversation brief",
      title: "An emergency-appointment question",
      items: [
        {
          label: "Observed",
          text: "The pages checked do not clearly explain emergency hours or the route to book an urgent visit.",
        },
        {
          label: "Why discuss it",
          text: "The service information deserves a closer look; this does not establish lost bookings.",
        },
        {
          label: "Ask the client",
          text: "Is urgent care a current priority, and which page is intended to handle those enquiries?",
        },
        {
          label: "First direction",
          text: "Confirm the target page before proposing clearer service and booking information.",
        },
      ],
    },
    nextMove:
      "Take the observation and questions into the first call. Decide whether to propose a focused first scope after the practice confirms its priorities.",
    boundary:
      "Public evidence only. Private search, analytics and booking data are not available yet.",
    primaryCta: prospectStart,
    sampleLink: prospectSample,
    methodLink: "01",
  },
  {
    id: "competitor-question",
    groupId: "first-conversations",
    shortTitle: "A ranking screenshot",
    title: "“Why does that competitor keep showing up above us?”",
    story:
      "A local plumbing company sends its SEO a search-results screenshot and wants an immediate explanation. The image reflects one query, device and location—not a complete account of local competition.",
    tension:
      "A competitor's separate page or extra reviews cannot, by themselves, explain why that business appeared above the client.",
    assistance:
      "SearchTrust organizes the confirmed service, target area, competitor and available public-page differences so the SEO can test a relevant comparison.",
    artifact: {
      kind: "comparison",
      label: "Competition observation",
      title: "Compare the right businesses first",
      items: [
        {
          label: "Relevance",
          text: "Confirm both businesses serve the same plumbing need and area shown in the search.",
        },
        {
          label: "Observed difference",
          text: "The competitor clearly describes its service and contact route; the client's checked page is less specific.",
        },
        {
          label: "Client-side check",
          text: "Look for another page that may already cover the service before recommending a new one.",
        },
        {
          label: "Interpretation",
          text: "Treat the difference as an investigation lead, not the proven cause of a ranking gap.",
        },
      ],
    },
    nextMove:
      "Explain what was actually compared, ask which services matter commercially, and agree what to inspect next instead of promising to outrank the competitor.",
    boundary:
      "The screenshot's query and location need checking; a public-page contrast is not ranking attribution.",
    primaryCta: prospectStart,
    sampleLink: prospectEvidence,
    methodLink: "01",
  },
  {
    id: "beyond-free-audits",
    groupId: "first-conversations",
    shortTitle: "Three free audits",
    title: "They already have three free audits.",
    story:
      "A landscape-maintenance business has received several long PDFs of errors and scores. Its owner asks a more useful question: what would you address first, and why?",
    tension:
      "Another longer checklist turns the conversation into a comparison of audit counts, not the business's seasonal service.",
    assistance:
      "SearchTrust groups supported observations with proposed actions related to the service the SEO wants to discuss, leaving the final choice to the SEO.",
    artifact: {
      kind: "brief",
      label: "Focused diagnosis",
      title: "Make seasonal maintenance easier to understand",
      items: [
        {
          label: "Observed",
          text: "Coverage, suitable customers and enquiry conditions for seasonal maintenance are scattered across the pages checked.",
        },
        {
          label: "Business question",
          text: "Is this the service the owner wants to promote in the coming season?",
        },
        {
          label: "First action",
          text: "Confirm the existing service page, then clarify its offer and contact route before considering another page.",
        },
        {
          label: "Open condition",
          text: "Business priority and private search data have not yet been confirmed.",
        },
      ],
    },
    nextMove:
      "Use a problem–meaning–first-action brief to show your judgment, then invite the owner to confirm the service and scope.",
    boundary:
      "An illustrative public review, not a measured ranking or sales result.",
    primaryCta: prospectStart,
    sampleLink: prospectActions,
    methodLink: "05",
  },
  {
    id: "limited-budget",
    groupId: "scope-engagement",
    shortTitle: "Limited budget",
    title: "A limited budget. A longer list of possible work.",
    story:
      "A prospective client is ready to talk, but can fund only a small first phase. Content, contact routes and public business details have all been mentioned as possible work.",
    tension:
      "Calling every task ‘high priority’ avoids the difficult choice. An unsupported revenue forecast is not a sound substitute.",
    assistance:
      "SearchTrust gives an evidence-backed starting set of actions and limits. The SEO adjusts their order against the client's goals, dependencies and resources.",
    artifact: {
      kind: "plan",
      label: "First-phase arrangement",
      title: "A scope that fits the available work",
      items: [
        {
          label: "Start",
          text: "Confirm the page and contact information for the service the client most wants to grow.",
        },
        {
          label: "Prioritize",
          text: "Move forward with an evidenced, directly relevant action that is feasible now.",
        },
        {
          label: "Defer",
          text: "Hold work requiring developer time or unconfirmed business facts.",
        },
        {
          label: "Revisit",
          text: "Record what would make a deferred item worth reconsidering.",
        },
      ],
    },
    nextMove:
      "Present a first-phase order the client can understand, then set the fee and contractual scope yourself.",
    boundary:
      "Priority is a reviewed professional decision; SearchTrust does not calculate a business-value or revenue score.",
    primaryCta: prospectReports,
    sampleLink: prospectActions,
    methodLink: "05",
  },
  {
    id: "first-scope",
    groupId: "scope-engagement",
    shortTitle: "Define the scope",
    title: "“Handle our SEO” is not a usable scope.",
    story:
      "A client assumes content, development, public business details and tracking are all in the quote. The SEO expected to work on one core service area. Neither side has named who provides facts or publishes changes.",
    tension:
      "Without boundaries, the work expands and nobody agrees on what ‘done’ means.",
    assistance:
      "The report's action target, steps and completion checks give the SEO a basis for a scope discussion. Supported action fields can be edited in the Case workspace.",
    artifact: {
      kind: "plan",
      label: "Scope confirmation",
      title: "Turn the proposal into a workable agreement",
      items: [
        {
          label: "Target",
          text: "Name the service page and content covered in this phase.",
        },
        {
          label: "Client input",
          text: "Confirm service areas, qualifications, contact details and approved claims.",
        },
        {
          label: "Responsibility",
          text: "Agree who supplies material, implements changes and approves the live result.",
        },
        {
          label: "Done and review",
          text: "Specify completion checks and what evidence will be revisited later.",
        },
      ],
    },
    nextMove:
      "Adapt the proposed actions, then put exclusions, fee and responsibilities in your own engagement agreement.",
    boundary:
      "This is a scope discussion aid, not an automatically generated contract or unlimited task manager.",
    primaryCta: prospectReports,
    sampleLink: prospectActions,
    methodLink: "05",
  },
  {
    id: "set-expectations",
    groupId: "scope-engagement",
    shortTitle: "No ranking guarantee",
    title: "“How soon will this work—and can you guarantee it?”",
    story:
      "Near agreement, a prospect asks for a date when rankings will improve. The SEO needs to make the investment concrete without presenting a search outcome as a scheduled deliverable.",
    tension:
      "A completion date for work and a performance result are different commitments.",
    assistance:
      "SearchTrust pairs specific proposed work and completion checks with review conditions, giving the SEO a more defensible way to explain the phase.",
    artifact: {
      kind: "brief",
      label: "Stage goal and review",
      title: "Promise the work you can control",
      items: [
        {
          label: "Commit",
          text: "Define the page, approved changes and how their implementation will be checked.",
        },
        {
          label: "Observe",
          text: "Review relevant search activity and contact events only after their meaning is confirmed.",
        },
        {
          label: "Compare",
          text: "Use suitable periods, checked collection and enough context to interpret movement.",
        },
        {
          label: "If unclear",
          text: "Leave the conclusion open and agree a review date with the client.",
        },
      ],
    },
    nextMove:
      "Explain what the first phase will deliver, what you will inspect later, and why no ranking date can be guaranteed.",
    boundary:
      "The SEO agrees timing with the client; SearchTrust does not guarantee rank, leads or revenue.",
    primaryCta: prospectStart,
    sampleLink: prospectActions,
    methodLink: "06",
  },
  {
    id: "revisit-recommendation",
    groupId: "move-work",
    shortTitle: "Revise the first call",
    title: "Client access changes the first recommendation.",
    story:
      "Before access, an SEO questioned whether an air-conditioning repair service needed its own page. The client now confirms an existing page, and eligible search data shows relevant activity there.",
    tension:
      "Creating the page proposed in an early discussion could duplicate one that already serves the need.",
    assistance:
      "SearchTrust brings client confirmation and supported search evidence beside the original question so the SEO can review a revised action plan.",
    artifact: {
      kind: "revision",
      label: "Decision revision",
      title: "Improve the existing service page first",
      items: [
        {
          label: "Before access",
          text: "A dedicated repair page might be missing; confirm the intended target.",
        },
        {
          label: "New information",
          text: "The page exists and receives impressions and clicks for relevant searches.",
        },
        {
          label: "Current call",
          text: "Clarify the confirmed page's service details and contact path before creating a duplicate.",
        },
        {
          label: "Still check",
          text: "Verify event meaning, collection and the client's business priorities.",
        },
      ],
    },
    nextMove:
      "Tell the client why the recommendation changed, then review and approve the actionable plan before a new delivery.",
    boundary:
      "Relevant search activity does not prove why enquiries change. Service work requires a completed Prospect Case and eligible access.",
    primaryCta: clientCase,
    sampleLink: verifiedSample,
    methodLink: "02",
  },
  {
    id: "execution-brief",
    groupId: "move-work",
    shortTitle: "Write the brief",
    title: "A recommendation still needs an execution brief.",
    story:
      "The SEO decides that a cleaning company's commercial-service page needs clearer information. A writer or developer still needs to know exactly which page, what the client must provide and what counts as complete.",
    tension:
      "‘Optimize the service page’ is not an instruction another person can reliably implement.",
    assistance:
      "The Verified Action Plan provides an action target, steps and completion checks that the SEO can review and adapt into an execution brief.",
    artifact: {
      kind: "plan",
      label: "Execution brief",
      title: "Commercial-cleaning service page",
      items: [
        {
          label: "Target",
          text: "The client-confirmed commercial-cleaning service page.",
        },
        {
          label: "Work",
          text: "Add approved service scope, applicable situations and a clear contact route.",
        },
        {
          label: "Client input",
          text: "Confirm service facts, area, restrictions and approval of claims.",
        },
        {
          label: "Done means",
          text: "The approved details are live and consistent, and the contact path works.",
        },
      ],
    },
    nextMove:
      "Assign the work, obtain approval where needed and check the live result yourself.",
    boundary:
      "The report is a task foundation, not an auto-saved full copy draft, publication tool or implementation record.",
    primaryCta: currentPlan,
    sampleLink: verifiedActions,
    methodLink: "05",
  },
  {
    id: "blocked-dependencies",
    groupId: "move-work",
    shortTitle: "Dependencies block work",
    title: "The developer is booked. The client inputs are late.",
    story:
      "The first recommended action needs a template change and approved service details. Development has no capacity this month, yet the SEO still needs a sensible next move.",
    tension:
      "An analytically plausible order is not necessarily executable under today's client constraints.",
    assistance:
      "The SEO can edit the plan's action order, scope, steps, owner and timing while the original observations remain unchanged.",
    artifact: {
      kind: "plan",
      label: "Adjusted work arrangement",
      title: "Move what can be done now",
      items: [
        {
          label: "Bring forward",
          text: "A supported action that does not depend on the template change.",
        },
        {
          label: "Keep visible",
          text: "The blocked page action and the client facts still needed.",
        },
        {
          label: "Owner",
          text: "Name who will provide inputs and who will implement the deferred work.",
        },
        {
          label: "Resume when",
          text: "Developer capacity and approved service information are available.",
        },
      ],
    },
    nextMove:
      "Save and approve a revised plan that reflects actual capacity, then explain what moved and why.",
    boundary:
      "Changed scope still needs checking; this is not automatic chasing, scheduling or dependency management.",
    primaryCta: currentPlan,
    sampleLink: verifiedActions,
    methodLink: "05",
  },
  {
    id: "clicks-declined",
    groupId: "replan-evidence",
    shortTitle: "Clicks fell",
    title: "Clicks fell on a key page. Should the plan change?",
    story:
      "At a planned review, the SEO sees fewer clicks on a priority page in the selected comparison window. The client wants to replace the current plan immediately, but the reason for the change is unknown.",
    tension:
      "Editing the page straight away could mistake demand, scope, tracking or a concurrent change for a content issue.",
    assistance:
      "SearchTrust organizes supported page-level evidence and report limits for a review; the SEO checks comparability and plausible explanations.",
    artifact: {
      kind: "revision",
      label: "Change review",
      title: "Investigate before reprioritizing",
      items: [
        {
          label: "Observed",
          text: "Clicks declined for the selected page and comparison period.",
        },
        {
          label: "Check",
          text: "Compare windows, query/page scope, source health and other changes around that time.",
        },
        {
          label: "Decision now",
          text: "Keep the current plan while checking whether this page should move forward.",
        },
        {
          label: "If unresolved",
          text: "Record the uncertainty instead of assigning a cause to the decline.",
        },
      ],
    },
    nextMove:
      "Decide whether to investigate further or change the action order after the checks, not from a single downward line.",
    boundary:
      "This is a user-initiated review, not live monitoring, an automatic alert or causal attribution.",
    primaryCta: clientCase,
    sampleLink: verifiedSample,
    methodLink: "04",
  },
  {
    id: "traffic-without-enquiries",
    groupId: "replan-evidence",
    shortTitle: "Visits, few enquiries",
    title: "More visits. The client still reports few enquiries.",
    story:
      "A home-service client sees more website visits but says good enquiries have not followed. The SEO needs a useful investigation, not just another traffic chart.",
    tension:
      "Visits, contact events, qualified enquiries and revenue measure different things and cannot be treated as one result.",
    assistance:
      "SearchTrust brings eligible GSC, GA4 and page evidence into a reviewable plan. The client's account of qualified enquiries must be confirmed separately.",
    artifact: {
      kind: "comparison",
      label: "Investigation priorities",
      title: "Separate search activity from lead quality",
      items: [
        {
          label: "Search",
          text: "Do the queries and landing pages relate to the intended service?",
        },
        {
          label: "Page",
          text: "Are the service promise and contact steps clear on the relevant page?",
        },
        {
          label: "Measurement",
          text: "Do the selected contact events fire correctly and mean what the team thinks they mean?",
        },
        {
          label: "Business",
          text: "Ask the client to check which contacts were genuinely relevant.",
        },
      ],
    },
    nextMove:
      "Choose the next check with the client before deciding whether the work belongs on the page, in measurement or elsewhere.",
    boundary:
      "SearchTrust does not read a CRM or classify qualified leads; no single metric proves the cause of fewer enquiries.",
    primaryCta: clientCase,
    sampleLink: verifiedSample,
    methodLink: "04",
  },
  {
    id: "next-priorities",
    groupId: "replan-evidence",
    shortTitle: "Next round of work",
    title: "The first round is done. What deserves the next round?",
    story:
      "A client continues on a monthly basis after the SEO completes the agreed first phase. Simply moving unfinished items to a new list—or manufacturing a fresh issue—would miss the point of the review.",
    tension:
      "The next phase should respond to current evidence, confirmed implementation and the client's goals.",
    assistance:
      "A current supported analysis and action plan provide a starting point. The SEO compares it with their own implementation record and client priorities.",
    artifact: {
      kind: "plan",
      label: "Next-phase recommendation",
      title: "Continue, change, pause—or keep watching",
      items: [
        {
          label: "Continue",
          text: "A still-supported priority that remains unfinished.",
        },
        {
          label: "Pause",
          text: "Work whose dependency is unmet or relevance has declined.",
        },
        {
          label: "Change",
          text: "A direction supported by genuinely new evidence or client confirmation.",
        },
        {
          label: "Observe",
          text: "Keep monitoring when the evidence does not justify a new task.",
        },
      ],
    },
    nextMove:
      "Explain the next order of work with reasons, including a decision to defer rather than invent new work.",
    boundary:
      "A generated plan is not evidence that work was implemented; implementation dates and effects are not automatically linked.",
    primaryCta: clientCase,
    sampleLink: verifiedActions,
    methodLink: "05",
  },
  {
    id: "quiet-month-review",
    groupId: "reviews-next",
    shortTitle: "A quiet month",
    title: "Work is complete. A clear lift has not appeared yet.",
    story:
      "The SEO has completed an approved page update, but available data does not yet support a clear performance improvement. A monthly client conversation still needs to explain the work and what will be checked next.",
    tension:
      "Counting tasks alone says little about value; turning a small fluctuation into a success claim damages trust.",
    assistance:
      "The report supplies evidence, actions and review conditions. The SEO adds and confirms their separate implementation record before preparing the update.",
    artifact: {
      kind: "review",
      label: "Client update outline",
      title: "Distinguish delivery from outcome",
      items: [
        {
          label: "Completed",
          text: "The approved page changes, verified against the SEO's own work record.",
        },
        {
          label: "Observed",
          text: "The search and on-site evidence currently available in a suitable scope.",
        },
        {
          label: "Not established",
          text: "A stable increase in relevant enquiries or a causal effect from the update.",
        },
        {
          label: "Next",
          text: "Check data quality, continue observation or revise the next task if warranted.",
        },
      ],
    },
    nextMove:
      "Use the outline to give a candid update and agree when a stronger review will be possible.",
    boundary:
      "This is not an auto-generated monthly report with implementation history; full report narratives are not all persistently editable.",
    primaryCta: currentPlan,
    sampleLink: verifiedSample,
    methodLink: "06",
  },
  {
    id: "explain-priority-change",
    groupId: "reviews-next",
    shortTitle: "Explain a changed plan",
    title: "“Why is this month’s plan different?”",
    story:
      "New evidence and client confirmation lead the SEO to change the action order. The client worries the service direction is inconsistent and asks what changed.",
    tension:
      "A replacement plan alone hides the reason for the change and can make the earlier recommendation seem arbitrary.",
    assistance:
      "The available report evidence and current actions give the SEO a basis to explain the change, while the SEO checks the old and new scopes.",
    artifact: {
      kind: "revision",
      label: "Priority-change explanation",
      title: "Show what changed—and what did not",
      items: [
        {
          label: "Earlier",
          text: "The previous action and the evidence available when it was proposed.",
        },
        {
          label: "New",
          text: "The confirmed fact or supported observation that changes the call.",
        },
        {
          label: "Now",
          text: "Which action moves forward, moves back or needs a revised scope.",
        },
        {
          label: "Still open",
          text: "The unchanged business goal and conditions not yet verified.",
        },
      ],
    },
    nextMove:
      "Walk the client through the reason for the shift, then save and approve the edited action plan if the work changes.",
    boundary:
      "This is not an automatic causal change log. If evidence has not changed, do not label an item a new finding.",
    primaryCta: currentPlan,
    sampleLink: verifiedActions,
    methodLink: "05",
  },
  {
    id: "quarterly-next-phase",
    groupId: "reviews-next",
    shortTitle: "Quarterly decision",
    title: "At the quarterly review: what is worth continuing?",
    story:
      "A long-standing client must choose whether to continue, narrow or pause some SEO work next quarter. The SEO needs to make that decision from work and evidence, not from a default renewal pitch.",
    tension:
      "A historical growth chart alone cannot explain why a particular next phase is worth funding.",
    assistance:
      "The current report and action plan provide evidence and recommendations; the SEO combines them with confirmed work, resources and business goals.",
    artifact: {
      kind: "review",
      label: "Quarterly discussion outline",
      title: "Decide the next phase on its merits",
      items: [
        {
          label: "Review",
          text: "Work confirmed complete and the observations available afterward.",
        },
        {
          label: "Opportunity",
          text: "A next action still supported by evidence and the client's current objective.",
        },
        {
          label: "Choice",
          text: "Continue, reduce or pause a workstream, with a reason for each.",
        },
        {
          label: "Agreement",
          text: "Set the next scope and the conditions for checking it again.",
        },
      ],
    },
    nextMove:
      "Recommend an honest next phase—including a smaller one or a pause—and agree its scope with the client.",
    boundary:
      "Quarterly review is a use of existing report materials, not a third automatic report product or a guaranteed renewal outcome.",
    primaryCta: currentPlan,
    sampleLink: verifiedActions,
    methodLink: "06",
  },
];

export const legacyScenarioHashes: Record<string, string> = {
  "scene-01": "first-conversation",
  "scene-02": "revisit-recommendation",
  "scene-03": "revisit-recommendation",
  "scene-04": "revisit-recommendation",
  "scene-05": "next-priorities",
  "scene-06": "next-priorities",
};
