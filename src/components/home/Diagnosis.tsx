import React from 'react';
import { Crosshair, Layers3, ScanSearch, MapPinned, Building2, Wrench } from 'lucide-react';

const diagnosisFeatures = [
  {
    id: "1",
    title: "Single-Page Trust Diagnosis",
    desc: "Evaluate whether a page looks like a real local business entry point.",
    icon: Crosshair,
  },
  {
    id: "2",
    title: "Trust Layer Mapping",
    desc: "See which trust layer is holding the page back most.",
    icon: Layers3,
  },
  {
    id: "3",
    title: "Programmatic Risk Detection",
    desc: "Spot signals that make a page look templated, doorway-like, or low-value.",
    icon: ScanSearch,
  },
  {
    id: "4",
    title: "Real-World Anchor Analysis",
    desc: "Detect whether the page is grounded in place, service context, and reality.",
    icon: MapPinned,
  },
  {
    id: "5",
    title: "Entity Consistency Checks",
    desc: "Understand whether page claims align with business identity and local signals.",
    icon: Building2,
  },
  {
    id: "6",
    title: "Lowest-Cost Fix Suggestions",
    desc: "Get specific, minimal actions to improve trust without rewriting everything.",
    icon: Wrench,
  }
];

export function Diagnosis() {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* 背景容器 */}
        <div className="relative w-full rounded-[32px] overflow-hidden bg-[#F8FAF5] p-10 md:p-16 lg:p-20 border border-gray-100 shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#A5D020]/35 to-transparent pointer-events-none" />
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#A5D020]/10 blur-[100px] pointer-events-none" />
          <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#A5D020]/8 blur-[110px] pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* 左侧标题区域 */}
            <div className="lg:col-span-4">
              <h2 className="text-[32px] md:text-[40px] font-bold text-[#1A1F2B] leading-[1.1] tracking-tight">
                Built for trust diagnosis, not just page scoring
              </h2>
              <div className="mt-6 h-1.5 w-[72px] rounded-full bg-[#A5D020]" />
            </div>

            {/* 右侧卡片网格区域 */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {diagnosisFeatures.map((item) => (
                <div 
                  key={item.id} 
                  className="group relative overflow-hidden bg-white/78 backdrop-blur-md rounded-2xl p-6 border border-white/70 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]"
                >
                  <div className="absolute inset-x-0 top-0 h-1 bg-[#A5D020]" />
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F0F5E0] text-[#7FA40F] shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition-transform duration-300 group-hover:scale-105">
                      <item.icon size={19} strokeWidth={1.8} />
                    </div>
                    <div>
                      <h3 className="mb-2 text-[15px] font-bold text-[#1A1F2B] leading-snug">
                        <span className="mr-1.5 text-[13px] font-black text-[#7FA40F]">{item.id}.</span>
                        {item.title}
                      </h3>
                      <p className="text-[13px] leading-relaxed text-gray-500 font-medium">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}
