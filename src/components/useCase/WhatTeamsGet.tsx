"use client";

import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Zap,
  MessageSquare,
  ClipboardCheck,
  ListOrdered,
  TrendingUp,
} from 'lucide-react';

const benefits = [
  {
    icon: ShieldCheck,
    title: 'Fewer weak pages published',
    description: 'Catch trust issues before pages go live, reducing the volume of low-trust content reaching search engines.',
  },
  {
    icon: Zap,
    title: 'Faster diagnosis of non-performing pages',
    description: 'Skip the guesswork. Get a structured explanation for why a specific page isn\'t earning trust.',
  },
  {
    icon: MessageSquare,
    title: 'More credible client communication',
    description: 'Show clients a structured trust breakdown instead of vague recommendations or opinions.',
  },
  {
    icon: ClipboardCheck,
    title: 'Better quality control for scaled local SEO',
    description: 'Review priority pages in a multi-location rollout against trust standards, not just surface-level checks.',
  },
  {
    icon: ListOrdered,
    title: 'Clearer prioritization of fixes',
    description: 'Know which trust layer is collapsing and what to fix first — instead of trying everything at once.',
  },
  {
    icon: TrendingUp,
    title: 'Stronger trust readiness for local search',
    description: 'Build pages that qualify as genuine local entity entry points, not just keyword-optimized templates.',
  },
];

export function WhatTeamsGet() {
  return (
    <section className="pt-20 bg-[#F9FAFB]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">

          <h2 className="text-[36px] md:text-[44px] font-bold text-[#1A1F2B] leading-[1.2]">
            What teams get from these use cases
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((benefit, index) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08 }}
              className="bg-white rounded-[24px] p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-gray-100 hover:shadow-md transition-shadow group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#F4F7E9] flex items-center justify-center mb-5 group-hover:bg-[#A5D020] transition-colors">
                <benefit.icon size={24} className="text-[#A5D020] group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-[17px] font-bold text-[#1A1F2B] mb-3 leading-snug">
                {benefit.title}
              </h3>
              <p className="text-[15px] text-[#6B7280] leading-relaxed font-medium">
                {benefit.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
