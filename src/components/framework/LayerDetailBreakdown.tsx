"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, ChevronRight } from 'lucide-react';

const layerDetails = [
   {
    id: "L0",
    title: "Relevance",
    whatItAnswers: "Does this page qualify to enter the evaluation process, or should it not be competing at all?",
    criteria: ["Does the page clearly target a real search intent?", "Is it a meaningful local page rather than a filler expansion page?", "Is there a clear service / location / entity relationship?"],
    failures: ["The page intent is vague or ambiguous", "The service-city relationship does not hold", "It reads more like a bulk placeholder than a real entry page"],
    googleInterpretation: "This page may not represent a distinct local destination worth surfacing.",
  },
  {
    id: "L1",
    title: "Entity Clarity",
    whatItAnswers: "Is the page specific enough, or could any city name be swapped in?",
    criteria: ["Does it include local details?", "Does it contain service context that cannot be easily replicated?", "Does it avoid generic city-template language?"],
    failures: ["Too much generic description", "Content is reusable with a simple city-name swap", "Headers, paragraphs, and FAQs are all highly templated"],
    googleInterpretation: "The page appears location-labeled rather than genuinely local.",
  },
  {
    id: "L2",
    title: "Proof Signals",
    whatItAnswers: "Is the page grounded in real-world evidence?",
    criteria: ["Specific locations", "Service scenarios", "Operational timelines", "Coverage area logic", "Connections to the real local environment"],
    failures: ["The page only says 'we serve this city'", "No traces of real locations, scenarios, or timelines", "Lacks operational realism"],
    googleInterpretation: "Claims are present, but grounding is weak.",
  },
  {
    id: "L3",
    title: "Local Fit",
    whatItAnswers: "Does the page reflect a structure where a real business takes responsibility?",
    criteria: ["Clear business identity", "Operational legitimacy", "Contact / ownership / responsibility cues", "Service accountability signals"],
    failures: ["All claims, no accountability", "No clear business responsibility structure", "The page looks like a lead-gen shell"],
    googleInterpretation: "The page describes services, but accountability remains unclear.",
  },
  {
    id: "L4",
    title: "Structural Trust",
    whatItAnswers: "Does this page deserve to exist on its own?",
    criteria: ["Is it just a slight rewrite of the main page?", "If this page were removed, what would users lose?", "Does it provide independent value?"],
    failures: ["The page merely repeats existing site content", "No unique purpose or unique information", "Very low standalone visit value"],
    googleInterpretation: "This page may exist for coverage rather than value.",
  },
  {
    id: "L5",
    title: "Standalone Value",
    whatItAnswers: "Is the page adapted to the current search environment?",
    criteria: ["Is it still stuck in old-school SEO template thinking?", "Does it account for AI overviews, citations, and entity understanding?", "Is it structured clearly enough to be explainable and extractable?"],
    failures: ["Outdated structure, keyword-stuffed, lacking extractable information", "Not suitable for AI system citation", "Unfriendly to modern search parsing methods"],
    googleInterpretation: "The page may be indexable, but not citation-ready or structurally competitive.",
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

        <div className="flex flex-col lg:flex-row gap-12 items-start">
          
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
          <div className="w-full lg:w-2/3 min-h-[560px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="bg-gray-50/50 rounded-[40px] p-8 md:p-12 border border-gray-100 h-full"
              >
                {/* 核心问题区域 */}
                <div className="mb-12">
                  <span className="text-[11px] font-bold text-[#A5D020] uppercase tracking-[0.2em] mb-4 block">Key Inquiry</span>
                  <h3 className="text-[24px] md:text-[28px] font-bold text-[#0B0C0E] leading-snug">
                    {layerDetails[activeTab].whatItAnswers}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  
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

                {/* Google 视角 - 底部横幅样式 */}
                <div className="mt-12 p-8 rounded-[24px] bg-[#0B0C0E] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 text-[#A5D020]">
                    <Info size={64} />
                  </div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3 block">Google's Possible Interpretation</span>
                  <p className="text-[17px] text-white font-medium italic relative z-10 leading-relaxed">
                    "{layerDetails[activeTab].googleInterpretation}"
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
