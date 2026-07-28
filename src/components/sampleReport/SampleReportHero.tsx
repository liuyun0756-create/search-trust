"use client";

import Link from "next/link";
import { ArrowRight, Building2, Download, FileWarning, Layers3, Route } from 'lucide-react';
import {AuditForm} from "@/components/common/AuditForm";


export function SampleReportHero() {
  return (
    <section className="relative min-h-[880px] w-full bg-[#F9F9F9] flex justify-center overflow-visible">
      {/* 背景纹理 */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{
          backgroundImage: "url('/images/abstract-lines.jpg')",
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

            <h1 className="text-[44px] md:text-[52px] font-[800] leading-[1.15] text-[#1D2531] tracking-tight">
              See what a
              <span className="text-[#A5D020]"> SearchTrust </span>
              report looks like
            </h1>

            <div className="mt-8 space-y-4 w-full">
              <p className="text-[#657083] text-[16px] leading-relaxed">
                Follow a local-page diagnosis from evidence-backed findings to prioritized actions, a phased implementation roadmap, and a client-ready report.
              </p>
              <div className="flex max-w-full items-start gap-3 rounded-2xl border border-[#A5D020]/20 bg-[#F4F7E9] px-4 py-3">
                <div className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#A5D020]" />
                <p className="text-[13px] text-[#4B5563] font-bold leading-snug">
                  This sample is illustrative. Some details may be simplified or anonymized.
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/sample-case" target="_blank" className="inline-flex items-center gap-2 px-8 py-3 bg-[#1A1F2B] text-white rounded-lg font-semibold text-[15px] transition-all hover:bg-black hover:shadow-lg active:scale-95">
                View Sample Report
                <ArrowRight size={18} />
              </Link>
              <Link href="/sample-case" target="_blank" className="inline-flex items-center gap-2 px-8 py-3 bg-white text-[#4B5563] border border-[#D1D5DB] rounded-lg font-semibold text-[15px] transition-all hover:border-[#A5D020]/60 hover:bg-[#F8FCEB] active:scale-95">
                <Download size={20} strokeWidth={2.4} />
                Open Sample and Export PDF
              </Link>
            </div>
          </div>

          <div className="flex w-full flex-1 justify-end">
            <div className="w-full max-w-[600px] overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8BAF18]">Sample Agency Audit</p>
                  <h2 className="mt-1 text-[19px] font-extrabold text-[#1A1F2B]">Trust Audit Report</h2>
                </div>
                <span className="bg-[#1A1F2B] px-3 py-2 text-[10px] font-bold text-white">Export PDF</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-1.5 text-center sm:grid-cols-6">
                {[
                  ["Overall", true],
                  ["Page Level", false],
                  ["Key Issues", false],
                  ["L1-L8", false],
                  ["Roadmap", false],
                  ["Presence", false],
                ].map(([label, active]) => (
                  <span
                    key={String(label)}
                    className={`flex min-h-9 items-center justify-center px-1 text-[9px] font-bold ${
                      active ? "bg-[#1A1F2B] text-white" : "bg-[#F5F6F8] text-[#7B8495]"
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>

              <div className="mt-3 border border-[#D6E5F8] bg-[#F5F9FF] p-4">
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#2563EB]">Primary blocking layer</p>
                <p className="mt-1 text-[15px] font-extrabold text-[#1A1F2B]">L3 Entity Consistency</p>
                <p className="mt-2 text-[10px] font-medium leading-4 text-[#657083]">
                  Stabilize checked identity signals before investing in later page improvements.
                </p>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                {[
                  [Layers3, "Complete L1-L8 model", "Eight fixed trust layers with status and findings."],
                  [FileWarning, "Traceable key issues", "Judgement, impact, suggestions, and actions."],
                  [Route, "Implementation roadmap", "Four ordered phases with clear sequencing."],
                  [Building2, "Business presence", "Supplemental non-scoring public profile checks."],
                ].map(([Icon, title, description]) => {
                  const ItemIcon = Icon as typeof Layers3;
                  return (
                    <div key={String(title)} className="min-h-[116px] border border-gray-100 bg-white p-3">
                      <ItemIcon size={15} className="text-[#8BAF18]" aria-hidden="true" />
                      <p className="mt-2 text-[11px] font-extrabold text-[#1A1F2B]">{String(title)}</p>
                      <p className="mt-1 text-[9px] font-medium leading-4 text-[#7B8495]">{String(description)}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-4">
                <p className="text-[10px] font-semibold text-[#657083]">Full Agency Audit</p>
                <p className="text-[10px] font-semibold text-[#657083]">Client Report Preview</p>
              </div>
            </div>
          </div>

        </div>
      </div>
      <AuditForm floating />
    </section>
  );
}
