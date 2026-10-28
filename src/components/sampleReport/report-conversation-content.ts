import { deliverables } from "./deliverable-content";

export const reportConversations = [
  {
    id: "reasoning",
    stage: "A recommendation discussion",
    title: "Why this work?",
    question: "Why improve the existing page instead of building a new one?",
    answer:
      "You confirmed an existing service page, and Search Console shows relevant searches reaching it. The service details and contact steps still need work. I’d improve that page before proposing another.",
    documentLabel: "Recommendation & evidence",
    documentTitle: deliverables.verified.headline,
    rows: [
      {
        label: "Client confirmation",
        text: "A service page already exists. Repair work is a current business priority.",
      },
      {
        label: "Search observation",
        text: "The page receives impressions and clicks for relevant service queries.",
      },
      {
        label: "Page finding",
        text: "Service coverage, the repair process and the next contact step remain unclear.",
      },
    ],
    noteLabel: "Limit",
    note: "These observations do not establish why enquiries changed.",
    followUp: "But our competitor has a dedicated page. Shouldn’t we follow?",
    reply:
      "It is worth comparing, but their page alone doesn’t show that you need another one. Let’s first check whether your existing page covers the same service, so we don’t propose a duplicate.",
  },
  {
    id: "scope",
    stage: "Agreeing the work scope",
    title: "What am I paying for?",
    question: "If we work together, what exactly will you do?",
    answer:
      "I’d start with the confirmed repair page: clarify the service, improve the contact steps and agree how we’ll review the work. These three proposed actions give us a scope to discuss—not an automatic commitment.",
    documentLabel: "Three proposed actions",
    documentTitle: "A scope to agree before work starts.",
    rows: [
      {
        label: deliverables.verified.actions[0].title,
        text: "Add approved service coverage, supported repairs and process information.",
      },
      {
        label: deliverables.verified.actions[1].title,
        text: "Explain the next contact step and check that the route works.",
      },
      {
        label: deliverables.verified.actions[2].title,
        text: "Check event collection and agree comparable evidence and review timing.",
      },
    ],
    noteLabel: "Client input",
    note: "Confirm business facts, publishing ownership and the work arrangements.",
    followUp: "What do you need from us, and who puts the changes live?",
    reply:
      "You confirm the service facts and coverage. I can prepare the content changes; together we’ll agree who publishes them and how completion is checked. We’ll put those responsibilities into the plan before delivery.",
  },
  {
    id: "progress",
    stage: "Planning the next review",
    title: "How will we judge progress?",
    question: "Once the page is updated, how will we know whether it helped?",
    answer:
      "First we’ll check that the agreed changes are live and the contact path works. Then we’ll review the same page’s search evidence and usable on-site data. Completing the work and proving an effect are different checks.",
    documentLabel: "Completion & follow-up",
    documentTitle: "Keep completion and results separate.",
    rows: [
      {
        label: "Completion check",
        text: "Is the agreed content live, and does the intended contact path work?",
      },
      {
        label: "Performance review",
        text: "Compare the same page, relevant queries and eligible on-site evidence over suitable periods.",
      },
      {
        label: "Still to confirm",
        text: "What do the key events mean? Is collection reliable, and do events represent meaningful enquiries?",
      },
    ],
    noteLabel: "Limit",
    note: "Click changes do not prove enquiry changes or the effect of this work.",
    followUp: "So if clicks go up, does that mean we’ll get more enquiries?",
    reply:
      "Not necessarily. We need to check what the enquiry events measure, whether tracking works and what else changed at the same time. Keeping those limits visible helps us decide whether to continue, adjust or investigate further.",
  },
] as const;
