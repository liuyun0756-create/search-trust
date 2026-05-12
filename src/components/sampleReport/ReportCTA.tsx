"use client";

import { ArrowRight } from 'lucide-react';
import { RunAuditButton } from '@/components/common/RunAuditButton';

export function ReportCTA() {
  return (
    <section className="py-24 bg-[#0B0C0E]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-[#A5D020]/5 blur-[140px] rounded-full pointer-events-none" />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <h2 className="text-[32px] md:text-[48px] font-bold text-white leading-tight mb-8">
            Want a report like this for your own page?
          </h2>
          <p className="text-gray-400 text-[16px] md:text-[18px] leading-relaxed max-w-2xl mx-auto mb-10">
            Run SearchTrust on a live URL and see where trust breaks down, which layer
            matters most, and what to fix first.
          </p>
          <RunAuditButton className="inline-flex items-center gap-2 px-8 py-4 bg-white text-[#0B0C0E] font-bold rounded-xl hover:bg-gray-200 transition-colors text-[15px]">
            Run a Trust Audit
            <ArrowRight size={18} />
          </RunAuditButton>
        </div>
      </div>
    </section>
  );
}
