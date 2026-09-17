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
    title: "SearchTrust | Win Clients With Evidence. Improve With Verified Data.",
    description:
      "Build evidence-backed local SEO Prospect reports, then connect GSC and GA4 to generate Verified Action Plans. New accounts receive 5 permanent credits.",
    path: "/",
  },
  framework: {
    title: "8-Layer Local Trust Framework | SearchTrust",
    description:
      "See how SearchTrust evaluates L1 Foundation through L8 Algorithm Fit, connects findings to evidence, and orders remediation without changing the fixed scoring model.",
    path: "/framework",
  },
  sampleReport: {
    title: "Sample Prospect & Verified Reports | SearchTrust",
    description:
      "Explore how SearchTrust turns public evidence into a Prospect report and connected GSC and GA4 data into a Verified Action Plan.",
    path: "/sample-report",
  },
  useCases: {
    title: "Local SEO Prospect & Verified Use Cases | SearchTrust",
    description:
      "Use SearchTrust to win local SEO clients with public evidence, then improve their businesses with verified first-party performance data.",
    path: "/use-cases",
  },
  pricing: {
    title: "Pricing | Permanent SearchTrust Credits",
    description:
      "Every new SearchTrust account receives 5 permanent credits. Additional credits are $19 each, with no subscription and no expiration.",
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
