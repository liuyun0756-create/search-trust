"use client";

import { Network, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

export function LocalPage() {
  const features = [
    {
      title: "AI city page explosion",
      description: "AI-generated city pages are everywhere. Most look scalable, not believable",
      icon: Sparkles,
    },
    {
      title: "Google is stricter",
      description: "Google is increasingly cautious about doorway-like local pages and template-based service pages",
      icon: ShieldCheck,
    },
    {
      title: "Entity-based local search",
      description: "Local visibility depends on more than on-page content — GBP, entity consistency, UGC, and real-world anchors matter.",
      icon: Network,
    },
    {
      title: "Ranking is no longer enough",
      description: "Pages now compete not only for rankings, but for trust, citation eligibility, and local entity recognition",
      icon: TrendingUp,
    }
  ];

  return (
    <section className="py-20 bg-[#FAFAFA] overflow-hidden">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* 顶部文案 */}
        <div className="text-center mb-20">
          <h2 className="text-[36px] md:text-[44px] font-[700] text-[#1A1F2B] leading-[1.2]">
            Local pages don’t fail because they lack content <br />
            They fail because Google doesn’t trust them
          </h2>
          <div className="section-title-bar" />
          <p className="mt-6 text-[#6B7280] text-[16px] md:text-[18px] max-w-4xl mx-auto font-medium">
            AI-generated city pages are exploding, but Google is getting stricter about templated, low-value, and weakly grounded local pages
          </p>
        </div>

        {/* 左图右内容 */}
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-16 max-w-7xl mx-auto items-stretch px-4">
          <div className="min-h-[420px] rounded-[28px] bg-white relative overflow-hidden shadow-[0_18px_50px_rgba(15,23,42,0.08)] ring-1 ring-gray-100">
            <img
              src="/images/local-trust-problem-summary.svg"
              alt="Local page trust problem summary"
              className="h-full w-full object-cover object-left-top"
            />
          </div>

          <div className="flex flex-col justify-between gap-9 py-2">
            {features.map((item) => (
              <div key={item.title}>
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F0F5E0] text-[#7FA40F] shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                    <item.icon size={19} strokeWidth={1.8} />
                  </div>
                  <h3 className="text-[26px] md:text-[30px] font-bold text-[#111827] tracking-tight">
                    {item.title}
                  </h3>
                </div>
                <p className="text-[18px] md:text-[20px] leading-relaxed text-[#111827] font-normal">
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
