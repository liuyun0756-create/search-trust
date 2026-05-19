"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { X, Minus } from 'lucide-react';

const notItems = [
  "It is not a ranking guarantee system.",
  "It is not a content generator.",
  "It is not a technical SEO crawler.",
  "It is not a substitute for overall SEO strategy.",
  "It is not a universal spam detector for every niche.",
];

export function WhatFrameworkIsNot() {
  return (
    <section className="pt-24 bg-white relative overflow-hidden">
      {/* 装饰性背景：微妙的网格感 */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="container mx-auto max-w-7xl px-6 relative z-10">
        
        {/* 标题区域 */}
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 border border-gray-200 mb-6"
          >
            <span className="text-[11px] font-bold text-gray-500 tracking-[0.2em] uppercase">Scope & Boundaries</span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[36px] md:text-[52px] font-bold text-[#0B0C0E] leading-[1.1] tracking-tight"
          >
            What this framework <br /> <span className="text-gray-400">is not</span>
          </motion.h2>
        </div>

        {/* 列表容器 */}
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          {notItems.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group flex items-center gap-6 bg-gray-50/50 hover:bg-white border border-gray-100 hover:border-gray-200 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-[24px] px-8 py-6 transition-all duration-300"
            >
              {/* 这里的图标处理：用中性灰，Hover 时稍微变重 */}
              <div className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <X size={18} className="text-gray-300 group-hover:text-red-400 transition-colors" />
              </div>

              <p className="text-[16px] md:text-[18px] text-gray-500 font-medium tracking-tight group-hover:text-gray-800 transition-colors">
                {item}
              </p>
            </motion.div>
          ))}
        </div>

        {/* 底部引导文案 */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-16 text-center"
        >
          <div className="inline-block p-[1px] rounded-full bg-gradient-to-r from-transparent via-gray-200 to-transparent w-full max-w-md h-px mb-8" />
          <p className="text-gray-400 text-[14px]">
            SearchTrust focuses on <span className="text-[#A5D020] font-bold">Trust Signals</span> — the missing piece in current SEO audits.
          </p>
        </motion.div>

      </div>
    </section>
  );
}