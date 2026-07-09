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
import {ComparisonTable} from "@/components/home/ComparisonTable";
import {ProductRoadmap} from "@/components/home/ProductRoadmap";
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
    answer: "Yes, it is designed for service area businesses, multi-location brands, and local lead-gen pages that need to establish entity authority."
  },
  {
    question: "Is this a replacement for my existing SEO tools?",
    answer: "No, it's a diagnostic layer that sits on top of tools like Ahrefs or Semrush to explain the 'why' behind ranking plateaus that those tools can't detect."
  },
  {
    question: "How long does a trust audit take?",
    answer: "A single-page audit usually generates a web report shortly after processing. Delivery timing may vary by page availability, data coverage, and workflow load."
  },
  {
    question: "Can I run trust audits in bulk?",
    answer: "The current checkout analyzes one URL at a time. Agencies and multi-location teams can start with priority pages first; broader batch workflows are not part of the current $19 one-time report."
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
      <ComparisonTable />
      <ProductRoadmap />
      <FAQAccordion tag="FAQ" title="Frequently asked questions" items={homeFAQData} />
      {/* <CTABanner /> */}
    </>
  );
}
