"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Building2, Check, FileSearch, Layers3, Route, Target } from "lucide-react";
import { RunAuditButton } from "@/components/common/RunAuditButton";
import { AuditForm } from "@/components/common/AuditForm";
import { AuditFormModal } from "@/components/common/AuditFormModal";
import { PaymentModal } from "@/components/common/PaymentModal";

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true";

export function HeroSection() {
  // --- Dev test flow state ---
  const [devModalOpen, setDevModalOpen] = useState(false);
  const [devPaymentOpen, setDevPaymentOpen] = useState(false);
  const [devSubmitting] = useState(false);
  const [devFormData, setDevFormData] = useState<{ url: string; gbpUrl: string; pageType: string } | null>(null);

  const handleDevSubmit = useCallback((data: { url: string; gbpUrl: string; pageType: string }) => {
    // Skip login + credits check, go straight to payment
    setDevFormData(data);
    setDevModalOpen(false);
    setDevPaymentOpen(true);
  }, []);

  const handleDevPaymentSuccess = useCallback(() => {
    setDevPaymentOpen(false);
    // PaymentModal redirects to Dodo, return_url handles the rest
  }, []);

  const handleDevPaymentClose = useCallback(() => {
    setDevPaymentOpen(false);
    setDevFormData(null);
  }, []);

  return (
    <section className="relative min-h-[880px] w-full bg-[#F9F9F9] flex justify-center overflow-visible">
      {/* 背景纹理 - 使用图片或SVG抽象线条 */}
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

      <div className=" mx-auto max-w-8xl px-6 px-4 sm:px-6 lg:px-8 pt-20 pb-20 relative z-10">
        <div className="flex flex-col lg:flex-row  justify-between gap-12">

          {/* 左侧文字区域 */}
          <div className="flex-1 max-w-2xl">
            <div className="mb-6 pt-3">
              <span className="inline-block px-3 py-1 text-[12px] tracking-[0.2em] font-bold text-[#4A4A5A] border border-gray-200 rounded bg-white/50 backdrop-blur-sm uppercase">
                SearchTrust Insight Engine
              </span>
            </div>

            <h1 className="text-[44px] md:text-[52px] font-[800] leading-[1.15] text-[#1D2531] tracking-tight">
              Diagnose why a local page struggles to establish trust
              <span className="text-[#A5D020]"> and what to fix first</span>
            </h1>

            <div className="mt-8 space-y-4 w-full">
              <p className="text-[#657083] text-[16px] leading-relaxed">
                Local pages are more likely to earn and hold stable rankings when their trust signals are clear and consistent. SearchTrust shows where trust breaks down, the evidence behind each finding, and what to fix first.
              </p>
              <div className="flex items-start gap-3 rounded-2xl border border-[#A5D020]/20 bg-[#F4F7E9] px-4 py-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#7FA40F] shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                  <Target size={15} strokeWidth={2} />
                </div>
                <p className="text-[#4B5563] text-[15px] font-semibold leading-relaxed">
                  Built for agencies and local SEO teams that need a defensible diagnosis, an executable roadmap, and client-ready delivery.
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <RunAuditButton className="px-8 py-3 bg-[#1A1F2B] text-white rounded-lg font-semibold text-[15px] transition-all hover:bg-black hover:shadow-lg active:scale-95">
                Run a Trust Audit
              </RunAuditButton>
              <Link href="/sample-case" target="_blank" className="px-8 py-3 bg-white text-[#1A1F2B] border border-[#D1D5DB] rounded-lg font-semibold text-[15px] transition-all hover:bg-gray-50 active:scale-95">
                View Sample Report
              </Link>

              {/* === DEV TEST BUTTON === */}
              {DEV_MODE && (
                <button
                  onClick={() => setDevModalOpen(true)}
                  className="px-8 py-3 bg-red-500 text-white rounded-lg font-semibold text-[15px] transition-all hover:bg-red-600 active:scale-95"
                >
                  [Dev] Test Payment Flow
                </button>
              )}
            </div>
          </div>

          <div className="flex w-full flex-1 justify-end">
            <div className="relative w-full max-w-[600px] overflow-hidden rounded-2xl border border-white/70 bg-white/85 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.10)] backdrop-blur-md sm:p-6">
              <div className="mb-5 border-b border-gray-100 pb-4">
                <div>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#8BAF18]">
                    Agency Audit
                  </p>
                  <h2 className="mt-1 text-[20px] font-extrabold text-[#1A1F2B]">Trust Audit Report</h2>
                  <p className="mt-1 text-[12px] font-medium text-[#7B8495]">One priority local service page</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Trust status", "Medium weak", "text-[#2563EB]"],
                  ["Ranking potential", "Strong", "text-[#059669]"],
                  ["Risk level", "Medium", "text-[#D97706]"],
                ].map(([label, value, color]) => (
                  <div key={label} className="min-h-[88px] border border-gray-100 bg-[#FAFBFC] p-3">
                    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#929BAD]">{label}</p>
                    <p className={`mt-3 text-[14px] font-extrabold leading-tight ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="border border-gray-100 bg-white p-4">
                  <div className="flex items-center gap-2 text-[#1A1F2B]">
                    <Layers3 size={16} className="text-[#8BAF18]" aria-hidden="true" />
                    <p className="text-[12px] font-extrabold">L1-L8 Trust Breakdown</p>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-1.5">
                    {["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8"].map((layer, index) => (
                      <span
                        key={layer}
                        className={`flex h-8 items-center justify-center text-[10px] font-extrabold ${
                          index === 2 || index === 3
                            ? "bg-[#FFF3E5] text-[#B45309]"
                            : "bg-[#ECFDF5] text-[#047857]"
                        }`}
                      >
                        {layer}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-[11px] font-semibold text-[#657083]">
                    <FileSearch size={14} aria-hidden="true" />
                    Evidence and observations
                  </div>
                </div>

                <div className="border border-gray-100 bg-white p-4">
                  <div className="flex items-center gap-2 text-[#1A1F2B]">
                    <Route size={16} className="text-[#8BAF18]" aria-hidden="true" />
                    <p className="text-[12px] font-extrabold">Implementation Roadmap</p>
                  </div>
                  <div className="mt-4 space-y-2.5">
                    {[
                      "Stabilize the entity",
                      "Build local credibility",
                      "Add accountable proof",
                      "Reassess search fit",
                    ].map((phase, index) => (
                      <div key={phase} className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#A5D020] text-[9px] font-extrabold text-[#172009]">
                          {index + 1}
                        </span>
                        <span className="text-[10px] font-semibold text-[#657083]">{phase}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between gap-3 border border-[#DDE8BD] bg-[#F7FAEE] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Building2 size={16} className="text-[#789B11]" aria-hidden="true" />
                  <div>
                    <p className="text-[11px] font-extrabold text-[#263018]">Business Presence Audit</p>
                    <p className="text-[9px] font-medium text-[#718052]">Supplemental, non-scoring checks</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-[#4B6410]">
                  <Check size={13} aria-hidden="true" />
                  Checked
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      <AuditForm floating />

      {/* === DEV TEST MODALS === */}
      {DEV_MODE && (
        <>
          <AuditFormModal
            isOpen={devModalOpen}
            onClose={() => { setDevModalOpen(false); setDevFormData(null); }}
            onSubmit={handleDevSubmit}
            submitting={devSubmitting}
          />
          <PaymentModal
            isOpen={devPaymentOpen}
            onClose={handleDevPaymentClose}
            onSuccess={handleDevPaymentSuccess}
            formData={devFormData}
          />
        </>
      )}
    </section>
  );
};
