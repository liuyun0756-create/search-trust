import { FAQAccordion } from "@/components/common/FAQAccordion";
import { HomepageV22 } from "@/components/home/HomepageV22";
import { createPageMetadata, pageSeo, siteUrl } from "@/lib/seo";

const homeFAQData = [
  {
    question: "What does one credit cover?",
    answer: "One credit starts one provider-backed Prospect workflow or one Verified Action Plan generation. Entering the website and confirming the business happens before the charge. A technical generation failure returns exactly one credit.",
  },
  {
    question: "What is the difference between Prospect and Verified?",
    answer: "Prospect uses public website, business profile, and competitor evidence to help you explain an opportunity before an engagement. Verified adds connected Search Console and Google Analytics data after the engagement so the action plan reflects owned performance evidence.",
  },
  {
    question: "Do I need access to a Google Business Profile account?",
    answer: "No. SearchTrust checks the confirmed public Business Profile through SerpAPI. Verified generation requires Search Console and Google Analytics connections, but not an official GBP owner connection.",
  },
  {
    question: "What happens if SearchTrust cannot find a competitor?",
    answer: "The workflow asks you to provide at least one real competitor before continuing. That correction remains part of the same charged workflow and does not consume a second credit.",
  },
  {
    question: "Do the five signup credits expire?",
    answer: "No. Every new authenticated account receives five permanent credits once. Purchased credits also do not expire.",
  },
  {
    question: "Is SearchTrust a rank tracker or a promise of rankings?",
    answer: "No. SearchTrust organizes available evidence into defensible findings and actions. It does not guarantee rankings, traffic, leads, or business outcomes.",
  },
];

export const metadata = createPageMetadata(pageSeo.home);

const homeJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SearchTrust",
    url: siteUrl,
    description: "SearchTrust helps local SEO consultants win client work with public evidence and improve the business with verified first-party data.",
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SearchTrust",
    applicationCategory: "SEO Software",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "19", priceCurrency: "USD", description: "One permanent SearchTrust credit" },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: homeFAQData.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  },
];

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }} />
      <HomepageV22 />
      <FAQAccordion tag="FAQ" title="Straight answers before you spend a credit" items={homeFAQData} />
    </>
  );
}
