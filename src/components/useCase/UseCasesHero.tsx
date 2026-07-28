import { ArrowRight, Check, ClipboardCheck, FileSearch, FileText, Route } from 'lucide-react';

const userTags = [
  'SEO Agencies',
  'Local SEO Teams',
  'Affiliate Operators',
  'Multi-Location Businesses',
];

export function UseCasesHero() {
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

      <div className=" mx-auto max-w-8xl px-6 px-4 sm:px-6 lg:px-8 py-20 relative z-10">
        <div className="flex flex-col lg:flex-row  justify-between gap-12">

          {/* 左侧文字区域 */}
          <div className="flex-1 max-w-2xl">
            <div className="mb-6">
              <span className="inline-block px-3 py-1 text-[10px] tracking-[0.2em] font-bold text-[#666] border border-gray-200 rounded bg-white/50 backdrop-blur-sm uppercase">
                Use Cases
              </span>
            </div>

            <h1 className="text-[44px] md:text-[52px] font-[800] leading-[1.15] text-[#1D2531] tracking-tight">
              Turn one local page audit into
              <span className="text-[#A5D020]"> a defensible work plan</span>
            </h1>

            <div className="mt-8 space-y-4 w-full">
              <p className="text-[#6B7280] text-[15px] leading-relaxed">
                SearchTrust helps agencies and local SEO teams diagnose one priority page, scope the remediation, deliver a client-ready explanation, and verify the next phase.
              </p>
            </div>

            <div className="mt-10 max-w-lg rounded-2xl border border-[#A5D020]/20 bg-[#F4F7E9] p-3 shadow-[0_14px_32px_rgba(15,23,42,0.04)]">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {userTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/75 px-3.5 py-2 text-[12px] font-bold text-[#4B5563] ring-1 ring-[#A5D020]/15"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#A5D020]/15 text-[#86B800]">
                      <Check size={12} strokeWidth={3} />
                    </span>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-4">
              <a
                href="/sample-case"
                target="_blank"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-[#1A1F2B] text-white rounded-lg font-semibold text-[15px] transition-all hover:bg-black hover:shadow-lg active:scale-95"
              >
                View Sample Report
                <ArrowRight size={18} />
              </a>
            </div>
          </div>

          <div className="flex w-full flex-1 justify-center">
            <div className="w-full max-w-[600px] overflow-hidden rounded-2xl border border-white/70 bg-white/90 p-5 shadow-[0_24px_60px_rgba(15,23,42,0.10)]">
              <div className="border-b border-gray-100 pb-4">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8BAF18]">Agency Workflow</p>
                <h2 className="mt-1 text-[19px] font-extrabold text-[#1A1F2B]">From audit to approved work</h2>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                {[
                  [FileSearch, "Audit", "One priority URL"],
                  [ClipboardCheck, "Review", "Evidence and findings"],
                  [Route, "Plan", "Four ordered phases"],
                  [FileText, "Deliver", "Client-ready PDF"],
                ].map(([Icon, title, detail], index) => {
                  const StepIcon = Icon as typeof FileSearch;
                  return (
                    <div key={String(title)} className="min-h-[118px] bg-[#F8F9FA] p-3">
                      <div className="flex items-center justify-between">
                        <StepIcon size={15} className="text-[#8BAF18]" aria-hidden="true" />
                        <span className="text-[9px] font-extrabold text-[#A5D020]">0{index + 1}</span>
                      </div>
                      <p className="mt-3 text-[11px] font-extrabold text-[#1A1F2B]">{String(title)}</p>
                      <p className="mt-1 text-[9px] font-medium leading-4 text-[#7B8495]">{String(detail)}</p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 border border-gray-100 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#929BAD]">Common decisions supported</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {[
                    "Scope a client remediation proposal",
                    "Diagnose an indexed-but-stuck page",
                    "Review a page before publishing",
                    "Re-audit after a completed phase",
                    "Sample priority multi-location pages",
                    "Separate scoring from presence checks",
                  ].map((item) => (
                    <div key={item} className="flex min-h-10 items-center gap-2 bg-[#FAFBFC] px-3 py-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#EAF4C9] text-[#6F8F0E]">
                        <Check size={11} strokeWidth={3} aria-hidden="true" />
                      </span>
                      <span className="text-[10px] font-semibold leading-4 text-[#536071]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between bg-[#F4F7E9] px-4 py-3">
                <p className="text-[10px] font-bold text-[#44521F]">One audit, one defensible next step</p>
                <ArrowRight size={15} className="text-[#789B11]" aria-hidden="true" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
