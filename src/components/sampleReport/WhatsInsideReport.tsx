"use client";

import { FileText, BarChart3, Target, Layers, Compass, Zap } from 'lucide-react';
import { SectionHeader } from '@/components/common/SectionHeader';
import { motion } from 'framer-motion';

const sections = [
  {
    icon: BarChart3,
    title: 'Current trust status',
    desc: 'A page-level summary of current structural trust strength.',
  },
  {
    icon: Compass,
    title: 'Page interpretation',
    desc: 'Why the page can participate, stall, or stay unstable.',
  },
  {
    icon: Target,
    title: 'Dominant failure layer',
    desc: 'The layer where trust breakdown matters most.',
  },
  {
    icon: Layers,
    title: 'Key issues by layer',
    desc: 'Weaknesses organized through the six-layer model.',
  },
  {
    icon: Zap,
    title: 'Prioritized improvement path',
    desc: 'What to fix first, next, and later.',
  },
  {
    icon: FileText,
    title: 'Strategic recommendations',
    desc: 'Guidance focused on trust impact, not just issue listing.',
  },
];

export function WhatsInsideReport() {
  return (
    <section className="pt-20 bg-[#F8F9FB]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader title="What's inside the report" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {sections.map((s, index) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className="bg-white rounded-[32px] p-8 flex flex-col items-center min-h-[280px] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-[#A5D020]/40 hover:shadow-[0_8px_30px_rgba(165,208,32,0.08)] transition-all duration-300 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#F4F7E9] flex items-center justify-center mb-8 group-hover:bg-[#A5D020] transition-colors duration-300">
                <s.icon size={24} className="text-[#A5D020] group-hover:text-white transition-colors duration-300" />
              </div>

              <h3 className="text-[20px] font-bold text-[#1A212B] mb-4 text-center leading-[1.2]">
                {s.title}
              </h3>

              <p className="text-[15px] text-[#3E4651] font-medium leading-[1.5] text-center">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
