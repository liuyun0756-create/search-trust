"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Ban, XCircle, AlertCircle } from 'lucide-react';

const notItems = [
  {
    icon: Ban,
    num: "01",
    title: "Not a technical issue",
    desc: "It's not primarily about crawlability or indexing. Technical health is a prerequisite, but trust is the structural ceiling.",
  },
  {
    icon: XCircle,
    num: "02",
    title: "Not thin content",
    desc: "Length does not equal legitimacy. A 3,000-word page can still feel structurally untrustworthy and 'doorway-like'.",
  },
  {
    icon: AlertCircle,
    num: "03",
    title: "Not just ranking loss",
    desc: "A page may rank briefly due to legacy signals while being structurally unstable and ready to collapse in the next era.",
  },
];

export function TrustCollapseMeaning() {
  return (
    <section className="py-32 bg-white relative overflow-hidden">
      {/* 极简背景修饰 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-gray-100 to-transparent" />
      
      <div className="container mx-auto max-w-7xl px-6 lg:px-8 relative">
        
        {/* 顶部宣言区域 */}
        <div className="max-w-4xl mx-auto text-center mb-24">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[32px] md:text-[48px] font-bold text-[#0B0C0E] tracking-tight leading-[1.1] mb-8"
          >
            What trust collapse means
          </motion.h2>
          
          <motion.div 
             initial={{ opacity: 0 }}
             whileInView={{ opacity: 1 }}
             viewport={{ once: true }}
             transition={{ delay: 0.2 }}
             className="relative"
          >
            <div className="absolute -left-4 top-0 w-1 h-full bg-[#A5D020] rounded-full hidden md:block" />
            <p className="text-[18px] md:text-[21px] text-gray-500 leading-relaxed font-medium md:pl-8 text-left md:text-center italic">
              "Trust collapse happens when a page stops being interpreted as a credible, grounded,
              accountable local entry point — even if it contains keywords, content, and optimization signals."
            </p>
          </motion.div>
        </div>

        {/* 对比卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {notItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group relative p-10 rounded-[32px] border border-gray-100 bg-[#F9FAFB]/50 hover:bg-white hover:border-[#A5D020]/30 hover:shadow-[0_20px_50px_rgba(165,208,32,0.1)] transition-all duration-500"
            >
              {/* 编号与图标 */}
              <div className="flex justify-between items-start mb-8">
                <div className="text-[12px] font-bold text-gray-300 tracking-[0.2em] uppercase">
                  Case {item.num}
                </div>
                <item.icon 
                  size={24} 
                  strokeWidth={1.5} 
                  className="text-gray-300 group-hover:text-[#A5D020] transition-colors duration-500" 
                />
              </div>

              {/* 内容 */}
              <h3 className="text-[20px] font-bold text-[#0B0C0E] mb-4 leading-tight group-hover:text-[#A5D020] transition-colors">
                {item.title}
              </h3>
              <p className="text-[15px] md:text-[16px] text-gray-500 leading-relaxed font-medium">
                {item.desc}
              </p>

              {/* 底部装饰线 */}
              <div className="absolute bottom-0 left-10 right-10 h-1 bg-[#A5D020] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 rounded-t-full" />
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}