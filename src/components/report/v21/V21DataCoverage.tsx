"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { extractGBPAlignmentRows, type GBPAlignmentContractRow, type GBPAlignmentRow, type ReportV21 } from "@/lib/report-v21";
import { safeList } from "./statusHelpers";

const GBP_SOURCE_LABELS = {
  user_provided: "Provided by the user",
  system_discovered: "Found automatically",
  not_available: "No GBP source was available",
} as const;

const INTERNAL_MARKERS = ["validation note:", "pydantic", "dedupe", "duplicate", "deterministic", "triggered_rule_ids", "checked_rule_ids"];

export function V21DataCoverage({ reportV21, source }: { reportV21: ReportV21; source: string }) {
  const coverage = reportV21.data_coverage;
  const gbpChecked = reportV21.gbp_status.status === "checked";
  const alignment: Array<GBPAlignmentContractRow | GBPAlignmentRow> = reportV21.gbp_alignment?.length ? reportV21.gbp_alignment : extractGBPAlignmentRows(reportV21).rows;
  const limitations = safeList(coverage.limitations).filter((note) => !INTERNAL_MARKERS.some((marker) => note.toLowerCase().includes(marker)));

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] border border-[#E4EDD2] bg-[#FBFDF5] p-5">
        <h3 className="text-[20px] font-black tracking-tight text-[#1A212B]">Local Presence &amp; Market Context</h3>
        <p className="mt-2 max-w-3xl text-[14px] font-medium leading-relaxed text-gray-600">
          This section separates verified GBP-to-page signals from external data that was not collected in this audit.
        </p>
      </div>

      <ContextPanel title="GBP × Page Alignment" summary={gbpChecked ? "Verified profile fields and comparable page signals" : "GBP was not verified for this audit"} defaultOpen>
        <GBPPanel reportV21={reportV21} rows={alignment} />
      </ContextPanel>

      <ContextPanel title="External Presence" summary="Schema, reviews, supporting site pages, and citation coverage">
        {reportV21.schema_summary?.checked && <p className="mb-3 rounded-xl border border-[#E4EDD2] bg-[#FBFDF5] px-4 py-3 text-[13px] font-medium text-gray-700">Schema types found: {safeList(reportV21.schema_summary.types).length ? safeList(reportV21.schema_summary.types).join(", ") : "No JSON-LD types detected"}</p>}
        <div className="grid gap-3 md:grid-cols-2">
          <Assessment label="Page content" checked={coverage.page_content_checked} />
          <Assessment label="GBP reviews" checked={coverage.reviews_checked} />
          <Assessment label="Schema" checked={coverage.schema_checked} />
          <Assessment label="Contact page" checked={coverage.contact_page_checked} />
          <Assessment label="About page" checked={coverage.about_page_checked} />
          <Assessment label="Internal pages" checked={coverage.internal_pages_checked} />
          <Assessment label="Citations / listings" checked={Boolean(coverage.citations_checked)} />
        </div>
      </ContextPanel>

      <ContextPanel title="Competitive Context" summary="Competitor pages, Map Pack, and geo-grid visibility">
        <div className="grid gap-3 md:grid-cols-2">
          <Assessment label="Competitor pages" checked={coverage.competitor_pages_checked} />
          <Assessment label="Map Pack / geo-grid" checked={Boolean(coverage.geo_grid_checked)} />
        </div>
        <p className="mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-[13px] font-medium leading-relaxed text-gray-600">
          These sources are kept separate from GBP × Page Alignment. They are not used to imply a ranking or visibility comparison until they are collected.
        </p>
      </ContextPanel>

      {limitations.length > 0 && (
        <ContextPanel title="Scope Notes" summary={`${limitations.length} limitation${limitations.length === 1 ? "" : "s"} recorded`}>
          <ul className="space-y-2">
            {limitations.slice(0, 6).map((note, index) => <li key={`${note}-${index}`} className="flex gap-2 text-[13px] font-medium leading-relaxed text-gray-600"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />{note}</li>)}
          </ul>
        </ContextPanel>
      )}
      {source !== "native" && <p className="text-[12px] font-medium text-gray-400">This historic report was adapted for the v2.1 presentation.</p>}
    </div>
  );
}

