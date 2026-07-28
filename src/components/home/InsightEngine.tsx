"use client";

import { FileCheck2, Route, ScanSearch } from "lucide-react";

export function InsightEngine() {
  const cards = [
    {
      eyebrow: "Surface audit",
      title: "A page can pass common checks and still underperform",
      desc: "Keywords, contact details, and clean markup do not explain whether the page has enough entity consistency, evidence, and page-specific value.",
      icon: FileCheck2,
    },
    {
      eyebrow: "Trust diagnosis",
      title: "The missing context is often structural",
      desc: "SearchTrust separates foundation, entity signals, local specificity, real-world connection, accountability, and standalone value.",
      icon: ScanSearch,
    },
    {
      eyebrow: "Implementation planning",
      title: "A useful audit must show what to repair first",
      desc: "The report turns confirmed findings into actions and a staged roadmap so later improvements do not distract from an earlier blocker.",
      icon: Route,
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* 标题部分 */}
        <div className="text-center mb-16">
          <h2 className="text-[32px] md:text-[42px] font-[700] text-[#1A1F2B] leading-tight max-w-3xl mx-auto">
            A way to explain why a local page feels{" "}
            <span className="text-bar-highlight">optimized but still doesn’t rank</span>
          </h2>
          <div className="section-title-bar" />
        </div>

        {/* 三个卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {cards.map((card) => (
            <div 
              key={card.eyebrow}
              className="bg-[#F8F9FA] rounded-[24px] p-8 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EDF5D4] text-[#789B11]">
                  <card.icon size={19} strokeWidth={1.8} aria-hidden="true" />
                </div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#7B8495]">{card.eyebrow}</p>
              </div>

              <h3 className="text-[18px] font-bold text-[#1A1F2B] mb-4 leading-snug">
                {card.title}
              </h3>
              <p className="text-[14px] leading-relaxed text-[#6B7280]">
                {card.desc}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
