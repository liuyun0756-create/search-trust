"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function PricingHero() {
  return (
    <section className="pt-20 pb-24 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto mb-8"
      >
        <h1 className="text-[26px] md:text-[40px] font-bold tracking-tighter leading-[1.1] mb-7 ">
          Simple pricing for
          <span className="text-[#A5D020] px-2">one</span>SearchTrust report
        </h1>
        <p className="text-[20px] text-[#6B7280] font-medium">
          Purchase a one-time trust audit for a single submitted URL. No subscription required.
        </p>
      </motion.div>

      <div className="max-w-[1300px] mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 text-left">
        {/* Standard plan */}
        <motion.div
          whileHover={{ y: -10 }}
          className="bg-[#EBECEF] rounded-[32px] p-10 flex flex-col justify-between border border-transparent hover:border-[#A5D020]/30 transition-all duration-500 shadow-sm"
        >
          <div>
            <div className="mb-4">
              <h3 className="text-[28px] font-bold mb-2">
                <span>$19</span> <span className="text-[18px] font-medium text-[#3E4651]">one-time</span>
              </h3>
              <p className="text-[14px] text-[#838383] font-medium">A structured trust diagnosis for one submitted page.</p>
            </div>
            <button className="w-full bg-[#1A212B] text-white py-4 rounded-[16px] font-bold text-[15px] flex items-center justify-center gap-2 hover:bg-black transition-all my-6">
              Buy One Report <ArrowRight className="w-5 h-5" />
            </button>
            <ul className="space-y-3 text-[14px] text-[#3E4651]">
              {[
                '1 page / 1 submitted URL',
                'L0–L5 trust framework evaluation',
                'Current trust status',
                'Dominant failure layer',
                'Key findings by layer',
                'Prioritized improvement path',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#A5D020] shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6 space-y-1">
            <p className="text-[11px] text-[#aaa] text-center">One-time payment. No recurring billing.</p>
            <p className="text-[11px] text-[#aaa] text-center">Taxes may be added at checkout.</p>
          </div>
        </motion.div>

        {/* Team packs */}
        <div className="bg-[#EBECEF]/50 rounded-[32px] p-10 border border-dashed border-gray-300 flex flex-col items-center justify-center text-center">
          <h3 className="text-[28px] font-bold mb-2">Team packs</h3>
          <p className="text-[14px] text-[#838383] font-medium mb-8">For teams reviewing multiple pages.</p>
          <button className="w-full bg-gray-200 text-[#3E4651] py-4 rounded-[16px] font-medium text-[15px]">
            Coming soon.
          </button>
        </div>

        {/* Agency / team access */}
        <div className="bg-[#EBECEF]/50 rounded-[32px] p-10 border border-dashed border-gray-300 flex flex-col items-center justify-center text-center">
          <h3 className="text-[28px] font-bold mb-2">Agency / team access</h3>
          <p className="text-[14px] text-[#838383] font-medium mb-8">For higher-volume workflows and broader rollout.</p>
          <button className="w-full bg-gray-200 text-[#3E4651] py-4 rounded-[16px] font-medium text-[15px]">
            Coming soon.
          </button>
        </div>
      </div>
    </section>
  );
}
