import { ArrowRight, ChevronsUp, ShieldCheck } from 'lucide-react';
import Link from "next/link";

const trustLayers = [
  { key: "L8", name: "Algorithm Fit", width: "72%", accent: "#F4C34E" },
  { key: "L7", name: "Page Unique Value", width: "76%", accent: "#E58A5F" },
  { key: "L6", name: "Accountability", width: "80%", accent: "#9BD024" },
  { key: "L5", name: "Real-World Connection", width: "84%", accent: "#40C7A3" },
  { key: "L4", name: "Specificity", width: "88%", accent: "#4CB8D8" },
  { key: "L3", name: "Entity Consistency", width: "92%", accent: "#6294F2" },
  { key: "L2", name: "Entity Presence", width: "96%", accent: "#83B8FF" },
  { key: "L1", name: "Foundation", width: "100%", accent: "#A5D020" },
];

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
            <h1 className="text-[44px] md:text-[52px] font-[800] leading-[1.15] text-[#1D2531] tracking-tight">
              The 8-Layer Local <br />
              Trust <span className="text-bar-highlight text-[#1D2531]">Model</span>
            </h1>

            <div className="mt-8 space-y-4 w-full">
              <p className="text-[#657083] text-[15px] leading-relaxed">
                Local rankings are harder to earn and hold when identity, evidence,
                accountability, or page value breaks down. The 8-layer model examines
                these signals in sequence to show where trust is first lost and how
                that weakness limits the layers above it.
              </p>
              <div className="flex max-w-full items-start gap-3 rounded-2xl border border-[#A5D020]/20 bg-[#F4F7E9] px-4 py-3">
                <div className="mt-1 flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#A5D020]" />
                <p className="text-[11px] md:text-[12px] text-[#4B5563] font-bold leading-snug uppercase tracking-[0.08em]">
                  The 8-layer model identifies the earliest trust barrier to fix, helping teams avoid wasted optimization and build a stronger foundation for stable local visibility.
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

          {/* 右侧层级总览 */}
          <div className="flex-1 w-full flex justify-end">
            <div className="relative w-full max-w-[600px] overflow-hidden rounded-lg border border-white/10 bg-[#111A29] p-5 shadow-[0_28px_70px_rgba(17,26,41,0.20)] md:p-7">
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.10] mix-blend-screen"
                style={{
                  backgroundImage: "url('/images/abstract-lines.jpg')",
                  backgroundPosition: "right center",
                  backgroundRepeat: "no-repeat",
                  backgroundSize: "cover",
                }}
              />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/[0.08] to-transparent" />

              <div className="relative mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-[#A5D020]">
                    <ShieldCheck size={18} />
                    <span className="text-[11px] font-bold uppercase tracking-[0.14em]">
                      Layered trust model
                    </span>
                  </div>
                  <p className="mt-2 text-[17px] font-bold text-white">
                    Trust is built from foundation to outcome
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-[#A5D020]/25 bg-[#A5D020]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#C8ED63]">
                  <ChevronsUp size={14} />
                  Build upward
                </div>
              </div>

              <div className="relative flex flex-col items-center gap-1.5">
                <div className="pointer-events-none absolute bottom-3 left-1/2 top-3 w-px -translate-x-1/2 bg-gradient-to-t from-[#A5D020]/50 via-[#5BAFE8]/35 to-[#F4C34E]/50" />
                {trustLayers.map((layer, index) => (
                  <div
                    key={layer.key}
                    className="relative flex min-h-9 items-center gap-3 border border-white/[0.10] bg-white/[0.065] px-3.5 py-2 text-white shadow-[0_8px_18px_rgba(0,0,0,0.10)] backdrop-blur-sm transition-transform duration-300 hover:-translate-y-0.5 hover:bg-white/[0.10]"
                    style={{
                      width: layer.width,
                      borderRadius: index === 0 ? "8px 8px 5px 5px" : "5px",
                    }}
                  >
                    <span
                      className="flex h-6 w-8 shrink-0 items-center justify-center rounded text-[10px] font-extrabold text-[#111A29]"
                      style={{ backgroundColor: layer.accent }}
                    >
                      {layer.key}
                    </span>
                    <span className="min-w-0 text-[12px] font-bold leading-tight md:text-[13px]">
                      {layer.name}
                    </span>
                    {index === 0 && (
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.12em] text-[#F8D67F]">
                        Outcome
                      </span>
                    )}
                    {index === trustLayers.length - 1 && (
                      <span className="ml-auto text-[9px] font-bold uppercase tracking-[0.12em] text-[#C8ED63]">
                        Foundation
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <p className="relative mt-4 text-center text-[11px] font-medium leading-relaxed text-white/55">
                Stabilize earlier layers first so later proof, differentiation, and search-era fit have a dependable base.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
