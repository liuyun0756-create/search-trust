import { ArrowRight } from 'lucide-react';
import Link from "next/link";

export function FrameworkHero() {
  return (
    <section className="relative min-h-[600px] w-full overflow-hidden bg-[#F9F9F9] flex items-center">
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

      <div className=" mx-auto max-w-8xl px-6 px-4 sm:px-6 lg:px-8 pt-20 pb-20 relative z-10">
        <div className="flex flex-col lg:flex-row  justify-between gap-12">

          {/* 左侧文字区域 */}
          <div className="flex-1 max-w-2xl">
            <div className="mb-6 pt-3">
              <span className="inline-block px-3 py-1 text-[10px] tracking-[0.2em] font-bold text-[#666] border border-gray-200 rounded bg-white/50 backdrop-blur-sm uppercase">
                SearchTrust v2.1 Framework
              </span>
            </div>

            <h1 className="text-[44px] md:text-[52px] font-[800] leading-[72px] text-[#1D2531] tracking-tight">
              The 8-Layer Local <br />
              Trust <span className="text-bar-highlight text-[#1D2531]">Model</span>
            </h1>

            <div className="mt-8 space-y-4 w-full">
              <p className="text-[#657083] text-[15px] leading-relaxed">
                A structural framework for diagnosing whether a local page has the
                entity, evidence, accountability, and page-level signals needed to
                compete as a trustworthy local entry point.
              </p>
              <div className="flex max-w-full items-start gap-3 rounded-2xl border border-[#A5D020]/20 bg-[#F4F7E9] px-4 py-3">
                <div className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#A5D020]" />
                <p className="text-[11px] md:text-[12px] text-[#4B5563] font-bold leading-snug uppercase tracking-[0.08em]">
                  The current product uses an 8-layer evidence-backed diagnosis, evolved from the earlier SearchTrust trust-collapse framework.
                </p>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/sample-case" target="_blank" className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#1A1F2B] text-white rounded-lg font-semibold text-[15px] transition-all hover:bg-black hover:shadow-lg active:scale-95">
                View Sample Report
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>

          {/* 右侧图片区域 */}
          <div className="flex-1 w-full flex justify-end">
            <div className="w-[600px] h-[612px] rounded-2xl border border-white/60 bg-white/30 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.05)] relative overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#A5D020]/10 blur-[80px] rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <img src="/images/six-layer-trust-model.png" alt="SearchTrust 8-layer local trust model" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
