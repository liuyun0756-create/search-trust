"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdvisorReportV22ViewModel } from "@/lib/report-v22/view-model";
import type { EvidenceItem, MetricValue } from "@/lib/report-v22/generated/types";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Database,
  ExternalLink,
  FileSearch,
  Layers3,
  Link2,
  ShieldCheck,
  X,
} from "lucide-react";

import { CompetitorGrid, LimitationsList, RoadmapTimeline, SectionHeading, formatReportDate } from "./report-v22-shared";

const STATUS_STYLE = {
  good: "border-[#cfe3a1] bg-[#f4f9e9] text-[#50661d]",
  medium: "border-[#ead79e] bg-[#fff9e8] text-[#84631a]",
  weak: "border-[#efc8b7] bg-[#fff3ed] text-[#9b4b29]",
  not_checked: "border-[#dfe3de] bg-[#f5f6f4] text-[#717a70]",
} as const;

const HEALTH_STYLE: Record<string, string> = {
  healthy: "bg-[#eaf5cf] text-[#58711d]",
  verified: "bg-[#eaf5cf] text-[#58711d]",
  matched: "bg-[#eaf5cf] text-[#58711d]",
  available: "bg-[#eaf5cf] text-[#58711d]",
  not_connected: "bg-[#eceeeb] text-[#687167]",
  not_checked: "bg-[#eceeeb] text-[#687167]",
  unavailable: "bg-[#fff0e8] text-[#a14d28]",
  unhealthy: "bg-[#fff0e8] text-[#a14d28]",
  mismatch: "bg-[#fff0e8] text-[#a14d28]",
  error: "bg-[#fff0e8] text-[#a14d28]",
  expired: "bg-[#fff8e5] text-[#8a6819]",
  needs_confirmation: "bg-[#fff8e5] text-[#8a6819]",
};

