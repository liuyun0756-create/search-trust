"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function PricingHero() {
  return (
    <section className="pt-32 pb-24 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto mb-20"
      >
        <h1 className="text-[56px] md:text-[72px] font-bold tracking-tighter leading-[1.1] mb-8">
          Simple pricing for <br />
          <span className="text-[#A5D020]">one</span> SearchTrust report
        </h1>
        <p className="text-xl text-[#3E4651] opacity-60 font-medium">
          No subscriptions. No hidden fees. Pure diagnostic clarity.
        </p>
      </motion.div>

      <div className="max-w-[1300px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
        {/* Standard plan */}
        <motion.div
          whileHover={{ y: -10 }}
          className="bg-[#EBECEF] rounded-[56px] p-12 flex flex-col justify-between border border-transparent hover:border-[#A5D020]/30 transition-all duration-500 shadow-sm"
        >
          <div>
            <div className="flex justify-between items-start mb-12">
              <div>
                <p className="text-[14px] font-black uppercase tracking-[0.2em] text-[#A5D020] mb-2">
                  Standard
                </p>
                <h3 className="text-[32px] font-bold">One-time</h3>
              </div>
              <div className="text-right">
                <span className="text-[48px] font-bold">$19</span>
              </div>
            </div>
            <ul className="space-y-5 mb-12 text-[16px] font-semibold text-[#3E4651]">
              {[
                'L0–L5 Trust Framework Evaluation',
                'Dominant Failure Layer Identification',
                'Delivered within 2 hours',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#A5D020]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <button className="w-full bg-[#1A212B] text-white py-6 rounded-[24px] font-bold text-lg flex items-center justify-center gap-2 hover:bg-black transition-all">
            Buy One Report <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>

        {/* Coming soon cards */}
        {['Team Packs', 'Agency Access'].map((title, i) => (
          <div
            key={i}
            className="bg-[#EBECEF]/50 rounded-[56px] p-12 border border-dashed border-gray-300 flex flex-col justify-center items-center"
          >
            <h3 className="text-[28px] font-bold text-gray-300 mb-4">{title}</h3>
            <span className="px-6 py-2 rounded-full bg-gray-200 text-gray-400 font-bold text-xs uppercase tracking-widest">
              Coming Soon
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
