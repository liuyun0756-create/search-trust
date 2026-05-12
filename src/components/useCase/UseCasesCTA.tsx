"use client";

import { ArrowRight } from 'lucide-react';
import { RunAuditButton } from '@/components/common/RunAuditButton';

export function UseCasesCTA() {
  return (
    <section className="py-24 bg-[#0B0C0E]">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-[#A5D020]/5 blur-[140px] rounded-full pointer-events-none" />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <h2 className="text-[32px] md:text-[48px] font-bold text-white leading-tight mb-8">
            Find the use case that matches your pages
          </h2>
          <p className="text-gray-400 text-[16px] md:text-[18px] leading-relaxed max-w-2xl mx-auto mb-10">
            Test it on a real URL — see where trust breaks, which layer matters most,
            and what to fix first.
          </p>
          <RunAuditButton className="inline-flex items-center gap-2 px-8 py-4 bg-[#A5D020] text-[#0B0C0E] font-bold rounded-2xl hover:bg-[#b8e62d] transition-all transform hover:-translate-y-1 shadow-lg shadow-[#A5D020]/20 text-[15px]">
            Run a Trust Audit
            <ArrowRight size={18} />
          </RunAuditButton>
        </div>
      </div>
    </section>
  );
}
