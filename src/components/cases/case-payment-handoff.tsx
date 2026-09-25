"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Coins,
  FileCheck2,
  LoaderCircle,
  LockKeyhole,
  Radar,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import type { AnalysisStage } from "@/lib/analysis-v22";

export type PaymentHandoffStatus =
  | "saving_case"
  | "ready"
  | "creating_checkout"
  | "confirming_payment"
  | "unlocked"
  | "starting_analysis"
  | "analyzing"
  | "analysis_failed"
  | "error";

interface CasePaymentHandoffProps {
  status: PaymentHandoffStatus;
  message: string;
  caseId: string | null;
  businessName?: string;
  scopeLine?: string;
  analysisStage?: AnalysisStage;
  progress?: number;
  onCheckout(): void;
  onRetryAnalysis?(): void;
  retryLabel?: string;
  onBack(): void;
}

const buildStages = [
  { key: "scope", number: "01", title: "Scope sealed", detail: "Business, service, market and competitors" },
  { key: "collect", number: "02", title: "Evidence collection", detail: "Website, search and public business evidence" },
  { key: "reason", number: "03", title: "Judgment synthesis", detail: "Findings, evidence and priority actions" },
  { key: "validate", number: "04", title: "Validation & save", detail: "Limits, completeness and report persistence" },
] as const;

type BuildStageKey = (typeof buildStages)[number]["key"];

const collectingStages = new Set<AnalysisStage>(["queued", "collecting_site", "collecting_market", "collecting_competitors"]);
const reasoningStages = new Set<AnalysisStage>(["building_evidence", "evaluating", "generating_copy"]);
const validationStages = new Set<AnalysisStage>(["validating", "persisting", "completed"]);

function activeBuildStage(status: PaymentHandoffStatus, stage?: AnalysisStage): BuildStageKey {
  if (status === "saving_case" || status === "ready" || status === "creating_checkout" || status === "confirming_payment" || status === "unlocked") return "scope";
  if (!stage || status === "starting_analysis" || collectingStages.has(stage)) return "collect";
  if (reasoningStages.has(stage)) return "reason";
  if (validationStages.has(stage)) return "validate";
  return "reason";
}

function phaseIndex(key: BuildStageKey) {
  return buildStages.findIndex((stage) => stage.key === key);
}

function progressValue(status: PaymentHandoffStatus, progress?: number) {
  if (status === "saving_case") return 5;
  if (["ready", "creating_checkout", "confirming_payment", "unlocked"].includes(status)) return 12;
  if (status === "starting_analysis") return 18;
  if (status === "analysis_failed" || status === "error") return Math.min(96, Math.max(18, progress ?? 35));
  return Math.min(99, Math.max(18, progress ?? 35));
}

function stateCopy(status: PaymentHandoffStatus) {
  if (status === "analysis_failed") return { eyebrow: "Report task needs attention", title: "This attempt stopped safely.", detail: "The failed attempt did not leave a partial report available for delivery." };
  if (status === "error") return { eyebrow: "Case setup needs attention", title: "The confirmed scope is still safe.", detail: "Resolve the issue below, then continue from the same Case." };
  if (status === "saving_case") return { eyebrow: "Preserving the Case", title: "Securing the confirmed scope before analysis.", detail: "The report will use this exact business, market and competitor set." };
  if (["ready", "creating_checkout", "confirming_payment"].includes(status)) return { eyebrow: "One-credit workflow", title: "Ready to start the complete Prospect analysis.", detail: "Discovery and report generation are handled as one traceable workflow." };
  if (status === "unlocked") return { eyebrow: "Report workflow covered", title: "Preparing the report task from the confirmed scope.", detail: "The credit is already reserved. No second charge will be made." };
  return { eyebrow: "Report build in progress", title: "Building your evidence-backed Prospect report.", detail: "Public evidence is being connected to specific findings and actions for this business." };
}

