import { MethodV22, MethodFAQ, MethodCTA } from "@/components/framework/MethodV22";
import { methodFAQ } from "@/components/framework/method-content";
import { createPageMetadata, pageSeo } from "@/lib/seo";

export const metadata = createPageMetadata(pageSeo.framework);

const frameworkJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: methodFAQ.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function FrameworkPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(frameworkJsonLd) }}
      />
      <MethodV22 />
      <MethodFAQ />
      <MethodCTA />
    </>
  );
}
