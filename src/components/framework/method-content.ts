export const diagnosticAreas = [
  {
    title: "Market & search intent",
    question: "Which services, locations and searches are worth competing for?",
    evidence: "Observed search results, confirmed local competitors, service scope and target market.",
    decision: "Put a visible gap in its market context before turning it into a sales opportunity.",
    boundary: "A search snapshot describes the observed results. It does not measure every searcher's experience.",
  },
  {
    title: "Website & landing pages",
    question: "Can the right page support the service and location being searched?",
    evidence: "Discovered site pages, checked page responses, page types and selected pages reviewed in depth.",
    decision: "Identify access, structure and landing-page problems that can block later work.",
    boundary: "The report records its checked scope. Selected-page analysis is not an exhaustive technical crawl.",
  },
  {
    title: "Business identity & local presence",
    question: "Do the website and public Business Profile describe the same business?",
    evidence: "Business name, contact details, website, location and service-area information, plus available public profile evidence.",
    decision: "Separate identity conflicts and missing information from broader competitive differences.",
    boundary: "Distance and prominence also matter in local results. A competitor's advantage is not automatically a website defect.",
  },
  {
    title: "Content & credibility",
    question: "Does the page give a customer enough specific, credible information to act?",
    evidence: "Service detail, local context, business identity, accountability and unique page value, assessed through L1–L8.",
    decision: "Turn a specific content or trust gap into a scoped page improvement.",
    boundary: "The eight-layer model is a SearchTrust diagnostic framework, not Google's ranking formula.",
  },
  {
    title: "Search performance",
    question: "Where does the search opportunity weaken: visibility, position or clicks?",
    evidence: "Connected Search Console data, with available query, page and period comparisons.",
    decision: "Use performance evidence for the same target to strengthen or reduce an action's priority.",
    boundary: "Demand, seasonality and search-result changes may need additional investigation by the advisor.",
  },
  {
    title: "On-site engagement & outcomes",
    question: "What happens after organic visitors arrive?",
    evidence: "Connected GA4 organic traffic, landing-page engagement and available key-event measurements.",
    decision: "Check whether search acquisition and the on-site experience point toward the same problem.",
    boundary: "Key events are only as meaningful as their configuration. They are not automatically qualified leads or revenue.",
  },
  {
    title: "Measurement & review",
    question: "Are the sources reliable enough to support the decision?",
    evidence: "Source health, business and resource matching, comparable periods, evidence snapshots and action baselines.",
    decision: "Resolve measurement blockers, investigate conflicting signals and define what to check next.",
    boundary: "A before-and-after change can support a judgment; it does not establish causation on its own.",
  },
];

