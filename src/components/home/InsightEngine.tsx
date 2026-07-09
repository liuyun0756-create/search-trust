"use client";

// InsightEngine: 首页"为什么页面优化了却不排名"的三卡片洞察区块
export function InsightEngine() {
  const cards = [
    {
      name: "SEO Agencies",
      role: "Local SEO Specialist",
      title: "They look optimised — but don't rank",
      desc: "Local pages with correct NAP data, keyword-rich content, and clean markup still underperform. The missing variable isn't visible in a standard audit.",
    },
    {
      name: "Sophia Martinez",
      role: "Digital Marketing Expert",
      title: "The gap is trust, not information",
      desc: "Local competition depends on trust signals such as entity consistency, evidence, citations, and real-world context. Most tools ignore the structure behind those signals.",
    },
    {
      name: "Emma Wilson",
      role: "Digital Marketing Expert",
      title: "Performance scores hide the real problem",
      desc: "A 94 PageSpeed score on a page Google won't trust is noise. Measurement without diagnosis wastes months of effort and budget.",
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* 标题部分 */}
        <div className="text-center mb-16">
          <h2 className="text-[32px] md:text-[42px] font-[700] text-[#1A1F2B] leading-tight max-w-3xl mx-auto">
            A way to explain why a local page feels{" "}
            <span className="text-bar-highlight">optimized but still doesn’t rank</span>
          </h2>
          <div className="section-title-bar" />
        </div>

        {/* 三个卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {cards.map((card, index) => (
            <div 
              key={index} 
              className="bg-[#F8F9FA] rounded-[24px] p-8 border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
            >
              {/* 人物信息区域 */}
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                 <img src={`/images/user${index + 1}.png`} alt={card.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-[15px] font-bold text-[#1A1F2B]">{card.name}</p>
                  <span className="inline-block px-2 py-0.5 mt-1 text-[11px] font-medium text-[#6B7280] border border-gray-200 rounded-md bg-white">
                    {card.role}
                  </span>
                </div>
              </div>

              {/* 内容 */}
              <h3 className="text-[18px] font-bold text-[#1A1F2B] mb-4 leading-snug">
                {card.title}
              </h3>
              <p className="text-[14px] leading-relaxed text-[#6B7280]">
                {card.desc}
              </p>
            </div>
          ))}
        </div>

        {/* 底部引用区块 */}
        {/* <div className="rounded-[18px] border border-[#A5D020]/30 bg-[#A5D020]/5 p-8 md:p-10">
          <div className="max-w-7xl">
            <p className="text-[18px] md:text-[20px] font-bold text-[#1A1F2B] leading-relaxed">
              &quot;Most SEO tools measure performance. They don&apos;t explain trust failure — and that&apos;s the gap SearchTrust was built to close.&quot;
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="w-6 h-[1px] bg-gray-400"></span>
              <span className="text-[14px] text-[#6B7280] font-medium italic">
                SearchTrust founding insight
              </span>
            </div>
          </div>
        </div> */}

      </div>
    </section>
  );
};
