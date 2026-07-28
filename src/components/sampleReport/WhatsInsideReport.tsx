"use client";

import { FileText, BarChart3, Target, Layers, Compass, Zap } from 'lucide-react';
import { SectionHeader } from '@/components/common/SectionHeader';
import { motion } from 'framer-motion';

const sections = [
  {
    icon: BarChart3,
    title: 'Overall decision summary',
    desc: 'The primary blocking layer, current trust status, urgency, and first priority.',
  },
  {
    icon: Compass,
    title: 'Page-level interpretation',
    desc: 'The current assessment, existing foundation, main limitation, and likely outcome.',
  },
  {
    icon: Target,
    title: 'Key Issues with actions',
    desc: 'Confirmed issues with judgement, impact, suggestions, and executable work items.',
  },
  {
    icon: Layers,
    title: 'L1-L8 trust breakdown',
    desc: 'Signals assessed, findings requiring attention, source evidence, and layer actions.',
  },
  {
    icon: Zap,
    title: 'Four-phase roadmap',
    desc: 'Ordered remediation with completion gates, observation guidance, and re-audit timing.',
  },
  {
    icon: FileText,
    title: 'Business Presence and delivery',
    desc: 'Public GBP checks plus a client preview, Client PDF, and Full Audit PDF.',
  },
];

export function WhatsInsideReport() {
  return (
    <section className="pt-20 bg-[#F8F9FB]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader title="What's inside the report" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {sections.map((s, index) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -4 }}
              className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-7 min-h-[230px] shadow-[0_16px_40px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-[#A5D020]/40 hover:shadow-[0_18px_44px_rgba(15,23,42,0.07)]"
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-[#A5D020]" />

              <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4F7E9] ring-1 ring-[#A5D020]/15 transition-colors duration-300 group-hover:bg-[#EEF6D4]">
                <s.icon size={22} className="text-[#86B800] transition-colors duration-300" />
              </div>

              <h3 className="mb-3 text-[19px] font-bold leading-snug text-[#1A212B]">
                {s.title}
              </h3>

              <p className="text-[15px] font-medium leading-relaxed text-[#4B5563]">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
