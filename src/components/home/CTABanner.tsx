"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { marketingProductLinks } from "@/components/layout/marketing-navigation";

const accountLinks = [
  { href: "/cases/new", label: "Start a Case" },
  { href: "/sign-in", label: "Sign In" },
];

const legalLinks = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refund-policy", label: "Refund Policy" },
];

export function CTABanner() {
  const pathname = usePathname();
  if (pathname === "/cases/new" || pathname === "/reports" || pathname === "/share" || pathname.startsWith("/sign-in") || /^\/cases\/[^/]+\/reports\/[^/]+$/.test(pathname)) return null;

  return (
    <footer aria-label="Site footer" className="bg-[#eef1e9] px-4 py-14 text-[#172018] sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
          <div>
            <Link href="/" aria-label="SearchTrust home" className="inline-flex rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#86a91b]">
              <img src="/images/logo.png" alt="SearchTrust" className="h-8 w-auto" />
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#627066]">Evidence-backed local SEO decisions for winning client work, planning delivery and explaining what changes.</p>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-[#668315]">Five permanent credits included with every new account</p>
          </div>

          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {[
              ["Product", marketingProductLinks],
              ["Account", accountLinks],
              ["Legal", legalLinks],
            ].map(([heading, links]) => (
              <div key={String(heading)}>
                <h2 className="text-xs font-black uppercase tracking-[0.16em] text-[#728078]">{String(heading)}</h2>
                <ul className="mt-5 space-y-3">
                  {(links as typeof marketingProductLinks).map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm font-semibold text-[#36443a] transition-colors hover:text-[#6c8a16] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#86a91b]">{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-[#172018]/10 pt-6 text-xs text-[#778279] sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 SearchTrust. All rights reserved.</p>
          <p>No subscription · Permanent credits · Secure Dodo Payments checkout</p>
        </div>
      </div>
    </footer>
  );
}
