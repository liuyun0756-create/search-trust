import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  FileSearch,
  RefreshCw,
  SearchCheck,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

import { RunAuditButton } from "@/components/common/RunAuditButton";

const moments = [
  {
    icon: SearchCheck,
    eyebrow: "Before the first call",
    title: "Qualify a prospect with real market context.",
    body: "Confirm the business and at least one actual local competitor before you spend time preparing a pitch. SearchTrust keeps weak identity matches and missing evidence visible instead of smoothing them over.",
    points: ["Website + public GBP match", "At least one real competitor", "Free input and business confirmation"],
  },
  {
    icon: BriefcaseBusiness,
    eyebrow: "During the proposal",
    title: "Show why the work deserves attention.",
    body: "Use the Prospect report to explain trust gaps, competitive context and the next best actions in language a client can understand—while keeping the deeper source trail available to the advisor.",
    points: ["L1–L8 evidence model", "Advisor and client views", "Source-backed recommendations"],
  },
  {
    icon: BarChart3,
    eyebrow: "After the client says yes",
    title: "Replace assumptions with verified performance.",
    body: "Connect Google Search Console and Google Analytics 4 to the same Case. SearchTrust compares recent and prior 90-day periods and checks source health before generating a plan.",
    points: ["GSC + GA4 connection health", "Recent 90 days vs prior 90", "Public GBP remains observable"],
  },
  {
    icon: RefreshCw,
    eyebrow: "During delivery",
    title: "Regenerate only when new evidence matters.",
    body: "Keep each plan tied to its source snapshot. When evidence changes, the next generation calls it out; when nothing changed, the product does not manufacture a change label.",
    points: ["Historical snapshots", "Evidence-change markers", "One credit per generation"],
  },
] as const;

export function UseCasesV22() {
  return (
    <main className="overflow-hidden bg-[#f3f4ed] text-[#182018]">
      <section className="relative bg-[#101710] px-4 py-20 text-white sm:px-6 sm:py-28 lg:px-8">
        <div aria-hidden="true" className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(184,230,38,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(184,230,38,0.08)_1px,transparent_1px)] [background-size:54px_54px]" />
        <div className="relative mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_0.82fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#b8e626]">Built for small local SEO practices</p>
            <h1 className="mt-5 max-w-4xl font-[family-name:Georgia] text-5xl leading-[0.98] tracking-[-0.055em] sm:text-7xl">One evidence chain from prospect to client delivery.</h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/62">SearchTrust helps independent consultants and small agencies make a credible case before they have private access—then make better decisions once the client shares verified first-party data.</p>
          </div>
          <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">The operating model</p>
            <div className="mt-6 space-y-5">
              {[
                ["01", "Prospect", "Public evidence creates the reason to talk."],
                ["02", "Connect", "The client authorizes GSC and GA4."],
                ["03", "Verified", "Owned data creates the action plan."],
              ].map(([number, title, body]) => (
                <div key={number} className="grid grid-cols-[2.5rem_1fr] gap-3 border-t border-white/10 pt-5 first:border-0 first:pt-0">
                  <span className="font-mono text-xs font-black text-[#b8e626]">{number}</span>
                  <div><p className="font-black">{title}</p><p className="mt-1 text-sm leading-6 text-white/48">{body}</p></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#718d18]">Four moments that matter</p>
            <h2 className="mt-4 font-[family-name:Georgia] text-4xl leading-tight tracking-[-0.04em] sm:text-5xl">Use SearchTrust where evidence changes the decision.</h2>
          </div>
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {moments.map(({ icon: Icon, eyebrow, title, body, points }, index) => (
              <article key={title} className={`rounded-[2rem] p-7 sm:p-10 ${index === 2 ? "bg-[#182018] text-white" : "border border-[#d7ddce] bg-white"}`}>
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${index === 2 ? "bg-[#b8e626] text-[#182018]" : "bg-[#edf3d9] text-[#718d18]"}`}><Icon className="h-5 w-5" /></div>
                <p className={`mt-7 text-xs font-black uppercase tracking-[0.2em] ${index === 2 ? "text-[#b8e626]" : "text-[#718d18]"}`}>{eyebrow}</p>
                <h3 className="mt-3 font-[family-name:Georgia] text-3xl leading-tight tracking-[-0.035em]">{title}</h3>
                <p className={`mt-5 leading-7 ${index === 2 ? "text-white/58" : "text-[#667064]"}`}>{body}</p>
                <ul className="mt-7 space-y-3 text-sm font-bold">
                  {points.map((point) => <li key={point} className="flex items-center gap-2"><Check className="h-4 w-4 text-[#90b51d]" />{point}</li>)}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[#d7ddce] bg-[#e8ecdd] px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
          <div>
            <UsersRound className="h-8 w-8 text-[#718d18]" />
            <h2 className="mt-5 font-[family-name:Georgia] text-4xl tracking-[-0.04em] sm:text-5xl">Designed for expertise that needs leverage—not another dashboard.</h2>
            <p className="mt-6 text-lg leading-8 text-[#667064]">The product is intentionally narrow: help a small local SEO practice win work honestly, preserve the evidence, and improve the client with better data after access is granted.</p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-[1.75rem] border border-[#ccd3c2] bg-[#ccd3c2] sm:grid-cols-2">
            {[
              [FileSearch, "Independent consultant", "Create a defensible client conversation without hand-building a speculative audit."],
              [ShieldCheck, "Small agency", "Give sales, strategy and delivery one shared Case and source history."],
            ].map(([Icon, title, body]) => {
              const Glyph = Icon as typeof FileSearch;
              return <div key={String(title)} className="bg-[#f8f9f3] p-8 sm:p-10"><Glyph className="h-6 w-6 text-[#789b12]" /><h3 className="mt-8 font-[family-name:Georgia] text-2xl">{String(title)}</h3><p className="mt-4 text-sm leading-7 text-[#667064]">{String(body)}</p></div>;
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 rounded-[2rem] bg-[#b8e626] p-8 sm:p-12 lg:flex-row lg:items-center">
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#42540c]">Five permanent credits included</p><h2 className="mt-3 max-w-3xl font-[family-name:Georgia] text-4xl tracking-[-0.04em]">Start with a real business. Spend a credit only when provider-backed work begins.</h2></div>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
            <RunAuditButton trackingSource="use_cases_v22" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#142013] px-6 py-3.5 text-sm font-black text-white">Start a Case <ArrowRight className="h-4 w-4" /></RunAuditButton>
            <Link href="/sample-report" className="inline-flex min-h-13 items-center justify-center rounded-xl border border-[#142013]/20 px-6 py-3.5 text-sm font-black">See sample reports</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
