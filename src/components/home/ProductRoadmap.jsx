"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';

const roadmapPhases = [
  {
    phase: "Phase 1",
    title: "Single–page trust diagnosis",
    desc: "Explain why client pages lose trust, not just rankings.",
    active: true,
  },
  {
    phase: "Phase 2",
    title: "Entity consistency analysis",
    desc: "Explain why client pages lose trust, not just rankings.",
    active: false,
  },
  {
    phase: "Phase 3",
    title: "Trust Radar",
    desc: "Visual scoring, comparison, trends, and reporting",
    active: false,
  },
  {
    phase: "Phase 4",
    title: "AI citation readiness",
    desc: "Evaluate whether the page is ready to be cited in AI Overviews",
    active: false,
  }
];

export function ProductRoadmap() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* 顶部标题 */}
        <div className="text-center mb-16">
          <h2 className="text-[36px] md:text-[42px] font-bold text-[#1A1F2B]">
            Where the product is <span className="text-bar-highlight">going</span>
          </h2>
          <p className="mt-6 text-[16px] text-gray-500 font-medium">
            Built to move from page trust diagnosis to search trust intelligence.
          </p>
        </div>

        {/* 路线图卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {roadmapPhases.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -8, transition: { duration: 0.25 } }}
              onClick={() => setActiveIndex(index)}
              className={`relative overflow-hidden rounded-[24px] p-8 min-h-[320px] flex flex-col justify-end border cursor-pointer ${
                activeIndex === index
                ? 'bg-[#F2F8DE] border-[#A5D020]/60 shadow-[0_18px_48px_rgba(165,208,32,0.18)]'
                : 'bg-[#F8F9FA] border-gray-100 hover:shadow-lg hover:border-gray-200'
              } focus:outline-none`}
            >
              {activeIndex === index && (
                <div className="absolute inset-x-0 top-0 h-1.5 bg-[#A5D020]" />
              )}

              {/* 卡片背景装饰纹理 */}
              {activeIndex !== index && (
                <div className="absolute top-0 right-0 w-full h-full opacity-[0.03] pointer-events-none">
                  <svg width="100%" height="100%" viewBox="0 0 200 200">
                    <circle cx="200" cy="100" r="80" fill="none" stroke="black" strokeWidth="1" />
                    <circle cx="200" cy="100" r="60" fill="none" stroke="black" strokeWidth="1" />
                    <circle cx="200" cy="100" r="40" fill="none" stroke="black" strokeWidth="1" />
                  </svg>
                </div>
              )}

              {/* 顶部 Phase 标签 */}
              <div className="absolute top-8 left-8">
                <span className={`px-4 py-1.5 rounded-full text-[12px] font-bold tracking-wide ${
                  activeIndex === index
                  ? 'bg-white text-[#6E9800] ring-1 ring-[#A5D020]/30'
                  : 'bg-[#A5D020] text-white'
                }`}>
                  {item.phase}
                </span>
              </div>

              {/* 底部文字内容 */}
              <div className="relative z-10">
                <h3 className={`text-[20px] font-bold mb-3 leading-tight ${
                  activeIndex === index ? 'text-[#1A1F2B]' : 'text-[#1A1F2B]'
                }`}>
                  {item.title}
                </h3>
                <p className={`text-[14px] leading-relaxed font-medium ${
                  activeIndex === index ? 'text-[#526236]' : 'text-gray-500'
                }`}>
                  {item.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
