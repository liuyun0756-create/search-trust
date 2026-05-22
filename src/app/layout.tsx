import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CTABanner } from "@/components/home/CTABanner";
import { ClerkProvider } from "@clerk/nextjs";
import { AuditModalProvider } from "@/components/common/AuditModalProvider";


const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SearchTrust — Find Why Google Doesn't Trust Your Local Page",
  description:
    "SearchTrust analyzes your local, city, service-area, or location page through a structured trust model and shows where trust breaks down, which layer matters most, and what to fix first.",
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
  openGraph: {
    title: "SearchTrust — Local Page Trust Diagnosis",
    description:
      "Find why Google doesn't trust your local page and what to fix first.",
    type: "website",
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
        <ClerkProvider
          afterSignInUrl="/"          
          afterSignUpUrl="/"          
          afterSignOutUrl="/"        
        >
          <AuditModalProvider>
          <Header />
          <main>{children}</main>
          {/* <Footer /> */}
          <CTABanner />
          </AuditModalProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