export const reasoningExamples = [
  {
    stage: "Prospect · Public evidence",
    title: "A local competitor appears above the business.",
    question: "Is there an actionable gap, or are the businesses competing under different conditions?",
    observation: "A confirmed competitor appears ahead of the business in the observed local search results.",
    checks: [
      "Confirm that both businesses serve the same intent and market. Keep the search location and query attached to the observation.",
      "Compare the available profile and website evidence: service relevance, identity consistency and specific local information.",
      "Consider distance and prominence. A single search result cannot establish why one business ranks above another.",
    ],
    decision: "Recommend a documented improvement where the business's own evidence supports it—for example, correcting conflicting service-area information. Use the competitor as context, not proof that copying its page will improve rankings.",
    review: "Check that the conflicting information was corrected on the relevant surfaces. Once the client connects performance data, use matching targets to review the opportunity further.",
  },
  {
    stage: "Verified · Search performance",
    title: "Impressions hold. Clicks fall.",
    question: "Is the problem visibility, intent or the search result itself?",
    observation: "Search Console shows fewer clicks while total impressions remain broadly stable.",
    checks: [
      "Find the affected pages and queries; an aggregate can hide a change in the search mix.",
      "Check position and CTR alongside those targets, then inspect the relevant search results.",
      "Ask whether demand, device mix or the results layout changed before recommending a page rewrite.",
    ],
    decision: "If the affected queries still match the service and positions are stable, review how the page is presented in search. If intent or query mix shifted, investigate that first.",
    review: "Record the affected targets and baseline. Review their clicks, impressions and CTR after the work, keeping demand and result changes in view.",
  },
  {
    stage: "Verified · Cross-source measurement",
    title: "Search clicks rise. Organic sessions fall.",
    question: "Do the sources disagree, or are we comparing different things?",
    observation: "Search Console and GA4 show opposing trends for the periods being reviewed.",
    checks: [
      "Confirm the property, date range, landing pages and Google organic traffic scope.",
      "Check tracking, consent and URL differences; clicks and sessions are different measurements.",
      "Keep the conflicting evidence visible without declaring either source wrong.",
    ],
    decision: "Investigate measurement consistency before using the disagreement to justify a content or conversion recommendation.",
    review: "Recheck aligned sources after measurement review. Explain any remaining difference instead of expecting their totals to match exactly.",
  },
  {
    stage: "Verified · On-site outcomes",
    title: "Organic traffic grows. Key events do not.",
    question: "Are we attracting the right visits, and measuring the right outcome?",
    observation: "GA4 records more organic sessions without a corresponding increase in configured key events.",
    checks: [
      "Confirm what each key event measures and whether its collection changed.",
      "Review the landing pages receiving the growth and the search intent bringing visitors there.",
      "Inspect the offer, contact path and service-area fit before attributing the gap to page copy.",
    ],
    decision: "If measurement is sound and relevant visitors reach the right page, investigate the path to enquiry. If the new visits are outside the target intent, address acquisition relevance first.",
    review: "Track the same landing pages and meaningful key events. The advisor should check lead quality with the client before describing a business improvement.",
  },
];

export const methodFAQ = [
  {
    question: "Is this an established SEO workflow or a proprietary ranking theory?",
    answer: "The workflow follows evidence-led SEO practice: inspect the market and site, check data quality, compare relevant signals, prioritize work and review the outcome. SearchTrust organizes this into traceable reports. Its L1–L8 model is one proprietary page-diagnosis tool within that workflow, not a claim about Google's internal algorithm.",
  },
  {
    question: "What can a Prospect report establish without private analytics?",
    answer: "It can document checked website and public Business Profile issues, compare confirmed competitors and recommend work supported by those observations. It cannot establish the client's private search traffic, conversions or the revenue impact of a proposed change.",
  },
  {
    question: "What does Verified add to the decision?",
    answer: "Connected Search Console and GA4 data add performance evidence to the same Case. Healthy evidence that matches the relevant page, query or supported scope can strengthen or reduce an action's priority. Conflicting signals can call for measurement review. Verified describes the evidence used; it does not mean an SEO outcome is guaranteed.",
  },
  {
    question: "Does SearchTrust prove that an SEO change caused growth?",
    answer: "No. Period comparisons and agreement between sources can support a judgment, but do not isolate the effect of one change. Advisors should consider timing, demand, seasonality and other work before drawing a causal conclusion. The report provides action baselines, validation criteria and review dates to support that review.",
  },
  {
    question: "Do I need access to the official Business Profile account?",
    answer: "Official GBP account access is not required for the core workflow. Confirmed public Business Profile evidence is used alongside the website. Verified requires the relevant GSC and GA4 connections; official GBP Performance can provide additional evidence when available and enabled. Public profile observations are not private GBP performance metrics.",
  },
  {
    question: "Does the method automatically check every possible SEO cause?",
    answer: "No. The report states the sources and pages checked. The wider diagnostic method also includes advisor checks such as seasonal demand, algorithm-update timing, tracking configuration and implementation history. SearchTrust does not claim exhaustive technical, backlink or local rank-grid coverage.",
  },
  {
    question: "Why can an action's priority change in the next report?",
    answer: "New evidence may support an earlier finding, reduce its urgency or reveal a measurement issue that needs attention first. Performance growth does not erase a directly observed problem such as an explicit noindex directive. Changes are explained against the earlier report; unchanged evidence does not need a change label.",
  },
];
