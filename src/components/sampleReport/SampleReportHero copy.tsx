"use client";

import React from 'react';
import Link from "next/link";
import { motion } from 'framer-motion';
import { ArrowRight, FileDown, ShieldCheck } from 'lucide-react';

export function SampleReportHero() {
  return (
    <section className="py-24 md:py-32 bg-[#0B0C0E] overflow-hidden relative">
      {/* 品牌色背景光晕 - 使用 #A5D020 做极简点缀 */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#A5D020]/10 blur-[150px] rounded-full -mr-64 -mt-64 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/5 blur-[120px] rounded-full -ml-48 -mb-48 pointer-events-none" />

      <div className="container mx-auto max-w-7xl px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* 左侧：文字内容区域 */}
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8"
            >
              <ShieldCheck size={14} className="text-[#A5D020]" />
              <span className="text-[11px] font-black text-gray-400 tracking-[0.2em] uppercase">
                Diagnostic Sample
              </span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-[44px] md:text-[64px] font-bold text-white leading-[1.05] tracking-tight mb-8"
            >
              See what a <br />
              <span className="text-[#A5D020]">SearchTrust</span> report <br />
              looks like
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-[18px] text-gray-400 leading-relaxed max-w-2xl mb-10 font-medium"
            >
              Explore a sample local page trust audit and see how SearchTrust diagnoses 
              trust breakdown across six structural layers. [cite: 36, 51]
            </motion.p>

            {/* 提示文案：Illustrative Sample */}
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="flex items-center gap-3 mb-10"
            >
              <div className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]" />
              <p className="text-[13px] text-gray-500 font-bold italic">
                This sample is illustrative. Some details may be simplified or anonymized. 
              </p>
            </motion.div>

            {/* 按钮组 */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <Link href="/sample-case" target="_blank" className="inline-flex items-center gap-3 px-8 py-4 bg-[#A5D020] text-[#0B0C0E] rounded-2xl font-black text-[15px] hover:bg-[#b8e62d] transition-all transform hover:-translate-y-1 shadow-lg shadow-[#A5D020]/20">
                View Sample Report
                <ArrowRight size={18} />
              </Link>
              
              <button className="inline-flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-black text-[15px] hover:bg-white/10 transition-all">
                <FileDown size={18} className="text-gray-400" />
                Download PDF
              </button>
            </motion.div>
          </div>

          {/* 右侧：图片预览占位区 */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-5 relative"
          >
            <div className="aspect-[4/5] bg-gradient-to-br from-white/5 to-transparent rounded-[40px] border border-dashed border-white/20 flex flex-col items-center justify-center p-12 overflow-hidden group">
              {/* 这里的区域留给您填充报表示例图 */}
              <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
                <div className="w-12 h-12 rounded-full bg-[#A5D020]/20 flex items-center justify-center">
                   <div className="w-4 h-4 rounded-full bg-[#A5D020]" />
                </div>
              </div>
              <p className="text-white/30 font-black uppercase tracking-[0.3em] text-[12px] text-center">
                Report Preview <br /> Placeholder
              </p>
              
              {/* 模拟的 UI 装饰线 */}
              <div className="absolute top-10 left-10 w-24 h-1 bg-white/5 rounded-full" />
              <div className="absolute bottom-10 right-10 w-32 h-1 bg-white/5 rounded-full" />
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}