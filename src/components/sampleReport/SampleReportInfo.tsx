"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { FileText, Target } from 'lucide-react';

export function SampleReportInfo() {
  const cards = [
    {
      icon: FileText,
      title: "Sample page type",
      items: [
        "a local service page",
        "a city / location-intent landing page",
        "a page reviewed as a trust diagnosis example"
      ]
    },
    {
      icon: Target,
      title: "Purpose of the sample",
      items: [
        "to show how the report is structured",
        "to explain how SearchTrust applies the framework",
        "to preview the kind of findings and recommendations you receive"
      ]
    }
  ];

  return (
    <section className="pt-50 bg-white">
      <div className="container mx-auto max-w-6xl px-6">
        <div className="text-center max-w-4xl mx-auto mb-16">
          <h2 className="text-[36px] md:text-[44px] font-bold text-[#1A1F2B] mb-6">
            What this sample report shows
          </h2>
          <p className="text-[16px] md:text-[18px] text-gray-500 font-medium">
            This sample is illustrative. Some details may be simplified to show the report structure clearly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className="bg-white rounded-[32px] p-8 flex flex-col min-h-[380px] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-[#A5D020]/40 hover:shadow-[0_8px_30px_rgba(165,208,32,0.08)] transition-all duration-300 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#F4F7E9] flex items-center justify-center mb-8 group-hover:bg-[#A5D020] transition-colors duration-300">
                <card.icon size={24} className="text-[#A5D020] group-hover:text-white transition-colors duration-300" />
              </div>

              <h3 className="text-[20px] font-bold text-[#1A212B] mb-8 leading-[1.2]">
                {card.title}
              </h3>

              <ul className="space-y-4 w-full">
                {card.items.map((item, i) => (
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
