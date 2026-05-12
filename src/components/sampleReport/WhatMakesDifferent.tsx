import { Check, X } from 'lucide-react';
import { SectionHeader } from '@/components/common/SectionHeader';

const typicalItems = [
  'flat issue list',
  'technical checks',
  'generic recommendations',
  'little trust interpretation',
  'weak fix prioritization',
];

const trustItems = [
  'layer-based diagnosis',
  'identifies dominant failure point',
  'explains local trust weakness',
  'prioritizes fixes by structural impact',
  'built for local page interpretation',
];

export function WhatMakesDifferent() {
  return (
    <section className="py-24 bg-white">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeader title="What makes this report different" />

        <div className="relative max-w-5xl mx-auto pt-10">
          <div className="flex flex-col md:flex-row items-stretch">

            {/* 左侧 Typical */}
            <div className="w-full md:w-[480px] bg-[#F8F9FA] rounded-[24px] p-10 md:p-14 md:pr-24 z-10 border border-gray-100">
              <h3 className="text-[18px] font-bold text-[#1A1F2B] mb-8">
                Typical SEO audit
              </h3>
              <ul className="space-y-5">
                {typicalItems.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-[#6B7280] text-[15px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* 右侧 SearchTrust */}
            <div className="w-full md:w-[500px] bg-[#1A1F2B] rounded-[24px] p-10 md:p-14 md:pl-20 z-20 md:-ml-12 shadow-[0_30px_60px_rgba(0,0,0,0.15)]">
              <h3 className="text-[18px] font-bold text-white mb-8">
                Search Trust report
              </h3>
              <ul className="space-y-5">
                {trustItems.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-200 text-[16px] font-medium">
                    <Check size={18} className="text-[#A5D020] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* VS 圆圈 */}
          <div className="absolute left-1/2 top-1/2 -translate-x-[90px] -translate-y-1/2 z-30 hidden md:flex">
            <div className="w-16 h-16 rounded-full bg-[#A5D020] flex items-center justify-center shadow-[0_0_30px_rgba(165,208,32,0.4)] border-[6px] border-white">
              <span className="text-white font-black text-[18px] tracking-tighter italic">VS</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
