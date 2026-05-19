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
    <section className="pt-20 bg-white overflow-hidden">
      <div className="container mx-auto max-w-4xl px-6">
        
        {/* 标题 */}
        <div className="text-center mb-20">
          <h2 className="text-[36px] md:text-[52px] font-bold text-[#0B0C0E] tracking-tight mb-4">
            The six layers of page trust
          </h2>
          <div className="w-12 h-1 bg-[#A5D020] mx-auto rounded-full" />
        </div>

        {/* 纵向堆叠容器 */}
        <div className="relative flex flex-col">
          <img src="/images/six-layer-bg.png" alt="" className="w-full h-auto" />
        </div>

        {/* 底部注脚 (来自原型图) */}
        {/* <div className="mt-20 flex justify-center">
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-orange-50 border border-orange-100">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            <p className="text-[14px] font-semibold text-orange-700">
              This framework explains why a page may fail trust before it fails visibility
            </p>
          </div>
        </div> */}

      </div>
    </section>
  );
}