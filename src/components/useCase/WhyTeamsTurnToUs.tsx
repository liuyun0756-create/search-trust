"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Layers, MessageCircleWarning, Wrench } from 'lucide-react';

const painPoints = [
  {
    icon: Layers,
    title: 'Local templates scale faster than trust',
    description:
      'Teams publish hundreds of city pages that look different on the surface but fail the same trust signals underneath.',
  },
  {
    icon: MessageCircleWarning,
    title: 'Teams struggle to explain why pages feel "off"',
    description:
      'Many teams are not lacking SEO data — they lack the ability to explain trust failure in structural terms.',
  },
  {
    icon: Wrench,
    title: 'Existing tools don\'t diagnose local trust collapse',
    description:
      'Standard SEO tools verify whether things were done, but cannot explain whether a page is genuinely specific, grounded, or independently valuable.',
  },
];

export function WhyTeamsTurnToUs() {
  return (
    <section className="py-20 bg-[#F9FAFB]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-block px-3 py-1 rounded-full bg-[#F4F7E9] text-[#A5D020] text-[12px] font-bold mb-6">
            Why teams turn to SearchTrust
          </div>
          <h2 className="text-[36px] md:text-[44px] font-bold text-[#1A1F2B] leading-[1.2]">
            The problem isn&apos;t data — it&apos;s trust diagnosis
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {painPoints.map((point, index) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-[24px] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#F4F7E9] flex items-center justify-center mb-6">
                <point.icon size={24} className="text-[#A5D020]" />
              </div>
              <h3 className="text-[18px] font-bold text-[#1A1F2B] mb-4 leading-snug">
                {point.title}
              </h3>
              <p className="text-[15px] text-[#6B7280] leading-relaxed font-medium">
                {point.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
