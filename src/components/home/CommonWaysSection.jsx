import React from 'react';

const commonWays = [
  {
    tag: "SEO Agencies",
    text: "Explain trust–related ranking issues faster and with less manual analysis."
  },
  {
    tag: "Local SEO Specialists",
    text: "Validate whether city + service pages qualify as real local entity"
  },
  {
    tag: "Affiliate Marketers",
    text: "Detect scaled page risk before Google treats pages as spam or doorway content."
  },
  {
    tag: "Multi-location Businesses",
    text: "Check whether local pages are distinct, grounded, and entity–aligned across locations."
  }
];

export function CommonWaysSection() {
  return (
    <section className="py-20 bg-[#0B0C0E] overflow-hidden">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* 标题 */}
        <div className="text-center mb-16">
          <h2 className="text-[32px] md:text-[40px] font-bold text-white tracking-tight">
            Common ways teams use Search Trust
          </h2>
          <div className="section-title-bar" />
        </div>

        {/* 列表容器 */}
        <div className="max-w-5xl mx-auto space-y-4">
          {commonWays.map((item, index) => (
            <div 
              key={index}
              className="group relative flex flex-col md:flex-row items-center gap-6 p-1.5 rounded-[18px] bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm transition-all hover:bg-white/[0.06] hover:border-white/[0.15]"
            >
              {/* 左侧品牌色标签 */}
              <div className="shrink-0 w-full md:w-[220px] py-2 px-6 rounded-[14px] bg-[#A5D020] flex items-center justify-center">
                <span className="text-[13px] font-bold text-[#0B0C0E] whitespace-nowrap">
                  {item.tag}
                </span>
              </div>

              {/* 右侧描述文字 */}
              <div className="py-4 md:py-0 px-6 md:px-0 flex-1">
                <p className="text-[16px] md:text-[18px] font-medium text-gray-300 leading-relaxed">
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
