"use client";

import React from 'react';
import Link from "next/link";
import { motion } from 'framer-motion';
import { ArrowRight, ShieldAlert } from 'lucide-react';

export function TrustCollapseModel() {
  const layers = [
    { id: 'L0', name: 'Qualification', desc: 'Can this page even qualify as a real competitor?' },
    { id: 'L1', name: 'Specificity', desc: 'Does it feel real and grounded, or generic and reusable?' },
    { id: 'L2', name: 'Real-World Anchors', desc: 'Does it connect to actual places, service reality, and local context?' },
    { id: 'L3', name: 'Responsibility', desc: 'Does it show signs of accountable business presence?' },
    { id: 'L4', name: 'Standalone Value', desc: 'Does the page deserve to exist on its own?' },
    { id: 'L5', name: 'Era Fit', desc: 'Is the page adapted to modern search and AI citation expectations?' }
  ];

  return (
    <section className="py-20 bg-white overflow-hidden">
      <div className="container mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          
          {/* 左侧：文字介绍区域 */}
          <div className="lg:col-span-6">
            <h2 className="text-[40px] md:text-[48px] font-bold text-[#1A1F2B] leading-[1.1] mb-8">
              The L0—L5 <br/>
              <span className="text-[#A5D020]">Trust Collapse Model</span>
            </h2>
            
            <p className="text-[18px] text-gray-500 leading-relaxed mb-8 font-medium">
              A structural framework for diagnosing whether a local page qualifies as a trustworthy entry point for Google, local search, and AI-era citation systems.
            </p>

            {/* 警告提示语 */}
            <div className="flex items-center gap-3 mb-10">
              <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
              <p className="text-[14px] font-bold text-[#F59E0B] tracking-tight">
                This framework is designed to explain why a page may fail trust before it fails visibility.
              </p>
            </div>

            <Link href="/sample-case" target="_blank" className="inline-flex items-center gap-3 px-8 py-4 bg-white border-2 border-gray-100 rounded-2xl font-black text-[15px] hover:border-[#A5D020] transition-all group shadow-sm">
              View Sample Report
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {/* 右侧：六层模型可视化 */}
          <div className="lg:col-span-6 relative">
            <div className="bg-gray-50 rounded-[40px] p-8 md:p-12 border border-gray-100 relative overflow-hidden">
              {/* 装饰性背景 */}
              <div className="absolute top-0 right-0 p-8">
                 <ShieldAlert size={120} className="text-gray-100 -rotate-12" />
              </div>

              <div className="relative z-10 space-y-3">
                {layers.map((layer, index) => (
                  <motion.div
                    key={layer.id}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center gap-6 p-4 bg-white rounded-2xl border border-gray-100 hover:shadow-md transition-shadow group cursor-default"
                  >
                    <span className="text-[13px] font-black text-[#A5D020] w-8">{layer.id}</span>
                    <div>
                      <h4 className="text-[15px] font-bold text-[#1A1F2B] group-hover:text-[#A5D020] transition-colors">
                        {layer.name}
                      </h4>
                      <p className="text-[12px] text-gray-400 font-medium leading-tight mt-0.5">
                        {layer.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}