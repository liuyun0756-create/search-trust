import { Check } from "lucide-react";

import type { WorkspaceStage } from "@/lib/preflight-v22";

const steps = [
  { label: "Scope", detail: "Choose the work and website" },
  { label: "Business", detail: "Confirm the public identity" },
  { label: "Competitors", detail: "Confirm at least 1 real rival" },
  { label: "Evidence & report", mobileLabel: "Report", detail: "Review boundaries and build" },
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
    <nav aria-label="New Case progress" className="border-b border-[#e3eae2] px-5 py-5 lg:border-b-0 lg:px-0 lg:py-0">
      <div className="mb-4 flex items-center justify-between lg:mb-9 lg:block">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#668a50]">One client / four decisions</p>
        <p className="text-[10px] font-semibold text-[#8b998d] lg:mt-2">Step {current + 1} of {steps.length}</p>
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
              <div className={`flex items-center gap-3 rounded-lg transition-colors lg:min-h-[66px] lg:px-3 ${active ? "lg:bg-[#eaf3e8]" : ""}`}>
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold ${
                  complete ? "bg-[#dcefd4] text-[#356b3c]" : active ? "bg-[#26432e] text-white" : "bg-[#f2f7f1] text-[#9aa79a]"
                }`}>
                  {complete ? <Check size={13} strokeWidth={3} /> : String(index + 1).padStart(2, "0")}
                </span>
                <span className="hidden min-w-0 lg:block">
                  <span className={`block text-sm font-semibold ${active ? "text-[#26432e]" : complete ? "text-[#4f6654]" : "text-[#8b998d]"}`}>{step.label}</span>
                  <span className={`mt-0.5 block text-[11px] leading-4 ${active ? "text-[#617b65]" : "text-[#a0aca0]"}`}>{step.detail}</span>
                </span>
              </div>
              <span className={`mt-2 block h-0.5 rounded-full lg:hidden ${complete || active ? "bg-[#67a16e]" : "bg-[#e3eae2]"}`} />
              <span className={`mt-1 block truncate text-[9px] font-semibold lg:hidden ${active ? "text-[#26432e]" : complete ? "text-[#617b65]" : "text-[#9aa79a]"}`}>{"mobileLabel" in step ? step.mobileLabel : step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
