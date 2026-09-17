"use client";

import { Users, Search, DollarSign, Building2 } from 'lucide-react';
import { SectionHeader } from '@/components/common/SectionHeader';
import { motion } from 'framer-motion';

const audiences = [
  {
    icon: Users,
    role: 'Independent SEO Consultants',
    desc: 'Use Prospect evidence to make a sharper pitch without spending hours assembling a speculative audit.',
  },
  {
    icon: Search,
    role: 'Small Local SEO Agencies',
    desc: 'Give sales and delivery teams one Case that carries evidence from proposal through implementation.',
  },
  {
    icon: DollarSign,
    role: 'Client Strategy Leads',
    desc: 'Separate public observations from verified first-party performance before setting priorities.',
  },
  {
    icon: Building2,
    role: 'Delivery Specialists',
    desc: 'Connect GSC and GA4 after engagement and regenerate the plan when the underlying evidence changes.',
  },
];

export function WhoThisReportFor() {
  return (
    <section className="pt-20 bg-[#F9FAFB]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader title="Who this type of report is for" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {audiences.map((a, index) => (
            <motion.div
              key={a.role}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className="bg-white rounded-[32px] p-8 flex flex-col items-center min-h-[320px] border border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:border-[#A5D020]/40 hover:shadow-[0_8px_30px_rgba(165,208,32,0.08)] transition-all duration-300 group"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#F4F7E9] flex items-center justify-center mb-8 group-hover:bg-[#A5D020] transition-colors duration-300">
                <a.icon size={24} className="text-[#A5D020] group-hover:text-white transition-colors duration-300" />
              </div>

              <h3 className="text-[20px] font-bold text-[#1A212B] mb-4 text-center leading-[1.2]">
                {a.role}
              </h3>

              <p className="text-[15px] text-[#3E4651] font-medium leading-[1.5] text-center">
                {a.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
