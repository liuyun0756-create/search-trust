import React from 'react';
import { Target, BarChart3, Bot, Filter } from 'lucide-react';

const reasons = [
  {
    icon: Target,
    title: "Ranking Inconsistency",
    desc: "In local SEO, pages often look optimized but still fail to rank or hold visibility.",
  },
  {
    icon: BarChart3,
    title: "Metrics Overload, Insight Scarcity",
    desc: "Existing tools explain metrics, but not trust interpretation.",
  },
  {
    icon: Bot,
    title: "Generic Content Saturation",
    desc: "AI–generated local pages have made generic, scalable content cheap.",
  },
  {
    icon: Filter,
    title: "Trust as the Real Filter",
    desc: "As a result, trust has become the true separator of quality.",
  }
];

export function WhyFrameworkExists() {
  return (
    <section className="pt-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* 居中标题 */}
        <div className="text-center mb-8">
          <h2 className="text-[36px] md:text-[42px] font-bold text-[#1A1F2B]">
            Why this <span className="text-bar-highlight">framework</span> exists
          </h2>
        </div>

        {/* 竖向列表 */}
        <div className="max-w-3xl mx-auto space-y-6">
          {reasons.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-6"
            >
              {/* 圆形图标 */}
              <div className="shrink-0 w-10 h-10 rounded-full bg-[#F0F5E0] flex items-center justify-center">
                <item.icon size={20} strokeWidth={1.5} className="text-[#A5D020]" />
              </div>

              {/* 标题文字 */}
              <span className="text-[16px] font-bold text-[#1A1F2B]">
                {item.desc}
              </span>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
