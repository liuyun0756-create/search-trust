"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

const notItems = [
  "It is not a ranking guarantee system.",
  "It is not a content generator.",
  "It is not a technical SEO crawler.",
  "It is not a substitute for overall SEO strategy.",
  "It is not a universal spam detector for every niche.",
];

export function WhatFrameworkIsNot() {
  return (
    <section className="pt-20 bg-white relative overflow-hidden">
      {/* 装饰性背景：微妙的网格感 */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="container mx-auto max-w-7xl px-6 relative z-10">
        
        {/* 标题区域 */}
        <div className="text-center mb-24">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[36px] md:text-[52px] font-bold text-[#0B0C0E] leading-[1.1] tracking-tight"
          >
            What this framework <br /> <span className="text-bar-highlight text-[#0B0C0E]">is not</span>
          </motion.h2>
        </div>

        {/* 列表容器 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto rounded-[28px] border border-gray-100 bg-white/80 p-8 md:p-10 shadow-[0_18px_50px_rgba(15,23,42,0.05)] backdrop-blur-sm"
        >
          <div className="space-y-5">
            {notItems.map((item) => (
              <div key={item} className="flex items-center gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-50 border border-gray-100">
                  <X size={16} className="text-gray-400" />
                </div>
                <p className="text-[16px] md:text-[18px] text-gray-600 font-medium tracking-tight">
                  {item}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

      </div>
    </section>
  );
}
