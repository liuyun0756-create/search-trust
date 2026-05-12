"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Database, Search, ClipboardCheck, ArrowRight, Activity } from 'lucide-react';

export function FrameworkInProduct() {
  return (
    <section className="py-32 bg-white relative overflow-hidden">
      {/* 背景点缀：极简的渐变 */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#A5D020]/5 rounded-full blur-[120px] -mr-64 -mt-64" />

      <div className="container mx-auto max-w-7xl px-6 relative z-10">
        
        {/* Header Section */}
        <div className="max-w-4xl mb-24">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center gap-3 mb-6"
          >
            <div className="h-px w-12 bg-[#A5D020]" />
            <span className="text-[12px] font-black uppercase tracking-[0.3em] text-[#A5D020]">Inside the Engine</span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[40px] md:text-[56px] font-bold text-[#0B0C0E] leading-[1.1] tracking-tight mb-8"
          >
            How the framework appears <br />
            <span className="text-gray-300 italic">inside SearchTrust</span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[18px] text-gray-500 max-w-2xl font-medium leading-relaxed"
          >
            In the AI Linter, issues aren't just "listed" — they are strategically mapped to specific trust layers to provide a clear path to recovery.
          </motion.p>
        </div>

        {/* Diagnostic Flow UI */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          
          {/* Left Side: Text Cards (Step-by-Step Breakdown) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Step 1: Input */}
            <div className="group bg-gray-50 rounded-[32px] p-8 border border-gray-100 hover:border-gray-200 transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <Database size={18} className="text-gray-400" />
                </div>
                <h3 className="text-[18px] font-bold text-[#0B0C0E]">Input Page</h3>
              </div>
              <div className="p-4 bg-white rounded-2xl border border-gray-100 text-[14px] font-mono text-gray-500">
                https://plumber-austin.com/landing
              </div>
            </div>

            {/* Step 2: Mapping Logic */}
            <div className="bg-[#0B0C0E] rounded-[32px] p-8 text-white relative overflow-hidden">
              <Activity className="absolute bottom-[-10px] right-[-10px] text-white/5 w-32 h-32" />
              <div className="flex items-center gap-4 mb-8">
                <div className="w-10 h-10 rounded-full bg-[#A5D020] flex items-center justify-center">
                  <Search size={18} className="text-[#0B0C0E]" />
                </div>
                <h4 className="text-[18px] font-bold">Mapping Layer Analysis</h4>
              </div>
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="text-gray-400 font-bold text-[13px]">Dominant Failure Layer</span>
                  <span className="text-[#A5D020] font-mono">L2 - Anchors</span>
                </div>
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="text-gray-400 font-bold text-[13px]">Criticality Status</span>
                  <span className="text-white font-mono">High Risk</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-bold text-[13px]">Google Interpretation</span>
                  <span className="text-white font-mono">Weak Grounding</span>
                </div>
              </div>
            </div>

            {/* Step 3: Actionable Output */}
            <div className="bg-gray-50 rounded-[32px] p-8 border border-gray-100">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                  <ClipboardCheck size={18} className="text-[#A5D020]" />
                </div>
                <h3 className="text-[18px] font-bold text-[#0B0C0E]">Actionable Findings</h3>
              </div>
              <ul className="space-y-4">
                {[
                  "Dominant Failure Layer",
                  "Why This Layer Matters",
                  "Google's Interpretation",
                  "Lowest Cost Recovery Path"
                ].map((text, i) => (
                  <li key={i} className="flex items-center gap-3 text-[14px] font-bold text-gray-600">
                    <ArrowRight size={14} className="text-[#A5D020]" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Side: Visual Asset Placeholder */}
          <div className="lg:col-span-7 bg-gray-50 rounded-[40px] border border-dashed border-gray-200 flex flex-col items-center justify-center p-12 min-h-[500px] relative group">
            <div className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Search size={32} className="text-gray-200" />
            </div>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[12px]">
              Visual Asset Placeholder
            </p>
            <p className="text-gray-300 text-[14px] mt-2 italic text-center max-w-xs">
              Place the product screenshot or trust-mapping visualization here.
            </p>
            
            {/* 模拟 UI 装饰元素 */}
            <div className="absolute top-10 right-10 w-32 h-2 bg-gray-200 rounded-full opacity-30" />
            <div className="absolute bottom-10 left-10 w-24 h-2 bg-gray-200 rounded-full opacity-30" />
          </div>

        </div>
      </div>
    </section>
  );
}