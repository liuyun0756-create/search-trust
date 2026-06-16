import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CTABanner } from "@/components/home/CTABanner";
import { ClerkProvider } from "@clerk/nextjs";
import { AuditModalProvider } from "@/components/common/AuditModalProvider";
import { FooterPreCTA } from "@/components/layout/FooterPreCTA";
import { AnalyticsIdentify } from "@/components/common/AnalyticsIdentify";
import { siteUrl, ogImage } from "@/lib/seo";


const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SearchTrust | Find Why Google Doesn't Trust Your Local Pages",
    template: "%s",
  },
  description:
    "SearchTrust analyzes local pages and business entities to explain why Google may not trust them, using a trust diagnosis model for local SEO and SEO agencies.",
  keywords: [
    "local SEO",
    "trust diagnosis",
    "Google trust",
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
    title: "SearchTrust | Find Why Google Doesn't Trust Your Local Pages",
    description:
      "SearchTrust analyzes local pages and business entities to explain why Google may not trust them, using a trust diagnosis model for local SEO and SEO agencies.",
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
    title: "SearchTrust | Find Why Google Doesn't Trust Your Local Pages",
    description:
      "SearchTrust analyzes local pages and business entities to explain why Google may not trust them, using a trust diagnosis model for local SEO and SEO agencies.",
    images: [`${siteUrl}${ogImage}`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <ClerkProvider>
          <AnalyticsIdentify />
          <AuditModalProvider>
          <Header />
          <main>{children}</main>
          {/* <Footer /> */}
          <FooterPreCTA />
          <CTABanner />
          </AuditModalProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
