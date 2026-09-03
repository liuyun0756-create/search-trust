"use client";

import { BriefcaseBusiness, ChevronDown, Globe2, Handshake, LockKeyhole, SearchCheck, WalletCards } from "lucide-react";
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
    title: "Win a new client",
    detail: "Prove the opportunity with public evidence before you pitch.",
    icon: Handshake,
  },
  {
    value: "work_existing_client" as const,
    title: "Work with an existing client",
    detail: "Set up the client identity and prepare a verified project.",
    icon: BriefcaseBusiness,
  },
];

export function GoalWebsiteStep({ initialGoal, initialSiteUrl, initialGbpUrl, error, onSubmit }: GoalWebsiteStepProps) {
  const [goal, setGoal] = useState(initialGoal);
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl);
  const [gbpUrl, setGbpUrl] = useState(initialGbpUrl ?? "");
  const [showGbp, setShowGbp] = useState(Boolean(initialGbpUrl));

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ goal, site_url: siteUrl.trim(), gbp_url: gbpUrl.trim() || null });
  }

  return (
    <section>
      <div className="mb-8">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#718218]">Step 1 of 4</p>
        <h1 className="max-w-2xl text-3xl font-bold leading-tight tracking-[-0.035em] text-[#172017] sm:text-[42px]">Start with the job you need to do.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#627062]">We’ll check public business, market, and competitor signals before asking you to create an account.</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <fieldset>
          <legend className="mb-3 text-sm font-bold text-[#263026]">What are you working on?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {goals.map((item) => {
              const Icon = item.icon;
              const selected = goal === item.value;
              return (
                <label key={item.value} className={`cursor-pointer rounded-2xl border p-5 transition focus-within:ring-4 focus-within:ring-[#A5D020]/25 ${selected ? "border-[#91b91b] bg-[#f5fadf] shadow-[0_10px_30px_rgba(101,127,25,0.08)]" : "border-[#dfe4da] bg-white hover:border-[#b9c4ad]"}`}>
                  <input className="sr-only" type="radio" name="goal" value={item.value} checked={selected} onChange={() => setGoal(item.value)} />
                  <span className={`mb-4 grid h-10 w-10 place-items-center rounded-xl ${selected ? "bg-[#A5D020] text-[#172017]" : "bg-[#eef1eb] text-[#657065]"}`}><Icon size={20} /></span>
                  <span className="block text-base font-bold text-[#202920]">{item.title}</span>
                  <span className="mt-1.5 block text-sm leading-6 text-[#697469]">{item.detail}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="rounded-2xl border border-[#dfe4da] bg-white p-5 sm:p-6">
          <label htmlFor="client-site" className="text-sm font-bold text-[#263026]">Client website</label>
          <div className="relative mt-2">
            <Globe2 aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7b877b]" size={19} />
            <input id="client-site" required autoComplete="url" inputMode="url" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="example.com" aria-describedby={error ? "site-error" : "site-help"} className="h-13 w-full rounded-xl border border-[#ccd4c7] bg-[#fbfcfa] pl-12 pr-4 text-base text-[#1d271d] outline-none transition placeholder:text-[#9ba49b] focus:border-[#89ad1c] focus:ring-4 focus:ring-[#A5D020]/20" />
          </div>
          <p id="site-help" className="mt-2 text-xs leading-5 text-[#798479]">Homepage or primary business domain. You can omit https://.</p>
          {error && <p id="site-error" role="alert" className="mt-2 text-sm font-semibold text-[#a3412c]">{error}</p>}

          <button type="button" aria-expanded={showGbp} onClick={() => setShowGbp((value) => !value)} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-[#4d594d] outline-none hover:text-[#1c241c] focus-visible:ring-4 focus-visible:ring-[#A5D020]/25">
            <ChevronDown size={16} className={`transition-transform ${showGbp ? "rotate-180" : ""}`} /> Add Google Business Profile link <span className="font-medium text-[#929b92]">(optional)</span>
          </button>
          {showGbp && (
            <div className="mt-3">
              <label htmlFor="gbp-url" className="sr-only">Google Business Profile link</label>
              <input id="gbp-url" autoComplete="url" inputMode="url" value={gbpUrl} onChange={(event) => setGbpUrl(event.target.value)} placeholder="https://maps.google.com/..." className="h-12 w-full rounded-xl border border-[#ccd4c7] bg-[#fbfcfa] px-4 text-sm text-[#1d271d] outline-none focus:border-[#89ad1c] focus:ring-4 focus:ring-[#A5D020]/20" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5 border-t border-[#dfe4da] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-[#6b776b]">
            <li className="flex items-center gap-1.5"><LockKeyhole size={14} /> No login</li>
            <li className="flex items-center gap-1.5"><WalletCards size={14} /> No payment</li>
            <li className="flex items-center gap-1.5"><SearchCheck size={14} /> Public data only</li>
          </ul>
          <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1a211a] px-6 text-sm font-bold text-white shadow-[0_10px_25px_rgba(23,32,23,0.16)] outline-none transition hover:bg-black focus-visible:ring-4 focus-visible:ring-[#A5D020]/40">
            Run free preflight <span aria-hidden="true">→</span>
          </button>
        </div>
      </form>
    </section>
  );
}
