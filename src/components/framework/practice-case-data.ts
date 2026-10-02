export const practiceSteps = [
  { id: "principle", label: "Public principle" },
  { id: "judgment", label: "SEO judgment" },
  { id: "rules", label: "Analysis rules" },
  { id: "evidence", label: "Project evidence" },
  { id: "conclusion", label: "Problem conclusion" },
  { id: "action", label: "Optimization action" },
  { id: "review", label: "Result review" },
] as const;

export type PracticeStep = (typeof practiceSteps)[number]["id"];
type RecordField = readonly [string, string];
export type PracticeCase = {
  id: string;
  title: string;
  description: string;
  sources: string;
  status: string;
  principle: string;
  sourceTitle: string;
  sourceUrl: string;
  judgment: string;
  checks: string[];
  rules: string[];
  manual: string;
  evidenceSummary: string;
  evidenceFields: RecordField[];
  conditionalConclusion: string;
  limit: string;
  actions: string[];
  rejectedAlternative: string;
  implementationFields: RecordField[];
  review: string;
  reviewChecks: RecordField[];
  metrics: string[];
  context: string;
  hypothesis: string;
  next: string;
  value: string;
  work: string[];
};

export const practiceCases: PracticeCase[] = [
  {
    id: "search-clicks",
    title: "Impressions look steady. Why are clicks falling?",
    description: "Narrow a site-wide change to specific pages and queries before rewriting titles.",
    sources: "Search Console · Search results · Page checks",
    status: "Method example · Page/query evidence needed",
    principle: "Investigate affected pages, queries and possible causes before choosing a response to a search traffic change. A site-wide total alone does not identify what to fix.",
    sourceTitle: "Google: Debugging drops in Search traffic",
    sourceUrl: "https://developers.google.com/search/docs/monitor-debug/debugging-search-traffic-drops",
    judgment: "Fewer clicks do not, by themselves, mean that a title has become less appealing. First find where the change occurred and what else changed around it.",
    checks: [
      "Which pages and queries account for the change? Is it concentrated or widespread?",
      "Did positions change within the corresponding page and query scope?",
      "Did the query mix change, making an aggregate CTR comparison misleading?",
      "Did search demand or the observed result presentation change?",
    ],
    rules: [
      "Associate the change with the affected page and the query detail actually available; do not imply complete query coverage.",
      "Compare impressions, clicks, CTR and average position for the same supported scope and comparable periods.",
      "Check sample size, source availability and filters before treating a pattern as evidence.",
      "Keep unresolved search-demand and result-presentation questions attached to the finding.",
    ],
    manual: "The SEO reviews the live result context, query intent and alternative explanations. A trend alone does not establish the cause or justify a rewrite.",
    evidenceSummary: "A real case needs page/query-level exports, comparable periods, relevant search and page captures, and the SEO’s investigation notes. None have been supplied for this example.",
    evidenceFields: [
      ["Page and query scope", "Record the affected URL, available queries, search type, country and device filters."],
      ["Before and after exports", "Keep source, extraction time, period boundaries and the four search metrics together."],
      ["Search and page captures", "Record the query, observation location and time; retain only authorized, relevant captures."],
      ["Judgment record", "Explain which hypothesis each observation supports, conflicts with or leaves unresolved."],
    ],
    conditionalConclusion: "If the evidence shows a shift toward queries with a different click-through pattern, revise the title hypothesis first. That would support investigating the query mix, not a blanket title rewrite.",
    limit: "This is one possible reasoning branch, not a finding about a real site. Search presentation or a narrower page problem would require its own evidence.",
    actions: [
      "Confirm the affected pages and queries before selecting an editing target.",
      "If a specific search-presentation issue is supported, record the page, proposed change and reason for choosing it.",
      "Keep the prior page version and the actual implementation date for follow-up.",
    ],
    rejectedAlternative: "Do not rewrite every title solely because aggregate clicks fell. Unaffected pages and alternative explanations must remain distinguishable.",
    implementationFields: [
      ["Target and change", "Exact page, previous wording, revised wording and the evidence supporting the chosen change."],
      ["Decision and trade-off", "Who approved the work, which alternatives were considered and why they were not selected."],
      ["Implementation", "Actual publication time, responsible person and a checked page version."],
    ],
    review: "Revisit clicks, CTR, impressions and average position for the same page/query scope. Read the change alongside the implementation date and other influences, rather than treating it as automatic proof of impact.",
    reviewChecks: [
      ["Completion check", "Confirm that the intended page change was published correctly."],
      ["Performance observation", "Compare the same scope over suitable periods; review demand and result changes alongside it."],
    ],
    metrics: ["Clicks", "CTR", "Impressions", "Average position"],
    context: "Search demand, query mix, ranking changes and other page or search-result changes have not been investigated in this example.",
    hypothesis: "Perhaps weaker titles explain the loss of clicks.",
    next: "Collect the scoped exports and investigation notes, then decide whether a page change is justified or the initial hypothesis needs revision.",
    value: "Concentrate investigation and implementation on identifiable targets instead of making broad rewrites from a site-wide trend.",
    work: ["Collecting page and query evidence in one place.", "Checking filters, periods and the location of the change.", "Connecting a scoped finding to a proposed action.", "Preparing the reasoning and follow-up material for the client."],
  },
  {
    id: "local-consistency",
    title: "A competitor ranks higher. Fix the website or business information first?",
    description: "Separate the ranking gap from a specific, evidenced issue that the client can address.",
    sources: "Local search context · Website · Public business information",
    status: "Method example · Field confirmation needed",
    principle: "Local results consider relevance, distance and prominence. Google also recommends complete, accurate business information. These principles do not identify the cause of an individual ranking gap.",
    sourceTitle: "Google: Tips to improve your local ranking",
    sourceUrl: "https://support.google.com/business/answer/7091?hl=en",
    judgment: "A higher-ranking competitor is not, on its own, a reason to add more content or location pages. Establish the business context and look for a problem with a clear correction target.",
    checks: [
      "Are the services, observation location and search intent comparable?",
      "Do the website and public business information describe the same business consistently?",
      "Which fields contain conflicts, errors or missing information?",
      "Which differences are actionable, and which cannot explain the ranking gap by themselves?",
    ],
    rules: [
      "Retain the query and geographic context, distinguish organic and local results, and use confirmed competitors.",
      "Align corresponding website and public business fields before comparing their values.",
      "Separate matches, partial matches, conflicts and missing information; missing on both sides is not a confirmed match.",
      "Keep collection failure separate from observed absence, and request client confirmation of the correct business information.",
    ],
    manual: "The SEO confirms the relevant search context and the client verifies business facts. Public observations cannot establish private Business Profile performance or a ranking cause.",
    evidenceSummary: "A real case needs a sourced, timestamped comparison of website information, public business information and client-confirmed facts. There are no verified business fields in this example.",
    evidenceFields: [
      ["Website information", "Field name, observed value, page source and observation time."],
      ["Public business information", "The corresponding public value, source and observation time; note collection limits."],
      ["Client-confirmed information", "Correct service coverage or contact detail, who confirmed it and when."],
      ["Search context", "Query, location, result type and the confirmed competitor used for context."],
    ],
    conditionalConclusion: "If the client confirms a service-area conflict between the website and public business information, the supported conclusion is to correct that conflict first—not that it caused the ranking gap.",
    limit: "A verified information conflict supports an accuracy correction. Its effect on ranking remains a separate question.",
    actions: [
      "Confirm accurate service coverage and contact information with the client.",
      "Correct the affected website content or business field through the appropriate owner.",
      "Check the related locations for consistency and record the actual changes and implementation time.",
    ],
    rejectedAlternative: "Do not add content just because a competitor leads. Start with the directly evidenced issue when that is the justified priority.",
    implementationFields: [
      ["Approved fact", "The exact client-approved information and its confirmation record."],
      ["Correction targets", "Affected website locations or public business fields, before/after values and responsible owner."],
      ["Implementation", "Actual update time and a follow-up check of each relevant location."],
    ],
    review: "Separate repair acceptance from performance observation. It is valid to report “correction verified; performance still under observation” only when the correction itself has actually been checked.",
    reviewChecks: [
      ["Repair acceptance", "Verify that the conflict is removed and the information matches the approved business facts."],
      ["Performance observation", "Review available performance in a comparable search context; leave it pending when data is insufficient."],
    ],
    metrics: ["Field consistency", "Relevant search impressions", "Relevant search clicks"],
    context: "Location, query, competitors and other concurrent website or business-profile changes must accompany any comparison. No such project context has been supplied.",
    hypothesis: "Perhaps the competitor’s lead means we need more website content.",
    next: "Obtain client-confirmed facts and field records. If a conflict is verified, fix and check it; observe performance separately.",
    value: "Prioritize a directly evidenced problem instead of adding content work merely because a competitor is ahead.",
    work: ["Assembling sources for corresponding business fields.", "Comparing website, public and client-confirmed information.", "Turning a verified discrepancy into a scoped correction brief.", "Keeping repair checks separate from performance reporting."],
  },
  {
    id: "measurement",
    title: "GSC clicks rise while GA4 visits fall. Where is the problem?",
    description: "Check measurement and comparability before recommending changes to the page.",
    sources: "Search Console · GA4 · Configuration and release records",
    status: "Method example · Measurement review needed",
    principle: "Search Console clicks and Analytics sessions use different definitions and collection systems. Joint analysis needs aligned scope and an investigation of discrepancies, not identical totals.",
    sourceTitle: "Google: Using Search Console and Analytics together",
    sourceUrl: "https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console",
    judgment: "Diverging trends are a reason to investigate—not evidence that the website experience has deteriorated. Establish what each source is measuring before changing content.",
    checks: [
      "Do the Search Console property and GA4 resource correspond to the same website?",
      "Is GA4 restricted to the relevant Google organic traffic rather than a different channel scope?",
      "Are dates, time zones, pages and URL definitions comparable?",
      "Did tracking, consent behavior or a site release change during the comparison?",
    ],
    rules: [
      "Check source health and match the available resource and page scope.",
      "Record comparable periods and channel filters while retaining the distinction between clicks and sessions.",
      "Locate where trends diverge without interpreting a difference in totals as a tracking fault by itself.",
      "Flag unresolved measurement conditions before using the data to prioritize page changes.",
    ],
    manual: "The SEO or measurement specialist inspects configuration and release records, tests collection and checks remaining explanations. These are manual checks, not proof supplied by a trend comparison.",
    evidenceSummary: "A real case needs the two source trends, matched analysis scope, investigation notes and configuration evidence if a defect is confirmed. This example contains no client analytics or configuration captures.",
    evidenceFields: [
      ["Corresponding sources", "Search Console property and GA4 resource; preserve the scope without exposing private identifiers."],
      ["Comparable trends", "Clicks and Google organic sessions, their separate definitions, dates, time zones and page/channel filters."],
      ["Measurement review", "Relevant tag, consent and configuration checks, with test method and actual observations."],
      ["Release record", "Any concurrent tracking or website release and the investigation of its timing."],
    ],
    conditionalConclusion: "If configuration evidence confirms broken collection, address measurement first. If the scopes differ, align them. If neither explanation is supported, leave the discrepancy unresolved and continue investigating.",
    limit: "These are conditional outcomes, not three findings. Different click and session totals are expected and do not establish a defect.",
    actions: [
      "Confirm whether a measurement fault or scope mismatch is actually supported.",
      "If a fault is confirmed, repair and test collection before re-evaluating page performance.",
      "If the cause remains unresolved, document the open checks rather than starting a content rewrite.",
    ],
    rejectedAlternative: "Do not treat the trend conflict as proof of poor content or user experience. Reliable measurement is a prerequisite for the next decision.",
    implementationFields: [
      ["Confirmed issue", "The verified fault or scope mismatch, supporting tests and responsible reviewer."],
      ["Correction", "Configuration or filter changes, approval and actual release time."],
      ["Collection test", "Expected behavior, observed test outcome and any remaining limits."],
    ],
    review: "Check whether collection works, whether the discrepancy has an evidence-backed explanation and which business questions can now be assessed. More recorded events after a repair do not automatically mean more real enquiries.",
    reviewChecks: [
      ["Measurement acceptance", "Test the intended collection and document any remaining difference in scope or metric definition."],
      ["Business analysis readiness", "Only resume judgments that the verified data can support; do not equate recorded events with qualified leads."],
    ],
    metrics: ["Collection test", "GSC clicks", "GA4 Google organic sessions"],
    context: "Tracking changes, consent behavior, releases, time zones and URL/channel scope need to be checked alongside the trends. None are verified here.",
    hypothesis: "Perhaps lower GA4 visits mean that the website experience has deteriorated.",
    next: "Check resource and period alignment, then inspect and test measurement. Resume page optimization only when the supporting data is reliable enough.",
    value: "Reduce the risk of acting on the wrong data and give subsequent optimization a more reliable starting point.",
    work: ["Bringing source status and scope information together.", "Locating the trend conflict for targeted investigation.", "Recording measurement prerequisites before page actions.", "Preparing a clear explanation of what can and cannot yet be concluded."],
  },
];
