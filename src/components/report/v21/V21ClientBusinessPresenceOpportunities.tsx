import { ArrowRight, Building2, CheckCircle2 } from "lucide-react";
import type { ClientBusinessPresenceOpportunity } from "@/lib/report-v21";

const AREA_LABELS = {
  identity_alignment: "Business identity",
  profile_activity: "Public profile",
  review_operations: "Customer reviews",
} as const;

const PRIORITY_STYLES = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-gray-200 bg-gray-50 text-gray-600",
} as const;

export function V21ClientBusinessPresenceOpportunities({
  opportunities,
}: {
  opportunities: ClientBusinessPresenceOpportunity[];
}) {
  if (!opportunities.length) return null;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[#DCE8C3] bg-[#F8FAF2] px-5 py-5 md:px-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#EAF4CC] text-[#6F8F0C]">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#6F8F0C]">
              Beyond the target page
            </p>
            <h3 className="mt-1 text-[18px] font-black tracking-tight text-[#1A212B]">
              {opportunities.length} additional business presence {opportunities.length === 1 ? "opportunity" : "opportunities"}
            </h3>
            <p className="mt-2 max-w-4xl text-[13px] font-medium leading-relaxed text-gray-600">
              These opportunities come directly from the Business Presence Audit. They are separate from the page-level findings and implementation roadmap above.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {opportunities.map((opportunity, index) => (
          <article
            key={opportunity.id}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]"
          >
            <div className="grid md:grid-cols-[168px_minmax(0,1fr)]">
              <div className="border-b border-gray-100 bg-[#F8FAF5] px-5 py-5 md:border-b-0 md:border-r md:px-6 md:py-6">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-gray-400">
                  Opportunity {String(index + 1).padStart(2, "0")}
                </p>
                <span
                  className={`mt-3 inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${PRIORITY_STYLES[opportunity.priority]}`}
                >
                  {opportunity.priority} priority
                </span>
                <p className="mt-3 text-[12px] font-bold text-gray-500">
                  {AREA_LABELS[opportunity.businessArea]}
                </p>
              </div>

              <div className="px-5 py-5 md:px-7 md:py-6">
                <h4 className="text-[19px] font-black tracking-tight text-[#1A212B]">
                  {opportunity.title}
                </h4>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <OpportunityField
                    label="Current situation"
                    value={opportunity.currentSituation}
                  />
                  <OpportunityField
                    label="Recommended next step"
                    value={opportunity.recommendedAction}
                    action
                  />
                </div>

                {opportunity.expectedBenefit && (
                  <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#E4EDD2] bg-[#FBFDF6] px-4 py-3.5">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#7A9E10]" aria-hidden="true" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6F8F0C]">
                        What this can improve
                      </p>
                      <p className="mt-1 text-[13px] font-medium leading-relaxed text-gray-700">
                        {opportunity.expectedBenefit}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function OpportunityField({
  label,
  value,
  action = false,
}: {
  label: string;
  value: string;
  action?: boolean;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-gray-400">
        {action && <ArrowRight className="h-3.5 w-3.5 text-[#8CAF16]" aria-hidden="true" />}
        {label}
      </p>
      <p className="mt-2 text-[13px] font-medium leading-relaxed text-gray-700">{value}</p>
    </div>
  );
}
