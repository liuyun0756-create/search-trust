"use client";

import React from 'react';
import { motion } from 'framer-motion';

const workflowStages = [
  { stage: 'Select one priority page', desc: 'Choose a high-value, underperforming, or representative public URL.' },
  { stage: 'Run the Agency Audit', desc: 'Assess the fixed L1-L8 model and available Business Presence data.' },
  { stage: 'Approve the work scope', desc: 'Use confirmed findings, actions, and the Client PDF to align stakeholders.' },
  { stage: 'Complete the active phase', desc: 'Implement the highlighted phase and confirm its completion requirements.' },
  { stage: 'Observe after publishing', desc: 'Allow the page and search systems time to absorb the completed changes.' },
  { stage: 'Re-audit the page', desc: 'Verify the new evidence and decide whether the next phase should begin.' },
];

export function WorkflowIntegrations() {
  return (
    <section className="pt-20 bg-[#F8F9FB]">
      <div className="container mx-auto max-w-7xl px-8">
        
        {/* 标题部分 */}
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[42px] md:text-[54px] font-bold text-[#1A212B] tracking-tight leading-tight"
          >
            Where <span className="text-[#A5D020]">SearchTrust</span> fits in your workflow
          </motion.h2>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="rounded-[32px] border border-[#EBECEF] bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.04)] md:p-10"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
            {workflowStages.map((step, index) => (
              <div key={step.stage} className="relative">
                {index < workflowStages.length - 1 && (
                  <div className="absolute left-[22px] top-[52px] h-[calc(100%+16px)] w-px bg-[#DDE8B9] md:hidden" />
                )}
                {index < workflowStages.length - 1 && (
                  <div className="absolute left-[calc(100%-8px)] top-[23px] hidden h-px w-8 bg-[#DDE8B9] xl:block" />
                )}

                <div className="relative h-full rounded-2xl border border-gray-100 bg-[#F8F9FA] p-5 transition-all">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[13px] font-black text-[#86B800] ring-1 ring-[#A5D020]/20">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>

                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                    Step {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="mb-3 text-[15px] font-bold leading-snug text-[#1A1F2B]">
                    {step.stage}
                  </h3>
                  <p className="text-[12px] font-medium leading-relaxed text-[#6B7280]">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* 底部提示 */}
        {/* <p className="mt-10 text-center text-[14px] text-gray-400 font-medium">
          → SearchTrust provides the diagnostic "bridge" when traditional growth plateaus.
        </p> */}
      </div>
    </section>
  );
}
