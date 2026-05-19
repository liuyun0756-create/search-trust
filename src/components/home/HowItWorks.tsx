"use client";
import { Check } from 'lucide-react';

export function HowItWorks() {
  return (
    <section className="py-20 bg-white overflow-hidden">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* 顶部标题区域 */}
        <div className="text-center mb-20">
          <h2 className="text-[36px] md:text-[44px] font-[700] text-[#1A1F2B] leading-[1.2] mb-6">
            Most SEO tools measure performance <br />
            They don’t explain trust failure
          </h2>
          <p className="text-[#6B7280] text-[15px] md:text-[16px] max-w-4xl mx-auto font-medium">
            Traditional SEO tools tell you what changed Search Trust tells you why Google may still not trust the page.
          </p>
        </div>

        {/* 对比卡片区域 */}
        <div className="relative max-w-5xl mx-auto ">

          {/* 卡片行 */}
          <div className="flex flex-col md:flex-row items-center">

            {/* 左侧卡片 - 现有工具 */}
            <div className="w-full md:w-[500px] bg-[#F8F9FA] rounded-[24px] p-10 md:px-14 md:py-10 md:pr-24 z-10 border border-gray-100">
              <h3 className="text-[18px] font-bold text-[#1A1F2B] mb-8">
                What existing tools give you
              </h3>
              <ul className="space-y-5">
                {['Rankings', 'Traffic', 'Backlinks', 'Crawl issues', 'Content scores'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-[#6B7280] text-[15px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 右侧卡片 - Search Trust */}
            <div className="w-full md:w-[520px] bg-[#1A1F2B] rounded-[24px] p-10 md:p-14 md:pl-20 z-20 md:-ml-12 shadow-[0_30px_60px_rgba(0,0,0,0.15)]">
              <h3 className="text-[18px] font-bold text-white mb-8">
                What Search Trust gives you
              </h3>
              <ul className="space-y-5">
                {[
                  'Trust collapse diagnosis',
                  'Programmatic / doorway risk clues',
                  'Local specificity analysis',
                  'Real-world anchor weakness',
                  'Likely Google interpretation',
                  'Lowest-cost fixes first'
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-200 text-[16px] font-medium">
                    <Check size={18} className="text-[#A5D020] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

          </div>

          {/* VS 标签 — 独立层，相对于外层容器定位 */}
          <div className="absolute left-1/2 top-1/2 -translate-x-[90px] -translate-y-1/2 z-30 hidden md:flex">
            <div className="w-16 h-16 rounded-full bg-[#A5D020] flex items-center justify-center shadow-[0_0_30px_rgba(165,208,32,0.4)] border-[6px] border-white">
              <span className="text-white font-black text-[18px] tracking-tighter italic">VS</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};

