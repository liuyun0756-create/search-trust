import { HeroSection } from "@/components/home/HeroSection";
import { InsightEngine } from "@/components/home/InsightEngine";
import { LocalPage } from "@/components/home/LocalPage";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ProductDemo } from "@/components/home/ProductDemo";
import { HowItWorksSteps } from "@/components/home/HowItWorksSteps";
import {ReportPreview} from "@/components/home/ReportPreview";
import { Diagnosis } from "@/components/home/Diagnosis";
import {AuditSection} from "@/components/home/AuditSection";
import {CommonWaysSection} from "@/components/home/CommonWaysSection";
import { FAQAccordion } from "@/components/common/FAQAccordion";
import {AuditForm} from "@/components/common/AuditForm";
import {WhatYouGet} from "@/components/home/WhatYouGet";
import { ProductDefinition } from "@/components/home/ProductDefinition";
import { createPageMetadata, pageSeo, siteUrl } from "@/lib/seo";

const homeFAQData = [
  {
    question: "How is SearchTrust different from a standard SEO audit tool?",
    answer: "Standard SEO tools measure performance signals: backlinks, traffic, content length, and technical errors. SearchTrust diagnoses page and entity trust structure: what evidence is present, which trust layer is weak, and what to fix first."
  },
  {
    question: "What is the SearchTrust 8-layer trust model?",
    answer: "It is a structured local trust diagnosis model covering foundation, entity presence, entity consistency, specificity, real-world connection, accountability, page unique value, and algorithm fit."
  },
  {
    question: "Does SearchTrust work for any type of local page?",
    answer: "SearchTrust is designed for publicly accessible local service pages, city pages, service-area pages, and location landing pages. The current product audits one priority URL at a time."
  },
  {
    question: "Is this a replacement for my existing SEO tools?",
    answer: "No. It complements technical SEO, analytics, and rank tracking by showing which checked trust signals need attention, the evidence behind each finding, and the order in which to address them."
  },
  {
    question: "How long does a trust audit take?",
    answer: "A single-page audit usually generates a web report shortly after processing. Delivery timing may vary by page availability, data coverage, and workflow load."
  },
  {
    question: "Can I run trust audits in bulk?",
    answer: "The current checkout analyzes one URL at a time. Agencies and multi-location teams can start with priority pages first; broader batch workflows are not part of the current $19 one-time report."
  },
  {
    question: "What can an agency deliver to a client?",
    answer: "Agencies receive a full working audit with evidence and implementation detail, plus a simplified client report preview and a client-ready PDF. A full audit PDF is also available for internal delivery."
  },
  {
    question: "What is included in Business Presence Audit?",
    answer: "When public GBP data is available, SearchTrust adds a supplemental, non-scoring review of GBP-to-page alignment, profile activity, and a recent review sample. Missing public data is shown as not verified rather than treated as a confirmed failure."
  }
];
// import { CTABanner } from "@/components/home/CTABanner";

export const metadata = createPageMetadata(pageSeo.home);

const homeJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SearchTrust",
    url: siteUrl,
    description:
      "SearchTrust helps diagnose local page and entity trust structure with evidence-backed 8-layer reports.",
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SearchTrust",
    applicationCategory: "SEO Software",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "19",
      priceCurrency: "USD",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: homeFAQData.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  },
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeJsonLd) }}
      />
      <HeroSection />
      {/* <AuditForm /> */}
      <WhatYouGet />
      <InsightEngine />
      <LocalPage />
      <ProductDefinition />
      <HowItWorks />
      <ProductDemo />
      <HowItWorksSteps />
      <ReportPreview />
      <Diagnosis />
      <AuditSection />
      <CommonWaysSection />
      <FAQAccordion tag="FAQ" title="Frequently asked questions" items={homeFAQData} />
      {/* <CTABanner /> */}
    </>
  );
}
