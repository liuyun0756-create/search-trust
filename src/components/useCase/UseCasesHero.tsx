import { ArrowRight } from 'lucide-react';

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
          backgroundImage: "url('/images/abstract-lines.png')",
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

            <h1 className="text-[44px] md:text-[52px] font-[800] leading-[72px] text-[#1D2531] tracking-tight">
              Use Cases for <br />
              <span className="text-[#A5D020]">SearchTrust</span>
            </h1>

            <div className="mt-8 space-y-4 w-full">
              <p className="text-[#6B7280] text-[15px] leading-relaxed">
                From pre-publish local page reviews to diagnosing ranking stagnation,
                SearchTrust helps teams understand where page trust breaks and what to fix first.
              </p>
              <div className="flex flex-wrap gap-3">
                {userTags.map((tag) => (
                  <span
                    key={tag}
                    className="px-4 py-2 rounded-full bg-white/60 border border-gray-200 text-[12px] font-bold text-gray-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
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

          {/* 右侧图片区域 */}
          <div className="flex-1 w-full flex justify-center">
            <div className="w-[600px] h-[560px] rounded-2xl relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <img src="/images/use-case.png" alt="Use Cases" />
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
