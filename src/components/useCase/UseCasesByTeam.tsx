"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Building2, MapPin, Link2, Globe } from 'lucide-react';

export function UseCasesByTeam() {
  const cases = [
    {
      icon: Building2,
      title: "SEO Agencies",
      items: ["one-time client audits", "proposal scoping", "client-ready PDF delivery"]
    },
    {
      icon: MapPin,
      title: "Local SEO Specialists",
      items: ["priority-page diagnosis", "L1-L8 remediation", "re-audit planning"]
    },
    {
      icon: Link2,
      title: "Affiliate Marketers",
      items: ["priority-page sampling", "template risk review", "pre-rollout quality gates"]
    },
    {
      icon: Globe,
      title: "Multi–location Businesses",
      items: ["representative page sampling", "local entity alignment", "standalone value checks"]
    }
  ];

  return (
    <section className="pt-20 bg-[#F8F9FB]">
      <div className="container mx-auto max-w-7xl px-8">
        <h2 className="text-center text-[36px] md:text-[44px] font-bold text-[#1A212B] mb-6 tracking-tight leading-tight">
          Use cases by team type
        </h2>
        <p className="text-center text-[16px] md:text-[18px] text-[#6B7280] mb-16 leading-[1.2]">
          How different teams use SearchTrust in a one-time audit and remediation workflow
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cases.map((useCase, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -4 }}
              className="group relative min-h-[300px] overflow-hidden rounded-2xl border border-gray-100 bg-white p-7 shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-[#A5D020]/40 hover:shadow-[0_18px_44px_rgba(15,23,42,0.07)]"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-[#A5D020]" />

              <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4F7E9] ring-1 ring-[#A5D020]/15 transition-colors duration-300 group-hover:bg-[#EEF6D4]">
                <useCase.icon size={22} className="text-[#86B800] transition-colors duration-300" />
              </div>

              <h3 className="mb-7 text-[20px] font-bold leading-snug text-[#1A212B]">
                {useCase.title}
              </h3>

              <ul className="space-y-4 w-full">
                {useCase.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-[15px] text-[#4B5563] font-medium leading-relaxed">
                    <span className="mt-2 h-[5px] w-[5px] shrink-0 rounded-full bg-[#A5D020]" />
                    <span className="tracking-tight">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
