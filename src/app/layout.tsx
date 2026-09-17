import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CTABanner } from "@/components/home/CTABanner";
import { AuditModalProvider } from "@/components/common/AuditModalProvider";
import { FooterPreCTA } from "@/components/layout/FooterPreCTA";
import { AnalyticsIdentify } from "@/components/common/AnalyticsIdentify";
import { SearchTrustGoogleAnalytics } from "@/components/common/SearchTrustGoogleAnalytics";
import { siteUrl, ogImage } from "@/lib/seo";
import { AppAuthProvider } from "@/lib/client-auth";
import { parseGoogleAnalyticsMeasurementId } from "@/lib/google-analytics";


export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SearchTrust | Win Clients With Evidence",
    template: "%s",
  },
  description:
    "Win local SEO clients with public evidence, then improve the business with verified Search Console and Analytics data.",
  keywords: [
    "local SEO",
    "trust diagnosis",
    "local page trust",
    "local page audit",
    "SEO tool",
    "search trust",
  ],
  icons: {
    icon: "/images/small-logo.png",
  },
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "SearchTrust | Win Clients With Evidence",
    description:
      "Win local SEO clients with public evidence, then improve the business with verified Search Console and Analytics data.",
    url: siteUrl,
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
    title: "SearchTrust | Win Clients With Evidence",
    description:
      "Win local SEO clients with public evidence, then improve the business with verified Search Console and Analytics data.",
    images: [`${siteUrl}${ogImage}`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const googleAnalyticsMeasurementId = parseGoogleAnalyticsMeasurementId(
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID,
  );

  return (
    <html lang="en">
      <body className="antialiased">
        <AppAuthProvider>
          <AnalyticsIdentify />
          <AuditModalProvider>
          <Header />
          <main>{children}</main>
          {/* <Footer /> */}
          <FooterPreCTA />
          <CTABanner />
          </AuditModalProvider>
        </AppAuthProvider>
        {googleAnalyticsMeasurementId ? (
          <SearchTrustGoogleAnalytics measurementId={googleAnalyticsMeasurementId} />
        ) : null}
      </body>
    </html>
  );
}
