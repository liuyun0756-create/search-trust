import { clientWorkExample as example } from "@/components/useCase/client-work-example";

export const pricingCopy = {
  eyebrow: "Pricing · No subscription",
  guestTitle: ["Start with 5 free credits.", "Buy more when you need them."],
  guestIntro: "Try SearchTrust with five included credits. One credit starts a Prospect Evidence Report or a Verified Action Plan generation. Additional credits are $19 each and never expire.",
  readyTitle: ["Your next report starts here.", "Use your credits when you need them."],
  readyIntro: "Use your available credits for a Prospect Evidence Report or a Verified Action Plan generation. Your balance never expires.",
  emptyTitle: ["Ready for your next report?", "Add a credit when you need one."],
  emptyIntro: "Additional credits are $19 each. No subscription, no recurring charge and no expiration.",
  neutralTitle: ["Reports when you need them.", "No subscription."],
  freeAction: "Get my 5 free credits",
  buyAction: "Buy 1 credit · $19",
  freeNote: "For new accounts · Granted once · No expiration",
  freeFeatures: ["Granted once to each new account", "The same report-generation features as purchased credits", "Never expire"],
  purchaseFeatures: ["One-time purchase", "Works across your Cases", "Never expires"],
  failureNote: "Technical failure? The credit used for that generation is returned automatically.",
  checkoutError: "Checkout could not be opened. Please try again.",
  confirmationError: "We couldn’t confirm the status yet. Check again before making another purchase.",
  supportHref: "mailto:liu6685756@gmail.com",
};

export const pricingReports = [
  {
    id: "prospect", name: "Prospect Evidence Report",
    title: "Bring a specific diagnosis into the first conversation.",
    business: example.business.name, page: example.page.path,
    sections: [
      { label: "Finding", text: `The ${example.business.service} page exists, but visitors must look further down to understand the repair service and find a booking route.` },
      { label: "Evidence", text: `The opening reads “${example.page.openingH1}.” Repair problems are described later; the phone number is in the footer and the booking form follows the main content.` },
      { label: "First action", text: "Clarify the existing page’s repair offer and bring the contact route forward before proposing another page for the same service." },
      { label: "For the first conversation", text: "Confirm that AC repair is a business priority and that the publicly listed service areas are still current." },
    ],
    limit: "Public observations—not a conclusion about lost enquiries.",
    use: "For first calls, a focused diagnosis and an initial scope discussion.",
    link: { label: "Read the sample report", href: "/sample-report#sample-prospect" },
    condition: null,
  },
  {
    id: "verified", name: "Verified Action Plan",
    title: "Get a plan you can put to work.",
    business: example.business.name, page: example.page.path,
    sections: [
      { label: "Decision", text: "Improve the confirmed AC repair page before creating another page for the same service." },
      { label: "Supporting evidence", text: `The page recorded ${example.metrics.impressions.toLocaleString("en-US")} impressions and ${example.metrics.clicks.toLocaleString("en-US")} clicks from ${example.period.label}. The client confirms its purpose and current service areas.` },
      { label: "Work to carry out", text: "State the service and coverage in the opening. Bring common repair problems forward. Add a booking action and a tap-to-call link, then test both on mobile." },
      { label: "Completion and review", text: "Check the live page and contact route, then review comparable search activity and verified contact events where available." },
    ],
    limit: "Proposed work, not yet implemented. Contact events are not qualified enquiries.",
    use: "For work planning, execution handoff and client delivery.",
    link: { label: "Read the sample plan", href: "/sample-report#sample-verified" },
    condition: "Available when continuing a completed Prospect Case with eligible client data.",
  },
];

export const creditRules = [
  { action: "Generate a Prospect report or Verified plan", rule: "1 credit" },
  { action: "Generate a new version", rule: "1 additional credit" },
  { action: "View, share or download an existing report", rule: "No additional credit" },
  { action: "Generation fails for a technical reason", rule: "The credit used is returned" },
];

export const pricingFAQData = [
  { question: "What can I use the five free credits for?", answer: "The credits use the same report-generation features as purchased credits. You can use them for Prospect analysis or eligible Verified Action Plan generation. They are granted once to a new account and do not expire. The Verified stage requires a completed Prospect Case and eligible client data." },
  { question: "Is there a subscription, and do credits expire?", answer: "No subscription or recurring charge is required. Both included and purchased credits stay in your account without an expiration date. Additional credits cost $19 USD each." },
  { question: "When is a credit used?", answer: "One credit is used when competitor discovery starts a complete Prospect analysis, or when a Verified Action Plan generation starts. Entering a website, confirming the business and connecting or synchronizing supported client data do not use a credit. Correcting a competitor or resuming the same active workflow does not use another credit." },
  { question: "Is editing a plan the same as generating a new one?", answer: "No. Reviewing or editing the supported action-plan fields does not start a new analysis. Generating a new report or plan version uses one credit. Viewing, sharing and downloading an existing report do not use another credit; the existing review and approval requirements still apply to client delivery." },
  { question: "What if a generation fails?", answer: "If a charged generation fails for a technical reason, the credit used is returned automatically. Starting a new generation after the return uses one credit again. This is a credit return, not a cash refund." },
  { question: "Can I use it for a client I already serve?", answer: "You can continue client work from a completed Prospect Case, with client confirmation and eligible data access. A direct service-only start for a client without a Prospect Case is not available yet. Opening the entry page does not use a credit." },
  { question: "How do payment and refunds work?", answer: "Purchases are processed through Dodo Payments, and credits are added after payment confirmation. An unused purchased credit may be refunded after the provider confirms the reversal. Used credits require manual review. See the Refund Policy for the applicable process." },
];

export const pricingJsonLd = {
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: pricingFAQData.map(({ question, answer }) => ({ "@type": "Question", name: question, acceptedAnswer: { "@type": "Answer", text: answer } })),
};

export function creditLabel(balance: number) { return `${balance} ${balance === 1 ? "credit" : "credits"}`; }
