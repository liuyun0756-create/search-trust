"use client";

import { AlertTriangle, Check, ExternalLink, MapPinned, Plus, RotateCcw, SearchX, ShieldCheck } from "lucide-react";
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
    <section>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#718218]">Step 3 of 4</p>
          <h1 className="text-3xl font-bold tracking-[-0.035em] text-[#172017] sm:text-[38px]">Choose the real competitive set.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#657165]">Three is recommended. Select at least one verified business to continue.</p>
        </div>
        <button type="button" onClick={onEditScope} className="self-start text-sm font-bold text-[#657165] underline decoration-[#b5c1b0] underline-offset-4 hover:text-[#1d271d]">Edit business scope</button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#dfe4da] bg-white px-4 py-3">
        <span className="text-sm font-bold text-[#263026]">{selectedIds.length} of 3 selected</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${selectedIds.length === 0 ? "bg-[#fbe9e7] text-[#a3332b]" : limited ? "bg-[#fff6d9] text-[#806000]" : "bg-[#edf7d5] text-[#56720c]"}`}>
          {selectedIds.length === 0 ? "Blocked" : limited ? "Limited coverage" : "Recommended coverage"}
        </span>
        <span className="ml-auto text-xs text-[#7c877c]">Up to 6 candidates found · 1 is required</span>
      </div>

      {candidates.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {candidates.map((candidate) => {
            const selected = selectedIds.includes(candidate.competitor_id);
            const disabled = !selected && selectedIds.length >= 3;
            return (
              <label key={candidate.competitor_id} className={`relative cursor-pointer rounded-2xl border p-5 transition focus-within:ring-4 focus-within:ring-[#A5D020]/25 ${selected ? "border-[#8caf1b] bg-[#f7fadf]" : "border-[#dfe4da] bg-white"} ${disabled ? "cursor-not-allowed opacity-55" : "hover:border-[#b8c3b2]"}`}>
                <input type="checkbox" className="sr-only" checked={selected} disabled={disabled} onChange={() => toggle(candidate.competitor_id)} />
                <span className={`absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-md border ${selected ? "border-[#7f9f18] bg-[#A5D020] text-[#182018]" : "border-[#cbd3c7] bg-white"}`}>{selected && <Check size={14} strokeWidth={3} />}</span>
                <div className="pr-10">
                  <h2 className="font-bold text-[#202a20]">{candidate.business_name}</h2>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-[#718071]"><ExternalLink size={12} />{new URL(candidate.website_url).hostname.replace(/^www\./, "")}</p>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#5f6b5f]">{candidate.relevance_reason}</p>
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[#dde3d8] pt-4 text-xs">
                  <div><dt className="text-[#899389]">Queries</dt><dd className="mt-1 font-bold text-[#293329]">{candidate.query_appearance_count}</dd></div>
                  <div><dt className="text-[#899389]">Best rank</dt><dd className="mt-1 font-bold text-[#293329]">#{candidate.best_position}</dd></div>
                  <div><dt className="text-[#899389]">Confidence</dt><dd className="mt-1 font-bold capitalize text-[#293329]">{candidate.confidence}</dd></div>
                </dl>
                <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#647064]">{candidate.public_gbp_url ? <><ShieldCheck size={14} className="text-[#6f8f11]" /> Public GBP available</> : <><MapPinned size={14} /> Public GBP not found</>}</p>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#e2bd7b] bg-[#fff9e9] p-6">
          <div className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ffe9bd] text-[#8b5b00]"><SearchX size={20} /></span><div><h2 className="font-bold text-[#5c440d]">At least one competitor is required</h2><p className="mt-1 text-sm leading-6 text-[#775f27]">We didn’t find a qualified competitor automatically. Add a known competitor website; it must pass backend identity and relevance checks before it counts.</p></div></div>
        </div>
      )}

      <form onSubmit={rerun} className="mt-5 rounded-2xl border border-[#dfe4da] bg-white p-5">
        <label htmlFor="supplemental-competitors" className="text-sm font-bold text-[#263026]">Add known competitor websites <span className="font-medium text-[#899389]">(up to 3)</span></label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <textarea id="supplemental-competitors" rows={2} value={supplement} onChange={(event) => setSupplement(event.target.value)} placeholder="competitor-one.com, competitor-two.com" className="min-h-12 flex-1 resize-none rounded-xl border border-[#ccd4c7] bg-[#fbfcfa] px-4 py-3 text-sm outline-none focus:border-[#89ad1c] focus:ring-4 focus:ring-[#A5D020]/20" />
          <button type="submit" disabled={!supplement.trim()} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#bfc9b9] px-4 text-sm font-bold text-[#273127] outline-none hover:bg-[#f4f7f0] focus-visible:ring-4 focus-visible:ring-[#A5D020]/30 disabled:cursor-not-allowed disabled:opacity-45"><Plus size={16} /> Validate & rerun</button>
        </div>
      </form>

      {result?.limitations.length ? <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#f2f4ef] px-4 py-3 text-xs leading-5 text-[#687468]"><AlertTriangle className="mt-0.5 shrink-0" size={14} />{result.limitations[0]}</div> : null}

      <div className="mt-6 flex justify-end">
        <button type="button" disabled={selectedIds.length === 0} onClick={onConfirm} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#1a211a] px-6 text-sm font-bold text-white outline-none hover:bg-black focus-visible:ring-4 focus-visible:ring-[#A5D020]/40 disabled:cursor-not-allowed disabled:bg-[#aab1a7]">
          {selectedIds.length === 0 ? <><RotateCcw size={16} /> Add and validate one competitor</> : <>Confirm competitors <span aria-hidden="true">→</span></>}
        </button>
      </div>
    </section>
  );
}
