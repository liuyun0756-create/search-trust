"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RunAuditButton } from "@/components/common/RunAuditButton";

const visiblePaths = new Set(["/", "/framework", "/sample-report", "/use-cases", "/pricing"]);

export function FooterPreCTA() {
  const pathname = usePathname();

  if (!visiblePaths.has(pathname)) return null;

  return (
    <section className="bg-white px-4 py-14 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] border border-[#A5D020]/20 bg-[#F7F9F2] px-8 py-12 shadow-[0_18px_50px_rgba(15,23,42,0.05)] md:px-12 lg:px-16">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(165,208,32,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(26,31,43,0.04)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#A5D020]/20 blur-[110px]" />

        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl lg:min-w-[680px]">
            <div className="mb-5 h-1.5 w-20 rounded-full bg-[#A5D020]" />
            <h2 className="text-[34px] font-bold leading-[1.18] tracking-tight text-[#1A1F2B] md:text-[42px]">
              <span className="block lg:whitespace-nowrap">Stop guessing why pages don&apos;t rank</span>
              <span className="block lg:whitespace-nowrap">See where trust breaks.</span>
            </h2>
            <p className="mt-6 max-w-3xl text-[18px] font-medium leading-relaxed tracking-normal text-[#4B5563] md:text-[20px]">
              Run a trust audit to see which signals are supported by evidence, where trust needs attention, and what to fix first.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
            <RunAuditButton className="rounded-xl bg-[#1A1F2B] px-8 py-4 text-[16px] font-bold tracking-normal text-white shadow-[0_12px_26px_rgba(26,31,43,0.18)] transition-colors hover:bg-black">
              Run a Trust Audit
            </RunAuditButton>
            <Link
              href="/sample-report"
              className="rounded-xl border border-[#1A1F2B]/15 bg-white/70 px-8 py-4 text-center text-[16px] font-bold tracking-normal text-[#1A1F2B] transition-colors hover:border-[#A5D020]/60 hover:bg-white"
            >
              View Sample Report
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
