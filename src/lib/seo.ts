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
    title: "SearchTrust | Find Why Google Doesn't Trust Your Local Pages",
    description:
      "SearchTrust analyzes local pages and business entities to explain why Google may not trust them, using a trust diagnosis model for local SEO and SEO agencies.",
    path: "/",
  },
  framework: {
    title: "Google Trust Collapse Framework for Local SEO | SearchTrust",
    description:
      "Learn the SearchTrust framework for diagnosing why local pages fail trust across eligibility, entity presence, consistency, specificity, real-world signals, accountability, and algorithm fit.",
    path: "/framework",
  },
  sampleReport: {
    title: "Sample Local SEO Trust Audit Report | SearchTrust",
    description:
      "Preview a SearchTrust report showing trust status, ranking potential, risk level, key issues, trust layers, and prioritized fixes for a local page.",
    path: "/sample-report",
  },
  useCases: {
    title: "Use Cases | SearchTrust for SEO Agencies and Local SEO",
    description:
      "See how SEO agencies, local SEO teams, affiliate operators, and multi-location businesses use SearchTrust to diagnose local page trust issues.",
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
