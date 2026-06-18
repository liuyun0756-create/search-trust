"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Target } from "lucide-react";
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
                Search Trust Insight Engine
              </span>
            </div>

            <h1 className="text-[44px] md:text-[52px] font-[800] leading-[72px] text-[#1D2531] tracking-tight">
              Find why Google doesn&apos;t
              trust <span className="text-[#A5D020]">your local page</span>
              <br />
              and what to fix first
            </h1>

            <div className="mt-8 space-y-4 w-full">
              <p className="text-[#657083] text-[16px] leading-relaxed">
                SearchTrust analyzes a submitted local, city, service-area, or location page through a structured trust model and shows where trust breaks down, which layer matters most, and what to fix first.
              </p>
              <div className="flex items-start gap-3 rounded-2xl border border-[#A5D020]/20 bg-[#F4F7E9] px-4 py-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#7FA40F] shadow-[0_6px_18px_rgba(15,23,42,0.06)]">
                  <Target size={15} strokeWidth={2} />
                </div>
                <p className="text-[#4B5563] text-[15px] font-semibold leading-relaxed">
                  Built for local pages that look optimized but still struggle to rank, hold visibility, or compete consistently.
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

          {/* 右侧图片空置区域 */}
          <div className="flex-1 w-full flex justify-end">
            <div className="w-[600px] h-[560px] rounded-2xl border border-white/60 bg-white/30 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#A5D020]/10 blur-[80px] rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center text-gray-300 italic font-light">
                <img src="/images/home-banner-bg.png" alt="Home Banner Background" />
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
