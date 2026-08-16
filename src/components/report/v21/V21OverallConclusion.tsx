import {
  getClientDecisionContext,
  IMPROVEMENT_SEQUENCE,
  type ClientDecisionPriority,
  type ClientDecisionWorkPhase,
  type NormalizedReportV21Result,
  type ReportV21,
} from "@/lib/report-v21";
import { CircleHelp, Layers3, type LucideIcon } from "lucide-react";
import { formatLayerKey, getRiskTone } from "./statusHelpers";
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

  if (!showTechnical) {
    return (
      <ClientDecisionSummary
        report={report}
        clientSummary={clientSummary}
        primaryBlockingLayer={primaryBlockingLayer}
        cards={cards}
      />
    );
  }

  return (
    <div className="space-y-6">
      {!normalized.valid && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-[12px] font-black uppercase tracking-[0.12em] text-amber-700">
            Limited validation
          </span>
        </div>
      )}

      <ScoreCards cards={cards} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SummaryCard
          title="Primary Blocking Layer"
          value={formatLayerKey(primaryBlockingLayer.layer_key)}
          detail={primaryBlockingLayer.reason}
          icon={Layers3}
          highlighted
        />
        <SummaryCard
          title="Why It Matters"
          value={clientSummary.why_it_matters}
          detail={`First priority: ${clientSummary.first_priority}`}
          icon={CircleHelp}
          highlighted
        />
      </div>

      <div className="rounded-[22px] border border-blue-100 bg-blue-50/50 p-6">
        <h3 className="mb-2 text-[20px] font-black tracking-tight text-[#1A212B]">{clientSummary.title}</h3>
        <p className="text-[15px] font-medium leading-relaxed text-gray-700">{clientSummary.plain_language_summary}</p>
      </div>

      {clientSummary.expected_change && (
        <SummaryCard title="Expected Change" value={clientSummary.expected_change} detail={clientSummary.not_first_priority ? `Not first priority: ${clientSummary.not_first_priority}` : ""} />
      )}

      <DataCheckedSummary report={report} />

      {normalized.source === "legacy_adapted" && (
        <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-800">
          This report was adapted from a legacy report format; structured v2.1 evidence may be incomplete.
        </p>
      )}
      {normalized.source === "fallback" && (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
          This report could not be fully normalized, so only a limited fallback view is available.
        </p>
      )}
    </div>
  );
}

type ScoreCardData = {
  label: string;
  value: string;
  level: string;
  explanation: string;
  tone: string;
};

