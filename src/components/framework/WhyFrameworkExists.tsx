import React from 'react';
import { Target, BarChart3, Bot, Filter } from 'lucide-react'; // 引入符合Tech风格的图标

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
    isHighlight: true // 最后一项作为核心结论高亮
  }
];

export function WhyFrameworkExists() {
  return (
    <section className="py-28 md:py-36 bg-white overflow-hidden">
      <div className="container mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24 items-start">
          
          {/* 左侧标题区域 */}
          <div className="lg:col-span-5 lg:sticky lg:top-24">
            <h2 className="text-[40px] md:text-[52px] font-bold text-[#0B0C0E] leading-[1.1] tracking-tight">
              Why this <br className="hidden md:block" /> framework exists
            </h2>
            <div className="w-16 h-1.5 bg-[#A5D020] mt-8 rounded-full" /> {/* 品牌色装饰线 */}
          </div>

          {/* 右侧列表区域 (极简Tech风格优化) */}
          <div className="lg:col-span-7 space-y-12">
            {reasons.map((item, index) => (
              <div key={index} className="flex items-start gap-8 group">
                
                {/* 图标区域 - 替换原型图中的灰色方块 */}
                <div className="relative mt-1.5 shrink-0 flex items-center justify-center">
                  {/* 图标背景光晕 (微交互) */}
                  <div className="absolute inset-0 bg-[#A5D020]/20 blur-xl rounded-full scale-0 group-hover:scale-150 transition-transform duration-500" />
                  
                  {/* 品牌绿图标 */}
                  <div className="relative z-10">
                    <item.icon 
                      size={24} 
                      strokeWidth={1.5} 
                      className="text-[#A5D020] opacity-90" 
                    />
                  </div>
                </div>

                {/* 文字内容 */}
                <div className="flex-1 flex flex-col gap-2">
                  <h3 className={`text-[18px] font-bold leading-tight ${
                    item.isHighlight ? "text-[#0B0C0E]" : "text-gray-800"
                  }`}>
                    {item.title}
                  </h3>
                  <p className={`text-[15px] md:text-[16px] leading-relaxed ${
                    item.isHighlight 
                      ? "text-[#0B0C0E] font-medium" 
                      : "text-gray-600"
                  }`}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}