"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, ChevronRight } from 'lucide-react';

const layerDetails = [
   {
    id: "L1",
    title: "Foundation",
    whatItAnswers: "Does this page have the basic topic, service, location, and intent foundation needed for a local trust diagnosis?",
    criteria: ["Clear service and page purpose", "A meaningful local or service-area intent", "A coherent service / location / entity relationship"],
    failures: ["Page intent is vague or ambiguous", "Service and location relationship is unclear", "The page reads more like a placeholder than a real entry page"],
    searchInterpretation: "The page may have content, but the basic local trust foundation is not yet stable.",
  },
  {
    id: "L2",
    title: "Entity Presence",
    whatItAnswers: "Can a real business or organization be identified from the page and available checked signals?",
    criteria: ["Clear business name and identity cues", "Visible contact or ownership signals", "Entity details that connect the page to a real operator"],
    failures: ["The page explains the service but not who provides it", "Business identity is thin or hidden", "Important entity signals are missing from the checked content"],
    searchInterpretation: "The page may explain an offer, but the responsible entity is not strongly established.",
  },
  {
    id: "L3",
    title: "Entity Consistency",
    whatItAnswers: "Do the checked identity signals point to the same business entity?",
    criteria: ["Consistent name, phone, address, and service scope", "Aligned identity across page, footer, contact/about pages, and available GBP data", "No conflicting entity or brand signals"],
    failures: ["Different surfaces describe the business differently", "Contact or service area signals conflict", "Entity signals feel fragmented"],
    searchInterpretation: "Trust signals may be present, but they may not consolidate cleanly around one entity.",
  },
  {
    id: "L4",
    title: "Specificity",
    whatItAnswers: "Does the page feel specific and grounded, or generic and reusable?",
    criteria: ["Specific local/service details", "Scenario language that cannot be copied to any city", "Examples, FAQs, or details tied to this page's actual purpose"],
    failures: ["Too much generic description", "Content is reusable with a simple location swap", "Headers, paragraphs, and FAQs are highly templated"],
    searchInterpretation: "The page may be relevant, but it still reads like a generic local template.",
  },
  {
    id: "L5",
    title: "Real-World Connection",
    whatItAnswers: "Does the page connect to real places, service reality, and local context?",
    criteria: ["Specific locations or service context", "Operational timelines or service scenarios", "Coverage logic connected to the real local environment"],
    failures: ["The page only states that it serves an area", "No traces of real locations, scenarios, or timelines", "Local claims lack operational realism"],
    searchInterpretation: "Claims are present, but real-world grounding is weak.",
  },
  {
    id: "L6",
    title: "Accountability",
    whatItAnswers: "Does the page show process, responsibility, boundaries, and next-step clarity?",
    criteria: ["Clear service process", "Responsibility and ownership cues", "Limitations, expectations, or next steps that make the service accountable"],
    failures: ["All claims, little accountability", "No clear responsibility structure", "The page looks more like a lead-gen shell than a service entry point"],
    searchInterpretation: "The page describes services, but accountability remains unclear.",
  },
  {
    id: "L7",
    title: "Page Unique Value",
    whatItAnswers: "Does this page deserve to exist on its own?",
    criteria: ["A unique purpose beyond keyword coverage", "Content that would be missed if the page were removed", "Clear differentiation from related service/location pages"],
    failures: ["The page mostly repeats existing site content", "No unique purpose or unique information", "Low standalone visit value"],
    searchInterpretation: "The page may exist for coverage rather than meaningful standalone value.",
  },
  {
    id: "L8",
    title: "Algorithm Fit",
    whatItAnswers: "Does the page support clear interpretation by users and search systems?",
    criteria: ["Clear, scannable information structure", "Entity and service details that can be interpreted consistently", "Helpful organization for users and automated systems"],
    failures: ["Template structure obscures the page purpose", "Important information is difficult to extract", "Organization weakens the overall page interpretation"],
    searchInterpretation: "The page may be indexable, but its structure can still weaken how clearly the full page is interpreted.",
  },
];

export function LayerDetailBreakdown() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="py-20 bg-white overflow-hidden">
      <div className="container mx-auto max-w-7xl px-6">
        
        {/* Header */}
        <div className="text-left md:text-center mb-24">
          <h2 className="text-[32px] md:text-[52px] font-bold text-[#0B0C0E] tracking-tight mb-6">
            Detailed Breakdown of <span className="text-bar-highlight">Each Layer</span>
          </h2>
        
        </div>

        <div className="flex flex-col items-start gap-12 lg:flex-row lg:items-stretch">
          
          {/* 左侧：垂直导航 (层级选择) */}
          <div className="w-full lg:w-1/3 flex flex-col gap-2">
            {layerDetails.map((layer, index) => (
              <button
                key={layer.id}
                onClick={() => setActiveTab(index)}
                className={`group flex items-center justify-between p-6 rounded-[24px] transition-all duration-300 ${
                  activeTab === index 
                  ? 'bg-[#0B0C0E] text-white shadow-xl shadow-black/10' 
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`text-[12px] font-black tracking-tighter ${activeTab === index ? 'text-[#A5D020]' : 'text-gray-300'}`}>
                    {layer.id}
                  </span>
                  <span className={`text-[18px] font-bold ${activeTab === index ? 'text-white' : 'text-gray-500'}`}>
                    {layer.title}
                  </span>
                </div>
                <ChevronRight size={20} className={`transition-transform duration-300 ${activeTab === index ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0'}`} />
              </button>
            ))}
          </div>

          {/* 右侧：内容展示区 */}
          <div className="w-full lg:w-2/3">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex h-full flex-col rounded-[40px] border border-gray-100 bg-gray-50/50 p-8 md:p-12"
              >
                {/* 核心问题区域 */}
                <div className="mb-10 lg:min-h-[112px]">
                  <span className="text-[11px] font-bold text-[#A5D020] uppercase tracking-[0.2em] mb-4 block">Key Inquiry</span>
                  <h3 className="text-[24px] md:text-[28px] font-bold text-[#0B0C0E] leading-snug">
                    {layerDetails[activeTab].whatItAnswers}
                  </h3>
                </div>

                <div className="grid flex-1 grid-cols-1 gap-10 md:grid-cols-2">
                  
                  {/* 可写内容 / 核心信号 */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-[#A5D020]">
                      <CheckCircle2 size={18} />
                      <span className="text-[13px] font-black uppercase tracking-wider">Key Signals</span>
                    </div>
                    <ul className="space-y-4">
                      {layerDetails[activeTab].criteria.map((item, i) => (
                        <li key={i} className="text-[15px] text-gray-600 font-medium leading-relaxed flex items-start gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#A5D020] mt-2 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 页面失败表现 */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-red-400">
                      <XCircle size={18} />
                      <span className="text-[13px] font-black uppercase tracking-wider">Failure Patterns</span>
                    </div>
                    <ul className="space-y-4">
                      {layerDetails[activeTab].failures.map((item, i) => (
                        <li key={i} className="text-[15px] text-gray-500 font-medium leading-relaxed flex items-start gap-3">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-2 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Search interpretation - 底部横幅样式 */}
                <div className="relative mt-10 overflow-hidden rounded-[24px] bg-[#0B0C0E] p-8">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-[#A5D020]">
                    <Info size={64} />
                  </div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3 block">Search Interpretation</span>
                  <p className="text-[17px] text-white font-medium italic relative z-10 leading-relaxed">
                    "{layerDetails[activeTab].searchInterpretation}"
                  </p>
                </div>

              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>
    </section>
  );
}
