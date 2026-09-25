"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { HeaderUserActions } from "./HeaderUserActions";

const navLinks = [
  { id: "home", href: "/", label: "Home" },
  { id: "framework", href: "/framework", label: "Our Method" },
  { id: "report", href: "/sample-report", label: "Sample Report" },
  // { id: "reports", href: "/reports", label: "My Reports" },
  { id: "use-cases", href: "/use-cases", label: "In Practice" },
  { id: "pricing", href: "/pricing", label: "Pricing" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isCaseReport = /^\/cases\/[^/]+\/reports\/[^/]+$/.test(pathname);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  if (
    pathname === "/reports" ||
    pathname === "/policy" ||
    pathname === "/terms" ||
    pathname === "/privacy" ||
    pathname === "/refund-policy"
    || pathname === "/cases/new"
    || pathname === "/share"
    || isCaseReport
  ) return null;

  const activeTab = navLinks.find(l => l.href === pathname)?.id ?? "home";

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-50">
      <div className="mx-auto flex h-[72px] items-center justify-between px-6">

        <Link href="/" aria-label="SearchTrust home" className="flex min-w-[150px] items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#86a91b]">
          <img src="/images/logo.png" alt="SearchTrust" className="h-6 w-auto md:h-8" />
        </Link>

        <nav aria-label="Primary navigation" className="relative hidden items-center bg-white p-1 xl:flex">
          {navLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              aria-current={activeTab === link.id ? "page" : undefined}
              className={`relative px-5 py-2 text-[14px] font-bold rounded-[8px] transition-colors duration-200 z-10 ${
                activeTab === link.id ? "bg-[#1A1F2B] text-white" : "text-[#657083] hover:text-[#1D2531]"
              }`}
            >
              <span className="relative z-20">{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="hidden xl:block"><HeaderUserActions /></div>

        <button
          type="button"
          className="xl:hidden p-2 text-[#1D2531]"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <nav aria-label="Mobile navigation" className="absolute left-0 top-[72px] flex w-full flex-col gap-4 border-b border-gray-100 bg-white px-6 py-6 shadow-xl xl:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              aria-current={activeTab === link.id ? "page" : undefined}
              className={`rounded-lg px-4 py-3 text-left text-[16px] font-bold ${activeTab === link.id ? "bg-[#1A1F2B] text-white" : "text-[#657083]"}`}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <hr className="border-gray-100 my-2" />
          <HeaderUserActions mobile onNavigate={() => setMobileOpen(false)} />
        </nav>
      )}
    </header>
  );
}
