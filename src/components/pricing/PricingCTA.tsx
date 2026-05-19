"use client";

import React from 'react';
import { motion } from 'framer-motion';

export function PricingCTA() {
  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-[1300px] mx-auto">
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="bg-[#1A212B] rounded-[64px] p-12 md:p-20 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12"
        >
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#A5D020] opacity-[0.08] blur-[120px] -mr-48 -mt-48" />

          <div className="relative z-10 max-w-2xl">
            <h2 className="text-white text-[40px] md:text-[48px] font-bold leading-[1.2] tracking-tight">
              Purchase your first report and see how{' '}
              <span className="text-[#A5D020]">SearchTrust</span> diagnoses trust
              breakdown on a real page.
            </h2>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-6">
            <button className="bg-[#A5D020] text-[#1A212B] px-12 py-8 rounded-[32px] font-black text-xl hover:scale-105 transition-transform shadow-[0_20px_40px_-10px_rgba(165,208,32,0.3)]">
              Buy One Report
            </button>
          </div>
        </motion.div>

        <p className="mt-12 text-center text-[13px] text-[#3E4651] opacity-40 font-medium max-w-2xl mx-auto leading-relaxed">
          Policy note: By purchasing, you agree to our Terms of Service and Refund Policy.
          Payments are processed by Paddle, our merchant of record.
        </p>
      </div>
    </section>
  );
}
