"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { RunAuditButton } from '@/components/common/RunAuditButton';

export function PricingCTA() {
  return (
    <section className="relative overflow-hidden bg-[#F7F9F2] px-6 py-20">
      <div className="absolute inset-0 z-0 opacity-[0.08]">
        <img
          src="/images/bottom-bg.jpg"
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,rgba(165,208,32,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(26,31,43,0.04)_1px,transparent_1px)] bg-[size:56px_56px]" />
      <div className="absolute inset-x-0 top-0 z-0 h-px bg-gradient-to-r from-transparent via-[#A5D020]/40 to-transparent" />
      <div className="absolute left-1/2 top-8 z-0 h-72 w-72 -translate-x-1/2 rounded-full bg-[#A5D020]/16 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-[1300px]">
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white bg-white/78 p-8 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-md md:px-12 md:py-14"
        >
          <div className="relative z-10 flex flex-col items-center text-center">
            <h2 className="mb-8 max-w-3xl text-[30px] font-bold leading-tight tracking-tight text-[#1A1F2B] md:text-[42px]">
              Purchase your first report and see how{' '}
              <span className="text-bar-highlight">SearchTrust diagnoses trust breakdown</span>
              {' '}on a real page.
            </h2>
            <RunAuditButton
              className="inline-flex items-center justify-center rounded-xl bg-[#1A1F2B] px-8 py-4 font-bold text-white transition-colors hover:bg-black"
            >
              Buy One Report
            </RunAuditButton>
          </div>
        </motion.div>

        <p className="mt-12 text-center text-[13px] text-[#3E4651] opacity-40 font-medium max-w-2xl mx-auto leading-relaxed">
          Policy note: By purchasing, you agree to our Terms of Service and Refund Policy.
          Payments are processed securely via Dodo Payments.
        </p>
      </div>
    </section>
  );
}
