"use client";

import Link from "next/link";
import { ArrowRight } from 'lucide-react';
import {AuditForm} from "@/components/common/AuditForm";


export function SampleReportHero() {
  return (
    <section className="relative min-h-[880px] w-full bg-[#F9F9F9] flex justify-center overflow-visible">
      {/* 背景纹理 */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: "url('/images/abstract-lines.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/80 via-transparent to-white/20" />
      </div>

      <div className=" px-4 sm:px-6 lg:px-8 pt-20 pb-20 relative z-10">
        <div className="flex flex-col lg:flex-row justify-between gap-12">

          {/* 左侧文字区域 */}
          <div className="flex-1 max-w-2xl">
            <div className="mb-6 pt-3">
              <span className="inline-block px-3 py-1 text-[12px] tracking-[0.2em] font-bold text-[#4A4A5A] border border-gray-200 rounded bg-white/50 backdrop-blur-sm uppercase">
                Diagnostic Sample
              </span>
            </div>

            <h1 className="text-[44px] md:text-[52px] font-[800] leading-[72px] text-[#1D2531] tracking-tight">
              See what a
              <span className="text-[#A5D020]"> SearchTrust </span>
              report looks like
            </h1>

            <div className="mt-8 space-y-4 w-full">
              <p className="text-[#657083] text-[16px] leading-relaxed">
                Explore a sample local page trust audit and see how SearchTrust diagnoses trust breakdown across six structural layers.
              </p>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]" />
                <p className="text-[13px] text-gray-500 font-bold italic">
                  This sample is illustrative. Some details may be simplified or anonymized.
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/sample-case" target="_blank" className="inline-flex items-center gap-2 px-8 py-3 bg-[#1A1F2B] text-white rounded-lg font-semibold text-[15px] transition-all hover:bg-black hover:shadow-lg active:scale-95">
                View Sample Report
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          {/* 右侧图片区域 */}
          <div className="flex-1 w-full flex justify-end">
            <div className="w-[600px] h-[560px] rounded-2xl border border-white/60 bg-white/30 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#A5D020]/10 blur-[80px] rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <img src="/images/sample-report.png" alt="Sample Report Preview" />
              </div>
            </div>
          </div>

        </div>
      </div>
      <AuditForm floating />
    </section>
  );
}
