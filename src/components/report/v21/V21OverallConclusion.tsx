import type { NormalizedReportV21Result, ReportV21 } from "@/lib/report-v21";
import { formatLayerKey, getRiskTone, sourceLabel } from "./statusHelpers";
import { isAnalystView, type V21ViewMode } from "./viewMode";

export function V21OverallConclusion({
  normalized,
  viewMode = "analyst",
}: {
  normalized: NormalizedReportV21Result;
  viewMode?: V21ViewMode;
}) {
  const report = normalized.reportV21;
  const showTechnical = isAnalystView(viewMode);
  const overallStatus = report.overall_status ?? {
    label: "Unknown",
    level: "medium" as const,
    explanation: "No structured trust status was available.",
  };
  const rankingPotential = report.ranking_potential ?? {
    label: "Unknown",
    level: "competitive" as const,
    explanation: "No structured ranking potential was available.",
  };
  const riskLevel = report.risk_level ?? {
    label: "Unknown",
    level: "medium" as const,
    explanation: "No structured risk level was available.",
  };
  const primaryBlockingLayer = report.primary_blocking_layer ?? {
    layer_key: "foundation" as const,
    layer_name: "Eligibility",
    reason: "No structured primary blocking layer was available.",
    evidence_items: [],
  };
  const clientSummary = report.client_summary ?? {
    title: "SearchTrust report",
    plain_language_summary: "No structured client summary was available.",
    why_it_matters: "A structured v2.1 summary was not available in this report payload.",
    first_priority: "Review the trust layer breakdown.",
    not_first_priority: "",
    expected_change: "",
  };
  const cards = [
    {
      label: "Trust Status",
      value: overallStatus.label,
      level: overallStatus.level,
      explanation: overallStatus.explanation,
      tone: overallStatus.level === "weak" ? "text-red-600" : overallStatus.level === "strong" || overallStatus.level === "high" ? "text-emerald-600" : "text-blue-600",
    },
    {
      label: "Ranking Potential",
      value: rankingPotential.label,
      level: rankingPotential.level,
      explanation: rankingPotential.explanation,
      tone: rankingPotential.level === "strong" ? "text-emerald-600" : rankingPotential.level === "low" ? "text-red-600" : "text-indigo-600",
    },
    {
      label: "Risk Level",
      value: riskLevel.label,
      level: riskLevel.level,
      explanation: riskLevel.explanation,
      tone: getRiskTone(riskLevel.level),
    },
  ];

  return (
    <div className="space-y-6">
      {showTechnical && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-[#E4EDD2] bg-[#FBFDF5] px-3 py-1.5 text-[12px] font-black uppercase tracking-[0.12em] text-[#8BAA2B]">
            {sourceLabel(normalized.source)}
          </span>
          {!normalized.valid && (
            <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-[12px] font-black uppercase tracking-[0.12em] text-amber-700">
              Limited validation
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SummaryCard title="Primary Blocking Layer" value={formatLayerKey(primaryBlockingLayer.layer_key)} detail={primaryBlockingLayer.reason} />
        <SummaryCard title="Why It Matters" value={clientSummary.why_it_matters} detail={`First priority: ${clientSummary.first_priority}`} />
      </div>

      <div className="rounded-[22px] border border-blue-100 bg-blue-50/50 p-6">
        <h3 className="mb-2 text-[20px] font-black tracking-tight text-[#1A212B]">{clientSummary.title}</h3>
        <p className="text-[15px] font-medium leading-relaxed text-gray-700">{clientSummary.plain_language_summary}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <article key={card.label} className="rounded-[20px] border border-gray-100 bg-white p-5 shadow-sm">
            <p className="mb-2 text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">{card.label}</p>
            <h4 className={`mb-2 text-[24px] font-black tracking-tight ${card.tone}`}>{card.value}</h4>
            <p className="text-[13px] font-medium leading-relaxed text-gray-600">{card.explanation}</p>
          </article>
        ))}
      </div>

      {clientSummary.expected_change && (
        <SummaryCard title="Expected Change" value={clientSummary.expected_change} detail={clientSummary.not_first_priority ? `Not first priority: ${clientSummary.not_first_priority}` : ""} />
      )}

      <DataCheckedSummary report={report} />

      {showTechnical && normalized.source === "legacy_adapted" && (
        <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800">
          This report was adapted from a legacy report format; structured v2.1 evidence may be incomplete.
        </p>
      )}
      {showTechnical && normalized.source === "fallback" && (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
          This report could not be fully normalized, so only a limited fallback view is available.
        </p>
      )}
    </div>
  );
}

function SummaryCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <article className="rounded-[20px] border border-gray-100 bg-gray-50/60 p-5">
      <p className="mb-2 text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">{title}</p>
      <h4 className="mb-2 text-[17px] font-black text-[#1A212B]">{value}</h4>
      {detail && <p className="text-[13px] font-medium leading-relaxed text-gray-600">{detail}</p>}
    </article>
  );
}

function DataCheckedSummary({ report }: { report: ReportV21 }) {
  const coverage = report.data_coverage ?? {
    page_content_checked: false,
    gbp_checked: false,
    schema_checked: false,
    contact_page_checked: false,
    about_page_checked: false,
    reviews_checked: false,
    internal_pages_checked: false,
  };
  const checked = [
    coverage.page_content_checked && "Page content",
    coverage.gbp_checked && "GBP",
    coverage.schema_checked && "Schema",
    coverage.contact_page_checked && "Contact page",
    coverage.about_page_checked && "About page",
    coverage.reviews_checked && "Reviews",
    coverage.internal_pages_checked && "Internal pages",
  ].filter(Boolean);

  return (
    <div className="rounded-[20px] border border-[#E4EDD2] bg-[#FBFDF5] p-5">
      <p className="mb-2 text-[12px] font-black uppercase tracking-[0.14em] text-[#8BAA2B]">Data checked</p>
      <p className="text-[14px] font-medium leading-relaxed text-gray-700">
        {checked.length ? checked.join(", ") : "No structured data coverage was available."}
      </p>
    </div>
  );
}
