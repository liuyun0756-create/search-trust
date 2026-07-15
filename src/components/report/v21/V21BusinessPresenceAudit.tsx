import { ChevronDown } from "lucide-react";
import type {
  AuditComparisonStatus,
  AuditStatus,
  NormalizedReportSource,
  ReportV21,
} from "@/lib/report-v21";
import { V21DataCoverage } from "./V21DataCoverage";
import { V21GBPAlignment } from "./V21GBPAlignment";
import { isAnalystView, type V21ViewMode } from "./viewMode";

export function V21BusinessPresenceAudit({
  reportV21,
  source,
  viewMode = "analyst",
}: {
  reportV21: ReportV21;
  source: NormalizedReportSource;
  viewMode?: V21ViewMode;
}) {
  const audit = reportV21.business_presence_audit;
  const showTechnical = isAnalystView(viewMode);

  if (!audit) {
    return (
      <div className="space-y-8">
        <LegacyNotice />
        <V21DataCoverage reportV21={reportV21} source={source} />
        <V21GBPAlignment reportV21={reportV21} viewMode={viewMode} />
      </div>
    );
  }

  const summary = audit.summary;
  const profile = audit.profile_activity;
  const reviews = audit.review_audit;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[12px] font-black uppercase text-gray-400">Audit scope</p>
        <div className="mt-3 grid gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
          {audit.audit_scope.map((item) => (
            <div key={item.key} className="min-w-0 bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-black text-[#1A212B]">{item.label}</p>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-2 text-[12px] font-medium leading-relaxed text-gray-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 lg:grid-cols-4">
        <Metric label="Signals assessed" value={summary.assessed_items} />
        <Metric label="Aligned" value={summary.matched_items} tone="text-emerald-700" />
        <Metric label="Needs attention" value={summary.issue_items} tone="text-red-700" />
        <Metric label="Not assessed" value={summary.not_checked_items} tone="text-gray-500" />
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-black text-[#1A212B]">GBP x Page alignment</h3>
            <p className="mt-1 text-[13px] font-medium text-gray-500">
              Objective backend comparison. These checks do not change the eight-layer score.
            </p>
          </div>
        </div>
        <div className="hidden overflow-x-auto rounded-lg border border-gray-200 md:block">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="bg-[#F8FAF5]">
              <tr>
                {['Signal', 'Page observation', 'GBP observation', 'Result', 'What it means'].map((header) => (
                  <th key={header} className="border-b border-gray-200 px-4 py-3 text-[11px] font-black uppercase text-gray-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audit.gbp_page_alignment.map((item) => (
                <tr key={item.key} className="align-top odd:bg-white even:bg-gray-50/50">
                  <td className="border-b border-gray-100 px-4 py-4 text-[13px] font-black text-[#1A212B]">{item.label}</td>
                  <ValueCell value={item.page_value} source={showTechnical ? item.page_source : null} />
                  <ValueCell value={item.gbp_value} source={showTechnical ? item.gbp_source : null} />
                  <td className="border-b border-gray-100 px-4 py-4"><ComparisonBadge status={item.status} /></td>
                  <td className="max-w-[280px] border-b border-gray-100 px-4 py-4 text-[12px] font-medium leading-relaxed text-gray-600">
                    {item.explanation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 md:hidden">
          {audit.gbp_page_alignment.map((item) => (
            <div key={item.key} className="bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-black text-[#1A212B]">{item.label}</p>
                <ComparisonBadge status={item.status} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3">
                <Detail label="Page" value={item.page_value || "Not returned"} />
                <Detail label="GBP" value={item.gbp_value || "Not returned"} />
              </dl>
              <p className="mt-3 text-[12px] font-medium leading-relaxed text-gray-500">{item.explanation}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AuditDetails title="GBP categories and activity" status={profile.status}>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
            <Detail label="Observed categories" value={profile.categories.join(", ") || "Not returned"} wide />
            <Detail label="Photos returned" value={formatCount(profile.photo_count, profile.photo_status)} />
            <Detail label="Latest photo date" value={profile.latest_photo_date || "Not exposed"} />
            <Detail label="Posts returned" value={formatCount(profile.post_count, profile.post_status)} />
            <Detail label="Latest post date" value={profile.latest_post_date || "Not exposed"} />
          </dl>
          <Limitations values={profile.limitations} />
        </AuditDetails>

        <AuditDetails title="Recent review audit" status={reviews.status}>
          <dl className="grid grid-cols-2 gap-x-5 gap-y-4">
            <Detail label="GBP review total" value={formatNumber(reviews.total_reviews)} />
            <Detail label="Recent sample" value={`${reviews.sample_size} / ${reviews.sample_limit}`} />
            <Detail label="Latest review" value={reviews.latest_review_date || "Not returned"} />
            <Detail label="Owner reply rate" value={formatRate(reviews.owner_reply_rate)} />
            <Detail label="Rating distribution" value={formatDistribution(reviews.rating_distribution)} wide />
          </dl>
          <Limitations values={reviews.limitations} />
        </AuditDetails>
      </div>

      {showTechnical && reviews.reviews.length > 0 && (
        <AuditDetails title={`Review evidence sample (${reviews.reviews.length})`} status={reviews.status}>
          <div className="divide-y divide-gray-100">
            {reviews.reviews.map((review, index) => (
              <div key={`${review.author || 'review'}-${index}`} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-gray-500">
                  <span className="text-[#1A212B]">{review.author || "Anonymous"}</span>
                  <span>{review.rating != null ? `${review.rating}/5` : "No rating"}</span>
                  <span>{review.date || "Date not returned"}</span>
                </div>
                {review.text && <p className="mt-2 text-[13px] font-medium leading-relaxed text-gray-600">{review.text}</p>}
                {review.owner_reply && <p className="mt-2 border-l-2 border-[#A5D020] pl-3 text-[12px] font-medium text-gray-500">Owner reply: {review.owner_reply}</p>}
              </div>
            ))}
          </div>
        </AuditDetails>
      )}
    </div>
  );
}

function AuditDetails({ title, status, children }: { title: string; status: AuditStatus; children: React.ReactNode }) {
  return (
    <details className="group rounded-lg border border-gray-200 bg-white" open={false}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <h3 className="truncate text-[15px] font-black text-[#1A212B]">{title}</h3>
          <StatusBadge status={status} />
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-gray-100 px-5 py-5">{children}</div>
    </details>
  );
}

function Metric({ label, value, tone = "text-[#1A212B]" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="bg-white px-4 py-4">
      <p className="text-[11px] font-black uppercase text-gray-400">{label}</p>
      <p className={`mt-1 text-[24px] font-black ${tone}`}>{value}</p>
    </div>
  );
}

function ValueCell({ value, source }: { value?: string | null; source?: string | null }) {
  return (
    <td className="max-w-[240px] border-b border-gray-100 px-4 py-4">
      <p className="break-words text-[12px] font-bold leading-relaxed text-gray-700">{value || "Not returned"}</p>
      {source && <p className="mt-1 text-[10px] font-medium text-gray-400">{source}</p>}
    </td>
  );
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-[10px] font-black uppercase text-gray-400">{label}</dt>
      <dd className="mt-1 break-words text-[13px] font-bold leading-relaxed text-gray-700">{value}</dd>
    </div>
  );
}

function Limitations({ values }: { values: string[] }) {
  if (!values.length) return null;
  return (
    <ul className="mt-5 space-y-1 border-t border-gray-100 pt-4">
      {values.map((value) => <li key={value} className="text-[11px] font-medium leading-relaxed text-gray-500">{value}</li>)}
    </ul>
  );
}

function StatusBadge({ status }: { status: AuditStatus }) {
  return <span className={`shrink-0 rounded-full border px-2 py-1 text-[9px] font-black uppercase ${statusTone(status)}`}>{statusLabel(status)}</span>;
}

function ComparisonBadge({ status }: { status: AuditComparisonStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${statusTone(status)}`}>{statusLabel(status)}</span>;
}

function statusLabel(status: AuditStatus | AuditComparisonStatus): string {
  return status.replaceAll("_", " ");
}

function statusTone(status: AuditStatus | AuditComparisonStatus): string {
  if (status === "match" || status === "checked") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  if (status === "mismatch" || status === "missing" || status === "error") return "border-red-100 bg-red-50 text-red-700";
  if (status === "partial") return "border-amber-100 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-50 text-gray-500";
}

function formatCount(value: number | null | undefined, status: AuditStatus): string {
  if (status === "error") return "Retrieval error";
  if (value == null) return "Not returned";
  return String(value);
}

function formatNumber(value: number | null | undefined): string {
  return value == null ? "Not returned" : new Intl.NumberFormat("en-US").format(value);
}

function formatRate(value: number | null | undefined): string {
  return value == null ? "Not available" : `${Math.round(value * 100)}%`;
}

function formatDistribution(value: Record<string, number>): string {
  const entries = Object.entries(value).sort(([left], [right]) => Number(right) - Number(left));
  return entries.length ? entries.map(([rating, count]) => `${rating}-star: ${count}`).join(" · ") : "Not available";
}

function LegacyNotice() {
  return (
    <div className="rounded-lg border border-amber-100 bg-amber-50 px-5 py-4 text-[13px] font-medium leading-relaxed text-amber-900">
      This saved report predates the Business Presence Audit. Legacy coverage and alignment data are shown below.
    </div>
  );
}
