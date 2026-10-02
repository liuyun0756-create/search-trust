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
    || pathname.startsWith("/sign-in")
    || isCaseReport
  ) return null;

  const activeTab = navLinks.find(l => l.href === pathname)?.id ?? "home";

  return (
    <header className="sticky top-0 z-50 border-b border-[#e3eae2] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 sm:px-8">

        <Link href="/" aria-label="SearchTrust home" className="flex min-w-[150px] items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#86a91b]">
          <img src="/images/logo.png" alt="SearchTrust" className="h-6 w-auto md:h-8" />
        </Link>

        <nav aria-label="Primary navigation" className="relative hidden items-center gap-1 xl:flex">
          {navLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              aria-current={activeTab === link.id ? "page" : undefined}
              className={`relative z-10 rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors duration-200 ${
                activeTab === link.id ? "bg-[#eaf3e8] text-[#26432e]" : "text-[#647466] hover:bg-[#f2f7f1] hover:text-[#26432e]"
              }`}
            >
              <span className="relative z-20">{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="hidden xl:block"><HeaderUserActions /></div>

        <button
          type="button"
          className="rounded-lg p-2 text-[#26432e] hover:bg-[#f2f7f1] xl:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <nav aria-label="Mobile navigation" className="absolute left-0 top-[68px] flex w-full flex-col gap-2 border-b border-[#e3eae2] bg-white px-6 py-6 shadow-[0_16px_32px_rgba(29,42,34,0.08)] xl:hidden">
          {navLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              aria-current={activeTab === link.id ? "page" : undefined}
              className={`rounded-lg px-4 py-3 text-left text-[15px] font-semibold ${activeTab === link.id ? "bg-[#eaf3e8] text-[#26432e]" : "text-[#647466]"}`}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <hr className="my-2 border-[#e3eae2]" />
          <HeaderUserActions mobile onNavigate={() => setMobileOpen(false)} />
        </nav>
      )}
    </header>
  );
}
