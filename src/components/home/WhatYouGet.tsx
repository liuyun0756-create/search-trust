"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, ScanSearch, ListOrdered, Send } from 'lucide-react';

interface CardItem {
  title: string;
  desc?: string;
  icon?: React.ElementType;
}

interface WhatYouGetProps {
  title?: string;
  items?: CardItem[];
}

const defaultBenefits = [
  {
    icon: Shield,
    title: "A complete evidence-backed L1-L8 diagnosis for one submitted page",
  },
  {
    icon: ScanSearch,
    title: "Confirmed findings with source evidence you can trace back to the page",
  },
  {
    icon: ListOrdered,
    title: "A four-phase implementation roadmap with completion and re-audit guidance",
  },
  {
    icon: Send,
    title: "A full Agency Audit plus a simplified client preview and client-ready PDF",
  }
];

export function WhatYouGet({ title = "What you get", items = defaultBenefits }: WhatYouGetProps) {
  return (
    <section className="pt-50 pb-20 bg-[#F9F9F9]">
      <div className="container mx-auto max-w-8xl px-4 sm:px-6 lg:px-8">

        {/* 居中标题 */}
        <div className="text-center mb-16">
          <h2 className="text-[36px] md:text-[42px] font-bold text-[#1A1F2B]">
            {title}
          </h2>
          <div className="section-title-bar" />
        </div>

        {/* 2x2 网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="flex items-center gap-4 bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-md transition-shadow"
            >
              {item.icon && (
                <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0">
                  <item.icon size={18} strokeWidth={1.5} className="text-[#A5D020]" />
                </div>
              )}
              <span className="text-[16px] font-medium text-[#1D2531] leading-snug">
                {item.title}
              </span>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
