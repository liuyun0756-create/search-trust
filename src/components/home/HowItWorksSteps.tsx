"use client";

import { FileText, Clock, CheckCircle2, MousePointer2 } from 'lucide-react';

const steps = [
  {
    icon: FileText,
    title: "Submit your page",
    desc: "Enter the page URL, page type, and optionally a GBP link.",
  },
  {
    icon: Clock,
    title: "Analyze trust signals",
    desc: "We scan structural patterns related to specificity, anchors, accountability, and page value.",
  },
  {
    icon: CheckCircle2,
    title: "Map the trust breakdown",
    desc: "Each issue is mapped to your page's dominant trust failure layer.",
  },
  {
    icon: MousePointer2,
    title: "Get actionable output",
    desc: "Receive a trust report with findings, likely Google interpretation, and lowest-cost next steps.",
  },
];

export function HowItWorksSteps() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* 标题部分 */}
        <div className="text-center mb-20">
          <h2 className="text-[40px] md:text-[48px] font-bold text-[#1A1F2B] tracking-tight">
            How it works
          </h2>
        </div>

        {/* 四列布局容器 */}
        <div className="grid grid-cols-1 md:grid-cols-4 border border-gray-100 rounded-[4px] overflow-hidden">
          {steps.map((s, i) => (
            <div
              key={i}
              className={`relative px-8 py-6 bg-white flex flex-col items-start transition-colors hover:bg-gray-50/50 
                ${i !== steps.length - 1 ? 'border-b md:border-b-0 md:border-r border-gray-100' : ''}`}
            >
              {/* 右上角超大数字背景 */}
              <span className="absolute top-3 right-8 text-[48px] font-bold text-[#E1E7ED] leading-none select-none pointer-events-none">
                {i + 1}
              </span>

              {/* 图标 - 品牌色，无背景框 */}
              <div className="mb-4 relative z-10">
                <s.icon size={24} strokeWidth={1.5} className="text-[#A5D020]" />
              </div>

              {/* 内容区域 */}
              <div className="relative z-10">
                <h3 className="text-[18px] font-bold text-[#1A1F2B] mb-4">
                  {s.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-gray-500 font-medium">
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}