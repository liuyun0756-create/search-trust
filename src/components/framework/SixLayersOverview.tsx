"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Sparkles, MapPin, Building2, UserCheck, Diamond, Fingerprint, Link2 } from 'lucide-react';

const layers = [
  { id: "L1", title: "Foundation", icon: ShieldCheck, question: "Does this page have a clear service, topic, and local intent foundation?" },
  { id: "L2", title: "Entity Presence", icon: Fingerprint, question: "Can a real business entity be identified from the page and available signals?" },
  { id: "L3", title: "Entity Consistency", icon: Link2, question: "Do business identity signals stay consistent across the checked surfaces?" },
  { id: "L4", title: "Specificity", icon: Sparkles, question: "Does the page feel specific and grounded, not generic or reusable?" },
  { id: "L5", title: "Real-World Connection", icon: MapPin, question: "Does it connect to actual places, service reality, and local context?" },
  { id: "L6", title: "Accountability", icon: Building2, question: "Does it show process, responsibility, boundaries, and next-step clarity?" },
  { id: "L7", title: "Page Unique Value", icon: UserCheck, question: "Does the page deserve to exist on its own?" },
  { id: "L8", title: "Algorithm Fit", icon: Diamond, question: "Does the page support clear interpretation by users and search systems?" },
];

export function SixLayersOverview() {
  return (
    <section className="pt-20 bg-white overflow-hidden">
      <div className="container mx-auto max-w-6xl px-6">
        
        {/* 标题 */}
        <div className="text-center mb-20">
          <h2 className="text-[36px] md:text-[52px] font-bold text-[#0B0C0E] tracking-tight mb-4">
            The 8 layers of <span className="text-bar-highlight">local page trust</span>
          </h2>
          <div className="w-12 h-1 bg-[#A5D020] mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {layers.map((layer, index) => (
            <motion.div
              key={layer.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="grid min-h-[160px] grid-cols-[48px_1fr] gap-4 rounded-lg border border-gray-100 bg-[#F8F9FA] p-6"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-[#7FA40F]">
                <layer.icon size={20} />
              </div>
              <div>
                <span className="text-[12px] font-black text-[#7FA40F]">{layer.id}</span>
                <h3 className="mt-1 text-[18px] font-bold text-[#1A1F2B]">{layer.title}</h3>
                <p className="mt-3 text-[14px] font-medium leading-relaxed text-gray-500">{layer.question}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
