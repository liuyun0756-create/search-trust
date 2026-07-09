"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Sparkles, MapPin, Building2, UserCheck, Diamond, Fingerprint, Link2 } from 'lucide-react';

const layers = [
  { id: "L0", title: "Foundation", icon: ShieldCheck, question: "Does this page have a clear service, topic, and local intent foundation?" },
  { id: "L0-A", title: "Entity Presence", icon: Fingerprint, question: "Can a real business entity be identified from the page and available signals?" },
  { id: "L0-B", title: "Entity Consistency", icon: Link2, question: "Do business identity signals stay consistent across the checked surfaces?" },
  { id: "L1", title: "Specificity", icon: Sparkles, question: "Does the page feel specific and grounded, not generic or reusable?" },
  { id: "L2", title: "Real-World Connection", icon: MapPin, question: "Does it connect to actual places, service reality, and local context?" },
  { id: "L3", title: "Accountability", icon: Building2, question: "Does it show process, responsibility, boundaries, and next-step clarity?" },
  { id: "L4", title: "Page Unique Value", icon: UserCheck, question: "Does the page deserve to exist on its own?" },
  { id: "L5", title: "Algorithm Fit", icon: Diamond, question: "Is the page structured for modern search and AI citation expectations?" },
];

export function SixLayersOverview() {
  return (
    <section className="pt-20 bg-white overflow-hidden">
      <div className="container mx-auto max-w-4xl px-6">
        
        {/* 标题 */}
        <div className="text-center mb-20">
          <h2 className="text-[36px] md:text-[52px] font-bold text-[#0B0C0E] tracking-tight mb-4">
            The 8 layers of <span className="text-bar-highlight">local page trust</span>
          </h2>
          <div className="w-12 h-1 bg-[#A5D020] mx-auto rounded-full" />
        </div>

        {/* 纵向堆叠容器 */}
        <div className="relative flex flex-col">
          <img src="/images/six-layer-bg.png" alt="SearchTrust 8-layer local page trust framework" className="w-full h-auto" />
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
