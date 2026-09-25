"use client";

import { ArrowRight, Check, Coins, FileSearch, LoaderCircle, Radar, Sparkles } from "lucide-react";
import Link from "next/link";

import type { BusinessConfirmation } from "@/lib/preflight-v22";
import type { PaymentHandoffStatus } from "./case-payment-handoff";

interface ProspectStartStepProps {
  business: BusinessConfirmation;
  status: PaymentHandoffStatus;
  message: string;
  caseReady: boolean;
  covered: boolean;
  creditBalance: number | null;
  signedIn: boolean;
  onStart(): void;
  onSignIn(): void;
}

const workflow = [
  ["01", "Discover", "Find and qualify real local competitors."],
  ["02", "Analyze", "Connect public evidence to specific problems."],
  ["03", "Prepare", "Produce findings and three priority actions."],
] as const;

export function ProspectStartStep({ business, status, message, caseReady, covered, creditBalance, signedIn, onStart, onSignIn }: ProspectStartStepProps) {
  const starting = status === "saving_case" || status === "starting_analysis";
  const market = business.target_market.display_name;

  return (
    <section className="case-step-enter">
      <div className="mb-7">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#718218]">03 / Start competitor discovery</p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.045em] text-[#172017] sm:text-[42px]">Start the complete prospect analysis.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#657165]">The free identity check is complete. Review exactly what the one-credit workflow will do before provider-backed discovery begins.</p>
      </div>

      <div className="overflow-hidden rounded-[26px] bg-[#172017] text-white shadow-[0_24px_70px_rgba(24,35,25,.16)] lg:grid lg:grid-cols-[1fr_310px]">
        <div className="px-6 py-7 sm:px-8 sm:py-9">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#b7dc3f]"><FileSearch size={15} />Confirmed Case scope</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{business.business_identity.business_name}</h2>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/48"><span>{business.primary_service}</span><span aria-hidden="true">·</span><span>{market}</span></div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {workflow.map(([number, title, detail], index) => (
              <div key={number} className="rounded-[18px] bg-white/[0.055] p-4 ring-1 ring-white/[0.06]">
                <div className="flex items-center justify-between"><span className="font-mono text-[9px] font-bold text-[#b7dc3f]">{number}</span>{index === 0 ? <Radar size={14} className="text-white/35" /> : index === 1 ? <Sparkles size={14} className="text-white/35" /> : <Check size={14} className="text-white/35" />}</div>
                <p className="mt-3 text-sm font-bold">{title}</p>
                <p className="mt-1 text-[11px] leading-5 text-white/40">{detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-white/45">
            <span className="flex items-center gap-2"><Check size={13} className="text-[#b7dc3f]" />Charged once per Prospect workflow</span>
            <span className="flex items-center gap-2"><Check size={13} className="text-[#b7dc3f]" />Refresh and resume without another charge</span>
            <span className="flex items-center gap-2"><Check size={13} className="text-[#b7dc3f]" />Technical failure returns the credit</span>
          </div>
        </div>

        <div className="bg-white p-6 text-[#1d281e] sm:p-7 lg:m-3 lg:rounded-[20px]">
          <div className="flex items-center justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3df] text-[#6e8d12]"><Coins size={19} /></span>
            <span className="text-2xl font-semibold">{covered ? "Covered" : "1 credit"}</span>
          </div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7c887c]">Available balance</p>
          <p className="mt-1 text-sm font-bold">{creditBalance === null ? "Loading your balance…" : `${creditBalance} ${creditBalance === 1 ? "credit" : "credits"}`}</p>
          <p aria-live="polite" className="mt-4 min-h-10 text-xs leading-5 text-[#6c786c]">{message}</p>

          {signedIn ? (
            creditBalance === 0 && !covered ? (
              <Link href="/pricing" className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1a211a] px-5 text-sm font-bold text-white">Buy 1 credit · $19 <ArrowRight size={15} /></Link>
            ) : (
              <button type="button" onClick={onStart} disabled={!caseReady || starting || creditBalance === null} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1a211a] px-5 text-sm font-bold text-white outline-none transition hover:bg-black focus-visible:ring-4 focus-visible:ring-[#A5D020]/35 disabled:cursor-wait disabled:opacity-55">
                {starting ? <LoaderCircle className="animate-spin" size={17} /> : <Radar size={17} />}
                {covered ? "Resume discovery · no extra credit" : "Start analysis · uses 1 credit"}
              </button>
            )
          ) : (
            <button type="button" onClick={onSignIn} className="mt-5 min-h-12 w-full rounded-xl bg-[#1a211a] px-5 text-sm font-bold text-white outline-none focus-visible:ring-4 focus-visible:ring-[#A5D020]/35">Sign in & continue</button>
          )}
          <p className="mt-4 text-center text-[10px] leading-4 text-[#8a948a]">No subscription. This approval starts one traceable Prospect workflow.</p>
        </div>
      </div>
    </section>
  );
}
