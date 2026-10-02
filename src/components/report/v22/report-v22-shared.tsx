import type {
  PublicLimitationViewModel,
  ReportV22CompetitorViewModel,
  ReportV22RoadmapPhaseViewModel,
} from "@/lib/report-v22/view-model";
import { AlertTriangle, ArrowUpRight, Check, Flag, MapPin } from "lucide-react";

export function formatReportDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 max-w-3xl">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#668a50]">{eyebrow}</p>
      <h2 className="text-balance text-[27px] font-black leading-[1.08] tracking-[-0.045em] text-[#1d2a22] sm:text-[33px]">
        {title}
      </h2>
      {description ? <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6c7b70]">{description}</p> : null}
    </div>
  );
}

export function CompetitorGrid({ competitors }: { competitors: ReportV22CompetitorViewModel[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {competitors.map((competitor, index) => (
        <article
          key={competitor.websiteUrl}
          className="group relative overflow-hidden rounded-2xl border border-[#e3eae2] bg-white p-5 transition-colors hover:border-[#b9d3ad]"
        >
          <div className="mb-8 flex items-start justify-between gap-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e6f2e1] text-xs font-black text-[#65974e]">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="rounded-full border border-[#dce5cf] bg-white px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#627053]">
              Best rank #{competitor.bestPosition}
            </span>
          </div>
          <h3 className="text-xl font-black tracking-[-0.03em] text-[#1b231d]">{competitor.businessName}</h3>
          <p className="mt-2 text-sm leading-6 text-[#6c756b]">
            Seen for {competitor.queryAppearanceCount} tracked {competitor.queryAppearanceCount === 1 ? "query" : "queries"} · {competitor.analyzedPageCount} pages reviewed
          </p>
          {competitor.strengths.length ? (
            <ul className="mt-5 space-y-2">
              {competitor.strengths.map((strength) => (
                <li key={strength} className="flex gap-2 text-sm font-semibold leading-5 text-[#394438]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#8eb51b]" aria-hidden="true" />
                  {strength}
                </li>
              ))}
            </ul>
          ) : null}
          <a
            href={competitor.websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#59694a] hover:text-[#1a231b]"
          >
            Visit site <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </article>
      ))}
    </div>
  );
}

export function RoadmapTimeline({ phases }: { phases: ReportV22RoadmapPhaseViewModel[] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {phases.map((phase, index) => (
        <article key={phase.period} className="rounded-2xl border border-[#e3eae2] bg-white p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e6f2e1] text-xs font-black text-[#65974e]">
            {index + 1}
          </div>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-[#6f9659]">{phase.label}</p>
          <h3 className="mt-2 text-xl font-black tracking-[-0.03em] text-[#1c251f]">{phase.objective}</h3>
          <div className="mt-6 border-t border-[#e9ece4] pt-5">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-[#8a9388]">Exit criteria</p>
            <ul className="space-y-2">
              {phase.exitCriteria.map((criterion) => (
                <li key={criterion} className="flex gap-2 text-sm leading-6 text-[#4a5549]">
                  <Flag className="mt-1 h-4 w-4 shrink-0 text-[#8eb51b]" aria-hidden="true" />
                  {criterion}
                </li>
              ))}
            </ul>
          </div>
        </article>
      ))}
    </div>
  );
}

export function LimitationsList({ limitations }: { limitations: PublicLimitationViewModel[] }) {
  if (!limitations.length) {
    return <p className="rounded-2xl bg-[#f4f7ef] p-5 text-sm text-[#5f6b5e]">No material report-wide limitations were recorded.</p>;
  }

  return (
    <div className="space-y-3">
      {limitations.map((limitation) => (
        <div key={`${limitation.category}-${limitation.description}`} className="flex gap-4 rounded-2xl border border-[#eadfc7] bg-[#fffaf0] p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#b77718]" aria-hidden="true" />
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#a36b18]">
              {limitation.severity} · {limitation.category}
            </p>
            <p className="mt-1.5 text-sm leading-6 text-[#5c5140]">{limitation.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportContextPills({ service, location }: { service: string; location: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f5ed] px-3 py-1.5 text-xs font-bold text-[#59705e]">
        <MapPin className="h-3.5 w-3.5 text-[#79a75e]" aria-hidden="true" /> {location}
      </span>
      <span className="rounded-full bg-[#f0f5ed] px-3 py-1.5 text-xs font-bold text-[#59705e]">
        {service}
      </span>
    </div>
  );
}