function prettyValue(value: unknown) {
  if (value === null || value === undefined) return "Not available";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function EvidenceButton({ ids, onOpen }: { ids: string[]; onOpen: (ids: string[]) => void }) {
  if (!ids.length) return null;
  return (
    <button
      type="button"
      onClick={() => onOpen(ids)}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#cfdbc0] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#5d704a] transition-colors hover:border-[#a5c654] hover:bg-[#f7faef]"
    >
      <FileSearch className="h-3.5 w-3.5" aria-hidden="true" />
      {ids.length} {ids.length === 1 ? "source" : "sources"}
    </button>
  );
}

function EvidenceDrawer({
  evidence,
  index,
  total,
  onClose,
  onNext,
  onPrevious,
}: {
  evidence: EvidenceItem | null;
  index: number;
  total: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  useEffect(() => {
    if (!evidence) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
    };
  }, [evidence, onClose]);

  if (!evidence) return null;
  const locatorEntries = Object.entries(evidence.source_locator).filter(([, value]) => value !== null && value !== undefined);

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Evidence details">
      <button type="button" className="absolute inset-0 cursor-default bg-[#111914]/65 backdrop-blur-sm" onClick={onClose} aria-label="Close evidence details" />
      <aside className="absolute bottom-0 right-0 top-0 w-full max-w-[560px] overflow-y-auto bg-[#f6f2e8] shadow-[-24px_0_70px_rgba(8,18,10,0.28)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#dcd9ce] bg-[#f6f2e8]/95 px-6 py-5 backdrop-blur sm:px-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7b971f]">Evidence record</p>
            <p className="mt-1 font-mono text-xs text-[#6c746b]">{evidence.evidence_id}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-[#d5d9d1] bg-white text-[#394338] hover:bg-[#edf1e8]" aria-label="Close evidence drawer" autoFocus>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-7 p-6 sm:p-8">
          {total > 1 ? (
            <div className="flex items-center justify-between rounded-2xl border border-[#dcded7] bg-white p-2">
              <button type="button" onClick={onPrevious} disabled={index === 0} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black text-[#4f5c4e] hover:bg-[#f1f4ed] disabled:cursor-not-allowed disabled:opacity-30"><ChevronLeft className="h-4 w-4" /> Previous</button>
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#879085]">Source {index + 1} of {total}</span>
              <button type="button" onClick={onNext} disabled={index === total - 1} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-black text-[#4f5c4e] hover:bg-[#f1f4ed] disabled:cursor-not-allowed disabled:opacity-30">Next <ChevronRight className="h-4 w-4" /></button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#1e2921] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-white">{evidence.source_type}</span>
            <span className={`rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] ${HEALTH_STYLE[evidence.health_status] ?? HEALTH_STYLE.not_checked}`}>{evidence.health_status.replaceAll("_", " ")}</span>
            <span className="rounded-full border border-[#d6dbd1] bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-[#657064]">{evidence.confidence} confidence</span>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.17em] text-[#8a9288]">Normalized value</p>
            <pre className="whitespace-pre-wrap break-words rounded-2xl bg-[#1e2921] p-5 font-mono text-[13px] leading-6 text-[#eff4e9]">{prettyValue(evidence.normalized_value)}</pre>
          </div>

          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.17em] text-[#8a9288]">Original value</p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-[#dcded7] bg-white p-5 font-mono text-[12px] leading-6 text-[#4a5549]">{prettyValue(evidence.original_value)}</pre>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#dcded7] bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a9288]">Collected</p>
              <p className="mt-2 text-sm font-bold text-[#354035]">{formatReportDate(evidence.collected_at)}</p>
            </div>
            <div className="rounded-2xl border border-[#dcded7] bg-white p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8a9288]">Snapshot</p>
              <p className="mt-2 break-all font-mono text-xs text-[#566054]">{evidence.snapshot_id}</p>
            </div>
          </div>

          {locatorEntries.length ? (
            <div>
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.17em] text-[#8a9288]">Source locator</p>
              <dl className="divide-y divide-[#e2e4dd] overflow-hidden rounded-2xl border border-[#dcded7] bg-white">
                {locatorEntries.map(([key, value]) => (
                  <div key={key} className="grid grid-cols-[120px_1fr] gap-4 px-4 py-3 text-sm">
                    <dt className="font-bold text-[#818980]">{key.replaceAll("_", " ")}</dt>
                    <dd className="break-all text-[#354035]">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          {evidence.limitations?.length ? (
            <div className="rounded-2xl border border-[#eadfc7] bg-[#fffaf0] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#a36b18]">Evidence limitations</p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#5c5140]">
                {evidence.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

export function AdvisorReportView({ report }: { report: AdvisorReportV22ViewModel }) {
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [selectedEvidenceIndex, setSelectedEvidenceIndex] = useState(0);
  const evidenceById = useMemo(() => new Map(report.evidence.map((item) => [item.evidence_id, item])), [report.evidence]);
  const selectedEvidenceItems = selectedEvidenceIds.flatMap((id) => {
    const item = evidenceById.get(id);
    return item ? [item] : [];
  });
  const selectedEvidence = selectedEvidenceItems[selectedEvidenceIndex] ?? null;
  const openEvidence = (ids: string[]) => {
    setSelectedEvidenceIds([...new Set(ids)]);
    setSelectedEvidenceIndex(0);
  };

  return (
    <>
      <div className="space-y-16 pb-16 sm:space-y-24">
        <section id="decision" className="scroll-mt-28">
          <div className="grid overflow-hidden rounded-[30px] bg-[#202a22] text-white lg:grid-cols-[1.25fr_0.75fr]">
            <div className="p-7 sm:p-10">
              <div className="flex items-center gap-2 text-[#b8dd3c]"><ShieldCheck className="h-5 w-5" /><span className="text-[11px] font-black uppercase tracking-[0.22em]">Executive decision</span></div>
              <h2 className="mt-5 max-w-3xl text-balance text-[34px] font-black leading-[1.04] tracking-[-0.05em] sm:text-[48px]">{report.executiveDecision.decision_summary}</h2>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/65">{report.executiveDecision.core_problem}</p>
              <div className="mt-8"><EvidenceButton ids={[...new Set(report.findings.filter((finding) => report.executiveDecision.finding_ids.includes(finding.finding_id)).flatMap((finding) => finding.evidence_ids))]} onOpen={openEvidence} /></div>
            </div>
            <div className="flex flex-col justify-between border-t border-white/10 bg-white/[0.04] p-7 lg:border-l lg:border-t-0 lg:p-9">
              <CircleDot className="h-8 w-8 text-[#b8dd3c]" aria-hidden="true" />
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Why now</p>
                <p className="mt-3 text-lg font-bold leading-8 text-white/90">{report.executiveDecision.why_now}</p>
              </div>
            </div>
          </div>
        </section>

        <section id="market" className="scroll-mt-28">
          <SectionHeading eyebrow="Observed market" title="Evidence from the competitive set." description={report.competitorAnalysis.comparisonSummary} />
          <CompetitorGrid competitors={report.competitorAnalysis.competitors} />
          {report.competitorAnalysis.limitations.map((limitation) => <p key={limitation} className="mt-3 flex gap-2 text-xs leading-5 text-[#7a8478]"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{limitation}</p>)}
          <div className="mt-5 rounded-2xl border border-[#e2e6dd] bg-[#f8faf5] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#83907d]">Search snapshot · {formatReportDate(report.marketSnapshot.observed_at)}</p>
                <p className="mt-2 text-sm leading-6 text-[#566154]">{report.marketSnapshot.summary}</p>
              </div>
              <div className="flex flex-wrap gap-2">{report.marketSnapshot.queries.map((query) => <span key={query} className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#566154] shadow-sm">{query}</span>)}</div>
            </div>
          </div>
        </section>

        <section id="findings" className="scroll-mt-28">
          <SectionHeading eyebrow="Diagnostic findings" title="What the rules found—and the evidence behind it." />
          <div className="space-y-3">
            {report.findings.map((finding, index) => (
              <article key={finding.finding_id} className="grid gap-5 rounded-[24px] border border-[#dfe5d9] bg-white p-5 sm:grid-cols-[58px_1fr_auto] sm:p-6">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eff4e6] text-sm font-black text-[#6f891d]">F{index + 1}</span>
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-[#1f2922] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white">{finding.classification}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ${finding.severity === "critical" || finding.severity === "high" ? "bg-[#fff0e8] text-[#a14d28]" : "bg-[#fff8e5] text-[#8a6819]"}`}>{finding.severity}</span>
                    <span className="rounded-full bg-[#f0f2ee] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-[#687167]">{finding.confidence} confidence</span>
                  </div>
                  <p className="mt-3 text-base font-bold leading-7 text-[#263027]">{finding.statement}</p>
                  <p className="mt-3 font-mono text-[11px] text-[#879085]">{finding.rule_id} · {finding.rule_version} · {finding.scope}</p>
                </div>
                <div className="sm:pt-1"><EvidenceButton ids={finding.evidence_ids} onOpen={openEvidence} /></div>
              </article>
            ))}
          </div>
        </section>

        <section id="actions" className="scroll-mt-28">
          <SectionHeading eyebrow="Implementation brief" title="Three actions with executable detail." description="Open an action for targets, owner, implementation steps, and validation criteria." />
          <div className="space-y-4">
            {report.actions.map((action) => (
              <details key={action.actionId} className="group overflow-hidden rounded-[26px] border border-[#dfe5d9] bg-white open:border-[#b9ce79]">
                <summary className="flex cursor-pointer list-none items-start gap-5 p-5 marker:hidden sm:p-7">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1f2922] text-lg font-black text-[#b8dd3c]">0{action.sequence}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-black leading-7 tracking-[-0.025em] text-[#1c251f]">{action.clientFacingExplanation}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-[#f0f4e7] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#61734b]">{action.effort} effort</span>
                      <span className="rounded-full bg-[#f3f4f1] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#6e776d]">Owner: {action.ownerSuggestion}</span>
                      <span className="rounded-full bg-[#f3f4f1] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#6e776d]">Review {formatReportDate(action.reviewDate)}</span>
                    </div>
                  </div>
                  <ChevronDown className="mt-2 h-5 w-5 shrink-0 text-[#7b8579] transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-[#e5e9e0] bg-[#fafbf8] p-5 sm:p-7">
                  <div className="grid gap-7 lg:grid-cols-2">
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#81907a]">Implementation steps</h4>
                      <ol className="mt-4 space-y-3">
                        {action.implementationSteps.map((step) => (
                          <li key={step.sequence} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#a5d020] text-[10px] font-black">{step.sequence}</span>
                            <div><p className="text-sm font-black text-[#344033]">{step.title}</p><p className="mt-1 text-sm leading-6 text-[#687367]">{step.instruction}</p></div>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <div className="space-y-5">
                      <div><h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#81907a]">Exact targets</h4><ul className="mt-3 space-y-2">{action.exactTargets.map((target) => <li key={target} className="flex gap-2 break-all text-sm leading-6 text-[#4e5a4d]"><Link2 className="mt-1 h-4 w-4 shrink-0 text-[#8eb51b]" />{target}</li>)}</ul></div>
                      <div><h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#81907a]">Definition of done</h4><ul className="mt-3 space-y-2">{action.definitionOfDone.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-[#4e5a4d]"><Check className="mt-1 h-4 w-4 shrink-0 text-[#8eb51b]" />{item}</li>)}</ul></div>
                      <div><h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#81907a]">Validation</h4><ul className="mt-3 space-y-2">{action.validationMetrics.map((metric) => <li key={metric.metric_key} className="rounded-xl border border-[#e1e6dc] bg-white p-3 text-sm"><strong className="text-[#334031]">{metric.success_condition}</strong><span className="mt-1 block text-xs text-[#7a8478]">Baseline: {metric.baseline} · {metric.source_type}</span></li>)}</ul></div>
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#81907a]">Specification</h4>
                        <div className="mt-3 space-y-3">
                          {([
                            ["Content", action.specification.content_requirements ?? []],
                            ["GBP", action.specification.gbp_requirements ?? []],
                            ["Technical", action.specification.technical_requirements ?? []],
                          ] as const).filter(([, items]) => items.length).map(([label, items]) => (
                            <div key={label} className="rounded-xl border border-[#e1e6dc] bg-white p-3">
                              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#7a8676]">{label}</p>
                              <ul className="mt-2 space-y-1.5">{items.map((item) => <li key={item} className="text-sm leading-6 text-[#4e5a4d]">• {item}</li>)}</ul>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 border-t border-[#e2e7dd] pt-4">
                        {action.dataSources.map((source) => <span key={source} className="rounded-full bg-[#edf2e6] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#61734b]">{source}</span>)}
                        {action.dependencies.length ? <span className="rounded-full bg-[#fff5e5] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[#8a6819]">Depends on {action.dependencies.length} action{action.dependencies.length === 1 ? "" : "s"}</span> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section id="roadmap" className="scroll-mt-28"><SectionHeading eyebrow="Delivery sequence" title="30 / 60 / 90-day roadmap." /><RoadmapTimeline phases={report.roadmap} /></section>

        <section id="layers" className="scroll-mt-28">
          <SectionHeading eyebrow="SearchTrust diagnostic" title="The eight layers of local trust." description="A layer marked not checked is an explicit coverage boundary—not a passing score." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {report.layers.map((layer, index) => (
              <article key={layer.layer_key} className={`flex min-h-[210px] flex-col justify-between rounded-[22px] border p-5 ${STATUS_STYLE[layer.status]}`}>
                <div className="flex items-start justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-[0.18em] opacity-65">Layer {index + 1}</span><Layers3 className="h-4 w-4 opacity-55" /></div>
                <div><h3 className="text-lg font-black tracking-[-0.03em]">{layer.label}</h3><p className="mt-2 text-sm leading-6 opacity-80">{layer.summary}</p></div>
                <div className="mt-4 flex items-center justify-between gap-3"><span className="text-[10px] font-black uppercase tracking-[0.14em]">{layer.status.replaceAll("_", " ")}</span><EvidenceButton ids={layer.evidence_ids ?? []} onOpen={openEvidence} /></div>
              </article>
            ))}
          </div>
        </section>

        <section id="coverage" className="scroll-mt-28">
          <SectionHeading eyebrow="Coverage and source health" title="Exactly what this report could see." />
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="rounded-[26px] bg-[#202a22] p-7 text-white">
              <Database className="h-8 w-8 text-[#b8dd3c]" />
              <p className="mt-10 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Site inventory</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[{ label: "Discovered", value: report.siteInventory.discovered_url_count }, { label: "Checked", value: report.siteInventory.structurally_checked_count }, { label: "Deep", value: report.siteInventory.deep_analyzed_count }].map((item) => <div key={item.label} className="rounded-xl bg-white/[0.06] p-3"><p className="text-2xl font-black tracking-[-0.05em] text-[#b8dd3c]">{item.value}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/45">{item.label}</p></div>)}
              </div>
              <p className="mt-6 text-sm leading-6 text-white/60">{report.dataCoverage.fullEvidenceCoverage ? "All required first-party sources were healthy and identity matched." : "Coverage is intentionally partial; limitations below define the boundary."}</p>
            </div>
            <div className="space-y-3">
              {report.dataCoverage.sources.map((source) => (
                <div key={source.source_type} className="grid gap-4 rounded-2xl border border-[#dfe5d9] bg-white p-4 sm:grid-cols-[110px_1fr_auto] sm:items-center">
                  <div className="flex items-center gap-3"><Activity className="h-4 w-4 text-[#8eb51b]" /><span className="text-xs font-black uppercase tracking-[0.14em] text-[#354035]">{source.source_type}</span></div>
                  <p className="text-sm leading-6 text-[#667165]">{source.coverage_summary}</p>
                  <div className="flex flex-wrap gap-1.5"><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${HEALTH_STYLE[source.health_status] ?? HEALTH_STYLE.not_checked}`}>{source.health_status.replaceAll("_", " ")}</span><span className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${HEALTH_STYLE[source.identity_match_status] ?? HEALTH_STYLE.not_checked}`}>{source.identity_match_status.replaceAll("_", " ")}</span></div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {Object.entries(report.firstPartyPerformance).map(([name, source]) => (
              <div key={name} className="rounded-2xl border border-[#dfe5d9] bg-[#fafbf8] p-5">
                <div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-[0.16em] text-[#354035]">{name}</span><BarChart3 className="h-4 w-4 text-[#8eb51b]" /></div>
                <p className="mt-4 text-sm font-bold text-[#536052]">{source.connection_state.replaceAll("_", " ")}</p>
                <p className="mt-1 text-xs text-[#7a8478]">Identity: {source.identity_match_status.replaceAll("_", " ")}</p>
                {source.metrics?.length ? <ul className="mt-4 border-t border-[#e4e8df] pt-3">{source.metrics.map((metric: MetricValue) => <li key={metric.metric_key} className="flex items-baseline justify-between py-1.5 text-xs"><span className="text-[#6d776b]">{metric.label}</span><strong className="text-[#2d392c]">{metric.value} {metric.unit}</strong></li>)}</ul> : null}
              </div>
            ))}
          </div>
          {report.dataCoverage.limitations.map((limitation) => <p key={limitation} className="mt-3 flex gap-2 text-xs leading-5 text-[#7a8478]"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{limitation}</p>)}
        </section>

        <section id="limitations" className="scroll-mt-28"><SectionHeading eyebrow="Interpretation limits" title="Known boundaries, stated plainly." /><LimitationsList limitations={report.limitations} /></section>

        {report.versionDiff.kind === "upgrade" ? (
          <section id="changes" className="scroll-mt-28">
            <SectionHeading eyebrow="Version intelligence" title="What changed since the previous report." />
            <div className="space-y-3">{report.versionDiff.entries?.map((entry, index) => <article key={`${entry.change_type}-${index}`} className="rounded-2xl border border-[#dfe5d9] bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-[#eaf5cf] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#58711d]">{entry.change_type}</span><EvidenceButton ids={entry.evidence_ids} onOpen={openEvidence} /></div><p className="mt-4 text-sm leading-6 text-[#4f5b4e]">{entry.reason}</p>{entry.previous_finding ? <p className="mt-3 border-l-2 border-[#cad9a5] pl-3 text-xs italic leading-5 text-[#7c867a]">Previously: {entry.previous_finding.statement}</p> : null}</article>)}</div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-[#e1e5dd] bg-[#f8faf5] p-5 text-xs text-[#7a8478]">
          <div className="flex flex-wrap items-center justify-between gap-3"><span>Schema {report.reportMetadata.schemaVersion} · Rules {report.reportMetadata.rulesetVersion} · Copy {report.reportMetadata.copyModelVersion}</span><a href={report.header.siteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-[#5f7346] hover:text-[#253021]">Open audited site <ExternalLink className="h-3.5 w-3.5" /></a></div>
        </section>
      </div>
      <EvidenceDrawer
        evidence={selectedEvidence}
        index={selectedEvidenceIndex}
        total={selectedEvidenceItems.length}
        onClose={() => {
          setSelectedEvidenceIds([]);
          setSelectedEvidenceIndex(0);
        }}
        onNext={() => setSelectedEvidenceIndex((index) => Math.min(index + 1, selectedEvidenceItems.length - 1))}
        onPrevious={() => setSelectedEvidenceIndex((index) => Math.max(index - 1, 0))}
      />
    </>
  );
}
