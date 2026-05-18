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
    <section className="py-24 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* 顶部标题区域 */}
        <div className="text-center mb-16">
          <h2 className="text-[32px] md:text-[42px] font-bold text-[#1A1F2B] mb-4">
            Why this framework exists
          </h2>
        </div>

        {/* 2x2 功能网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {reasons.map((item, index) => (
            <div
              key={index}
              className="bg-[#F8F9FA] rounded-[20px] p-8 flex items-start gap-6 transition-all hover:shadow-sm"
            >
              {/* 图标容器 */}
              <div className="mt-1">
                <item.icon
                  size={24}
                  strokeWidth={1.5}
                  className="text-[#A5D020]"
                />
              </div>

              {/* 文字内容 */}
              <div className="flex flex-col gap-2">
                <h3 className="text-[18px] font-bold text-[#1A1F2B]">
                  {item.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-gray-500 font-medium">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
