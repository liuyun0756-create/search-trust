"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ScanSearch, Quote, ClipboardList, Route } from 'lucide-react';

const features = [
  {
    icon: ScanSearch,
    title: "Signals Assessed and Findings",
    desc: "Shows the fixed signal count for each layer and the confirmed items that need attention.",
  },
  {
    icon: Quote,
    title: "Evidence and Observations",
    desc: "Keeps source excerpts and missing-signal observations available for verification.",
  },
  {
    icon: ClipboardList,
    title: "Layer Actions",
    desc: "Turns the layer's confirmed findings into implementation tasks with completion signals.",
  },
  {
    icon: Route,
    title: "Implementation Roadmap",
    desc: "Orders remediation into four phases with completion gates, observation guidance, and re-audit timing.",
  },
];

export function FrameworkInProduct() {
  return (
    <section className="pt-20 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* 顶部标题 */}
        <div className="text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[32px] md:text-[42px] font-bold text-[#1A1F2B] mb-4"
          >
            How the framework appears inside SearchTrust
          </motion.h2>
          <p className="text-[16px] text-gray-500 font-medium max-w-xl mx-auto">
            Findings, evidence, and actions remain connected inside the layer, while the roadmap controls the order of work.
          </p>
        </div>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-2">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group relative overflow-hidden rounded-[24px] border border-gray-100 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:border-[#A5D020]/35 hover:shadow-[0_16px_42px_rgba(15,23,42,0.08)] flex flex-col gap-4"
              >
                <div className="absolute inset-x-0 top-0 h-1.5 bg-[#A5D020]" />
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0F5E0] text-[#A5D020] transition-transform duration-300 group-hover:scale-105">
                  <feature.icon size={19} strokeWidth={1.7} />
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-[15px] font-bold text-[#1A1F2B]">
                    {feature.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed text-gray-500 font-medium">
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
        </div>

      </div>
    </section>
  );
}
