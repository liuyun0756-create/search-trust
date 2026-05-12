"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, ChevronRight } from 'lucide-react';

const layerDetails = [
  {
    id: "L0",
    title: "Qualification",
    whatItAnswers: "这个页面有没有资格进入判断流程，还是本质上就不该竞争",
    criteria: ["页面是否明确聚焦一个真实搜索意图", "是否属于有意义的本地页，而不是无效扩页", "是否有清晰的服务/位置/实体关系"],
    failures: ["页面意图模糊", "服务与城市关系不成立", "更像批量占位页而不是真实入口页"],
    googleInterpretation: "This page may not represent a distinct local destination worth surfacing.",
  },
  {
    id: "L1",
    title: "Specificity",
    whatItAnswers: "页面是否足够具体，还是任何城市都能换词复用",
    criteria: ["是否有本地细节", "是否有无法轻易复制的服务语境", "是否避免 generic city-template language"],
    failures: ["通用描述过多", "城市名替换即可复用", "开头、段落、FAQ 都高度模板化"],
    googleInterpretation: "The page appears location-labeled rather than genuinely local.",
  },
  {
    id: "L2",
    title: "Real-World Anchors",
    whatItAnswers: "页面有没有被真实世界托住",
    criteria: ["具体地点", "服务情境", "运营时间线", "区域覆盖逻辑", "与真实本地环境的连接"],
    failures: ['页面只说"我们服务这个城市"', "没有真实地点/场景/时间痕迹", "缺乏运营层面的现实感"],
    googleInterpretation: "Claims are present, but grounding is weak.",
  },
  {
    id: "L3",
    title: "Responsibility",
    whatItAnswers: '页面是否体现出"真实业务会为这件事负责"的结构',
    criteria: ["Clear business identity", "Operational legitimacy", "Contact / ownership / responsibility cues", "Service accountability signals"],
    failures: ["全是宣称，没有承担关系", "没有清晰业务责任结构", "页面像 lead-gen shell"],
    googleInterpretation: "The page describes services, but accountability remains unclear.",
  },
  {
    id: "L4",
    title: "Standalone Value",
    whatItAnswers: "这个页面是否值得单独存在",
    criteria: ["它是不是只是主页面的轻微改写版", "如果删掉这个页面，用户会失去什么", "它是否提供独立价值"],
    failures: ["页面只是在重复站内已有内容", "没有独特用途或独特信息", "独立访问价值很低"],
    googleInterpretation: "This page may exist for coverage rather than value.",
  },
  {
    id: "L5",
    title: "Era Fit",
    whatItAnswers: "页面是否适合当下搜索环境",
    criteria: ["是否仍停留在旧 SEO 模板思维", "是否考虑 AI 概览、引用、实体理解", "是否结构清晰、可解释、可提取"],
    failures: ["结构旧、堆关键词、缺少可提取信息", "不适合被 AI 系统引用", '页面对"现代搜索解析方式"不友好'],
    googleInterpretation: "The page may be indexable, but not citation-ready or structurally competitive.",
  },
];

export function LayerDetailBreakdown() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <section className="py-32 bg-white overflow-hidden">
      <div className="container mx-auto max-w-7xl px-6">
        
        {/* Header */}
        <div className="text-left md:text-center mb-24">
          <h2 className="text-[32px] md:text-[52px] font-bold text-[#0B0C0E] tracking-tight mb-6">
            Detailed Breakdown of Each Layer
          </h2>
          <p className="text-gray-500 text-[18px] max-w-2xl mx-auto">
            深入了解 Trust Collapse 模型的各个维度，识别导致排名不稳定的结构性风险。
          </p>
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
                  <span className="text-[11px] font-bold text-[#A5D020] uppercase tracking-[0.2em] mb-4 block">核心问询 / Key Inquiry</span>
                  <h3 className="text-[24px] md:text-[28px] font-bold text-[#0B0C0E] leading-snug">
                    {layerDetails[activeTab].whatItAnswers}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  
                  {/* 可写内容 / 核心信号 */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-[#A5D020]">
                      <CheckCircle2 size={18} />
                      <span className="text-[13px] font-black uppercase tracking-wider">核心信号</span>
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
                      <span className="text-[13px] font-black uppercase tracking-wider">失败表现</span>
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