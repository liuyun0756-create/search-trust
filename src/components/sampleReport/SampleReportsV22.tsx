import Link from "next/link";
import { ArrowRight, BarChart3, Check, FileSearch, Fingerprint, Link2, ShieldCheck } from "lucide-react";

import { RunAuditButton } from "@/components/common/RunAuditButton";

const prospectRows = [
  ["Business identity", "Matched", "Website + public GBP"],
  ["Competitor set", "Confirmed", "Real local businesses"],
  ["Trust gap", "L3 consistency", "L1–L8 evidence model"],
  ["Next action", "Prioritized", "Client-ready rationale"],
] as const;

const verifiedRows = [
  ["Search Console", "Healthy", "Clicks, impressions, queries"],
  ["Google Analytics", "Healthy", "Users and engagement"],
  ["Comparison", "90 vs 90 days", "Aligned source windows"],
  ["Action plan", "Verified", "Owned + public evidence"],
] as const;

function ReportCard({ variant }: { variant: "prospect" | "verified" }) {
  const prospect = variant === "prospect";
  const rows = prospect ? prospectRows : verifiedRows;
  return (
    <article className={`overflow-hidden rounded-[1.8rem] ${prospect ? "border border-[#d7ddce] bg-white text-[#182018]" : "bg-[#182018] text-white shadow-[0_28px_80px_rgba(24,32,24,0.2)]"}`}>
      <header className={`flex items-center justify-between border-b px-6 py-5 ${prospect ? "border-[#e2e6dc]" : "border-white/10"}`}>
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${prospect ? "bg-[#edf3d9] text-[#718d18]" : "bg-[#b8e626] text-[#182018]"}`}>{prospect ? <FileSearch className="h-5 w-5" /> : <BarChart3 className="h-5 w-5" />}</span>
          <div><p className={`text-[10px] font-black uppercase tracking-[0.2em] ${prospect ? "text-[#718d18]" : "text-[#b8e626]"}`}>{prospect ? "Before the engagement" : "After the engagement"}</p><h3 className="mt-1 font-[family-name:Georgia] text-2xl">{prospect ? "Prospect Evidence Report" : "Verified Action Plan"}</h3></div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${prospect ? "bg-[#f1f3ed]" : "border border-white/10 text-white/50"}`}>V2.2</span>
      </header>
      <div className="p-6">
        <p className={`min-h-14 text-sm leading-6 ${prospect ? "text-[#667064]" : "text-white/56"}`}>{prospect ? "A persuasive, source-backed view built from public business, site and competitor evidence." : "A prioritized plan built after GSC and GA4 pass health checks and join the Case evidence."}</p>
        <div className="mt-6 space-y-3">
          {rows.map(([label, value, source]) => <div key={label} className={`rounded-xl border p-3.5 ${prospect ? "border-[#e2e6dc] bg-[#fafbf7]" : "border-white/8 bg-white/[0.035]"}`}><div className="flex items-center justify-between gap-4 text-xs"><span className={prospect ? "font-bold text-[#586256]" : "font-bold text-white/62"}>{label}</span><span className="font-black text-[#85a918]">{value}</span></div><p className={`mt-1.5 text-[10px] ${prospect ? "text-[#899187]" : "text-white/34"}`}>{source}</p></div>)}
        </div>
      </div>
    </article>
  );
}

export function SampleReportsV22() {
  return (
    <main className="overflow-hidden bg-[#f3f4ed] text-[#182018]">
      <section className="px-4 pb-24 pt-20 sm:px-6 sm:pb-32 sm:pt-28 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.26em] text-[#718d18]">Illustrative V2.2 reports</p>
            <h1 className="mt-5 font-[family-name:Georgia] text-5xl leading-[0.98] tracking-[-0.055em] sm:text-7xl">The evidence grows with the client relationship.</h1>
            <p className="mx-auto mt-7 max-w-3xl text-lg leading-8 text-[#667064]">Prospect shows what can be responsibly learned from public evidence. Verified adds owned performance data only after access is granted. The two reports share one Case and one source history.</p>
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row"><RunAuditButton trackingSource="sample_reports_v22" className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-[#182018] px-6 py-3.5 text-sm font-black text-white">Start with 5 free credits <ArrowRight className="h-4 w-4" /></RunAuditButton><Link href="/framework" className="inline-flex min-h-13 items-center justify-center rounded-xl border border-[#cfd5c7] bg-white px-6 py-3.5 text-sm font-black">Explore the L1–L8 framework</Link></div>
          </div>
          <div className="mt-16 grid gap-6 lg:grid-cols-2"><ReportCard variant="prospect" /><ReportCard variant="verified" /></div>
          <p className="mx-auto mt-6 max-w-3xl text-center text-xs leading-5 text-[#7c8679]">These previews demonstrate report structure and evidence states. They do not represent a ranking, traffic or revenue guarantee.</p>
        </div>
      </section>

      <section className="border-y border-[#d7ddce] bg-[#e8ecdd] px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
            <div><p className="text-xs font-black uppercase tracking-[0.24em] text-[#718d18]">What changes between reports</p><h2 className="mt-4 font-[family-name:Georgia] text-4xl tracking-[-0.04em] sm:text-5xl">More access creates stronger evidence—not retroactive certainty.</h2></div>
            <p className="max-w-2xl text-lg leading-8 text-[#667064] lg:justify-self-end">Prospect is honest about public-data limits. Verified does not erase that history; it adds source health, owned performance and time-based comparison so recommendations can become more specific.</p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-[1.75rem] border border-[#ccd3c2] bg-[#ccd3c2] md:grid-cols-3">
            {[
              [Fingerprint, "Same identity", "The confirmed site, public GBP and competitors remain attached to the Case."],
              [Link2, "New owned sources", "GSC and GA4 are authorized, checked and synchronized before generation."],
              [ShieldCheck, "Visible change", "A change is marked only when the evidence actually differs from the earlier snapshot."],
            ].map(([Icon, title, body]) => { const Glyph = Icon as typeof Fingerprint; return <article key={String(title)} className="bg-[#f8f9f3] p-8 sm:p-10"><Glyph className="h-6 w-6 text-[#789b12]" /><h3 className="mt-10 font-[family-name:Georgia] text-2xl">{String(title)}</h3><p className="mt-4 text-sm leading-7 text-[#667064]">{String(body)}</p></article>; })}
          </div>
        </div>
      </section>

      <section className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div><p className="text-xs font-black uppercase tracking-[0.24em] text-[#718d18]">What every report preserves</p><h2 className="mt-4 font-[family-name:Georgia] text-4xl tracking-[-0.04em] sm:text-5xl">A conclusion should never outrun its source.</h2><p className="mt-6 max-w-2xl text-lg leading-8 text-[#667064]">Each conclusion stays connected to its evidence status. Missing required data blocks the workflow; unavailable optional data remains visible; technical generation failure returns the credit.</p></div>
          <ul className="space-y-3 rounded-[1.75rem] border border-[#d7ddce] bg-white p-7 sm:p-9">
            {["Confirmed business identity", "At least one real competitor for Prospect", "GSC and GA4 health for Verified", "Source snapshots and generation history", "Advisor detail and client-ready communication"].map((item) => <li key={item} className="flex items-center gap-3 border-b border-[#e7eadf] pb-3 text-sm font-bold last:border-0 last:pb-0"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#edf3d9]"><Check className="h-4 w-4 text-[#789b12]" /></span>{item}</li>)}
          </ul>
        </div>
      </section>
    </main>
  );
}
