"use client";

import { ArrowRight, BriefcaseBusiness, ChevronDown, Globe2, Handshake, SearchCheck, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";

import type { WorkGoal } from "@/lib/preflight-v22";

interface GoalWebsiteStepProps {
  initialGoal: WorkGoal;
  initialSiteUrl: string;
  initialGbpUrl: string | null;
  error?: string | null;
  onSubmit(input: { goal: WorkGoal; site_url: string; gbp_url: string | null }): void;
}

const goals = [
  {
    value: "win_new_client" as const,
    title: "Win the work",
    detail: "Prepare a specific prospect conversation before private data access.",
    icon: Handshake,
  },
  {
    value: "work_existing_client" as const,
    title: "Serve a client",
    detail: "Set up the right business scope before ongoing analysis.",
    icon: BriefcaseBusiness,
  },
];

const goalContext = {
  win_new_client: {
    label: "Prospect Case",
    title: "Build a useful first view before asking for private data.",
    detail: "Confirm the public website and business identity before deciding whether to start the complete Prospect Analysis.",
    action: "Check this prospect · free",
  },
  work_existing_client: {
    label: "Active client Case",
    title: "Anchor ongoing work to the correct business scope.",
    detail: "Confirm the public business, service and market before competitor evidence and ongoing analysis.",
    action: "Check this client · free",
  },
} satisfies Record<WorkGoal, { label: string; title: string; detail: string; action: string }>;

export function GoalWebsiteStep({ initialGoal, initialSiteUrl, initialGbpUrl, error, onSubmit }: GoalWebsiteStepProps) {
  const [goal, setGoal] = useState(initialGoal);
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl);
  const [gbpUrl, setGbpUrl] = useState(initialGbpUrl ?? "");
  const [showGbp, setShowGbp] = useState(Boolean(initialGbpUrl));
  const context = goalContext[goal];

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ goal, site_url: siteUrl.trim(), gbp_url: gbpUrl.trim() || null });
  }

  return (
    <section className="case-step-enter">
      <div className="mb-8 lg:mb-10">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em]">
          <span className="text-[#66800e]">Start one client Case</span>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#9bad61]" />
          <span className="text-[#7b877b]">Free setup</span>
        </div>
        <h1 className="max-w-2xl text-[clamp(2.35rem,5vw,4.4rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-[#132015]">Start with one business.</h1>
        <p className="mt-5 max-w-[680px] text-[15px] leading-7 text-[#5f6c60] sm:text-base">Tell us what stage of the client relationship you are in, then enter the business website. We’ll establish the public scope before any credit is used.</p>
      </div>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[0.88fr_1.25fr] lg:gap-8">
        <fieldset className="rounded-[24px] bg-[#e8ede4] p-5 sm:p-6">
          <legend className="sr-only">What are you working on?</legend>
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#6d786d]">01 / Choose the work moment</p>
          <div className="mt-5 space-y-2.5">
            {goals.map((item) => {
              const Icon = item.icon;
              const selected = goal === item.value;
              return (
                <label key={item.value} className={`group flex cursor-pointer items-start gap-3 rounded-2xl p-3.5 transition focus-within:ring-4 focus-within:ring-[#A5D020]/25 ${selected ? "bg-white shadow-[0_10px_30px_rgba(35,52,29,0.08)]" : "hover:bg-white/55"}`}>
                  <input className="sr-only" type="radio" name="goal" value={item.value} checked={selected} onChange={() => setGoal(item.value)} />
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition ${selected ? "bg-[#A5D020] text-[#172017]" : "bg-white/70 text-[#687468] group-hover:bg-white"}`}><Icon size={19} /></span>
                  <span className="min-w-0 pt-0.5">
                    <span className="flex items-center gap-2 text-[15px] font-bold text-[#202920]">{item.title}{selected && <span className="rounded-full bg-[#edf6cf] px-2 py-0.5 text-[9px] uppercase tracking-wider text-[#60790f]">Selected</span>}</span>
                    <span className="mt-1 block text-xs leading-5 text-[#667267]">{item.detail}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <div className="mt-6 border-l-2 border-[#A5D020] pl-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#718218]">{context.label}</p>
            <h2 className="mt-1.5 text-lg font-bold leading-6 tracking-[-0.02em] text-[#1d281e]">{context.title}</h2>
            <p className="mt-1 text-xs leading-5 text-[#647064]">{context.detail}</p>
          </div>
        </fieldset>

        <div className="rounded-[24px] bg-white p-5 shadow-[0_24px_70px_rgba(35,52,29,0.08)] ring-1 ring-[#dfe5da] sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#6d786d]">02 / Add the business</p>
          <label htmlFor="client-site" className="mt-5 block text-sm font-bold text-[#263026]">Business website</label>
          <div className="relative mt-2.5">
            <Globe2 aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7b877b]" size={19} />
            <input id="client-site" required autoComplete="url" inputMode="url" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="example.com" aria-describedby={error ? "site-error" : "site-help"} className="h-14 w-full rounded-2xl border border-[#c9d2c5] bg-[#f8faf6] pl-12 pr-4 text-base font-medium text-[#1d271d] outline-none transition placeholder:font-normal placeholder:text-[#9ba49b] focus:border-[#86a91c] focus:ring-4 focus:ring-[#A5D020]/20" />
          </div>
          <p id="site-help" className="mt-2 text-xs leading-5 text-[#798479]">Use the primary business domain. You can omit https://.</p>
          {error && <p id="site-error" role="alert" className="mt-2 text-sm font-semibold text-[#a3412c]">{error}</p>}

          <button type="button" aria-expanded={showGbp} onClick={() => setShowGbp((value) => !value)} className="mt-5 inline-flex items-center gap-2 text-xs font-bold text-[#4d594d] outline-none hover:text-[#1c241c] focus-visible:ring-4 focus-visible:ring-[#A5D020]/25">
            <ChevronDown size={15} className={`transition-transform ${showGbp ? "rotate-180" : ""}`} /> I already have the public Google Business Profile link <span className="font-medium text-[#929b92]">(optional)</span>
          </button>
          {showGbp && (
            <div className="mt-3">
              <label htmlFor="gbp-url" className="sr-only">Google Business Profile link</label>
              <input id="gbp-url" autoComplete="url" inputMode="url" value={gbpUrl} onChange={(event) => setGbpUrl(event.target.value)} placeholder="https://www.google.com/maps?cid=..." className="h-12 w-full rounded-xl border border-[#ccd4c7] bg-[#fbfcfa] px-4 text-sm text-[#1d271d] outline-none focus:border-[#89ad1c] focus:ring-4 focus:ring-[#A5D020]/20" />
            </div>
          )}
          <button type="submit" className="group mt-7 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#172017] px-6 text-sm font-bold text-white shadow-[0_14px_32px_rgba(23,32,23,0.18)] outline-none transition hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_18px_36px_rgba(23,32,23,0.22)] focus-visible:ring-4 focus-visible:ring-[#A5D020]/40 motion-reduce:transform-none">
            {context.action} <ArrowRight aria-hidden="true" size={16} className="transition-transform group-hover:translate-x-0.5" />
          </button>
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#f2f5ed] px-3.5 py-3 text-xs leading-5 text-[#637063]">
            <ShieldCheck className="mt-0.5 shrink-0 text-[#6f8f11]" size={15} />
            <span><strong className="text-[#344134]">No credit is used here.</strong> A credit is used only when you approve and start the complete analysis.</span>
          </div>
        </div>

        <div aria-label="What the free setup returns" className="lg:col-span-2 grid overflow-hidden rounded-[22px] bg-[#172017] text-white sm:grid-cols-[1fr_1fr_1.15fr]">
          <div className="px-5 py-5 sm:px-6">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#b7dc3f]"><SearchCheck size={14} />Free setup returns</p>
            <p className="mt-2 text-sm font-bold">A confirmed public business</p>
            <p className="mt-1 text-xs leading-5 text-white/42">Website and public identity matched to the right company.</p>
          </div>
          <div className="px-5 py-5 sm:px-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/38">Scope you can inspect</p>
            <p className="mt-2 text-sm font-bold">Service and market context</p>
            <p className="mt-1 text-xs leading-5 text-white/42">What the Case is about before provider-backed discovery begins.</p>
          </div>
          <div className="bg-white/[0.06] px-5 py-5 sm:px-6">
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/38"><ShieldCheck size={14} className="text-[#b7dc3f]" />Then you decide</p>
            <p className="mt-2 text-sm font-bold">Approve complete analysis · 1 credit</p>
            <p className="mt-1 text-xs leading-5 text-white/42">Competitor discovery starts only after the confirmed scope and clear credit boundary.</p>
          </div>
        </div>
      </form>
    </section>
  );
}
