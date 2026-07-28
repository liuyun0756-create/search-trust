"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { RunAuditButton } from '@/components/common/RunAuditButton';

function ComingSoonPattern({ variant = "layers" }: { variant?: "layers" | "agency" }) {
  const accents =
    variant === "layers"
      ? ["left-10 top-12 h-12 w-12", "right-10 bottom-12 h-16 w-16", "left-1/2 bottom-20 h-10 w-10"]
      : ["right-12 top-10 h-12 w-12", "left-10 bottom-14 h-16 w-16", "right-1/3 bottom-24 h-10 w-10"];

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(165,208,32,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(26,31,43,0.04)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="absolute left-1/2 top-8 h-44 w-44 -translate-x-1/2 rounded-full bg-[#A5D020]/18 blur-[70px]" />
      <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full border border-[#A5D020]/20" />
      <div className="absolute -left-10 bottom-10 h-32 w-32 rounded-full border border-[#1A212B]/10" />
      {accents.map((item, index) => (
        <div
          key={item}
          className={`absolute ${item} rounded-2xl border border-[#A5D020]/20 bg-white/55 shadow-[0_14px_34px_rgba(15,23,42,0.05)]`}
        >
          <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#A5D020]" />
          {index === 1 && (
            <div className="absolute inset-3 rounded-xl border border-dashed border-[#A5D020]/30" />
          )}
        </div>
      ))}
    </div>
  );
}

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
          className="relative overflow-hidden rounded-[32px] border border-[#A5D020]/30 bg-white p-10 shadow-[0_22px_70px_rgba(15,23,42,0.08)] transition-all duration-500 hover:border-[#A5D020]/60 hover:shadow-[0_28px_90px_rgba(15,23,42,0.12)] flex flex-col justify-between"
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[#A5D020]" />
          <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[#A5D020]/16 blur-[70px]" />
          <div className="absolute bottom-24 right-8 h-24 w-24 rounded-full border border-[#A5D020]/20" />
          <div className="relative z-10">
            <div className="mb-6 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#A5D020]/25 bg-[#F7F9F2] px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-[#6E9800]">
                <ShieldCheck className="h-4 w-4" />
                Single report
              </span>
              <span className="rounded-full bg-[#1A212B] px-3 py-1.5 text-[12px] font-bold text-white">
                One-time
              </span>
            </div>

            <div className="mb-6">
              <div className="flex items-end gap-2">
                <span className="text-[52px] font-black leading-none tracking-tight text-[#111827]">$19</span>
                <span className="pb-2 text-[16px] font-bold text-[#6B7280]">/ submitted URL</span>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-[#55616F]">
                An evidence-backed trust diagnosis for one submitted page, delivered as a web report with PDF export and a clear fix path.
              </p>
            </div>

            <RunAuditButton className="group w-full bg-[#1A212B] text-white py-4 rounded-[16px] font-bold text-[15px] flex items-center justify-center gap-2 border border-[#1A212B] shadow-[0_14px_30px_rgba(26,33,43,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#A5D020] hover:bg-black hover:shadow-[0_18px_36px_rgba(165,208,32,0.28)]">
              Buy One Report <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
            </RunAuditButton>

            <div className="my-6 rounded-[24px] border border-[#EDF0E3] bg-[#F8FAF3] p-5">
              <p className="mb-4 text-[12px] font-black uppercase tracking-[0.14em] text-[#7FA40F]">
                What's included
              </p>
              <ul className="space-y-3 text-[14px] font-medium text-[#3E4651]">
              {[
                '1 page / 1 submitted URL',
                '8-layer trust model evaluation',
                'Trust status, ranking potential, and risk level',
                'Evidence-backed key issues',
                'Data coverage and safe GBP alignment status',
                'Client / Analyst report views and PDF export',
                'Light agency-ready branding placeholders',
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-[#86B800]" />
                    <span>{item}</span>
                </li>
              ))}
              </ul>
            </div>
          </div>
          <div className="relative z-10 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-center shadow-sm">
            <p className="text-[12px] font-semibold text-[#6B7280]">One-time payment. No recurring billing.</p>
            <p className="text-[11px] text-[#A0A7B1]">Taxes may be added at checkout.</p>
          </div>
        </motion.div>

        {/* Team packs */}
        <div className="relative overflow-hidden rounded-[32px] border border-dashed border-[#A5D020]/35 bg-[#F7F9F2] p-10 shadow-sm flex flex-col items-center justify-center text-center">
          <ComingSoonPattern variant="layers" />
          <div className="relative z-10 flex w-full flex-col items-center">
            <h3 className="text-[28px] font-bold mb-2">Team packs</h3>
            <p className="text-[14px] text-[#64707D] font-medium mb-8">For teams reviewing multiple pages.</p>
            <button className="w-full bg-white/75 text-[#3E4651] py-4 rounded-[16px] font-medium text-[15px] border border-[#A5D020]/20 shadow-sm">
            Coming soon.
            </button>
          </div>
        </div>

        {/* Agency / team access */}
        <div className="relative overflow-hidden rounded-[32px] border border-dashed border-[#1A212B]/15 bg-white p-10 shadow-sm flex flex-col items-center justify-center text-center">
          <ComingSoonPattern variant="agency" />
          <div className="relative z-10 flex w-full flex-col items-center">
            <h3 className="text-[28px] font-bold mb-2">Agency / team access</h3>
            <p className="text-[14px] text-[#64707D] font-medium mb-8">For higher-volume workflows and broader rollout.</p>
            <button className="w-full bg-[#F7F9F2]/90 text-[#3E4651] py-4 rounded-[16px] font-medium text-[15px] border border-[#A5D020]/20 shadow-sm">
            Coming soon.
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
