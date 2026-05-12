import React from 'react';
import { Eye, FileSearch, ShieldCheck, PenTool } from 'lucide-react';

const auditUseCases = [
  {
    icon: ShieldCheck,
    title: "Audit local pages before publishing",
    desc: "Catch trust gaps before a city page goes live",
  },
  {
    icon: FileSearch,
    title: "Diagnose ranking stagnation",
    desc: "Understand why a page is indexed but still not gaining visibility.",
  },
  {
    icon: Eye,
    title: "Review AI-generated city pages",
    desc: "Reduce the risk of scaled local pages being treated as spam or doorway content.",
  },
  {
    icon: PenTool,
    title: "Improve client reporting",
    desc: "Give agencies a clearer way to explain what's structurally wrong and what to fix first",
  }
];

export function AuditSection() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* 顶部标题区域 */}
        <div className="text-center mb-16">
          <h2 className="text-[32px] md:text-[42px] font-bold text-[#1A1F2B] mb-4">
            How teams use Search Trust
          </h2>
          <p className="text-[28px] md:text-[36px] font-bold text-[#1A1F2B]">
            Audit local pages before publishing
          </p>
        </div>

        {/* 2x2 功能网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {auditUseCases.map((useCase, index) => (
            <div 
              key={index}
              className="bg-[#F8F9FA] rounded-[20px] p-10 flex items-start gap-8 transition-all hover:shadow-sm"
            >
              {/* 图标容器 */}
              <div className="mt-1">
                <useCase.icon 
                  size={24} 
                  strokeWidth={1.5} 
                  className="text-[#A5D020]" 
                />
              </div>

              {/* 文字内容 */}
              <div className="flex flex-col gap-2">
                <h3 className="text-[18px] font-bold text-[#1A1F2B]">
                  {useCase.title}
                </h3>
                <p className="text-[14px] leading-relaxed text-gray-500 font-medium">
                  {useCase.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}