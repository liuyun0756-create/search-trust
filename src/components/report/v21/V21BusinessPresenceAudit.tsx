import {
  Activity,
  ChevronDown,
  ClipboardCheck,
  MessagesSquare,
  UserRoundCheck,
} from "lucide-react";
import type {
  AuditComparisonStatus,
  AuditStatus,
  BusinessPresenceProposalAction,
  NormalizedReportSource,
  ReportV21,
} from "@/lib/report-v21";
import {
  getAdditionalBusinessPresenceActions,
  getEffectiveGBPAlignmentStatus,
  getProposalActionDisplayCopy,
  getProposalOpportunityCopy,
  NO_ADDITIONAL_PROPOSAL_TASKS_MESSAGE,
  SERVICE_AREA_GBP_MISSING_EXPLANATION,
} from "@/lib/report-v21";
import { V21DataCoverage } from "./V21DataCoverage";
import { V21GBPAlignment } from "./V21GBPAlignment";
import { isAnalystView, type V21ViewMode } from "./viewMode";
import { HorizontalScrollArea } from "@/components/ui/HorizontalScrollArea";

const ATTENTION_STATUSES = new Set<AuditComparisonStatus>(["mismatch", "missing", "partial"]);

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
  const headingId = (id: string) => showTechnical ? id : `client-${id}`;

  if (!audit) {
    return (
      <div className="space-y-8">
        <LegacyNotice />
        <V21DataCoverage reportV21={reportV21} source={source} />
        <V21GBPAlignment reportV21={reportV21} viewMode={viewMode} />
      </div>
    );
  }

  const profile = audit.profile_activity;
  const reviews = audit.review_audit;
  const proposalActions = getAdditionalBusinessPresenceActions(audit.proposal_actions);
  const proposalOpportunityCopy = getProposalOpportunityCopy(proposalActions.length);
  const alignmentRows = audit.gbp_page_alignment.map((item) => {
    const status = getEffectiveGBPAlignmentStatus({
      fieldKey: item.key,
      status: item.status,
      pageValue: item.page_value,
      gbpValue: item.gbp_value,
      gbpChecked: reportV21.gbp_status.status === "checked",
    });
    return status === item.status
      ? item
      : { ...item, status, explanation: SERVICE_AREA_GBP_MISSING_EXPLANATION };
  });
  const displaySummary = summarizeAlignment(alignmentRows);
  const visibleAlignment = showTechnical
    ? alignmentRows
    : alignmentRows.filter((item) => ATTENTION_STATUSES.has(item.status));

  return (
    <div className="space-y-8">
      <p className="border-l-4 border-[#A5D020] pl-4 text-[13px] font-semibold leading-relaxed text-gray-500">
        A non-scoring audit that turns page, GBP and recent-review observations into a one-time client proposal scope.
      </p>

      <section aria-labelledby={headingId("presence-snapshot-title")}>
        <SectionHeading icon={ClipboardCheck} title="Business presence opportunity" id={headingId("presence-snapshot-title")} />
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-100 bg-[#F8FAF5] px-5 py-5">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-[18px] font-black text-[#1A212B]">{proposalOpportunityCopy.headline}</h3>
              <StatusBadge status={audit.proposal_status === "needs_attention" ? "partial" : audit.proposal_status === "clear" ? "checked" : "not_checked"} />
            </div>
            <p className="mt-2 max-w-4xl text-[13px] font-medium leading-relaxed text-gray-600">{proposalOpportunityCopy.summary}</p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-gray-200 lg:grid-cols-4">
            <Metric label="Signals assessed" value={displaySummary.assessed_items} />
            <Metric label="Aligned" value={displaySummary.matched_items} tone="text-emerald-700" />
            <Metric label="Needs attention" value={displaySummary.issue_items} tone="text-red-700" />
            <Metric label="Data limits" value={displaySummary.not_checked_items} tone="text-gray-500" />
          </div>
        </div>
      </section>

      <section aria-labelledby={headingId("proposal-work-title")}>
        <SectionHeading icon={UserRoundCheck} title="Proposal-ready tasks" id={headingId("proposal-work-title")} />
        <div className="mt-4 space-y-3">
          {proposalActions.length ? proposalActions.map((action) => (
            <ProposalActionCard key={action.id} action={action} showTechnical={showTechnical} />
          )) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-5 py-4 text-[13px] font-semibold leading-relaxed text-gray-600">
              {NO_ADDITIONAL_PROPOSAL_TASKS_MESSAGE}
            </div>
          )}
        </div>
      </section>

      <section aria-labelledby={headingId("presence-alignment-title")}>
        <SectionHeading icon={UserRoundCheck} title="GBP x Page alignment" id={headingId("presence-alignment-title")} />
        {visibleAlignment.length ? (
          <AlignmentTable rows={visibleAlignment} showTechnical={showTechnical} />
        ) : (
          <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 px-5 py-4 text-[13px] font-semibold text-emerald-800">
            No confirmed page-to-GBP alignment issue was found in the assessed signals.
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby={headingId("profile-activity-title")}>
          <SectionHeading icon={Activity} eyebrow="Profile activity" title="Profile completeness opportunities" id={headingId("profile-activity-title")} compact />
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-5">
              <Detail label="Observed categories" value={profile.categories.join(", ") || "Not verified"} wide />
              <Detail label="Photos returned" value={formatCount(profile.photo_count, profile.photo_status)} />
              <Detail label="Latest photo date" value={profile.latest_photo_date || "Not verified"} />
              <Detail label="Posts returned" value={formatCount(profile.post_count, profile.post_status)} />
              <Detail label="Latest post date" value={profile.latest_post_date || "Not verified"} />
            </dl>
            {showTechnical && <Limitations values={profile.limitations} />}
          </div>
        </section>

        <section aria-labelledby={headingId("review-operations-title")}>
          <SectionHeading icon={MessagesSquare} eyebrow="Review operations" title="Recent review workload" id={headingId("review-operations-title")} compact />
          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
            <dl className="grid grid-cols-2 gap-x-5 gap-y-5">
              <Detail label="Recent sample" value={`${reviews.sample_size} / ${reviews.sample_limit}`} />
              <Detail label="Reply rate" value={formatRate(reviews.owner_reply_rate)} />
              <Detail label="Unanswered" value={formatNumber(reviews.unanswered_count)} />
              <Detail label="1-3 star reviews" value={formatNumber(reviews.low_rating_count)} />
              <Detail label="1-3 star unanswered" value={formatNumber(reviews.low_rating_unanswered_count)} />
              <Detail label="Detailed positive" value={formatNumber(reviews.detailed_positive_count)} />
              <Detail label="Rating distribution" value={formatDistribution(reviews.rating_distribution)} wide />
            </dl>
            {showTechnical && <Limitations values={reviews.limitations} />}
          </div>
        </section>
      </div>

      {showTechnical && (
        <details className="group overflow-hidden rounded-lg border border-gray-200 bg-white">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 bg-[#F8FAF5] px-5 py-4">
            <div>
              <h3 className="text-[16px] font-black text-[#1A212B]">Sources, limitations and recent reviews</h3>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-7 border-t border-gray-100 px-5 py-5">
            <div className="grid gap-px overflow-hidden rounded-lg border border-gray-200 bg-gray-200 sm:grid-cols-2 lg:grid-cols-3">
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
            <div>
              <h4 className="text-[14px] font-black text-[#1A212B]">Recent review evidence ({reviews.reviews.length})</h4>
              {reviews.reviews.length ? (
                <div className="mt-3 divide-y divide-gray-100 rounded-lg border border-gray-200 px-4">
                  {reviews.reviews.map((review, index) => (
                    <div key={`${review.author || "review"}-${index}`} className="py-4">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-bold text-gray-500">
                        <span className="text-[#1A212B]">{review.author || "Anonymous"}</span>
                        <span>{review.rating != null ? `${review.rating}/5` : "No rating"}</span>
                        <span>{review.date || "Date not returned"}</span>
                        <span className={review.owner_reply ? "text-emerald-700" : "text-amber-700"}>{review.owner_reply ? "Replied" : "No owner reply"}</span>
                      </div>
                      {review.text && <p className="mt-2 text-[13px] font-medium leading-relaxed text-gray-600">{review.text}</p>}
                      {review.owner_reply && <p className="mt-2 border-l-2 border-[#A5D020] pl-3 text-[12px] font-medium text-gray-500">Owner reply: {review.owner_reply}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] font-medium text-gray-500">No recent review records were returned.</p>
              )}
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

function SectionHeading({ icon: Icon, eyebrow, title, id, compact = false }: {
  icon: typeof ClipboardCheck;
  eyebrow?: string;
  title: string;
  id: string;
  compact?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F1F8DC] text-[#708B13]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div>
        {eyebrow && <p className="text-[10px] font-black uppercase text-gray-400">{eyebrow}</p>}
        <h3 id={id} className={`${compact ? "text-[16px]" : "text-[19px]"} mt-0.5 font-black text-[#1A212B]`}>{title}</h3>
      </div>
    </div>
  );
}

function ProposalActionCard({ action, showTechnical }: { action: BusinessPresenceProposalAction; showTechnical: boolean }) {
  const copy = getProposalActionDisplayCopy(action);

  return (
    <article className="rounded-lg border border-gray-200 bg-white px-5 py-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${priorityTone(action.priority)}`}>{action.priority}</span>
        <span className="text-[11px] font-black uppercase text-gray-400">{areaLabel(action.business_area)}</span>
      </div>
      <h4 className="mt-3 text-[16px] font-black text-[#1A212B]">{copy.title}</h4>
      <div className="mt-3">
        <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">Why this task matters</p>
        <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-gray-600">{copy.rationale}</p>
      </div>
      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="text-[10px] font-black uppercase tracking-wide text-gray-400">What the agency should deliver</p>
        <ul className="mt-2 grid gap-2 md:grid-cols-2">
          {copy.recommended_scope.map((item) => (
            <li key={item} className="flex gap-2 text-[12px] font-semibold leading-relaxed text-gray-600">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A5D020]" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      {showTechnical && action.evidence_keys.length > 0 && (
        <p className="mt-4 text-[10px] font-semibold text-gray-400">Evidence references: {action.evidence_keys.join(", ")}</p>
      )}
    </article>
  );
}

function summarizeAlignment(
  rows: NonNullable<ReportV21["business_presence_audit"]>["gbp_page_alignment"],
) {
  const unavailable = new Set<AuditComparisonStatus>(["not_checked", "not_applicable", "error"]);
  return {
    assessed_items: rows.filter((item) => !unavailable.has(item.status)).length,
    matched_items: rows.filter((item) => item.status === "match").length,
    issue_items: rows.filter((item) => ATTENTION_STATUSES.has(item.status)).length,
    not_checked_items: rows.filter((item) => unavailable.has(item.status)).length,
  };
}

function AlignmentTable({ rows, showTechnical }: { rows: NonNullable<ReportV21["business_presence_audit"]>["gbp_page_alignment"]; showTechnical: boolean }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
      <HorizontalScrollArea
        className="hidden md:block"
        label="GBP and page alignment comparison table"
      >
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead className="bg-[#F8FAF5]">
            <tr>
              {["Signal", "Page observation", "GBP observation", "Result", "What it means"].map((header) => (
                <th key={header} className="border-b border-gray-200 px-4 py-3 text-[11px] font-black uppercase text-gray-500">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.key} className="align-top odd:bg-white even:bg-gray-50/50">
                <td className="border-b border-gray-100 px-4 py-4 text-[13px] font-black text-[#1A212B]">{item.label}</td>
                <ValueCell value={item.page_value} source={showTechnical ? item.page_source : null} />
                <ValueCell value={item.gbp_value} source={showTechnical ? item.gbp_source : null} />
                <td className="border-b border-gray-100 px-4 py-4"><ComparisonBadge status={item.status} /></td>
                <td className="max-w-[280px] border-b border-gray-100 px-4 py-4 text-[12px] font-medium leading-relaxed text-gray-600">{item.explanation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </HorizontalScrollArea>
      <div className="divide-y divide-gray-100 md:hidden">
        {rows.map((item) => (
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
  );
}

function Metric({ label, value, tone = "text-[#1A212B]" }: { label: string; value: number; tone?: string }) {
  return <div className="bg-white px-4 py-4"><p className="text-[10px] font-black uppercase text-gray-400">{label}</p><p className={`mt-1 text-[24px] font-black ${tone}`}>{value}</p></div>;
}

function ValueCell({ value, source }: { value?: string | null; source?: string | null }) {
  return <td className="max-w-[240px] border-b border-gray-100 px-4 py-4"><p className="whitespace-pre-line break-words text-[12px] font-bold leading-relaxed text-gray-700">{value || "Not returned"}</p>{source && <p className="mt-1 text-[10px] font-medium text-gray-400">{source}</p>}</td>;
}

function Detail({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "col-span-2" : ""}><dt className="text-[10px] font-black uppercase text-gray-400">{label}</dt><dd className="mt-1 whitespace-pre-line break-words text-[13px] font-bold leading-relaxed text-gray-700">{value}</dd></div>;
}

function Limitations({ values }: { values: string[] }) {
  if (!values.length) return null;
  return <ul className="mt-5 space-y-1 border-t border-gray-100 pt-4">{values.map((value) => <li key={value} className="text-[11px] font-medium leading-relaxed text-gray-500">{value}</li>)}</ul>;
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

function priorityTone(priority: BusinessPresenceProposalAction["priority"]): string {
  if (priority === "high") return "border-red-100 bg-red-50 text-red-700";
  if (priority === "medium") return "border-amber-100 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function areaLabel(area: BusinessPresenceProposalAction["business_area"]): string {
  return {
    identity_alignment: "Identity alignment",
    profile_activity: "Profile activity",
    review_operations: "Review operations",
  }[area];
}

function formatCount(value: number | null | undefined, status: AuditStatus): string {
  if (status === "error") return "Retrieval error";
  if (value == null) return "Not verified";
  return String(value);
}

function formatNumber(value: number | null | undefined): string {
  return value == null ? "Not verified" : new Intl.NumberFormat("en-US").format(value);
}

function formatRate(value: number | null | undefined): string {
  return value == null ? "Not verified" : `${Math.round(value * 100)}%`;
}

function formatDistribution(value: Record<string, number>): string {
  const entries = Object.entries(value).sort(([left], [right]) => Number(right) - Number(left));
  return entries.length ? entries.map(([rating, count]) => `${rating}-star: ${count}`).join(" / ") : "Not verified";
}

function LegacyNotice() {
  return <div className="rounded-lg border border-amber-100 bg-amber-50 px-5 py-4 text-[13px] font-medium leading-relaxed text-amber-900">This saved report predates the Business Presence Audit. Legacy coverage and alignment data are shown below.</div>;
}
