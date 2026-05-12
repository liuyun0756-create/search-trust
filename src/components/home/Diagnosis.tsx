import React from 'react';

const diagnosisFeatures = [
  {
    id: "1",
    title: "Single-Page Trust Diagnosis",
    desc: "Evaluate whether a page looks like a real local business entry point.",
  },
  {
    id: "2",
    title: "Trust Layer Mapping",
    desc: "See which trust layer is holding the page back most.",
  },
  {
    id: "3",
    title: "Programmatic Risk Detection",
    desc: "Spot signals that make a page look templated, doorway-like, or low-value.",
  },
  {
    id: "4",
    title: "Real-World Anchor Analysis",
    desc: "Detect whether the page is grounded in place, service context, and reality.",
  },
  {
    id: "5",
    title: "Entity Consistency Checks",
    desc: "Understand whether page claims align with business identity and local signals.",
  },
  {
    id: "6",
    title: "Lowest-Cost Fix Suggestions",
    desc: "Get specific, minimal actions to improve trust without rewriting everything.",
  }
];

export function Diagnosis() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* 背景容器 - 带有淡绿色渐变和纹理感 */}
        <div className="relative w-full rounded-[32px] overflow-hidden bg-[#EBF5D7] p-10 md:p-16 lg:p-20">

          {/* 背景图 */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: "url('/images/diagnosis-bg.png')",
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
          {/* 装饰性背景光晕 */}
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            
            {/* 左侧标题区域 */}
            <div className="lg:col-span-4">
              <h2 className="text-[32px] md:text-[40px] font-bold text-[#1A1F2B] leading-[1.1] tracking-tight">
                Built for trust diagnosis, not just page scoring
              </h2>
            </div>

            {/* 右侧卡片网格区域 */}
            <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              {diagnosisFeatures.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white/60 backdrop-blur-md rounded-2xl p-6 border border-white/40 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition-all hover:bg-white/80"
                >
                  <h3 className="text-[15px] font-bold text-[#1A1F2B] mb-2 flex items-start gap-2">
                    <span className="opacity-60">{item.id}.</span>
                    {item.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-gray-500 font-medium pl-5">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}