"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Target, MapPin, UserCheck, FileText, Clock } from 'lucide-react';

const collapseSteps = [
  { level: "L0", title: "Qualification", desc: "If a page fails qualification, deeper trust signals barely matter.", icon: Shield },
  { level: "L1", title: "Specificity", desc: "If it passes qualification but lacks specificity, it begins to look templated.", icon: Target },
  { level: "L2", title: "Real-World Anchors", desc: "Without real-world anchors, local claims become weak.", icon: MapPin },
  { level: "L3", title: "Responsibility", desc: "Without responsibility, business legitimacy is unclear.", icon: UserCheck },
  { level: "L4", title: "Standalone Value", desc: "Without standalone value, the page feels unnecessary.", icon: FileText },
  { level: "L5", title: "Era Fit", desc: "Without era fit, it may be visible but not competitive.", icon: Clock },
];

export function TrustCollapseFlow() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* 顶部标题区域 */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[32px] md:text-[42px] font-bold text-[#1A1F2B] mb-4"
          >
            How trust collapses across layers
          </motion.h2>
          <p className="text-[16px] text-gray-500 font-medium max-w-xl mx-auto">
            Each layer builds on the one below. If a lower layer fails, everything above collapses.
          </p>
        </div>

        {/* 2x3 功能网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {collapseSteps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="bg-[#F8F9FA] rounded-[20px] p-8 flex items-start gap-5 transition-all hover:shadow-sm group"
            >
              {/* 图标 + Level 标签 */}
              <div className="mt-0.5">
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 group-hover:border-[#A5D020]/30 transition-colors">
                  <step.icon size={18} strokeWidth={1.5} className="text-[#A5D020]" />
                </div>
              </div>

              {/* 文字内容 */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-[#A5D020] tracking-tight">{step.level}</span>
                  <h3 className="text-[16px] font-bold text-[#1A1F2B]">
                    {step.title}
                  </h3>
                </div>
                <p className="text-[14px] leading-relaxed text-gray-500 font-medium">
                  {step.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
