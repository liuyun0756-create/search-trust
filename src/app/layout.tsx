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
    default: "SearchTrust | Evidence-Backed Local Page Trust Audit",
    template: "%s",
  },
  description:
    "SearchTrust gives agencies an evidence-backed L1-L8 trust audit, prioritized implementation roadmap, and client-ready report for one local page.",
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
    title: "SearchTrust | Evidence-Backed Local Page Trust Audit",
    description:
      "SearchTrust gives agencies an evidence-backed L1-L8 trust audit, prioritized implementation roadmap, and client-ready report for one local page.",
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
    title: "SearchTrust | Evidence-Backed Local Page Trust Audit",
    description:
      "SearchTrust gives agencies an evidence-backed L1-L8 trust audit, prioritized implementation roadmap, and client-ready report for one local page.",
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
