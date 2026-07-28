"use client";

import { CheckCircle2, XCircle } from "lucide-react";

const isItems = [
  "A fixed L1-L8 trust diagnosis for one local page",
  "A source-traceable record of confirmed findings",
  "An implementation roadmap ordered by trust-layer dependency",
  "An Agency Audit with a separate client-ready delivery format",
  "A supplemental Business Presence review when public data is available",
];

const isNotItems = [
  "Not a rank tracker",
  "Not a GBP management tool",
  "Not a full technical SEO crawler",
  "Not a generic content score",
  "Not a ranking promise",
];

export function ProductDefinition() {
  return (
    <section className="bg-white py-20 overflow-hidden">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-[34px] md:text-[44px] font-bold text-[#1A1F2B] leading-[1.16] tracking-tight">
              What SearchTrust <span className="text-bar-highlight">is</span> and what it is not
            </h2>
            <div className="section-title-bar" />
            <p className="mx-auto mt-6 max-w-2xl text-[15px] md:text-[16px] font-medium leading-relaxed text-[#657083]">
              SearchTrust is a page-level audit and delivery system for local SEO work. Its supplemental Business Presence section supports one-time proposal scoping without changing the L1-L8 score.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="relative overflow-hidden rounded-[24px] border border-gray-100 bg-[#FBFCF7] p-8 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-[#A5D020]" />
              <div className="mb-7 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F0F5E0] text-[#7FA40F]">
                  <CheckCircle2 size={21} strokeWidth={1.8} />
                </div>
                <h3 className="text-[22px] font-bold text-[#1A1F2B]">
                  What SearchTrust is
                </h3>
              </div>
              <ul className="space-y-4">
                {isItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] font-medium leading-relaxed text-[#4B5563]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A5D020]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative overflow-hidden rounded-[24px] border border-gray-100 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-[#1A1F2B]" />
              <div className="mb-7 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gray-100 text-[#1A1F2B]">
                  <XCircle size={21} strokeWidth={1.8} />
                </div>
                <h3 className="text-[22px] font-bold text-[#1A1F2B]">
                  What SearchTrust is not
                </h3>
              </div>
              <ul className="space-y-4">
                {isNotItems.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[15px] font-medium leading-relaxed text-[#4B5563]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
