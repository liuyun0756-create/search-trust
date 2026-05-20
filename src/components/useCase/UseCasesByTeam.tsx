"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Building2, MapPin, Link2, Globe } from 'lucide-react';

export function UseCasesByTeam() {
  const cases = [
    {
      icon: Building2,
      title: "SEO Agencies",
      items: ["pre–publish QA", "stuck page diagnosis", "client reporting"]
    },
    {
      icon: MapPin,
      title: "Local SEO Specialists",
      items: ["local page qualification", "trust breakdown analysis", "page improvement prioritization"]
    },
    {
      icon: Link2,
      title: "Affiliate Marketers",
      items: ["scaled page review", "doorway–risk detection", "template quality control"]
    },
    {
      icon: Globe,
      title: "Multi–location Businesses",
      items: ["location page consistency", "local entity alignment", "standalone value checks"]
    }
  ];

  return (
    <section className="pt-20 bg-[#F8F9FB]">
      <div className="container mx-auto max-w-[1300px] px-8">
        <h2 className="text-center text-[36px] md:text-[44px] font-bold text-[#1A212B] mb-6 tracking-tight leading-tight">
          Use cases by team type
        </h2>
        <p className="text-center text-[16px] md:text-[18px] text-[#6B7280] mb-16 leading-[1.2]">
          How different teams use SearchTrust in their daily workflow
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {cases.map((useCase, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className="bg-white rounded-[32px] p-8 flex flex-col items-center min-h-[380px] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-[#A5D020]/40 hover:shadow-[0_8px_30px_rgba(165,208,32,0.08)] transition-all duration-300 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#F4F7E9] flex items-center justify-center mb-8 group-hover:bg-[#A5D020] transition-colors duration-300">
                <useCase.icon size={24} className="text-[#A5D020] group-hover:text-white transition-colors duration-300" />
              </div>

              <h3 className="text-[20px] font-bold text-[#1A212B] mb-8 text-center leading-[1.2]">
                {useCase.title}
              </h3>

              <ul className="space-y-4 w-full">
                {useCase.items.map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-[15px] text-[#3E4651] font-medium leading-[1.5]">
                    <span className="w-[5px] h-[5px] rounded-full bg-[#A5D020] shrink-0 group-hover:scale-125 transition-transform" />
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