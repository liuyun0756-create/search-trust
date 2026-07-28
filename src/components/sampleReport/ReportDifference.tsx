"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Check, ClipboardList, FileSearch, Layers, Route, ShieldCheck, Target } from 'lucide-react';

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
        "fixed L1-L8 diagnosis",
        "source-traceable findings",
        "executable layer actions",
        "four-phase implementation order",
        "agency and client delivery formats"
      ]
    }
  };

  const featureCards = [
    {
      icon: FileSearch,
      title: "Evidence remains inspectable",
      desc: "Confirmed findings stay connected to source excerpts and missing-signal observations.",
    },
    {
      icon: Target,
      title: "Findings become work items",
      desc: "Layer actions include placement, implementation detail, expected effects, and completion signals.",
    },
    {
      icon: Layers,
      title: "Built for local page interpretation",
      desc: "Especially useful for city pages, service-area pages, and multi-location content.",
    },
    {
      icon: Route,
      title: "Work follows layer dependency",
      desc: "The roadmap shows what to complete, observe, and re-audit before the next phase.",
    },
  ];

  return (
    <section className="py-20 bg-[#F8F9FB]">
      <div className="container mx-auto max-w-6xl px-6">
        <div className="mb-20 text-center">
          <h2 className="text-[32px] md:text-[40px] font-bold text-[#1A1F2B] leading-tight">
            What makes this report different
          </h2>
          <div className="section-title-bar" />
        </div>

        {/* 左右对比区域 */}
        <div className="relative mx-auto mb-16 max-w-5xl">
          <div className="flex flex-col items-stretch md:flex-row md:items-center">
          {/* 左侧：典型 SEO 审计 */}
            <div className="z-10 w-full rounded-[24px] border border-gray-100 bg-white p-10 shadow-[0_16px_40px_rgba(15,23,42,0.04)] md:w-[500px] md:pr-24">
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F3F4F6] ring-1 ring-gray-200">
                <ClipboardList size={20} className="text-gray-400" />
              </div>
                <h3 className="text-[22px] md:text-[24px] font-medium text-gray-400">
                Typical <span className="font-bold text-gray-700">SEO audit</span>
              </h3>
            </div>
              <div className="mb-8 h-px w-full bg-gray-200" />
              <ul className="space-y-5">
              {comparison.typical.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[15px] font-medium text-gray-500">
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-gray-300" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* 右侧：Search Trust 报告 */}
            <div className="z-20 w-full rounded-[24px] bg-[#1A1F2B] p-10 shadow-[0_30px_60px_rgba(15,23,42,0.16)] md:-ml-12 md:w-[520px] md:pl-20">
              <div className="mb-8 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F4F7E9] ring-1 ring-[#A5D020]/20">
                <ShieldCheck size={20} className="text-[#A5D020]" />
              </div>
                <h3 className="text-[22px] md:text-[24px] font-medium text-gray-300">
                  <span className="font-bold text-white">Search Trust</span> report
              </h3>
            </div>
              <div className="mb-8 h-px w-full bg-[#A5D020]/30" />
              <ul className="space-y-5">
              {comparison.searchTrust.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[16px] font-medium text-gray-200">
                    <Check size={18} className="shrink-0 text-[#A5D020]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

            <div className="absolute left-1/2 top-1/2 z-30 hidden -translate-x-[90px] -translate-y-1/2 md:flex">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border-[6px] border-white bg-[#A5D020] shadow-[0_0_30px_rgba(165,208,32,0.35)]">
                <span className="text-[18px] font-black italic tracking-tighter text-white">VS</span>
              </div>
            </div>
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
              whileHover={{ y: -4 }}
              className="group relative min-h-[210px] overflow-hidden rounded-2xl border border-gray-100 bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-[#A5D020]/40 hover:shadow-[0_18px_44px_rgba(15,23,42,0.07)]"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-[#A5D020]" />
              <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F4F7E9] ring-1 ring-[#A5D020]/15 transition-colors duration-300 group-hover:bg-[#EEF6D4]">
                <card.icon size={20} className="text-[#86B800]" />
              </div>
              <h4 className="mb-3 text-[15px] font-bold leading-snug text-[#1A1F2B]">
                {card.title}
              </h4>
              <p className="text-[13px] font-medium leading-relaxed text-[#4B5563]">
                {card.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
