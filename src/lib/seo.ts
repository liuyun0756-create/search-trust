import type { Metadata } from "next";

export const siteUrl = "https://trysearchtrust.com";
export const ogImage = "/images/sample-report.png";

type SeoConfig = {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
};

export function createPageMetadata({
  title,
  description,
  path,
  noindex = false,
}: SeoConfig): Metadata {
  const url = `${siteUrl}${path}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    robots: noindex
      ? {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        }
      : undefined,
    openGraph: {
      title,
      description,
      url,
      siteName: "SearchTrust",
      type: "website",
      images: [
        {
          url: `${siteUrl}${ogImage}`,
          width: 1200,
          height: 630,
          alt: "SearchTrust local SEO trust audit report preview",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${siteUrl}${ogImage}`],
    },
  };
}

export const pageSeo = {
  home: {
    title: "SearchTrust | Evidence-Backed Local Page Trust Audit",
    description:
      "Audit one local page with an evidence-backed L1-L8 model, traceable findings, executable actions, a four-phase implementation roadmap, and client-ready PDF delivery.",
    path: "/",
  },
  framework: {
    title: "8-Layer Local Trust Framework | SearchTrust",
    description:
      "See how SearchTrust evaluates L1 Foundation through L8 Algorithm Fit, connects findings to evidence, and orders remediation without changing the fixed scoring model.",
    path: "/framework",
  },
  sampleReport: {
    title: "Sample Local SEO Trust Audit Report | SearchTrust",
    description:
      "Explore a real-format SearchTrust report with L1-L8 findings, source evidence, layer actions, a four-phase implementation roadmap, Business Presence Audit, and two PDF formats.",
    path: "/sample-report",
  },
  useCases: {
    title: "Use Cases | SearchTrust for SEO Agencies and Local SEO",
    description:
      "Use SearchTrust for agency client audits, proposal scoping, stuck-page diagnosis, pre-publish reviews, staged remediation, and priority-page sampling.",
    path: "/use-cases",
  },
  pricing: {
    title: "Pricing | SearchTrust Local Page Trust Audit",
    description:
      "Get a one-time SearchTrust report for one local page URL. Diagnose trust issues, entity consistency, local grounding, and prioritized fixes.",
    path: "/pricing",
  },
  terms: {
    title: "Terms of Service | SearchTrust",
    description:
      "Read the terms governing SearchTrust's local page trust audit service.",
    path: "/terms",
  },
  privacy: {
    title: "Privacy Policy | SearchTrust",
    description:
      "Learn how SearchTrust handles submitted URLs, contact details, analytics, and payment-related data.",
    path: "/privacy",
  },
  refund: {
    title: "Refund Policy | SearchTrust",
    description:
      "Learn when SearchTrust reports are eligible for refunds and how refund requests are handled.",
    path: "/refund-policy",
  },
} as const;
