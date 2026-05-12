"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Zap, ListChecks, Mail } from 'lucide-react';

const benefits = [
  {
    title: "A six-layer trust diagnosis",
    desc: "Comprehensive evaluation for one submitted page using our L0—L5 model.",
    icon: <ShieldCheck size={20} className="text-[#A5D020]" />
  },
  {
    title: "The dominant failure point",
    desc: "Pinpoint exactly which structural layer is holding your page back from ranking.",
    icon: <Zap size={20} className="text-[#A5D020]" />
  },
  {
    title: "Prioritized recommendations",
    desc: "Actionable steps ordered by their direct impact on search trust scores.",
    icon: <ListChecks size={20} className="text-[#A5D020]" />
  },
  {
    title: "Delivery by email",
    desc: "Receive your full technical report within two hours of submission.",
    icon: <Mail size={20} className="text-[#A5D020]" />
  }
];

export function WhatYouGet() {
  return (
    <section className="bg-[#F8F9FA] py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* 左侧：视觉诊断模型展示 */}
          <div className="lg:col-span-5 relative">
            <div className="relative bg-white rounded-[32px] p-12 border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden">
              {/* 背景装饰：品牌色微弱光晕 */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#A5D020]/5 blur-[60px] rounded-full -mr-20 -mt-20" />
              
              <div className="relative z-10 w-full aspect-square max-w-[320px]">
                {/* 模拟原型图中的雷达图/诊断图形 */}
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  {/* 背景网格线 */}
                  {[0.2, 0.4, 0.6, 0.8, 1].map((scale, i) => (
                    <circle 
                      key={i} 
                      cx="50" cy="50" r={scale * 45} 
                      fill="none" 
                      stroke="#E5E7EB" 
                      strokeWidth="0.5" 
                      strokeDasharray="2 2"
                    />
                  ))}
                  {/* 诊断数据阴影区 */}
                  <motion.path
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    d="M 50 15 L 82 35 L 75 75 L 50 85 L 25 75 L 18 35 Z"
                    fill="rgba(165, 208, 32, 0.15)"
                    stroke="#A5D020"
                    strokeWidth="1.5"
                  />
                  {/* 中心扫描线动画 */}
                  <motion.line 
                    x1="50" y1="50" x2="50" y2="5" 
                    stroke="#3B82F6" strokeWidth="1" strokeLinecap="round"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    style={{ originX: "50px", originY: "50px" }}
                  />
                </svg>
                
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="bg-white px-4 py-2 rounded-full border border-gray-100 shadow-xl text-[12px] font-black tracking-widest text-[#1A212B] uppercase">
                      L0 — L5 Model
                   </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧：文案清单 */}
          <div className="lg:col-span-7">
            <h2 className="text-[42px] font-extrabold text-[#1A212B] tracking-tighter leading-[1.1] mb-12">
              What you get
            </h2>
            
            <div className="grid sm:grid-cols-2 gap-x-12 gap-y-10">
              {benefits.map((item, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col gap-4"
                >
                  {/* 图标容器：品牌绿背景 + 白色图标 */}
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center">
                    {item.icon}
                  </div>
                  
                  <div>
                    <h3 className="text-[18px] font-bold text-[#1A212B] tracking-tight mb-2">
                      {item.title}
                    </h3>
                    <p className="text-[14px] text-gray-500 font-medium leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}