import { AlertOctagon, CheckCircle2, CircleDashed, Clock3, EyeOff, LockKeyhole, ShieldAlert, Sparkles } from "lucide-react";

import { mapCoverage, type NewCaseDraft, type WorkGoal } from "@/lib/preflight-v22";

interface CoverageStepProps {
  draft: NewCaseDraft;
  onContinue(): void;
  onBack(): void;
}

const moduleLabels = {
  site_inventory: "Site inventory",
  site_deep_analysis: "Deep page analysis",
  serp_maps: "Google Maps results",
  serp_local_pack: "Local pack",
  serp_organic: "Organic search",
  public_gbp: "Public GBP evidence",
  competitor_analysis: "Competitor analysis",
  pagespeed: "Page speed",
};

const statusMeta = {
  available: { label: "Available", className: "bg-[#edf7d5] text-[#56720c]", icon: CheckCircle2 },
  limited: { label: "Limited", className: "bg-[#fff5d7] text-[#806000]", icon: ShieldAlert },
  unavailable: { label: "Unavailable", className: "bg-[#f2f3f0] text-[#626c62]", icon: CircleDashed },
  blocked: { label: "Blocked", className: "bg-[#fbe9e7] text-[#a3332b]", icon: AlertOctagon },
  not_connected: { label: "Not connected", className: "bg-[#ecf2f8] text-[#3c6480]", icon: LockKeyhole },
};

function cta(goal: WorkGoal) {
  return goal === "win_new_client"
    ? { eyebrow: "$19 one-time report", title: "Turn this coverage into a client-ready opportunity report.", button: "Sign in & continue", detail: "Payment comes after sign-in. Nothing is charged on this page." }
    : { eyebrow: "Client project", title: "Save this Case and prepare first-party connections.", button: "Save client project & continue", detail: "Google connections remain optional and happen only after you choose to connect them." };
}

export function CoverageStep({ draft, onContinue, onBack }: CoverageStepProps) {
  const preflight = draft.preflight;
  const business = draft.business_confirmation;
  const selected = draft.selected_competitor_ids.length;
  if (!preflight || !business) return null;
  const coverage = mapCoverage(preflight.module_availability, preflight.data_gaps, selected);
  const action = cta(draft.goal);

  return (
    <section>
      <div className="mb-7">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#718218]">Step 4 of 4</p>
        <h1 className="text-3xl font-bold tracking-[-0.035em] text-[#172017] sm:text-[38px]">Your evidence coverage is ready.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#657165]">This is a coverage check—not the diagnosis. It shows exactly what the full workflow can support.</p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Summary label="Business" value={business.business_identity.business_name} />
        <Summary label="Target market" value={business.target_market.display_name} />
        <Summary label="Competitors" value={`${selected} confirmed`} accent={selected < 3 ? "Limited" : "Recommended"} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#dfe4da] bg-white">
        <div className="border-b border-[#e5e9e1] bg-[#fafbf8] px-5 py-4"><h2 className="font-bold text-[#202a20]">Evidence modules</h2><p className="mt-1 text-xs text-[#7b867b]">Every status comes from public preflight data and the confirmed competitor count.</p></div>
        <div className="divide-y divide-[#edf0ea]">
          {coverage.map((item) => {
            const meta = statusMeta[item.status];
            const Icon = meta.icon;
            return (
              <div key={item.module_key} className="grid gap-2 px-5 py-4 sm:grid-cols-[190px_auto_1fr] sm:items-center sm:gap-4">
                <span className="text-sm font-bold text-[#293329]">{moduleLabels[item.module_key]}</span>
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}><Icon size={13} />{meta.label}</span>
                <span className="text-xs leading-5 text-[#6b776b]">{item.module_key === "competitor_analysis" && selected < 3 && selected > 0 ? `${selected} of 3 recommended competitors confirmed.` : item.reason}</span>
              </div>
            );
          })}
        </div>
      </div>

      {preflight.data_gaps.length > 0 && (
        <div className="mt-5 rounded-2xl border border-[#e4ddd0] bg-[#fffdf8] p-5">
          <h2 className="text-sm font-bold text-[#332e25]">Known data gaps</h2>
          <ul className="mt-3 space-y-3">
            {preflight.data_gaps.map((gap) => <li key={gap.gap_code} className="flex gap-3 text-sm leading-6 text-[#675f51]"><span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${gap.blocking ? "bg-[#b6402c]" : "bg-[#d49b24]"}`} /><span><strong className="text-[#3c352b]">{gap.message}</strong> {gap.resolution}</span></li>)}
          </ul>
        </div>
      )}

      <div className="mt-5 grid gap-4 rounded-2xl border border-[#cad8a1] bg-[#f5fadf] p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#69820f]">{action.eyebrow}</p>
          <h2 className="mt-2 max-w-xl text-xl font-bold tracking-[-0.02em] text-[#202a20]">{action.title}</h2>
          <p className="mt-2 text-xs leading-5 text-[#69745a]">{action.detail}</p>
        </div>
        <button type="button" onClick={onContinue} className="min-h-12 rounded-xl bg-[#1a211a] px-6 text-sm font-bold text-white outline-none hover:bg-black focus-visible:ring-4 focus-visible:ring-[#A5D020]/45">{action.button} <span aria-hidden="true">→</span></button>
      </div>

      <div className="mt-5 flex flex-col gap-3 text-xs text-[#758075] sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onBack} className="w-fit font-bold underline decoration-[#b5c1b0] underline-offset-4">Back to competitors</button>
        <div className="flex flex-wrap gap-4"><span className="flex items-center gap-1.5"><Clock3 size={13} />{preflight.estimated_duration_bucket.replaceAll("_", " ")}</span><span className="flex items-center gap-1.5"><EyeOff size={13} />Findings and actions stay locked</span><span className="flex items-center gap-1.5"><Sparkles size={13} />No OAuth yet</span></div>
      </div>
    </section>
  );
}

function Summary({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return <div className="rounded-xl border border-[#dfe4da] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#8b958b]">{label}</p><p className="mt-2 truncate text-sm font-bold text-[#253025]">{value}</p>{accent && <p className="mt-1 text-xs font-semibold text-[#778711]">{accent} coverage</p>}</div>;
}
