"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Sparkles, MapPin, Building2, UserCheck, Diamond } from 'lucide-react';

const layers = [
  { id: "L0", title: "Qualification", icon: ShieldCheck, question: "Can this page even qualify as a real competitor?" },
  { id: "L1", title: "Specificity", icon: Sparkles, question: "Does it feel real and grounded, or generic and reusable?" },
  { id: "L2", title: "Real–World Anchors", icon: MapPin, question: "Does it connect to actual places, service reality, and local context?" },
  { id: "L3", title: "Responsibility", icon: Building2, question: "Does it show signs of accountable business presence?" },
  { id: "L4", title: "Standalone Value", icon: UserCheck, question: "Does the page deserve to exist on its own?" },
  { id: "L5", title: "Era Fit", icon: Diamond, question: "Is the page adapted to modern search and AI citation expectations?" },
];

export function SixLayersOverview() {
  return (
    <section className="py-32 bg-white overflow-hidden">
      <div className="container mx-auto max-w-4xl px-6">
        
        {/* 标题 */}
        <div className="text-center mb-20">
          <h2 className="text-[36px] md:text-[52px] font-bold text-[#0B0C0E] tracking-tight mb-4">
            The six layers of page trust
          </h2>
          <div className="w-12 h-1 bg-[#A5D020] mx-auto rounded-full" />
        </div>

        {/* 纵向堆叠容器 */}
        <div className="relative flex flex-col gap-4">
          
          {/* 贯穿全身的背景轴线 */}
          <div className="absolute left-[31px] md:left-[50%] top-0 bottom-0 w-px bg-gradient-to-b from-[#A5D020] via-gray-100 to-transparent z-0 hidden md:block" />

          {layers.map((layer, i) => (
            <motion.div
              key={layer.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group relative z-10"
            >
              <div className="flex flex-col md:flex-row items-center gap-6 md:gap-12">
                
                {/* 左侧：层级编号标识 (固定宽度) */}
                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center group-hover:border-[#A5D020]/50 transition-colors">
                  <span className="text-[18px] font-black text-[#0B0C0E] tracking-tighter group-hover:text-[#A5D020] transition-colors">
                    {layer.id}
                  </span>
                </div>

                {/* 右侧：内容卡片 (撑满剩余空间) */}
                <div className="flex-1 w-full bg-[#F9FAFB]/50 border border-gray-100 rounded-[24px] p-6 md:p-8 hover:bg-white hover:shadow-[0_20px_40px_rgba(165,208,32,0.08)] transition-all duration-500">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <layer.icon size={16} className="text-[#A5D020]" />
                        <h3 className="text-[18px] font-bold text-[#0B0C0E]">
                          {layer.title}
                        </h3>
                      </div>
                      <p className="text-[15px] md:text-[16px] text-gray-500 font-medium leading-relaxed">
                        {layer.question}
                      </p>
                    </div>
                    
                    {/* 指向下一个层级的箭头 (视觉引导) */}
                    <div className="hidden md:block text-gray-200 group-hover:text-[#A5D020] transition-colors">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>
                </div>

              </div>
              
              {/* 移动端连接线 */}
              {i < layers.length - 1 && (
                <div className="w-px h-4 bg-gray-100 ml-[31px] md:hidden" />
              )}
            </motion.div>
          ))}
        </div>

        {/* 底部注脚 (来自原型图) */}
        <div className="mt-20 flex justify-center">
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-orange-50 border border-orange-100">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            <p className="text-[14px] font-semibold text-orange-700">
              This framework explains why a page may fail trust before it fails visibility
            </p>
          </div>
        </div>

      </div>
    </section>
  );
}