function GBPPanel({ reportV21, rows }: { reportV21: ReportV21; rows: Array<GBPAlignmentContractRow | GBPAlignmentRow> }) {
  const checked = reportV21.gbp_status.status === "checked";
  const profile = reportV21.gbp_profile;
  const source = reportV21.gbp_status.source;
  if (!checked) {
    return <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-4"><p className="font-bold text-amber-900">GBP was not checked, so this report makes no GBP mismatch or comparison conclusion.</p>{reportV21.gbp_status.reason && <p className="mt-2 text-[13px] font-medium leading-relaxed text-amber-800">{reportV21.gbp_status.reason}</p>}</div>;
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E4EDD2] bg-[#FBFDF5] px-4 py-3"><div><p className="text-[12px] font-black uppercase tracking-[0.12em] text-[#7A8A15]">Verified GBP record</p><p className="mt-1 text-[13px] font-medium text-gray-600">{source ? GBP_SOURCE_LABELS[source] : "Source was not recorded"}</p></div><span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase text-emerald-700">Checked</span></div>
    {profile && <div className="grid gap-3 md:grid-cols-2"><ProfileField label="Business name" value={profile.name} /><ProfileField label="Address" value={profile.address} /><ProfileField label="Phone" value={profile.phone} /><ProfileField label="Website" value={profile.website} /><ProfileField label="Categories" value={safeList(profile.categories).join(", ")} /><ProfileField label="Hours" value={profile.hours} /><ProfileField label="Rating / reviews" value={[profile.rating && `${profile.rating} rating`, profile.review_count && `${profile.review_count} reviews`].filter(Boolean).join(" · ")} /><ProfileField label="Service areas" value={safeList(profile.service_areas).join(", ")} /></div>}
    {rows.length > 0 ? <div className="overflow-hidden rounded-xl border border-gray-100"><div className="overflow-x-auto"><table className="min-w-[760px] w-full border-collapse text-left"><thead className="bg-gray-50"><tr>{["Field", "Page signal", "GBP signal", "Result"].map((label) => <th key={label} className="border-b border-gray-100 px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-gray-500">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.field_key} className="align-top"><td className="border-b border-gray-100 px-4 py-3 text-[13px] font-bold text-[#1A212B]">{row.field_label}</td><td className="border-b border-gray-100 px-4 py-3 text-[13px] font-medium text-gray-600">{row.page_value || "Not extracted"}</td><td className="border-b border-gray-100 px-4 py-3 text-[13px] font-medium text-gray-600">{row.gbp_value || "Not recorded"}</td><td className="border-b border-gray-100 px-4 py-3"><ResultStatus value={row.status} /></td></tr>)}</tbody></table></div></div> : <p className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-[13px] font-medium text-gray-600">GBP data was available, but no field-level comparison was produced for this historic report.</p>}
  </div>;
}

function ContextPanel({ title, summary, defaultOpen = false, children }: { title: string; summary: string; defaultOpen?: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return <section className="overflow-hidden rounded-[20px] border border-gray-100 bg-white shadow-sm"><button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"><div><h4 className="text-[16px] font-black text-[#1A212B]">{title}</h4><p className="mt-1 text-[13px] font-medium text-gray-500">{summary}</p></div><ChevronDown className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} /></button>{open && <div className="border-t border-gray-100 p-5">{children}</div>}</section>;
}

function Assessment({ label, checked }: { label: string; checked: boolean }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3"><span className="text-[13px] font-bold text-[#1A212B]">{label}</span><span className={checked ? "text-[12px] font-black text-emerald-600" : "text-[12px] font-black text-gray-400"}>{checked ? "Assessed" : "Not assessed"}</span></div>;
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">{label}</p><p className="mt-1 text-[13px] font-medium leading-relaxed text-gray-700">{value || "Not recorded"}</p></div>;
}

function ResultStatus({ value }: { value: GBPAlignmentContractRow["status"] }) {
  const labels: Record<GBPAlignmentContractRow["status"], string> = { match: "Aligned", mismatch: "Does not align", partial: "Partial", missing: "Missing", not_checked: "Not assessed" };
  const classes: Record<GBPAlignmentContractRow["status"], string> = { match: "border-emerald-100 bg-emerald-50 text-emerald-700", mismatch: "border-red-100 bg-red-50 text-red-700", partial: "border-amber-100 bg-amber-50 text-amber-700", missing: "border-orange-100 bg-orange-50 text-orange-700", not_checked: "border-gray-100 bg-gray-50 text-gray-500" };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${classes[value]}`}>{labels[value]}</span>;
}
