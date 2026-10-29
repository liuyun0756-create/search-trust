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
  ["03", "Prepare", "Produce findings and up to three supported actions."],
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

      <div className="overflow-hidden rounded-2xl border border-[#e3eae2] bg-white text-[#1d2a22] lg:grid lg:grid-cols-[1fr_310px]">
        <div className="px-6 py-7 sm:px-8 sm:py-9">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#668a50]"><FileSearch size={15} />Confirmed Case scope</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{business.business_identity.business_name}</h2>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#718073]"><span>{business.primary_service}</span><span aria-hidden="true">·</span><span>{market}</span></div>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {workflow.map(([number, title, detail], index) => (
              <div key={number} className="rounded-xl bg-[#f2f7f1] p-4">
                <div className="flex items-center justify-between"><span className="font-mono text-[9px] font-bold text-[#57805b]">{number}</span>{index === 0 ? <Radar size={14} className="text-[#7c9480]" /> : index === 1 ? <Sparkles size={14} className="text-[#7c9480]" /> : <Check size={14} className="text-[#7c9480]" />}</div>
                <p className="mt-3 text-sm font-bold">{title}</p>
                <p className="mt-1 text-[11px] leading-5 text-[#718073]">{detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-[#647466]">
            <span className="flex items-center gap-2"><Check size={13} className="text-[#57805b]" />Charged once per Prospect workflow</span>
            <span className="flex items-center gap-2"><Check size={13} className="text-[#57805b]" />Refresh and resume without another charge</span>
            <span className="flex items-center gap-2"><Check size={13} className="text-[#57805b]" />Technical failure returns the credit</span>
          </div>
        </div>

        <div className="bg-[#f2f7f1] p-6 text-[#1d2a22] sm:p-7">
          <div className="flex items-center justify-between">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-[#57805b]"><Coins size={19} /></span>
            <span className="text-2xl font-semibold">{covered ? "Covered" : "1 credit"}</span>
          </div>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7c887c]">Available balance</p>
          <p className="mt-1 text-sm font-bold">{creditBalance === null ? "Loading your balance…" : `${creditBalance} ${creditBalance === 1 ? "credit" : "credits"}`}</p>
          <p aria-live="polite" className="mt-4 min-h-10 text-xs leading-5 text-[#6c786c]">{message}</p>

          {signedIn ? (
            creditBalance === 0 && !covered ? (
              <Link href="/pricing" className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#26432e] px-5 text-sm font-semibold text-white">Buy 1 credit · $19 <ArrowRight size={15} /></Link>
            ) : (
              <button type="button" onClick={onStart} disabled={!caseReady || starting || creditBalance === null} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#26432e] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#365d40] disabled:cursor-wait disabled:opacity-55">
                {starting ? <LoaderCircle className="animate-spin" size={17} /> : <Radar size={17} />}
                {covered ? "Resume discovery · no extra credit" : "Start analysis · uses 1 credit"}
              </button>
            )
          ) : (
            <button type="button" onClick={onSignIn} className="mt-5 min-h-12 w-full rounded-lg bg-[#26432e] px-5 text-sm font-semibold text-white">Sign in & continue</button>
          )}
          <p className="mt-4 text-center text-[10px] leading-4 text-[#8a948a]">No subscription. This approval starts one traceable Prospect workflow.</p>
        </div>
      </div>
    </section>
  );
}
