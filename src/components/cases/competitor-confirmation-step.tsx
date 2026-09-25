"use client";

import { AlertTriangle, ArrowRight, Check, ExternalLink, MapPinned, PencilLine, Plus, Radar, RotateCcw, SearchCheck, SearchX, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";

import type { CompetitorDiscoveryStatusResponse } from "@/lib/preflight-v22";

interface CompetitorConfirmationStepProps {
  status: CompetitorDiscoveryStatusResponse;
  selectedIds: string[];
  onSelectionChange(ids: string[]): void;
  onConfirm(): void;
  onRerun(urls: string[]): void;
  onEditScope(): void;
}

function limitationMessage(value: string) {
  if (/^[A-Z0-9_]+$/.test(value)) {
    return "Some map-result details were unavailable. Candidate confidence uses the verified market and website evidence that was returned.";
  }
  return value;
}

export function CompetitorConfirmationStep({ status, selectedIds, onSelectionChange, onConfirm, onRerun, onEditScope }: CompetitorConfirmationStepProps) {
  const result = status.result;
  const candidates = result?.candidates ?? [];
  const [supplement, setSupplement] = useState("");
  const limited = selectedIds.length > 0 && selectedIds.length < 3;

  function toggle(id: string) {
    if (selectedIds.includes(id)) onSelectionChange(selectedIds.filter((item) => item !== id));
    else if (selectedIds.length < 3) onSelectionChange([...selectedIds, id]);
  }

  function rerun(event: FormEvent) {
    event.preventDefault();
    const urls = supplement.split(/[\n,]/).map((value) => value.trim()).filter(Boolean).slice(0, 3);
    if (urls.length) onRerun(urls);
  }

  return (
    <section className="case-step-enter">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#718218]">03 / Confirm real competitors</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.045em] text-[#172017] sm:text-[42px]">Confirm who really competes for the same demand.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#657165]">A competitor must fit the service, market and search context—not simply look similar. Confirm at least one; three gives the report a broader evidence set.</p>
        </div>
        <button type="button" onClick={onEditScope} className="inline-flex self-start items-center gap-2 text-sm font-bold text-[#657165] outline-none hover:text-[#1d271d] focus-visible:rounded-lg focus-visible:ring-4 focus-visible:ring-[#A5D020]/25"><PencilLine size={15} />Edit business scope</button>
      </div>

      <div className="mb-6 grid overflow-hidden rounded-[24px] bg-[#172017] text-white shadow-[0_22px_60px_rgba(25,37,27,.12)] lg:grid-cols-[1fr_300px]">
        <div className="px-6 py-6 sm:px-8">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#b7dc3f]"><Radar size={15} />What qualifies</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div><p className="text-sm font-bold">Service overlap</p><p className="mt-1 text-xs leading-5 text-white/42">Competes for the work included in this Case.</p></div>
            <div><p className="text-sm font-bold">Local market fit</p><p className="mt-1 text-xs leading-5 text-white/42">Serves the confirmed target area.</p></div>
            <div><p className="text-sm font-bold">Search evidence</p><p className="mt-1 text-xs leading-5 text-white/42">Appears for relevant observed queries.</p></div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-white/10 lg:grid-cols-1 lg:grid-rows-2">
          <div className="flex items-center justify-between bg-white/[0.045] px-5 py-4"><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/40">Confirmed</span><span className="text-2xl font-semibold">{selectedIds.length}/3</span></div>
          <div className="flex items-center justify-between bg-white/[0.045] px-5 py-4"><span className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/40">Coverage</span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selectedIds.length === 0 ? "bg-[#ffe0d9] text-[#8c3022]" : limited ? "bg-[#fff0ba] text-[#725600]" : "bg-[#dff1ab] text-[#405c00]"}`}>{selectedIds.length === 0 ? "Blocked" : limited ? "Limited coverage" : "Recommended"}</span></div>
        </div>
      </div>

      {candidates.length > 0 ? (
        <section aria-labelledby="candidate-list-title" className="rounded-[24px] bg-white p-5 shadow-[0_18px_50px_rgba(31,39,27,0.06)] ring-1 ring-[#dfe4da] sm:p-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#718218]">Qualified candidates</p><h2 id="candidate-list-title" className="mt-2 text-xl font-bold tracking-[-0.025em] text-[#1d281e]">Compare the evidence, then choose the set.</h2></div>
            <p className="text-xs text-[#7c877c]">{candidates.length} found · minimum 1 · recommended 3</p>
          </div>

          <div className="hidden grid-cols-[44px_minmax(180px,1.1fr)_minmax(210px,1.3fr)_230px] gap-5 px-3 pb-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#929b92] md:grid"><span>Select</span><span>Business</span><span>Why it qualifies</span><span>Search evidence</span></div>
          <div className="divide-y divide-[#e9ede5]">
            {candidates.map((candidate, index) => {
              const selected = selectedIds.includes(candidate.competitor_id);
              const disabled = !selected && selectedIds.length >= 3;
              return (
                <label key={candidate.competitor_id} className={`grid cursor-pointer gap-4 rounded-[18px] px-3 py-5 transition focus-within:ring-4 focus-within:ring-[#A5D020]/25 md:grid-cols-[44px_minmax(180px,1.1fr)_minmax(210px,1.3fr)_230px] md:items-start md:gap-5 ${selected ? "bg-[#f3f7e8]" : "hover:bg-[#f7f9f5]"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
                  <input type="checkbox" className="sr-only" checked={selected} disabled={disabled} onChange={() => toggle(candidate.competitor_id)} />
                  <span className={`grid h-8 w-8 place-items-center rounded-lg border text-[10px] font-bold ${selected ? "border-[#8cab20] bg-[#A5D020] text-[#182018]" : "border-[#d1d8cd] bg-white text-[#8b958b]"}`}>{selected ? <Check size={15} strokeWidth={3} /> : String(index + 1).padStart(2, "0")}</span>
                  <div><h3 className="font-bold text-[#202a20]">{candidate.business_name}</h3><p className="mt-1 flex items-center gap-1 truncate text-xs text-[#718071]"><ExternalLink size={12} />{new URL(candidate.website_url).hostname.replace(/^www\./, "")}</p><p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#647064]">{candidate.public_gbp_url ? <><ShieldCheck size={13} className="text-[#6f8f11]" />GBP available</> : <><MapPinned size={13} />GBP not found</>}</p></div>
                  <div><span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#98a098] md:hidden">Why it qualifies</span><p className="text-sm leading-6 text-[#5f6b5f]">{candidate.relevance_reason}</p></div>
                  <dl className="grid grid-cols-3 gap-2 text-xs">
                    <div><dt className="text-[#899389]">Queries</dt><dd className="mt-1 text-lg font-bold text-[#293329]">{candidate.query_appearance_count}</dd></div>
                    <div><dt className="text-[#899389]">Best rank</dt><dd className="mt-1 text-lg font-bold text-[#293329]">#{candidate.best_position}</dd></div>
                    <div><dt className="text-[#899389]">Confidence</dt><dd className="mt-1 text-sm font-bold capitalize text-[#293329]">{candidate.confidence}</dd></div>
                  </dl>
                </label>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="rounded-[24px] bg-[#fff6dc] p-6">
          <div className="flex gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffe5ab] text-[#8b5b00]"><SearchX size={21} /></span><div><h2 className="font-bold text-[#5c440d]">At least one competitor is required</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[#775f27]">No qualified business was found automatically. Add a known competitor website below; it still has to pass identity and relevance checks before it can enter the report.</p></div></div>
        </div>
      )}

      <form onSubmit={rerun} className="mt-5 rounded-[22px] bg-[#e8ede4] p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#667466]"><Plus size={16} /></span><div><label htmlFor="supplemental-competitors" className="text-sm font-bold text-[#263026]">Add known competitor websites <span className="font-medium text-[#899389]">(up to 3)</span></label><p className="mt-1 text-xs leading-5 text-[#738073]">Use this when a real local competitor is missing. Adding a URL reruns validation; it does not automatically approve the business.</p></div></div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <textarea id="supplemental-competitors" rows={2} value={supplement} onChange={(event) => setSupplement(event.target.value)} placeholder="competitor-one.com, competitor-two.com" className="min-h-12 flex-1 resize-none rounded-xl border border-[#c7d0c2] bg-white px-4 py-3 text-sm outline-none focus:border-[#89ad1c] focus:ring-4 focus:ring-[#A5D020]/20" />
          <button type="submit" disabled={!supplement.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-bold text-[#273127] shadow-sm outline-none hover:bg-[#f8faf6] focus-visible:ring-4 focus-visible:ring-[#A5D020]/30 disabled:cursor-not-allowed disabled:opacity-45"><SearchCheck size={16} />Validate & rerun</button>
        </div>
      </form>

      {result?.limitations.length ? <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#f2f4ef] px-4 py-3 text-xs leading-5 text-[#687468]"><AlertTriangle className="mt-0.5 shrink-0" size={14} />{limitationMessage(result.limitations[0])}</div> : null}

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-[#707c70]">The selected set becomes part of this Case’s traceable evidence scope.</p>
        <button type="button" disabled={selectedIds.length === 0} onClick={onConfirm} className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1a211a] px-6 text-sm font-bold text-white outline-none transition hover:bg-black focus-visible:ring-4 focus-visible:ring-[#A5D020]/40 disabled:cursor-not-allowed disabled:bg-[#aab1a7]">
          {selectedIds.length === 0 ? <><RotateCcw size={16} />Add and validate one competitor</> : <>Confirm {selectedIds.length} {selectedIds.length === 1 ? "competitor" : "competitors"}<ArrowRight aria-hidden="true" size={16} className="transition-transform group-hover:translate-x-0.5" /></>}
        </button>
      </div>
    </section>
  );
}
