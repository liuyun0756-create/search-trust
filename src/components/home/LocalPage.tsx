"use client";

import { FileSearch, Network, ShieldCheck, Workflow } from "lucide-react";

export function LocalPage() {
  const features = [
    {
      title: "Reusable local copy",
      description: "A page can cover the service correctly and still lack the page-specific detail that makes it a distinct local asset.",
      icon: FileSearch,
    },
    {
      title: "Weak entity signals",
      description: "Business identity, contact details, and public profile data may be incomplete or inconsistent across checked sources.",
      icon: ShieldCheck,
    },
    {
      title: "Missing real-world proof",
      description: "Local claims are harder to evaluate when the page lacks concrete work, accountable details, and verifiable context.",
      icon: Network,
    },
    {
      title: "Unclear repair order",
      description: "Teams often add more copy before stabilizing earlier trust layers, which can create work without resolving the main blocker.",
      icon: Workflow,
    }
  ];

  return (
    <section className="py-20 bg-[#FAFAFA] overflow-hidden">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* 顶部文案 */}
        <div className="text-center mb-20">
          <h2 className="text-[36px] md:text-[44px] font-[700] text-[#1A1F2B] leading-[1.2]">
            A local page can look complete <br />
            and still have unresolved trust gaps
          </h2>
          <div className="section-title-bar" />
          <p className="mt-6 text-[#6B7280] text-[16px] md:text-[18px] max-w-4xl mx-auto font-medium">
            SearchTrust separates content volume from evidence, entity consistency, real-world grounding, and page-specific value.
          </p>
        </div>

        {/* 左图右内容 */}
        <div className="grid grid-cols-1 lg:grid-cols-[500px_minmax(0,1fr)] gap-12 lg:gap-16 max-w-7xl mx-auto items-stretch px-4">
          <div className="flex min-h-[500px] w-full flex-col overflow-hidden rounded-[28px] bg-[#151922] p-7 shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-9">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#A5D020]">What the audit separates</p>
            <h3 className="mt-3 max-w-sm text-[27px] font-extrabold leading-tight text-white">
              Content volume is only one part of local page trust
            </h3>
            <div className="mt-8 grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ["Page signals", "Service intent, structure, specificity, and page-unique value"],
                ["Entity signals", "Presence and consistency across the checked business data"],
                ["Evidence", "Observed values, missing signals, and source limitations"],
                ["Repair order", "The earliest affected layer and the phases that should follow"],
              ].map(([title, description], index) => (
                <div key={title} className="min-h-[142px] border border-white/10 bg-white/[0.04] p-4">
                  <span className="text-[10px] font-extrabold text-[#A5D020]">0{index + 1}</span>
                  <p className="mt-3 text-[15px] font-bold text-white">{title}</p>
                  <p className="mt-2 text-[12px] font-medium leading-5 text-gray-400">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex h-auto flex-col justify-between gap-6 py-1 lg:h-[500px]">
            {features.map((item) => (
              <div key={item.title}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F0F5E0] text-[#7FA40F] shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                    <item.icon size={17} strokeWidth={1.8} />
                  </div>
                  <h3 className="text-[21px] md:text-[23px] font-bold text-[#111827] tracking-tight">
                    {item.title}
                  </h3>
                </div>
                <p className="text-[14px] md:text-[15px] leading-relaxed text-[#111827] font-normal">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
