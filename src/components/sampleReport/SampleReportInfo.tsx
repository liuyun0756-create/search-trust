"use client";

import React from 'react';
import { motion } from 'framer-motion';

export function SampleReportInfo() {
  const content = {
    pageTypes: [
      "a local service page",
      "a city / location-intent landing page",
      "a page reviewed as a trust diagnosis example"
    ],
    purposes: [
      "to show how the report is structured",
      "to explain how SearchTrust applies the framework",
      "to preview the kind of findings and recommendations you receive"
    ]
  };

  return (
    <section className="pt-20 bg-white">
      <div className="container mx-auto max-w-6xl px-6">
        {/* 标题区域  */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-[36px] md:text-[44px] font-bold text-[#1A1F2B] mb-6">
            What this sample report shows 
          </h2>
          <p className="text-[16px] md:text-[18px] text-gray-500 font-medium">
            This sample is illustrative. Some details may be simplified to show the report structure clearly. [cite: 42]
          </p>
        </div>

        {/* 双栏清单区域  */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
          
          {/* 左侧：样本页面类型 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <h3 className="text-[24px] md:text-[28px] font-bold text-[#1A1F2B]">
              Sample page type 
            </h3>
            <ul className="space-y-4">
              {content.pageTypes.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="mt-2.5 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
                  <span className="text-[15px] md:text-[17px] text-gray-600 font-medium leading-relaxed">
                    {item} 
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* 右侧：样本目的 */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="space-y-8"
          >
            <h3 className="text-[24px] md:text-[28px] font-bold text-[#1A1F2B]">
              Purpose of the sample 
            </h3>
            <ul className="space-y-4">
              {content.purposes.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <div className="mt-2.5 w-1.5 h-1.5 rounded-full bg-gray-900 flex-shrink-0" />
                  <span className="text-[15px] md:text-[17px] text-gray-600 font-medium leading-relaxed">
                    {item} 
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>

        </div>
      </div>
    </section>
  );
}