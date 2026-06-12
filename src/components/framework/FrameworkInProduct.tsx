"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Lightbulb, Eye, Route } from 'lucide-react';

const features = [
  {
    icon: AlertTriangle,
    title: "Dominant Failure Layer",
    desc: "Identifies which trust layer is causing the most damage to your page's credibility.",
  },
  {
    icon: Lightbulb,
    title: "Why This Layer Matters",
    desc: "Explains the specific impact this failure has on Google's evaluation of your page.",
  },
  {
    icon: Eye,
    title: "Google's Interpretation",
    desc: "Shows exactly how Google interprets the missing or weak signals on your page.",
  },
  {
    icon: Route,
    title: "Lowest Cost Recovery Path",
    desc: "Provides the most efficient fix strategy to restore trust at the failing layer.",
  },
];

export function FrameworkInProduct() {
  return (
    <section className="pt-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* 顶部标题 */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[32px] md:text-[42px] font-bold text-[#1A1F2B] mb-4"
          >
            How the framework appears inside SearchTrust
          </motion.h2>
          <p className="text-[16px] text-gray-500 font-medium max-w-xl mx-auto">
            Issues aren't just listed — they are mapped to specific trust layers with a clear path to recovery.
          </p>
        </div>

        {/* 左图右卡片 */}
        <div className="flex flex-col lg:flex-row gap-8 items-stretch max-w-5xl mx-auto">
          {/* 左侧大图 */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:w-[45%] flex-shrink-0"
          >
            <div className="bg-[#F8F9FA] rounded-[24px] border border-gray-100 overflow-hidden h-full">
              <img src="/images/framework-bg.png" alt="Framework in Product" className="w-full h-full object-cover" />
            </div>
          </motion.div>

          {/* 右侧 2x2 卡片网格 */}
          <div className="lg:w-[55%] grid grid-cols-1 sm:grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group relative overflow-hidden rounded-[24px] border border-gray-100 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[#A5D020]/35 hover:shadow-[0_16px_42px_rgba(15,23,42,0.08)] flex flex-col gap-4"
              >
                <div className="absolute inset-x-0 top-0 h-1.5 bg-[#A5D020]" />
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0F5E0] text-[#A5D020] transition-transform duration-300 group-hover:scale-105">
                  <feature.icon size={19} strokeWidth={1.7} />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-[15px] font-bold text-[#1A1F2B]">
                    {feature.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-gray-500 font-medium">
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
