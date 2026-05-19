"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function TrustLayerDetail() {
  const [activeLayer, setActiveLayer] = useState('L0');

  const layers = [
    {
      id: 'L0',
      name: 'Qualification',
      question: 'What It Answers',
      questionDesc: 'Does this page qualify to enter the evaluation process, or is it fundamentally not competitive?',
      contentTitle: 'What Can Be Written',
      contents: ['Does the page clearly focus on a real search intent', 'Is it a meaningful local page, not an invalid expansion', 'Is there a clear service/location/entity relationship'],
      failureTitle: 'Page Failure Signs',
      failures: ['Page intent is vague', 'Service-city relationship is unclear', 'Looks more like a bulk placeholder than a real entry page'],
      googleLabel: "Google's Likely Interpretation",
      googleDesc: 'This page may not represent a distinct local destination worth surfacing'
    },
    { id: 'L1', name: 'Specificity' },
    { id: 'L2', name: 'Real-World Anchors' },
    { id: 'L3', name: 'Responsibility' },
    { id: 'L4', name: 'Standalone Value' },
    { id: 'L5', name: 'Era Fit' }
  ];

  return (
    <section className="py-24 bg-[#F9FAFB]">
      <div className="container mx-auto max-w-6xl px-6">
        <h2 className="text-center text-[36px] font-bold text-[#1A1F2B] mb-16">
          Detailed Breakdown of Each Layer
        </h2>

        <div className="relative bg-white rounded-[40px] shadow-xl shadow-gray-100 border border-gray-100 overflow-hidden">
          {/* 层级切换导航 (堆叠卡片样式) */}
          <div className="flex overflow-x-auto no-scrollbar border-b border-gray-100">
            {layers.map((layer, index) => (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className={`flex-shrink-0 px-8 py-6 transition-all relative ${
                  activeLayer === layer.id 
                  ? 'bg-white z-10' 
                  : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                }`}
                style={{
                  borderRight: '1px solid #F3F4F6',
                  width: `${100 / layers.length}%`,
                  minWidth: '160px'
                }}
              >
                <div className="flex flex-col items-start gap-1">
                  <span className={`text-[12px] font-black tracking-widest ${activeLayer === layer.id ? 'text-[#A5D020]' : 'text-gray-300'}`}>
                    {layer.id}
                  </span>
                  <span className="text-[15px] font-bold whitespace-nowrap">
                    {layer.name}
                  </span>
                </div>
                {activeLayer === layer.id && (
                  <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-[#A5D020]" />
                )}
              </button>
            ))}
          </div>

          {/* 内容展示区 */}
          <div className="p-10 md:p-16">
            <AnimatePresence mode="wait">
              {layers.map((layer) => (
                layer.id === activeLayer && (
                  <motion.div
                    key={layer.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-16"
                  >
                    {/* 左侧：逻辑说明 */}
                    <div className="space-y-10">
                      <div className="space-y-4">
                        <h4 className="text-[18px] font-black text-gray-900 uppercase tracking-tight">{layer.question}</h4>
                        <p className="text-[16px] text-gray-500 leading-relaxed font-medium">
                          {layer.questionDesc}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-[18px] font-black text-gray-900 uppercase tracking-tight">{layer.contentTitle}</h4>
                        <ul className="space-y-3">
                          {layer.contents?.map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-[15px] text-gray-600 font-medium">
                              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#A5D020] flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* 右侧：表现与解读 */}
                    <div className="space-y-10">
                      <div className="space-y-4">
                        <h4 className="text-[18px] font-black text-gray-900 uppercase tracking-tight">{layer.failureTitle}</h4>
                        <ul className="space-y-3">
                          {layer.failures?.map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-[15px] text-gray-600 font-medium">
                              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-8 border-t border-gray-100">
                        <h4 className="text-[14px] font-black text-gray-400 uppercase tracking-widest mb-4">
                          {layer.googleLabel}
                        </h4>
                        <div className="bg-gray-50 rounded-2xl p-6 border-l-4 border-gray-200">
                          <p className="text-[15px] text-gray-500 font-medium italic">
                            "{layer.googleDesc}"
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}