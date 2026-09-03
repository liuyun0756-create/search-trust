"use client";

import { ArrowRight, BriefcaseBusiness, Globe2, Handshake } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { createNewCaseDraft, saveDraft, type WorkGoal } from "@/lib/preflight-v22";

export function AuditForm({ floating = false }: { floating?: boolean }) {
  const router = useRouter();
  const [goal, setGoal] = useState<WorkGoal>("win_new_client");
  const [siteUrl, setSiteUrl] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!siteUrl.trim()) return;
    saveDraft(sessionStorage, createNewCaseDraft(new Date(), crypto.randomUUID(), { goal, site_url: siteUrl.trim() }));
    router.push("/cases/new");
  }

  const wrapperClass = floating
    ? "absolute bottom-0 left-1/2 z-20 w-[calc(100%-2rem)] max-w-6xl -translate-x-1/2 translate-y-1/2 overflow-hidden rounded-2xl border border-[#D9E7AE] bg-white p-6 shadow-[0_24px_64px_rgba(15,23,42,0.14)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-[#A5D020] sm:p-8"
    : "relative z-20 mx-auto max-w-6xl overflow-hidden rounded-2xl border border-[#D9E7AE] bg-white p-6 shadow-[0_24px_64px_rgba(15,23,42,0.14)] before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-[#A5D020] sm:p-8";

  return (
    <form onSubmit={submit} className={wrapperClass}>
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end">
        <GoalOption value="win_new_client" selected={goal === "win_new_client"} onSelect={setGoal} icon={Handshake} label="Win a new client" />
        <GoalOption value="work_existing_client" selected={goal === "work_existing_client"} onSelect={setGoal} icon={BriefcaseBusiness} label="Existing client" />
        <label className="block"><span className="mb-2 block text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#657083]">Client website</span><div className="relative"><Globe2 className="absolute left-4 top-1/2 -translate-y-1/2 text-[#7e8898]" size={18} /><input required inputMode="url" autoComplete="url" value={siteUrl} onChange={(event) => setSiteUrl(event.target.value)} placeholder="example.com" className="h-12 w-full rounded-xl border border-[#CDD3DD] bg-[#FCFCFD] pl-11 pr-4 text-sm outline-none focus:border-[#8FB713] focus:ring-4 focus:ring-[#A5D020]/20" /></div></label>
        <button type="submit" disabled={!siteUrl.trim()} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1A1F2B] px-6 text-sm font-bold text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)] outline-none hover:bg-black focus-visible:ring-4 focus-visible:ring-[#A5D020]/35 disabled:cursor-not-allowed disabled:opacity-50">Start free preflight <ArrowRight size={16} /></button>
      </div>
      <p className="mt-4 text-center text-[11px] font-semibold text-[#7c8798]">Public data only · No login · No payment · No Google access</p>
    </form>
  );
}

function GoalOption({ value, selected, onSelect, icon: Icon, label }: { value: WorkGoal; selected: boolean; onSelect(value: WorkGoal): void; icon: typeof Handshake; label: string }) {
  return (
    <label className={`flex h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 transition focus-within:ring-4 focus-within:ring-[#A5D020]/20 ${selected ? "border-[#91b91b] bg-[#f5fadf]" : "border-[#d6dce3] bg-[#fcfcfd]"}`}>
      <input className="sr-only" type="radio" name="preflight-goal" checked={selected} onChange={() => onSelect(value)} />
      <Icon size={17} className={selected ? "text-[#668509]" : "text-[#7b8594]"} />
      <span className="text-sm font-bold text-[#27303e]">{label}</span>
    </label>
  );
}
