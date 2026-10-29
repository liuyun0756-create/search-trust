"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Eye,
  FileCheck2,
  Globe2,
  LockKeyhole,
  Radar,
  SearchCheck,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import {
  mapCoverage,
  resolveCoverageAfterConfirmation,
  type CoverageStatus,
  type NewCaseDraft,
  type WorkGoal,
} from "@/lib/preflight-v22";

interface CoverageStepProps {
  draft: NewCaseDraft;
  onContinue(): void;
  onBack(): void;
  continueDisabled?:boolean;
}

const evidenceGroups = [
  {
    title: "How this business meets demand",
    detail: "Review the site, service pages and public business presence against the confirmed service and market.",
    keys: ["site_inventory", "site_deep_analysis", "public_gbp", "pagespeed"],
    icon: Globe2,
  },
  {
    title: "Where search demand appears",
    detail: "Use organic and local search evidence to identify the queries, result types and pages worth discussing.",
    keys: ["serp_organic", "serp_maps", "serp_local_pack"],
    icon: SearchCheck,
  },
  {
    title: "How the confirmed competitors differ",
    detail: "Compare the business with real competitors in the same service, location and search context.",
    keys: ["competitor_analysis"],
    icon: Radar,
  },
] as const;

const moduleLabels = {
  site_inventory: "Website pages",
  site_deep_analysis: "Page content",
  serp_maps: "Maps results",
  serp_local_pack: "Local results",
  serp_organic: "Organic results",
  public_gbp: "Public business profile",
  competitor_analysis: "Confirmed competitors",
  pagespeed: "Page experience",
} as const;

const resultItems = [
  ["Specific findings", "What was observed on this business, not a generic audit score."],
  ["Traceable evidence", "The public source and scope behind each material judgment."],
  ["Up to three supported actions", "Specific next steps where evidence supports them. With insufficient evidence, the report records the diagnosis without proposing a change."],
] as const;

function cta(goal: WorkGoal, workflowReserved: boolean) {
  return goal === "win_new_client"
    ? workflowReserved
      ? {
          eyebrow: "Prospect workflow already covered",
          title: "Generate the report from this confirmed scope.",
          button: "Generate Prospect report",
          detail: "Competitor discovery reserved the credit for this workflow. Generating the report uses no additional credit.",
        }
      : {
          eyebrow: "Prospect report",
          title: "Continue to the complete Prospect workflow.",
          button: "Continue",
          detail: "One credit is reserved before paid providers are called.",
        }
    : {
        eyebrow: "Client project",
        title: "Save this scope and prepare first-party connections.",
        button: "Save client project & continue",
        detail: "Google connections remain optional and happen only after you choose to connect them.",
      };
}

function groupStatus(statuses: CoverageStatus[]): "ready" | "limited" | "blocked" {
  if (statuses.some((status) => status === "blocked")) return "blocked";
  if (statuses.some((status) => status !== "available")) return "limited";
  return "ready";
}

const statusPresentation = {
  ready: { label: "Evidence ready", className: "bg-[#e8f1cf] text-[#52700a]", icon: Check },
  limited: { label: "Available with limits", className: "bg-[#fff1c9] text-[#795b00]", icon: ShieldAlert },
  blocked: { label: "Needs attention", className: "bg-[#ffe3dd] text-[#8e3024]", icon: TriangleAlert },
};

