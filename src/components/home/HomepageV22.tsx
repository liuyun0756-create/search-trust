import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  CircleDot,
  FileSearch,
  Fingerprint,
  Gauge,
  LineChart,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { RunAuditButton } from "@/components/common/RunAuditButton";

const evidenceRows = [
  ["Business identity", "Matched", "Site + public GBP"],
  ["Local competitors", "3 confirmed", "Live market evidence"],
  ["Trust gaps", "Prioritized", "L1–L8 framework"],
] as const;

const verifiedRows = [
  ["Search Console", "Healthy", "90-day comparison"],
  ["Google Analytics", "Healthy", "Engagement evidence"],
  ["Public GBP", "Matched", "SerpAPI observation"],
] as const;

function CreditPill() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#b8e626]/30 bg-[#b8e626]/10 px-3 py-1.5 text-xs font-bold text-[#d8ff66]">
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      5 permanent credits when you join
    </div>
  );
}

function EvidenceBoard() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] lg:mr-0">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-[#b8e626]/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#172018] shadow-[0_34px_100px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#b8e626] text-[#142013]">
              <Fingerprint className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#b8e626]">Evidence dossier</p>
              <p className="mt-0.5 text-sm font-bold text-white">Northstar Plumbing · Denver</p>
            </div>
          </div>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-bold text-white/55">V2.2</span>
        </div>

        <div className="grid gap-px bg-white/10 sm:grid-cols-2">
          <div className="bg-[#172018] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">Before the sale</p>
              <UsersRound className="h-4 w-4 text-[#b8e626]" aria-hidden="true" />
            </div>
            <p className="mt-4 font-[family-name:Georgia] text-2xl leading-tight text-white">A case your prospect can believe.</p>
            <div className="mt-6 space-y-3">
              {evidenceRows.map(([label, value, source]) => (
                <div key={label} className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-white/65">{label}</span>
                    <span className="font-black text-[#d8ff66]">{value}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-white/35">{source}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#1d281d] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">After the sale</p>
              <LineChart className="h-4 w-4 text-[#b8e626]" aria-hidden="true" />
            </div>
            <p className="mt-4 font-[family-name:Georgia] text-2xl leading-tight text-white">A plan grounded in verified data.</p>
            <div className="mt-6 space-y-3">
              {verifiedRows.map(([label, value, source]) => (
                <div key={label} className="rounded-xl border border-white/8 bg-white/[0.035] p-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-white/65">{label}</span>
                    <span className="inline-flex items-center gap-1 font-black text-[#d8ff66]"><Check className="h-3 w-3" />{value}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-white/35">{source}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/15 px-5 py-4 text-xs sm:px-6">
          <span className="inline-flex items-center gap-2 font-bold text-white/55"><ShieldCheck className="h-4 w-4 text-[#b8e626]" /> Every conclusion keeps its source</span>
          <span className="font-black text-white">1 workflow · 1 credit</span>
        </div>
      </div>
    </div>
  );
}

export function HomepageV22() {
  return (
    <div className="overflow-hidden bg-[#f3f4ed] text-[#182018] selection:bg-[#b8e626] selection:text-[#142013]">
      <section className="relative isolate bg-[#101710] px-4 pb-24 pt-16 text-white sm:px-6 sm:pb-32 sm:pt-24 lg:px-8">
        <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-40 [background-image:linear-gradient(rgba(184,230,38,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(184,230,38,0.08)_1px,transparent_1px)] [background-size:54px_54px]" />
        <div aria-hidden="true" className="absolute -left-36 top-10 -z-10 h-[34rem] w-[34rem] rounded-full bg-[#7b9f15]/15 blur-[120px]" />
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <CreditPill />
            <p className="mt-8 text-xs font-black uppercase tracking-[0.28em] text-white/45">Local SEO intelligence for independent experts</p>
            <h1 className="mt-5 max-w-3xl font-[family-name:Georgia] text-[3.25rem] leading-[0.98] tracking-[-0.055em] sm:text-[4.7rem] lg:text-[5.35rem]">
              Win the client with <span className="text-[#c9f33d]">evidence.</span>
              <span className="mt-3 block text-white/72">Improve the business with verified data.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-white/62">
              SearchTrust turns public market evidence into a persuasive Prospect report, then turns connected first-party data into a Verified Action Plan after the client says yes.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <RunAuditButton trackingSource="home_v22_hero" className="group inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#b8e626] px-6 py-3.5 text-sm font-black text-[#142013] transition hover:bg-[#d1f75d] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b8e626]/30">
                Start with 5 free credits <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </RunAuditButton>
              <Link href="/sample-report" className="inline-flex min-h-13 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">
                Explore a sample report
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-white/42">
              <span>No subscription</span><span>Credits never expire</span><span>Technical failures return the credit</span>
            </div>
          </div>
          <EvidenceBoard />
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#718d18]">One system · two decisive moments</p>
              <h2 className="mt-4 font-[family-name:Georgia] text-4xl leading-[1.05] tracking-[-0.04em] sm:text-5xl">The sales conversation and the delivery work finally share the same evidence.</h2>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-[#667064] lg:justify-self-end">Built for independent SEO consultants and small local SEO agencies who need more than another audit export: a defensible reason to act, and a reliable way to prove what changed.</p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            <article className="group relative overflow-hidden rounded-[2rem] border border-[#d7ddce] bg-[#fafbf7] p-7 shadow-[0_18px_55px_rgba(24,32,24,0.06)] sm:p-10">
              <div aria-hidden="true" className="absolute -right-16 -top-16 h-48 w-48 rounded-full border-[28px] border-[#b8e626]/15 transition-transform duration-500 group-hover:scale-110" />
              <div className="relative">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#182018] text-[#b8e626]"><Search className="h-5 w-5" /></span>
                <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-[#718d18]">Prospect · before the engagement</p>
                <h3 className="mt-3 font-[family-name:Georgia] text-4xl tracking-[-0.035em]">Earn the right to recommend.</h3>
                <p className="mt-5 max-w-xl leading-7 text-[#667064]">Confirm the business, identify at least one real competitor, and assemble a source-backed view of local trust gaps. The output gives your pitch a concrete case—without pretending public data can prove private performance.</p>
                <ul className="mt-8 grid gap-3 text-sm font-bold sm:grid-cols-2">
                  {["Public site + GBP identity", "Real competitor context", "Traceable L1–L8 findings", "Advisor and client-ready views"].map((item) => <li key={item} className="flex items-center gap-2"><CircleDot className="h-4 w-4 text-[#86aa16]" />{item}</li>)}
                </ul>
              </div>
            </article>

            <article className="group relative overflow-hidden rounded-[2rem] bg-[#1a241a] p-7 text-white shadow-[0_24px_70px_rgba(24,32,24,0.18)] sm:p-10">
              <div aria-hidden="true" className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_80%_10%,#b8e626_0,transparent_30%)]" />
              <div className="relative">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#b8e626] text-[#182018]"><BarChart3 className="h-5 w-5" /></span>
                <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-[#b8e626]">Verified · after the engagement</p>
                <h3 className="mt-3 font-[family-name:Georgia] text-4xl tracking-[-0.035em]">Replace assumptions with observed performance.</h3>
                <p className="mt-5 max-w-xl leading-7 text-white/60">Connect Search Console and Google Analytics. SearchTrust combines those owned sources with the confirmed public business profile and the original Prospect evidence to produce a Verified Action Plan.</p>
                <ul className="mt-8 grid gap-3 text-sm font-bold sm:grid-cols-2">
                  {["Recent 90 days vs prior 90", "GSC + GA4 source health", "Evidence changes called out", "Regenerate when new data matters"].map((item) => <li key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-[#b8e626]" />{item}</li>)}
                </ul>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="border-y border-[#d9ded3] bg-[#e9ecdf] px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-[#718d18]">A disciplined evidence chain</p>
              <h2 className="mt-4 max-w-3xl font-[family-name:Georgia] text-4xl leading-tight tracking-[-0.04em] sm:text-5xl">Every answer shows what it knows—and what it does not.</h2>
            </div>
            <Link href="/framework" className="inline-flex items-center gap-2 text-sm font-black underline decoration-[#91b724] decoration-2 underline-offset-4">See the framework <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="mt-14 grid gap-px overflow-hidden rounded-[1.75rem] border border-[#ccd3c2] bg-[#ccd3c2] md:grid-cols-4">
            {[
              ["01", FileSearch, "Collect", "Public pages, business identity and real market competitors."],
              ["02", Fingerprint, "Match", "Keep each source attached to the correct business and Case."],
              ["03", Gauge, "Diagnose", "Separate confirmed findings from missing or unavailable evidence."],
              ["04", RefreshCw, "Verify", "Use owned performance data to update the action plan when reality changes."],
            ].map(([number, Icon, title, body]) => {
              const Glyph = Icon as typeof FileSearch;
              return <article key={String(number)} className="min-h-64 bg-[#f7f8f2] p-7">
                <div className="flex items-center justify-between"><span className="font-mono text-xs font-black text-[#7e8a78]">{String(number)}</span><Glyph className="h-5 w-5 text-[#7d9f17]" /></div>
                <h3 className="mt-14 font-[family-name:Georgia] text-2xl">{String(title)}</h3>
                <p className="mt-4 text-sm leading-6 text-[#667064]">{String(body)}</p>
              </article>;
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
        <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[2.2rem] border border-[#d7ddce] bg-white shadow-[0_24px_80px_rgba(24,32,24,0.08)] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="p-8 sm:p-12 lg:p-16">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[#718d18]">Simple permanent credits</p>
            <h2 className="mt-4 font-[family-name:Georgia] text-4xl tracking-[-0.04em] sm:text-5xl">Use a credit when the work creates value.</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#667064]">Entering a site and confirming the business is free. A credit is used when SearchTrust starts the provider-backed workflow that discovers competitors and builds the Prospect analysis—or when it generates a Verified Action Plan.</p>
            <div className="mt-9 flex flex-wrap gap-3 text-sm font-bold">
              {["5 credits at signup", "No expiration", "No subscription", "Failure-safe refund"].map((item) => <span key={item} className="rounded-full border border-[#d7ddce] bg-[#f6f8ef] px-4 py-2">{item}</span>)}
            </div>
          </div>
          <div className="flex flex-col justify-between bg-[#b8e626] p-8 text-[#142013] sm:p-12 lg:p-16">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em]">Additional credits</p>
              <div className="mt-6 flex items-end gap-3"><span className="font-[family-name:Georgia] text-7xl leading-none tracking-[-0.06em]">$19</span><span className="pb-2 text-sm font-black">USD / credit</span></div>
              <p className="mt-6 max-w-sm font-semibold leading-7 text-[#34410e]">One account balance. Use it across Prospect and Verified workflows on any of your Cases.</p>
            </div>
            <Link href="/pricing" className="group mt-10 inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#142013] px-6 py-3.5 text-sm font-black text-white transition hover:bg-black">See pricing details <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
          </div>
        </div>
      </section>

      <section className="px-4 pb-28 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.2rem] bg-[#101710] px-7 py-16 text-center text-white sm:px-12 sm:py-20">
          <div aria-hidden="true" className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_50%_100%,#8aae18_0,transparent_42%)]" />
          <div className="relative mx-auto max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#b8e626]">Your next client conversation can start with evidence</p>
            <h2 className="mt-5 font-[family-name:Georgia] text-4xl leading-tight tracking-[-0.04em] sm:text-6xl">Build the case. Win the work. Verify the change.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/58">Create an account, receive five permanent credits, and use the first one when you are ready to investigate a real local business.</p>
            <RunAuditButton trackingSource="home_v22_footer" className="group mx-auto mt-9 inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#b8e626] px-7 py-3.5 text-sm font-black text-[#142013] transition hover:bg-[#d1f75d]">Start with 5 free credits <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></RunAuditButton>
          </div>
        </div>
      </section>
    </div>
  );
}