function ClientDecisionSummary({
  report,
  clientSummary,
  primaryBlockingLayer,
  cards,
}: {
  report: ReportV21;
  clientSummary: ReportV21["client_summary"];
  primaryBlockingLayer: ReportV21["primary_blocking_layer"];
  cards: ScoreCardData[];
}) {
  const decision = getClientDecisionContext(report);
  const tone = priorityTone(decision.priority_level);
  const checked = checkedSources(report);

  return (
    <div className="space-y-6">
      <div>
        <ScoreCards cards={cards} />
        <p className="mt-3 rounded-[16px] border border-indigo-100 bg-indigo-50/40 px-5 py-4 text-[13px] font-semibold leading-relaxed text-gray-700">
          {decision.score_interpretation}
        </p>
      </div>

      <div className="space-y-4">
        <div className={`overflow-hidden rounded-[22px] border ${tone.border} ${tone.background}`}>
          <div className="p-6 md:p-8">
            <span className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] ${tone.badge}`}>
              {decision.priority_label}
            </span>
            <h3 className="mt-4 text-[24px] font-black tracking-tight text-[#1A212B] md:text-[28px]">
              {clientSummary.title}
            </h3>
            <p className="mt-3 max-w-4xl text-[15px] font-medium leading-relaxed text-gray-700">
              {clientSummary.plain_language_summary}
            </p>
            <div className={`mt-5 border-t pt-5 ${tone.divider}`}>
              <p className={`text-[11px] font-black uppercase tracking-[0.14em] ${tone.emphasis}`}>
                Why action is needed now
              </p>
              <p className="mt-2 max-w-4xl text-[14px] font-semibold leading-relaxed text-gray-700">
                {decision.why_act_now}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-[#DCE8C3] bg-[#FBFDF6] p-6 md:p-8">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#7A991C]">Recommended approval</p>
          <div className="mt-4 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.12em] text-gray-400">Primary blocking layer</p>
              <h4 className="mt-2 text-[20px] font-black text-[#1A212B]">
                {formatLayerKey(primaryBlockingLayer.layer_key)}
              </h4>
              <p className="mt-2 text-[13px] font-medium leading-relaxed text-gray-600">
                {primaryBlockingLayer.reason}
              </p>
            </div>
            <div className="border-t border-[#DCE8C3] pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
              <p className="text-[12px] font-black uppercase tracking-[0.12em] text-gray-400">First priority</p>
              <p className="mt-2 text-[17px] font-black leading-snug text-[#1A212B]">{clientSummary.first_priority}</p>
              {clientSummary.expected_change && (
                <>
                  <p className="mt-4 text-[12px] font-black uppercase tracking-[0.12em] text-gray-400">Expected change</p>
                  <p className="mt-2 text-[13px] font-medium leading-relaxed text-gray-600">{clientSummary.expected_change}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid overflow-hidden rounded-[18px] border border-gray-200 bg-white sm:grid-cols-3 sm:divide-x sm:divide-gray-200">
        <DecisionMetric value={decision.issue_count} label="Confirmed findings" />
        <DecisionMetric value={decision.affected_layer_count} label="Affected trust layers" />
        <DecisionMetric value={decision.work_phase_count} label="Recommended focus areas" />
      </div>

      <div className="overflow-hidden rounded-[20px] border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4 md:px-6">
          <h4 className="text-[15px] font-black text-[#1A212B]">Recommended work sequence</h4>
          <p className="mt-1 text-[12px] font-medium leading-relaxed text-gray-500">
            The affected trust layers from the Full Trust Audit, summarized without implementation detail.
          </p>
        </div>
        {decision.work_sequence.length ? (
          <ClientWorkSequenceList phases={decision.work_sequence} />
        ) : (
          <p className="px-5 py-5 text-[13px] font-medium leading-relaxed text-gray-600 md:px-6">
            Maintain the current trust signals and re-audit after meaningful page or business changes.
          </p>
        )}
      </div>

      <p className="border-t border-gray-100 pt-4 text-[12px] font-medium leading-relaxed text-gray-500">
        <span className="font-black text-gray-600">Sources checked:</span>{" "}
        {checked.length ? checked.join(", ") : "No structured data coverage was available."}
      </p>
    </div>
  );
}

function ClientWorkSequenceList({
  phases,
}: {
  phases: ClientDecisionWorkPhase[];
}) {
  const phaseGroups = IMPROVEMENT_SEQUENCE
    .map((sequence) => ({
      sequence,
      items: phases.filter((phase) => phase.phase_number === sequence.number),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <section className="px-5 py-4 md:px-6">
      <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 bg-[#FCFCFB] px-4">
        {phaseGroups.map(({ sequence, items }) => (
          <article
            key={sequence.number}
            className="grid gap-4 py-4 md:grid-cols-[210px_minmax(0,1fr)]"
          >
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#7A8A15]">
                Phase {sequence.number} · {sequence.layerRange}
              </p>
              <h3 className="mt-1 text-[14px] font-black text-[#1A212B]">{sequence.title}</h3>
            </div>
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.layer_keys.join("-")}>
                  <p className="text-[12px] font-bold text-gray-500">{item.layer_labels[0]}</p>
                  <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
                    What this affects
                  </p>
                  <p className="mt-1 text-[13px] font-medium leading-relaxed text-gray-600">{item.summary}</p>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DecisionMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="border-b border-gray-200 px-5 py-5 last:border-b-0 sm:border-b-0 md:px-6">
      <p className="text-[30px] font-black tracking-tight text-[#1A212B]">{value}</p>
      <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-gray-400">{label}</p>
    </div>
  );
}

function ScoreCards({ cards }: { cards: ScoreCardData[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {cards.map((card) => (
        <article key={card.label} className="rounded-[20px] border border-gray-100 bg-white p-5 shadow-sm">
          <p className="mb-2 text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">{card.label}</p>
          <h4 className={`mb-2 text-[24px] font-black tracking-tight ${card.tone}`}>{card.value}</h4>
          <p className="text-[13px] font-medium leading-relaxed text-gray-600">{card.explanation}</p>
        </article>
      ))}
    </div>
  );
}

function priorityTone(priority: ClientDecisionPriority) {
  return {
    immediate: {
      border: "border-red-200",
      background: "bg-red-50/45",
      badge: "border-red-200 bg-white text-red-700",
      divider: "border-red-200/70",
      emphasis: "text-red-700",
    },
    high: {
      border: "border-amber-200",
      background: "bg-amber-50/45",
      badge: "border-amber-200 bg-white text-amber-700",
      divider: "border-amber-200/70",
      emphasis: "text-amber-700",
    },
    planned: {
      border: "border-blue-200",
      background: "bg-blue-50/45",
      badge: "border-blue-200 bg-white text-blue-700",
      divider: "border-blue-200/70",
      emphasis: "text-blue-700",
    },
    monitor: {
      border: "border-emerald-200",
      background: "bg-emerald-50/45",
      badge: "border-emerald-200 bg-white text-emerald-700",
      divider: "border-emerald-200/70",
      emphasis: "text-emerald-700",
    },
  }[priority];
}

function SummaryCard({
  title,
  value,
  detail,
  icon: Icon,
  highlighted = false,
}: {
  title: string;
  value: string;
  detail: string;
  icon?: LucideIcon;
  highlighted?: boolean;
}) {
  return (
    <article
      className={`rounded-[20px] border p-5 ${
        highlighted
          ? "border-[#DCE8C3] bg-[#FBFDF6]"
          : "border-gray-100 bg-gray-50/60"
      }`}
    >
      {Icon ? (
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF4D2] text-[#739315]">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="text-[12px] font-black uppercase tracking-[0.14em] text-[#52651C]">
            {title}
          </p>
        </div>
      ) : (
        <p className="mb-2 text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">
          {title}
        </p>
      )}
      <h4 className="mb-2 text-[17px] font-black text-[#1A212B]">{value}</h4>
      {detail && <p className="text-[13px] font-medium leading-relaxed text-gray-600">{detail}</p>}
    </article>
  );
}

function DataCheckedSummary({ report }: { report: ReportV21 }) {
  const checked = checkedSources(report);

  return (
    <div className="rounded-[20px] border border-[#E4EDD2] bg-[#FBFDF5] p-5">
      <p className="mb-2 text-[12px] font-black uppercase tracking-[0.14em] text-[#8BAA2B]">Data checked</p>
      <p className="text-[14px] font-medium leading-relaxed text-gray-700">
        {checked.length ? checked.join(", ") : "No structured data coverage was available."}
      </p>
    </div>
  );
}

function checkedSources(report: ReportV21): string[] {
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
  ].filter((item): item is string => Boolean(item));
  return checked;
}
