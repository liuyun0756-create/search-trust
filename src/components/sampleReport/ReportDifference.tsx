"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, ShieldCheck } from 'lucide-react';

export function ReportDifference() {
  const comparison = {
    typical: {
      title: "Typical SEO audit",
      items: [
        "flat issue list",
        "technical checks",
        "generic recommendations",
        "little trust interpretation",
        "weak fix prioritization"
      ]
    },
    searchTrust: {
      title: "Search Trust report",
      items: [
        "layer-based diagnosis",
        "identifies dominant failure point",
        "explains local trust weakness",
        "prioritizes fixes by structural impact",
        "built for local page interpretation"
      ]
    }
  };

  const featureCards = [
    { title: "Not just issue detection", desc: "It explains why the page feels untrustworthy." },
    { title: "Not all findings are equal", desc: "It identifies the dominant layer, not just a long list." },
    { title: "Built for local page interpretation", desc: "Especially useful for city pages, service-area pages, and multi-location content." },
    { title: "Fixes are ordered by trust impact", desc: "Users know what to change first." }
  ];

  return (
    <section className="py-20 bg-[#F8F9FB]">
      <div className="container mx-auto max-w-6xl px-6">
        <h2 className="text-center text-[32px] md:text-[40px] font-bold text-[#1A1F2B] mb-20">
          What makes this report different
        </h2>

        {/* 左右对比区域 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-24 mb-16 px-4 md:px-8">
          {/* 左侧：典型 SEO 审计 */}
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <ClipboardList size={20} className="text-gray-400" />
              </div>
              <h3 className="text-[22px] md:text-[26px] font-medium text-gray-400">
                Typical <span className="font-bold text-gray-700">SEO audit</span>
              </h3>
            </div>
            <div className="w-full h-px bg-gray-200" />
            <ul className="space-y-4">
              {comparison.typical.items.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[16px] text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* 右侧：Search Trust 报告 */}
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#F4F7E9] flex items-center justify-center">
                <ShieldCheck size={20} className="text-[#A5D020]" />
              </div>
              <h3 className="text-[22px] md:text-[26px] font-medium text-gray-400">
                <span className="font-bold text-[#1A1F2B]">Search Trust</span> report
              </h3>
            </div>
            <div className="w-full h-px bg-[#A5D020]/30" />
            <ul className="space-y-4">
              {comparison.searchTrust.items.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-[16px] text-gray-700 font-medium">
                  <span className="w-[5px] h-[5px] rounded-full bg-[#A5D020] flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 下方强调卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featureCards.map((card, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className="bg-white rounded-[32px] p-8 flex flex-col justify-between min-h-[180px] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-[#A5D020]/40 hover:shadow-[0_8px_30px_rgba(165,208,32,0.08)] transition-all duration-300 group"
            >
              <h4 className="text-[15px] font-bold text-[#1A1F2B] leading-tight mb-3">
                {card.title}
              </h4>
              <p className="text-[13px] text-gray-500 font-medium leading-relaxed">
                {card.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
