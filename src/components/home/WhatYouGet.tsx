"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface CardItem {
  title: string;
  desc?: string;
}

interface WhatYouGetProps {
  title?: string;
  items?: CardItem[];
}

const defaultBenefits = [
  {
    title: "A six-layer trust diagnosis for one submitted page",
  },
  {
    title: "The dominant failure point holding the page back",
  },
  {
    title: "Prioritized recommendations based on trust impact",
  },
  {
    title: "Delivery by email within two hours of submission",
  }
];

export function WhatYouGet({ title = "What you get", items = defaultBenefits }: WhatYouGetProps) {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* 居中标题 */}
        <div className="text-center mb-16">
          <h2 className="text-[36px] md:text-[42px] font-bold text-[#1A1F2B] mb-4">
            {title}
          </h2>
        </div>

        {/* 四列卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-[#F8F9FA] rounded-2xl p-8 border border-gray-100 hover:shadow-lg transition-shadow"
            >
              <h3 className="text-[18px] font-bold text-[#1D2531] mb-3 leading-snug">
                {item.title}
              </h3>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
