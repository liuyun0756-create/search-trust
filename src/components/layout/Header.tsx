"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { HeaderUserActions } from "./HeaderUserActions";
import { marketingNavigation } from "./marketing-navigation";

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

  const activeTab = marketingNavigation.find((link) => link.href === pathname)?.id;

  return (
    <header className="sticky top-0 z-50 border-b border-[#e3eae2] bg-white/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center justify-between px-5 sm:px-8">

        <Link href="/" aria-label="SearchTrust home" className="flex min-w-[150px] items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#86a91b]">
          <img src="/images/logo.png" alt="SearchTrust" className="h-6 w-auto md:h-8" />
        </Link>

        <nav aria-label="Primary navigation" className="relative hidden items-center gap-1 xl:flex">
          {marketingNavigation.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <Link
                key={link.id}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative z-10 rounded-lg px-4 py-2 text-[13px] transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#86a91b] motion-reduce:transition-none ${
                  isActive
                    ? "bg-[#e8f3e5] font-bold text-[#1b3b29] ring-1 ring-inset ring-[#cde1c6]"
                    : "font-semibold text-[#647466] hover:bg-[#f2f7f1] hover:text-[#26432e]"
                }`}
              >
                <span className="relative z-20">{link.label}</span>
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-[3px] left-4 right-4 h-[3px] rounded-full bg-[#90bb28]"
                  />
                ) : null}
              </Link>
            );
          })}
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
          {marketingNavigation.map((link) => {
            const isActive = activeTab === link.id;
            return (
              <Link
                key={link.id}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative rounded-lg px-4 py-3 text-left text-[15px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#86a91b] ${
                  isActive
                    ? "bg-[#e8f3e5] font-bold text-[#1b3b29]"
                    : "font-semibold text-[#647466] hover:bg-[#f2f7f1] hover:text-[#26432e]"
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-[#90bb28]"
                  />
                ) : null}
                {link.label}
              </Link>
            );
          })}
          <hr className="my-2 border-[#e3eae2]" />
          <HeaderUserActions mobile onNavigate={() => setMobileOpen(false)} />
        </nav>
      )}
    </header>
  );
}
