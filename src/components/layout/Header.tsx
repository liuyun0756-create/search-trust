"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { motion } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { RunAuditButton } from "@/components/common/RunAuditButton";
import { UserDropdown } from "./UserDropdown";

const navLinks = [
  { id: "home", href: "/", label: "Home" },
  { id: "framework", href: "/framework", label: "Framework" },
  { id: "report", href: "/sample-report", label: "Sample Report" },
  // { id: "reports", href: "/reports", label: "My Reports" },
  { id: "use-cases", href: "/use-cases", label: "Use Cases" },
  { id: "pricing", href: "/pricing", label: "Pricing" },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isSignedIn } = useUser();
  const isAuthenticated = isSignedIn;

  if (pathname === "/sample-case" || pathname === "/reports" || pathname === "/policy") return null;

  const activeTab = navLinks.find(l => l.href === pathname)?.id ?? "home";

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-50">
      <div className="mx-auto flex h-[72px] items-center justify-between px-6">

        <div className="flex items-center min-w-[150px]">
          <div className="flex items-center gap-2">
            <img src="/images/logo.png" alt="" className="h-6 md:h-8 w-auto" />
          </div>
        </div>

        <nav className="hidden md:flex items-center bg-white p-1 relative">
          {navLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className={`relative px-5 py-2 text-[14px] font-bold transition-colors duration-200 z-10 ${
                activeTab === link.id ? "text-[#1D2531]" : "text-[#657083] hover:text-[#1D2531]"
              }`}
            >
              {activeTab === link.id && (
                <motion.div
                  layoutId="activeTabBackground"
                  className="absolute inset-0 bg-[#E7EDF2] rounded-[8px]"
                  transition={{ type: "tween", duration: 0.2 }}
                />
              )}
              <span className="relative z-20">{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-6">
          {isAuthenticated ? (
            <UserDropdown />
          ) : (
            <Link
              href="/sign-in"
              className="text-[14px] font-bold text-[#1D2531] hover:opacity-70 transition-opacity"
            >
              Sign In1
            </Link>
          )}
          <RunAuditButton className="rounded-full bg-[#1D2531] px-6 py-2.5 text-[14px] font-bold text-white transition-all hover:bg-black">
            Run a Trust Audit
          </RunAuditButton>
        </div>

        <button className="md:hidden p-2 text-[#1D2531]" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="absolute top-[72px] left-0 w-full bg-white border-b border-gray-100 px-6 py-6 flex flex-col gap-4 md:hidden shadow-xl">
          {navLinks.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className={`text-left text-[16px] font-bold ${activeTab === link.id ? "text-[#1D2531]" : "text-[#657083]"}`}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <hr className="border-gray-100 my-2" />
          {isAuthenticated ? (
            <UserDropdown />
          ) : (
            <Link href="/sign-in" className="text-left text-[16px] font-bold text-[#1D2531]" onClick={() => setMobileOpen(false)}>Sign In</Link>
          )}
          <RunAuditButton className="w-full rounded-full bg-[#1D2531] py-4 text-[16px] font-bold text-white">
            Run a Trust Audit
          </RunAuditButton>
        </div>
      )}
    </header>
  );
}
