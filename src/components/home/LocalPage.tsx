"use client";

import { Sparkles, ShieldCheck, Network, TrendingUp } from 'lucide-react';

export function LocalPage() {
  const features = [
    {
      title: "AI city page explosion",
      description: "AI-generated city pages are everywhere. Most look scalable, not believable",
      icon: <Sparkles size={20} className="text-[#A5D020]" />,
    },
    {
      title: "Google is stricter",
      description: "Google is increasingly cautious about doorway-like local pages and template-based service pages",
      icon: <ShieldCheck size={20} className="text-[#A5D020]" />,
    },
    {
      title: "Entity-based local search",
      description: "Local visibility depends on more than on-page content — GBP, entity consistency, UGC, and real-world anchors matter.",
      icon: <Network size={20} className="text-[#A5D020]" />,
    },
    {
      title: "Ranking is no longer enough",
      description: "Pages now compete not only for rankings, but for trust, citation eligibility, and local entity recognition",
      icon: <TrendingUp size={20} className="text-[#A5D020]" />,
    }
  ];

  return (
    <section className="py-24 bg-[#FAFAFA] overflow-hidden">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* 顶部文案 */}
        <div className="text-center mb-20">
          <h2 className="text-[36px] md:text-[44px] font-[700] text-[#1A1F2B] leading-[1.2] mb-6">
            Local pages don’t fail because they lack content <br />
            They fail because Google doesn’t trust them
          </h2>
          <p className="text-[#6B7280] text-[16px] md:text-[18px] max-w-4xl mx-auto font-medium">
            AI-generated city pages are exploding, but Google is getting stricter about templated, low-value, and weakly grounded local pages
          </p>
        </div>

        {/* 2x2 网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-16 max-w-6xl mx-auto px-4">
          {features.map((item, index) => (
            <div key={index} className="flex flex-col items-start group">
              {/* 图标容器 */}
              <div className="mb-6 relative">
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-50 group-hover:shadow-lg transition-shadow duration-300">
                  {item.icon}
                </div>
                {/* 图标背后的装饰微光 */}
                <div className="absolute -inset-2 bg-[#A5D020]/5 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* 文字内容 */}
              <h3 className="text-[18px] font-bold text-[#1A1F2B] mb-3">
                {item.title}
              </h3>
              <p className="text-[14px] leading-relaxed text-[#6B7280] font-medium opacity-90">
                {item.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

