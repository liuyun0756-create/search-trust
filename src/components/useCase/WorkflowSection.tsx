"use client";

import React from 'react';
import { motion } from 'framer-motion';
import {
  FileCheck,
  Rocket,
  BarChart3,
  AlertTriangle,
  Stethoscope,
  Wrench,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';

const steps = [
  {
    icon: FileCheck,
    label: 'Pre-publish trust review',
    shortLabel: 'Review',
  },
  {
    icon: Rocket,
    label: 'Publish page',
    shortLabel: 'Publish',
  },
  {
    icon: BarChart3,
    label: 'Monitor rankings / GSC',
    shortLabel: 'Monitor',
  },
  {
    icon: AlertTriangle,
    label: 'If visibility stalls',
    shortLabel: 'Stalled?',
  },
  {
    icon: Stethoscope,
    label: 'Run trust diagnosis',
    shortLabel: 'Diagnose',
  },
  {
    icon: Wrench,
    label: 'Prioritize fixes',
    shortLabel: 'Fix',
  },
  {
    icon: RotateCcw,
    label: 'Re-audit',
    shortLabel: 'Re-audit',
  },
];

export function WorkflowSection() {
  return (
    <section className="pt-24 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-block px-3 py-1 rounded-full bg-[#F4F7E9] text-[#A5D020] text-[12px] font-bold mb-6">
            Where SearchTrust fits in your workflow
          </div>
          <h2 className="text-[36px] md:text-[44px] font-bold text-[#1A1F2B] leading-[1.2]">
            From publish to diagnosis
          </h2>
        </div>

        {/* Desktop flow */}
        <div className="hidden md:flex items-start justify-center gap-0">
          {steps.map((step, index) => (
            <React.Fragment key={step.shortLabel}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                className="flex flex-col items-center text-center w-[130px]"
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${
                  index === 0 || index === 4 || index === 6
                    ? 'bg-[#A5D020]/10 border-2 border-[#A5D020]/30'
                    : 'bg-[#F3F4F6]'
                }`}>
                  <step.icon size={24} className={
                    index === 0 || index === 4 || index === 6
                      ? 'text-[#A5D020]'
                      : 'text-[#6B7280]'
                  } />
                </div>
                <span className="text-[13px] font-bold text-[#1A1F2B] leading-tight">
                  {step.shortLabel}
                </span>
              </motion.div>
              {index < steps.length - 1 && (
                <div className="flex items-center pt-5 px-1">
                  <ArrowRight size={16} className="text-gray-300" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Mobile flow */}
        <div className="md:hidden space-y-4">
          {steps.map((step, index) => (
            <motion.div
              key={step.shortLabel}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-4 bg-[#F9FAFB] rounded-2xl p-4"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                index === 0 || index === 4 || index === 6
                  ? 'bg-[#A5D020]/10 border-2 border-[#A5D020]/30'
                  : 'bg-white'
              }`}>
                <step.icon size={18} className={
                  index === 0 || index === 4 || index === 6
                    ? 'text-[#A5D020]'
                    : 'text-[#6B7280]'
                } />
              </div>
              <span className="text-[15px] font-bold text-[#1A1F2B]">{step.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
