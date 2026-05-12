"use client";

import React from 'react';
import { motion } from 'framer-motion';

const collapseSteps = [
  { level: "L0", title: "Qualification", desc: "If a page fails qualification, deeper trust signals barely matter." },
  { level: "L1", title: "Specificity", desc: "If it passes qualification but lacks specificity, it begins to look templated." },
  { level: "L2", title: "Real-World Anchors", desc: "Without real-world anchors, local claims become weak." },
  { level: "L3", title: "Responsibility", desc: "Without responsibility, business legitimacy is unclear." },
  { level: "L4", title: "Standalone Value", desc: "Without standalone value, the page feels unnecessary." },
  { level: "L5", title: "Era Fit", desc: "Without era fit, it may be visible but not competitive." },
];

export function TrustCollapseFlow() {
  return (
    <section className="py-28 bg-[#0B0C0E] overflow-hidden relative">
      {/* 背景氛围灯光 */}
      <div className="absolute top-1/4 -left-20 w-[400px] h-[400px] bg-[#A5D020]/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-[400px] h-[400px] bg-[#A5D020]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="container mx-auto max-w-7xl px-6 lg:px-8 relative z-10">
        <div className="text-center mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[36px] md:text-[48px] font-bold text-white leading-[1.1] tracking-tight"
          >
            How trust collapses <br className="md:hidden" /> across layers
          </motion.h2>
          <div className="w-12 h-1 bg-[#A5D020] mx-auto mt-6 rounded-full" />
        </div>

        <div className="max-w-4xl mx-auto">
          {collapseSteps.map((step, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group flex gap-8 md:gap-12"
            >
              {/* 左侧垂直线轴 */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  {/* 点亮时的外发光 */}
                  <div className="absolute inset-0 bg-[#A5D020]/20 blur-md rounded-full scale-0 group-hover:scale-125 transition-transform duration-500" />
                  <div className="relative w-12 h-12 rounded-full border border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-center shrink-0 transition-colors group-hover:border-[#A5D020]/50">
                    <span className="text-[13px] font-black text-[#A5D020] tracking-tighter">{step.level}</span>
                  </div>
                </div>
                {i < collapseSteps.length - 1 && (
                  <div className="w-[1px] h-20 bg-gradient-to-b from-white/20 via-white/5 to-transparent" />
                )}
              </div>

              {/* 右侧卡片内容 */}
              <div className="flex-1 pt-1 pb-12">
                <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-sm transition-all duration-300 group-hover:bg-white/[0.05] group-hover:border-white/10 group-hover:translate-x-2">
                  <h3 className="text-[18px] font-bold text-white mb-2 tracking-wide">
                    {step.title}
                  </h3>
                  <p className="text-[15px] md:text-[16px] text-gray-400 leading-relaxed font-medium">
                    {step.desc}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}