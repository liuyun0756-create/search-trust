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
  ["Local competitors", "1–3 confirmed", "Live market evidence"],
  ["Trust gaps", "Prioritized", "L1–L8 framework"],
] as const;

const verifiedRows = [
  ["Search Console", "Connected", "90-day comparison"],
  ["Google Analytics", "Connected", "Engagement evidence"],
  ["Public Business Profile", "Matched", "Public search evidence"],
] as const;

function CreditPill() {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg bg-[#eaf3e8] px-3 py-1.5 text-xs font-semibold text-[#42614a]">
      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      5 permanent credits when you join
    </div>
  );
}

function EvidenceBoard() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] lg:mr-0">
      <div className="relative overflow-hidden rounded-2xl border border-[#e3eae2] bg-white shadow-[0_16px_48px_rgba(29,42,34,0.07)]">
        <div className="flex items-center justify-between border-b border-[#e3eae2] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#dcefd4] text-[#356b3c]">
              <Fingerprint className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#668a50]">Evidence dossier</p>
              <p className="mt-0.5 text-sm font-semibold text-[#26432e]">Northstar Plumbing · Denver</p>
            </div>
          </div>
          <span className="rounded-lg bg-[#f2f7f1] px-2.5 py-1 text-[10px] font-semibold text-[#718073]">V2.2</span>
        </div>

        <div className="grid gap-px bg-[#e3eae2] sm:grid-cols-2">
          <div className="bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#718073]">Before the sale</p>
              <UsersRound className="h-4 w-4 text-[#57805b]" aria-hidden="true" />
            </div>
            <p className="mt-4 font-[family-name:Georgia] text-2xl leading-tight text-[#1d2a22]">A case your prospect can believe.</p>
            <div className="mt-6 space-y-3">
              {evidenceRows.map(([label, value, source]) => (
                <div key={label} className="rounded-lg bg-[#f7faf7] p-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-[#647466]">{label}</span>
                    <span className="font-semibold text-[#356b3c]">{value}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-[#8b998d]">{source}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#f2f7f1] p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#718073]">After the sale</p>
              <LineChart className="h-4 w-4 text-[#57805b]" aria-hidden="true" />
            </div>
            <p className="mt-4 font-[family-name:Georgia] text-2xl leading-tight text-[#1d2a22]">A plan grounded in verified data.</p>
            <div className="mt-6 space-y-3">
              {verifiedRows.map(([label, value, source]) => (
                <div key={label} className="rounded-lg bg-white p-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-[#647466]">{label}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[#356b3c]"><Check className="h-3 w-3" />{value}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-[#8b998d]">{source}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e3eae2] bg-white px-5 py-4 text-xs sm:px-6">
          <span className="inline-flex items-center gap-2 font-semibold text-[#647466]"><ShieldCheck className="h-4 w-4 text-[#57805b]" /> Every conclusion keeps its source</span>
          <span className="font-semibold text-[#26432e]">1 workflow · 1 credit</span>
        </div>
      </div>
    </div>
  );
}

export function HomepageV22() {
  return (
    <div className="overflow-hidden bg-[#f7faf7] text-[#1d2a22]">
      <section className="relative isolate bg-[#f7faf7] px-4 pb-24 pt-16 sm:px-6 sm:pb-32 sm:pt-24 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[0.92fr_1.08fr]">
          <div>
            <CreditPill />
            <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-[#668a50]">Local SEO intelligence for consultants and small agencies</p>
            <h1 className="mt-5 max-w-3xl font-[family-name:Georgia] text-[3.25rem] leading-[0.98] tracking-[-0.055em] sm:text-[4.7rem] lg:text-[5.35rem]">
              Win the client with <span className="text-[#57805b]">evidence.</span>
              <span className="mt-3 block text-[#647466]">Improve the business with verified data.</span>
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-[#647466]">
              Before the engagement, use public business and competitor evidence to show why action is needed. After the client connects Search Console and Google Analytics, turn verified performance into the next action plan.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <RunAuditButton trackingSource="home_v22_hero" className="group inline-flex min-h-13 items-center justify-center gap-2 rounded-lg bg-[#26432e] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#365d40]">
                Start with one business <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </RunAuditButton>
              <Link href="/sample-report" className="inline-flex min-h-13 items-center justify-center rounded-lg border border-[#dfe7dc] bg-white px-6 py-3.5 text-sm font-semibold text-[#42614a] transition-colors hover:bg-[#f2f7f1]">
                View a sample report
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-[#718073]">
              <span>5 permanent credits added at sign-in</span><span>No subscription</span><span>Technical failures return 1 credit</span>
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
                <p className="mt-5 max-w-xl leading-7 text-[#667064]">Confirm the business, identify at least one real local competitor, and turn public evidence into a defensible reason to act. Use the Advisor view for your analysis and the Client view for the conversation.</p>
                <ul className="mt-8 grid gap-3 text-sm font-bold sm:grid-cols-2">
                  {["Public site + GBP identity", "Real competitor context", "Traceable L1–L8 findings", "Advisor and client-ready views"].map((item) => <li key={item} className="flex items-center gap-2"><CircleDot className="h-4 w-4 text-[#86aa16]" />{item}</li>)}
                </ul>
              </div>
            </article>

            <article className="group relative overflow-hidden rounded-2xl border border-[#e3eae2] bg-[#f2f7f1] p-7 text-[#1d2a22] sm:p-10">
              <div className="relative">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#dcefd4] text-[#356b3c]"><BarChart3 className="h-5 w-5" /></span>
                <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-[#668a50]">Verified · after the engagement</p>
                <h3 className="mt-3 font-[family-name:Georgia] text-4xl tracking-[-0.035em]">Replace assumptions with observed performance.</h3>
                <p className="mt-5 max-w-xl leading-7 text-[#647466]">Connect the client’s Search Console and Google Analytics data. SearchTrust combines observed performance with the original public evidence to produce the next prioritized action plan.</p>
                <ul className="mt-8 grid gap-3 text-sm font-bold sm:grid-cols-2">
                  {["Recent 90 days vs prior 90", "GSC + GA4 source health", "Evidence changes called out", "Regenerate when new data matters"].map((item) => <li key={item} className="flex items-center gap-2"><Check className="h-4 w-4 text-[#57805b]" />{item}</li>)}
                </ul>
              </div>
            </article>
          </div>

          <div className="mt-8 overflow-hidden rounded-[2rem] border border-[#d7ddce] bg-white shadow-[0_18px_55px_rgba(24,32,24,0.06)]">
            <div className="border-b border-[#e2e6dc] px-7 py-8 sm:px-10">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#718d18]">One analysis · two ways to communicate it</p>
              <h3 className="mt-3 max-w-3xl font-[family-name:Georgia] text-3xl tracking-[-0.035em] sm:text-4xl">Keep the evidence for the advisor. Keep the decision clear for the client.</h3>
            </div>
            <div className="grid gap-px bg-[#d7ddce] md:grid-cols-3">
              {[
                [FileSearch, "Advisor Report", "Full source evidence, limitations, diagnostic findings and implementation detail."],
                [UsersRound, "Client Report", "The decision, supporting evidence, three actions and a 30 / 60 / 90-day roadmap."],
                [ShieldCheck, "Share and PDF", "A focused client-safe view that can be shared or exported without exposing internal diagnostics."],
              ].map(([Icon, title, body]) => {
                const Glyph = Icon as typeof FileSearch;
                return <article key={String(title)} className="bg-[#fafbf7] p-7 sm:p-9"><Glyph className="h-5 w-5 text-[#789b12]" /><h4 className="mt-7 text-lg font-black">{String(title)}</h4><p className="mt-3 text-sm leading-6 text-[#667064]">{String(body)}</p></article>;
              })}
            </div>
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
              ["01", FileSearch, "Collect", "Gather website and public Business Profile evidence."],
              ["02", Fingerprint, "Confirm", "Confirm the correct business and at least one real local competitor."],
              ["03", Gauge, "Prioritize", "Order findings and actions by the evidence that supports them."],
              ["04", RefreshCw, "Verify", "Use Search Console and Google Analytics to show what changed."],
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
            <p className="mt-6 max-w-xl text-lg leading-8 text-[#667064]">Entering a site and confirming the business is free. Starting competitor discovery and the full Prospect analysis uses 1 credit. Generating or regenerating a Verified Action Plan also uses 1 credit.</p>
            <div className="mt-9 flex flex-wrap gap-3 text-sm font-bold">
              {["5 credits at signup", "No expiration", "No subscription", "Resume the same workflow free", "Technical failure returns 1 credit"].map((item) => <span key={item} className="rounded-full border border-[#d7ddce] bg-[#f6f8ef] px-4 py-2">{item}</span>)}
            </div>
          </div>
          <div className="flex flex-col justify-between bg-[#eaf3e8] p-8 text-[#26432e] sm:p-12 lg:p-16">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em]">Additional credits</p>
              <div className="mt-6 flex items-end gap-3"><span className="font-[family-name:Georgia] text-7xl leading-none tracking-[-0.06em]">$19</span><span className="pb-2 text-sm font-black">USD / credit</span></div>
              <p className="mt-6 max-w-sm font-semibold leading-7 text-[#34410e]">One account balance. Use it across Prospect and Verified workflows on any of your Cases.</p>
            </div>
            <Link href="/pricing" className="group mt-10 inline-flex min-h-13 items-center justify-center gap-2 rounded-lg bg-[#26432e] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#365d40]">See pricing details <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link>
          </div>
        </div>
      </section>

      <section className="px-4 pb-28 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-2xl border border-[#e3eae2] bg-[#eaf3e8] px-7 py-16 text-center text-[#1d2a22] sm:px-12 sm:py-20">
          <div className="relative mx-auto max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#668a50]">Your next client conversation can start with evidence</p>
            <h2 className="mt-5 font-[family-name:Georgia] text-4xl leading-tight tracking-[-0.04em] sm:text-6xl">Build the case. Win the work. Verify the change.</h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-[#647466]">Start with one real business. Confirm its public identity for free, then use a credit when you are ready to begin the full Prospect analysis.</p>
            <RunAuditButton trackingSource="home_v22_footer" className="group mx-auto mt-9 inline-flex min-h-13 items-center justify-center gap-2 rounded-lg bg-[#26432e] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#365d40]">Start with one business <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></RunAuditButton>
          </div>
        </div>
      </section>
    </div>
  );
}
