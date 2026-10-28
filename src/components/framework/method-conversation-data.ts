type EmailParagraph = { before: string; highlight: string; after: string };

type MethodConversation = {
  id: string;
  phase: "prospect" | "service";
  label: string;
  stage: string;
  question: string;
  subject: string;
  generic: string;
  concern: string;
  email: EmailParagraph[];
  sourceLabels: string[];
  sources: string[];
  method: string[];
  takeaway: string;
  assessment: string;
  limit: string;
};

export const methodConversations: MethodConversation[] = [
  {
    id: "first-contact",
    phase: "prospect",
    label: "First contact",
    stage: "Before analytics access",
    question: "Why should we talk about SEO?",
    subject: "A question about your AC repair service page",
    generic: "Your competitors rank higher. We can improve your SEO.",
    concern: "Which service did you check? Do you know where we work?",
    email: [
      {
        before: "I noticed that ",
        highlight:
          "your AC repair information is spread across the public pages I reviewed",
        after:
          ". I could not confirm whether you already have a dedicated repair page. The supported repairs, service area and next contact step were difficult to establish.",
      },
      {
        before:
          "A confirmed competitor serving a comparable area explains the same service on a dedicated page. ",
        highlight:
          "That gives us a useful comparison for how customers understand the offer",
        after:
          ", although it does not establish why that competitor ranks or whether you need another page.",
      },
      {
        before: "I can help you confirm the right page and prepare ",
        highlight:
          "three proposed actions for the service explanation, contact path and follow-up checks",
        after:
          ". Is AC repair a current priority, and which page do you use for it?",
      },
    ],
    sourceLabels: ["Service pages", "Service area", "Competitor page"],
    sources: [
      "Inspected public service pages: repair information and contact guidance.",
      "Public service-area information: relevance to this business and market.",
      "Confirmed competitor’s equivalent service page: a comparable offer, not proof of a ranking cause.",
    ],
    method: [
      "Match the service and area.",
      "Confirm the intended page before proposing a new URL.",
      "Define a first scope and the questions the client must answer.",
    ],
    takeaway: "A specific page question and three proposed actions to discuss.",
    assessment:
      "Whether you understood the service and have a useful first scope.",
    limit:
      "Page existence still needs confirmation. Public evidence cannot establish private traffic, enquiry quality or revenue.",
  },
  {
    id: "existing-seo",
    phase: "prospect",
    label: "Already doing SEO",
    stage: "Before analytics access",
    question: "We already have an SEO. What would you add?",
    subject: "A quick check on your location’s contact details",
    generic:
      "Your current SEO is missing opportunities. Our audit can show you what is wrong.",
    concern:
      "What specifically did you find? Do you understand our current setup?",
    email: [
      {
        before: "I noticed that ",
        highlight:
          "the phone number on your contact page differs from the number on the matching Google Business Profile",
        after:
          ". It may be a valid branch or tracking number, so I would first confirm how each number is used.",
      },
      {
        before:
          "If either number reaches the wrong destination, customers may struggle to contact the right location. ",
        highlight: "The difference alone does not establish an SEO problem",
        after:
          ". Before recommending a correction, I would check the intended branch, call routing and whether both contact paths work.",
      },
      {
        before: "I can give you ",
        highlight:
          "a short record of what is correct and what, if anything, needs changing",
        after:
          ", so you can review it with the person managing your site. Are the two numbers intended for separate branches or call tracking?",
      },
    ],
    sourceLabels: ["Contact page", "Business profile", "Number setup"],
    sources: [
      "Website contact information: the number shown for the inspected location.",
      "Matching Google Business Profile: the publicly listed contact number.",
      "Branch and tracking setup: intended use and routing require client confirmation.",
    ],
    method: [
      "Match the business and branch.",
      "Distinguish a valid difference from a contact error.",
      "Specify a correction only if the check supports one.",
    ],
    takeaway: "A contact-path check with a clear confirmation question.",
    assessment:
      "Whether the check adds something useful to the work already underway.",
    limit:
      "A public discrepancy alone does not establish an error, a ranking cause or lost enquiries. Competitor details cannot resolve this client’s setup.",
  },
  {
    id: "first-scope",
    phase: "prospect",
    label: "Agree a first scope",
    stage: "Before analytics access",
    question: "What exactly would you work on first?",
    subject: "A first scope for your repair-service page",
    generic:
      "We will improve your content, fix technical issues and grow your online presence.",
    concern: "What will change, and what do you need from me?",
    email: [
      {
        before: "On the service page I reviewed, ",
        highlight:
          "the service area, repair process and next contact step are unclear",
        after:
          ". These are specific content questions we can resolve with your business information before agreeing on the first work.",
      },
      {
        before:
          "A confirmed competitor explains its repair process more clearly. We would use your actual process and supported repairs to ",
        highlight: "make your offer easier to understand",
        after:
          ". Public page content alone cannot tell us how much traffic or how many enquiries an update would produce.",
      },
      {
        before: "I can prepare ",
        highlight:
          "a page-update brief with three proposed actions and completion checks",
        after:
          ". First, we would confirm the target page, your coverage and the contact route. Can you provide those details and identify who will approve the page copy?",
      },
    ],
    sourceLabels: ["Service page", "Comparable offer", "Client materials"],
    sources: [
      "Inspected service-page content and contact path: what a visitor can currently find.",
      "Confirmed competitor’s service explanation: relevant context for clarity and scope.",
      "Accurate business materials: client approval is needed before using service claims.",
    ],
    method: [
      "Inspect a specific page and contact path.",
      "Match proposed changes to approved business information.",
      "Agree three actions with defined scope and completion checks.",
    ],
    takeaway:
      "A page-update brief and a specific request for client materials.",
    assessment:
      "What you will deliver, how they need to help and what counts as done.",
    limit:
      "The scope is proposed work. Search demand and longer-term priority still need checking after eligible data access.",
  },
  {
    id: "click-decline",
    phase: "service",
    label: "Explain fewer clicks",
    stage: "After eligible data access",
    question: "Clicks are down. Should we rewrite the page?",
    subject: "Before changing the page: isolate the click decline",
    generic:
      "Clicks are down. We should publish more content and refresh your keywords.",
    concern: "Which page or query changed? Why would a rewrite help?",
    email: [
      {
        before: "The Search Console comparison shows ",
        highlight: "fewer clicks while impressions are broadly stable",
        after:
          ". I would first identify the affected pages and queries, then check CTR, position and whether the dates and filters are comparable.",
      },
      {
        before: "A change in query mix or search context could contribute. ",
        highlight: "The click trend alone does not establish a content problem",
        after:
          ". Current competitor results can add context, but they cannot explain a past change without historical evidence.",
      },
      {
        before: "I can give you ",
        highlight: "a recommendation tied to the affected page and query scope",
        after:
          ": a targeted change, further investigation or no page edit yet. Where GA4 data is suitable, I would also check the same landing page, keeping search clicks and on-site sessions distinct.",
      },
    ],
    sourceLabels: ["GSC pages & queries", "Dates & filters", "Search context"],
    sources: [
      "Eligible GSC page and query comparison: clicks, impressions, CTR and position.",
      "Date range and filters: confirm the comparisons describe the same scope.",
      "Current search results: useful context, but not historical proof of a competitor change.",
    ],
    method: [
      "Locate the page and query scope that changed.",
      "Check comparability and alternative explanations.",
      "Recommend a targeted action or a defined investigation.",
    ],
    takeaway: "A specific investigation before committing to a page rewrite.",
    assessment: "Why the next action follows from the available evidence.",
    limit:
      "This scenario uses assumed observations. No actual account, metric values or dates are represented; a click trend cannot establish enquiry impact.",
  },
  {
    id: "page-review",
    phase: "service",
    label: "Review a page update",
    stage: "After a page update",
    question: "The page is updated. Has the work helped?",
    subject: "What we should check after the page update",
    generic:
      "Traffic changed after the update. This shows our SEO work is making a difference.",
    concern: "Are those numbers about this page? What else changed?",
    email: [
      {
        before: "I would start by confirming ",
        highlight: "which agreed changes are live on the intended page",
        after:
          ", using your implementation record to establish the date. That gives us a clear basis for reviewing the service information and contact path.",
      },
      {
        before:
          "Next, I would compare the same page and relevant query scope in GSC with suitable GA4 evidence, checking key-event collection and concurrent changes. ",
        highlight:
          "A performance change by itself does not prove the edit caused it",
        after: ". Demand and competitor changes may also need investigation.",
      },
      {
        before: "I can bring you ",
        highlight:
          "a review that distinguishes delivered work, observed performance and the next recommendation",
        after:
          ". We can then decide whether to continue, adjust the action or investigate further, with any measurement limits kept in the explanation.",
      },
    ],
    sourceLabels: ["Live page", "Implementation record", "GSC & GA4"],
    sources: [
      "Live page and client-held implementation record: exact changes and when they went live.",
      "Comparable GSC page and query evidence: consistent target and suitable review period.",
      "Eligible GA4 evidence: landing-page scope and checked event meaning and collection.",
    ],
    method: [
      "Confirm what went live and when.",
      "Compare the same targets and check concurrent changes.",
      "Explain the reason to continue, adjust or investigate.",
    ],
    takeaway:
      "A review connecting completed work, evidence and the next decision.",
    assessment: "What was delivered and why you recommend the next step.",
    limit:
      "No implementation or performance result is claimed by this example. Implementation history is kept outside the current workflow; automated change-aligned comparisons are not provided.",
  },
];