export function CasePaymentHandoff({
  status,
  message,
  caseId,
  businessName = "Confirmed Prospect Case",
  scopeLine = "Confirmed business, market and competitor scope",
  analysisStage,
  progress,
  onCheckout,
  onRetryAnalysis = () => undefined,
  retryLabel = "Generate again · uses 1 credit",
  onBack,
}: CasePaymentHandoffProps) {
  const busy = status === "saving_case" || status === "creating_checkout" || status === "confirming_payment" || status === "starting_analysis" || status === "analyzing";
  const building = status === "starting_analysis" || status === "analyzing";
  const covered = ["unlocked", "starting_analysis", "analyzing", "analysis_failed"].includes(status);
  const active = activeBuildStage(status, analysisStage);
  const activeIndex = phaseIndex(active);
  const percent = progressValue(status, progress);
  const copy = stateCopy(status);

  return (
    <section className="case-step-enter">
      <div className="mb-8">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#718218]">REPORT WORKROOM / PROSPECT</p>
        <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.045em] text-[#172017] sm:text-[42px]">{copy.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#657165]">{copy.detail}</p>
      </div>

      <div className="overflow-hidden rounded-[26px] bg-[#172017] text-white shadow-[0_24px_70px_rgba(24,35,25,.16)]">
        <div className="grid gap-8 px-6 py-7 sm:px-8 sm:py-9 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)]">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#b7dc3f]">
                  {status === "analysis_failed" || status === "error" ? <TriangleAlert size={14} /> : building || busy ? <LoaderCircle className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
                  {copy.eyebrow}
                </p>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">{businessName}</h2>
                <p className="mt-2 text-xs leading-5 text-white/42">{scopeLine}</p>
              </div>
              {covered && <span className="rounded-full bg-[#dff1ab] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#405c00]">Covered · no extra credit</span>}
            </div>

            <div className="mt-8" role="progressbar" aria-label="Report generation progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
              <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em]"><span className="text-white/38">Report build</span><span className="text-[#b7dc3f]">{percent}%</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.09]"><div className={`h-full rounded-full bg-[#b7dc3f] transition-[width] duration-700 ${building ? "shadow-[0_0_18px_rgba(183,220,63,.45)]" : ""}`} style={{ width: `${percent}%` }} /></div>
            </div>

            <ol className="mt-8 grid gap-2 sm:grid-cols-2">
              {buildStages.map((step, index) => {
                const done = index < activeIndex;
                const isActive = index === activeIndex;
                return (
                  <li key={step.key} className={`grid grid-cols-[36px_1fr] gap-3 rounded-[16px] px-4 py-4 ring-1 transition ${isActive ? "bg-white/[0.09] ring-[#b7dc3f]/35" : "bg-white/[0.035] ring-white/[0.055]"}`}>
                    <span className={`grid h-8 w-8 place-items-center rounded-full font-mono text-[9px] font-bold ${done ? "bg-[#b7dc3f] text-[#263700]" : isActive ? "bg-white text-[#172017]" : "bg-white/[0.06] text-white/28"}`}>{done ? <Check size={14} /> : step.number}</span>
                    <div><p className={`text-xs font-bold ${done || isActive ? "text-white" : "text-white/38"}`}>{step.title}</p><p className={`mt-1 text-[10px] leading-4 ${done || isActive ? "text-white/42" : "text-white/24"}`}>{step.detail}</p></div>
                  </li>
                );
              })}
            </ol>
          </div>

          <aside className={`rounded-[20px] p-6 text-[#1d281e] ${status === "analysis_failed" || status === "error" ? "bg-[#fff2e7]" : "bg-white"}`}>
            <div className="flex items-center justify-between">
              <span className={`grid h-10 w-10 place-items-center rounded-xl ${status === "analysis_failed" || status === "error" ? "bg-[#ffe0d3] text-[#963b27]" : "bg-[#edf3df] text-[#6e8d12]"}`}>
                {status === "analysis_failed" || status === "error" ? <TriangleAlert size={18} /> : building ? <Radar className="animate-pulse" size={18} /> : <FileCheck2 size={18} />}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#7c887c]">Live task status</span>
            </div>
            <p aria-live="polite" className="mt-5 min-h-[72px] text-sm font-semibold leading-6 text-[#394439]">{message}</p>

            {status === "analysis_failed" ? (
              <>
                <div className="mt-5 rounded-xl bg-white/70 p-4 text-[11px] leading-5 text-[#6b584e]"><strong className="text-[#4b3b34]">Credit returned.</strong> A new attempt remains available and will use one credit only when you choose to restart it.</div>
                <button type="button" onClick={onRetryAnalysis} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#172017] px-5 text-sm font-bold text-white outline-none transition hover:bg-black focus-visible:ring-4 focus-visible:ring-[#A5D020]/35"><RefreshCcw size={16} />{retryLabel}</button>
              </>
            ) : !covered ? (
              <button type="button" onClick={onCheckout} disabled={status !== "ready" && status !== "error"} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#172017] px-5 text-sm font-bold text-white outline-none transition hover:bg-black focus-visible:ring-4 focus-visible:ring-[#A5D020]/35 disabled:cursor-wait disabled:opacity-55">
                {busy ? <LoaderCircle className="animate-spin" size={17} /> : <Coins size={17} />}Start analysis · uses 1 credit
              </button>
            ) : (
              <div className="mt-5 space-y-3 text-[11px] leading-5 text-[#667266]">
                <p className="flex gap-2"><CheckCircle2 className="mt-0.5 shrink-0 text-[#75950e]" size={14} />Refresh or return later without restarting the task.</p>
                <p className="flex gap-2"><ArrowRight className="mt-0.5 shrink-0 text-[#75950e]" size={14} />The completed report opens automatically.</p>
              </div>
            )}

            {caseId && <p className="mt-5 break-all border-t border-black/[0.07] pt-4 font-mono text-[9px] uppercase text-[#939d93]"><span className="normal-case">Case</span> {caseId}</p>}
          </aside>
        </div>

        <div className="grid gap-5 border-t border-white/[0.08] bg-white/[0.025] px-6 py-6 sm:px-8 lg:grid-cols-[220px_1fr] lg:items-center">
          <div><p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#b7dc3f]"><Sparkles size={13} />When complete</p><p className="mt-2 text-sm font-bold">A reviewable report—not an automatic client send.</p></div>
          <div className="grid gap-3 text-[11px] text-white/43 sm:grid-cols-3">
            <p className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-[#b7dc3f]" />Specific findings tied to evidence</p>
            <p className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-[#b7dc3f]" />Three prioritized actions</p>
            <p className="flex gap-2"><Check size={13} className="mt-0.5 shrink-0 text-[#b7dc3f]" />Limits and client confirmations retained</p>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 text-xs text-[#758075] sm:flex-row sm:items-center sm:justify-between">
        {!building && !busy ? <button type="button" onClick={onBack} className="flex w-fit items-center gap-2 rounded-lg px-1 py-2 font-bold outline-none transition hover:text-[#1f291f] focus-visible:ring-4 focus-visible:ring-[#A5D020]/30"><ArrowLeft size={14} />Return to evidence boundary</button> : <span className="flex items-center gap-2"><CircleDashed size={13} />You may leave this page; the server-owned task continues.</span>}
        <div className="flex flex-wrap gap-4"><span className="flex items-center gap-1.5"><LockKeyhole size={13} />No second charge</span><span className="flex items-center gap-1.5"><ShieldCheck size={13} />No report is delivered automatically</span></div>
      </div>
    </section>
  );
}
