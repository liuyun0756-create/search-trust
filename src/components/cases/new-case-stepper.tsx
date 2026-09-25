import { Check } from "lucide-react";

import type { WorkspaceStage } from "@/lib/preflight-v22";

const steps = [
  { label: "Scope", detail: "Choose the work and website" },
  { label: "Business", detail: "Confirm the public identity" },
  { label: "Competitors", detail: "Confirm at least 1 real rival" },
  { label: "Coverage", detail: "Review what analysis can support" },
];

function activeIndex(stage: WorkspaceStage) {
  if (["goal_website", "preflight_running", "preflight_failed"].includes(stage)) return 0;
  if (stage === "business_confirmation") return 1;
  if (["prospect_start", "competitor_discovery_running", "competitor_confirmation", "competitor_discovery_failed"].includes(stage)) return 2;
  return 3;
}

export function NewCaseStepper({ stage }: { stage: WorkspaceStage }) {
  const current = activeIndex(stage);
  return (
    <nav aria-label="New Case progress" className="border-b border-white/10 px-5 py-5 lg:border-b-0 lg:px-0 lg:py-0">
      <div className="mb-4 flex items-center justify-between lg:mb-9 lg:block">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/42">One client / four decisions</p>
        <p className="text-[10px] font-semibold text-white/35 lg:mt-2">Step {current + 1} of {steps.length}</p>
      </div>
      <ol className="grid grid-cols-4 gap-2 lg:block lg:space-y-0">
        {steps.map((step, index) => {
          const complete = index < current;
          const active = index === current;
          return (
            <li
              key={step.label}
              aria-current={active ? "step" : undefined}
              className="relative px-1 py-1.5 lg:px-0 lg:py-0"
            >
              {index < steps.length - 1 && (
                <span aria-hidden="true" className={`absolute left-[13px] top-8 hidden h-12 w-px lg:block ${index < current ? "bg-[#A5D020]/70" : "bg-white/12"}`} />
              )}
              <div className={`flex items-center gap-3 rounded-xl transition-colors lg:min-h-[66px] lg:px-3 ${active ? "lg:bg-white/[0.065]" : ""}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${
                  complete ? "border-[#A5D020] bg-[#A5D020] text-[#151914]" : active ? "border-[#A5D020] bg-[#A5D020]/10 text-[#C7EE4E] shadow-[0_0_0_5px_rgba(165,208,32,0.08)]" : "border-white/18 text-white/32"
                }`}>
                  {complete ? <Check size={13} strokeWidth={3} /> : String(index + 1).padStart(2, "0")}
                </span>
                <span className="hidden min-w-0 lg:block">
                  <span className={`block text-sm font-semibold ${active ? "text-white" : complete ? "text-white/68" : "text-white/34"}`}>{step.label}</span>
                  <span className={`mt-0.5 block text-[11px] leading-4 ${active ? "text-white/48" : "text-white/28"}`}>{step.detail}</span>
                </span>
              </div>
              <span className={`mt-2 block h-0.5 rounded-full lg:hidden ${complete || active ? "bg-[#A5D020]" : "bg-white/10"}`} />
              <span className={`mt-1 block truncate text-[9px] font-semibold lg:hidden ${active ? "text-white" : complete ? "text-white/55" : "text-white/28"}`}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