export function CoverageStep({ draft, onContinue, onBack,continueDisabled=false }: CoverageStepProps) {
  const preflight = draft.preflight;
  const business = draft.business_confirmation;
  const selected = draft.selected_competitor_ids.length;
  if (!preflight || !business) return null;

  const discoveryCompleted = draft.discovery_status?.status === "succeeded";
  const resolved = resolveCoverageAfterConfirmation(preflight.module_availability, preflight.data_gaps, discoveryCompleted);
  const coverage = mapCoverage(resolved.modules, resolved.gaps, selected);
  const coverageByKey = new Map(coverage.map((item) => [item.module_key, item]));
  const action = cta(draft.goal, Boolean(draft.prospect_workflow_id));
  const competitorLimit = selected < 3;

  return (
    <section className="case-step-enter">
      <div className="mb-8">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#718218]">04 / Decide the evidence boundary</p>
        <h1 className="max-w-[780px] text-3xl font-semibold tracking-[-0.045em] text-[#172017] sm:text-[42px]">Know what the report can say before it is generated.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#657165]">The business and competitive scope are confirmed. Review what the public evidence can support, where the report must remain cautious, and what you will receive.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#e3eae2] bg-white text-[#1d2a22]">
        <div className="grid gap-7 px-6 py-7 sm:px-8 sm:py-9 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#668a50]"><FileCheck2 size={15} />Confirmed Case</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">{business.business_identity.business_name}</h2>
            <p className="mt-2 text-sm text-[#718073]">One business, one service and one local market.</p>
          </div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${competitorLimit ? "bg-[#fff0ba] text-[#6f5500]" : "bg-[#dff1ab] text-[#405c00]"}`}>{selected} {selected === 1 ? "competitor" : "competitors"} confirmed</span>
        </div>
        <dl className="grid bg-[#f2f7f1] sm:grid-cols-3">
          <ScopeFact label="Service" value={business.primary_service} />
          <ScopeFact label="Market" value={business.target_market.display_name} />
          <ScopeFact label="Evidence window" value="Public web & search evidence" />
        </dl>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
        <div>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a887a]">What the analysis can answer</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#1e291f]">Three connected evidence questions</h2>
            </div>
            <span className="hidden text-[11px] text-[#879187] sm:block">Based on the confirmed scope above</span>
          </div>

          <div className="space-y-3">
            {evidenceGroups.map((group, index) => {
              const items = group.keys.map((key) => coverageByKey.get(key)).filter(Boolean);
              const status = groupStatus(items.map((item) => item!.status));
              const meta = statusPresentation[status];
              const Icon = group.icon;
              const StatusIcon = meta.icon;
              return (
                <article key={group.title} className="grid gap-4 rounded-[20px] bg-white px-5 py-5 shadow-[0_10px_32px_rgba(28,39,27,.045)] ring-1 ring-[#e0e6dc] sm:grid-cols-[48px_1fr] sm:px-6">
                  <span className="grid h-11 w-11 place-items-center rounded-[14px] bg-[#eef3e7] text-[#678315]"><Icon size={19} /></span>
                  <div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-mono text-[9px] font-bold tracking-[0.14em] text-[#829082]">0{index + 1}</p>
                        <h3 className="mt-1 text-[15px] font-bold text-[#263126]">{group.title}</h3>
                      </div>
                      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${meta.className}`}><StatusIcon size={12} />{meta.label}</span>
                    </div>
                    <p className="mt-2 max-w-2xl text-xs leading-5 text-[#687468]">{group.detail}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {items.map((item) => <span key={item!.module_key} className="rounded-full bg-[#f3f5f0] px-2.5 py-1 text-[10px] font-semibold text-[#687468]">{moduleLabels[item!.module_key]}</span>)}
                    </div>
                    {group.keys[0] === "competitor_analysis" && competitorLimit && <p className="mt-3 text-[11px] leading-5 text-[#7a640b]">One confirmed competitor supports a focused comparison. Three would provide a broader market view; the report will state the current limit.</p>}
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <aside className="rounded-[22px] bg-[#e7ece3] p-6 sm:p-7">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#697669]"><Eye size={14} />Professional boundaries</p>
          <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em] text-[#1d281e]">What the report will not overclaim</h2>
          <ul className="mt-6 space-y-5">
            <Boundary title="No private performance data yet" detail="The Prospect report can discuss public evidence, but not private traffic, lead quality or revenue." />
            {competitorLimit && <Boundary title="Focused competitive view" detail={`${selected} confirmed competitor supports comparison, but not a complete picture of the market.`} />}
            <Boundary title="Observation is not causation" detail="A visible difference can support investigation; it does not prove why another business ranks or converts." />
            {resolved.gaps.map((gap) => <Boundary key={gap.gap_code} title={gap.message} detail={gap.resolution} alert={gap.blocking} />)}
          </ul>
        </aside>
      </div>

      <div className="mt-8 rounded-[24px] bg-white p-6 shadow-[0_12px_40px_rgba(29,39,28,.045)] ring-1 ring-[#e0e5dd] sm:p-8">
        <div className="grid gap-7 lg:grid-cols-[250px_1fr] lg:items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#718218]">What you receive</p>
            <h2 className="mt-2 text-xl font-semibold tracking-[-0.025em] text-[#1e291f]">A report you can inspect before using with the client.</h2>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {resultItems.map(([title, detail], index) => (
              <div key={title}>
                <span className="font-mono text-[10px] font-bold text-[#8aa516]">0{index + 1}</span>
                <h3 className="mt-2 text-sm font-bold text-[#263126]">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-[#6b776b]">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-5 rounded-[24px] bg-[#f4f9dd] p-6 ring-1 ring-[#cbd99f] sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#68810e]"><Sparkles size={14} />{action.eyebrow}</p>
          <h2 className="mt-2 max-w-xl text-xl font-semibold tracking-[-0.025em] text-[#202a20]">{action.title}</h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-[#69745a]">{action.detail}</p>
        </div>
        <button type="button" onClick={onContinue} disabled={continueDisabled} className="group flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#234b38] px-6 text-sm font-bold text-white outline-none transition hover:bg-[#2c6348] focus-visible:ring-4 focus-visible:ring-[#8ab49a]/45">
          {action.button}<ArrowRight aria-hidden="true" size={16} className="transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3 text-xs text-[#758075] sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className="flex w-fit items-center gap-2 rounded-lg px-1 py-2 font-bold outline-none transition hover:text-[#1f291f] focus-visible:ring-4 focus-visible:ring-[#A5D020]/30"><ArrowLeft size={14} />Edit competitors</button>
        <div className="flex flex-wrap gap-4">
          <span className="flex items-center gap-1.5"><Clock3 size={13} />{preflight.estimated_duration_bucket.replaceAll("_", " ")}</span>
          <span className="flex items-center gap-1.5"><LockKeyhole size={13} />No additional credit</span>
          <span className="flex items-center gap-1.5"><Sparkles size={13} />No OAuth required</span>
        </div>
      </div>
    </section>
  );
}

function ScopeFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-6 py-5 sm:px-8">
      <dt className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#718073]">{label}</dt>
      <dd className="mt-1 truncate text-xs font-semibold text-[#26432e]">{value}</dd>
    </div>
  );
}

function Boundary({ title, detail, alert = false }: { title: string; detail: string; alert?: boolean }) {
  return (
    <li className="flex gap-3">
      <span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full ${alert ? "bg-[#ffe0d8] text-[#91372a]" : "bg-white/70 text-[#6f861d]"}`}>{alert ? <TriangleAlert size={11} /> : <Check size={11} />}</span>
      <div><p className="text-xs font-bold text-[#303b30]">{title}</p><p className="mt-1 text-[11px] leading-5 text-[#687468]">{detail}</p></div>
    </li>
  );
}
