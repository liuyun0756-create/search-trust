"use client";

import React from 'react';
import { motion } from 'framer-motion';

const benefits = [
  {
    title: "A six-layer trust diagnosis for one submitted page",
    desc: "Comprehensive evaluation for one submitted page using our L0—L5 model."
  },
  {
    title: "The dominant failure point holding the page back",
    desc: "Pinpoint exactly which structural layer is holding your page back from ranking."
  },
  {
    title: "Prioritized recommendations based on trust impact",
    desc: "Actionable steps ordered by their direct impact on search trust scores."
  },
  {
    title: "Delivery by email within two hours of submission",
    desc: "Receive your full technical report within two hours of submission."
  }
];

export function WhatYouGet() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* 居中标题 */}
        <div className="text-center mb-16">
          <h2 className="text-[36px] md:text-[42px] font-bold text-[#1A1F2B] mb-4">
            What you get
          </h2>
        
        </div>

        {/* 四列卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((item, index) => (
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
              {/* <p className="text-[14px] text-gray-500 leading-relaxed font-medium">
                {item.desc}
              </p> */}
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
