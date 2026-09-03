import { Check, CircleDot } from "lucide-react";

import type { WorkspaceStage } from "@/lib/preflight-v22";

const steps = [
  { label: "Goal & website", detail: "Choose the job and client site" },
  { label: "Business match", detail: "Verify the public identity" },
  { label: "Competitors", detail: "Confirm 1–3 real businesses" },
  { label: "Coverage", detail: "Review what the report can support" },
];

function activeIndex(stage: WorkspaceStage) {
  if (["goal_website", "preflight_running", "preflight_failed"].includes(stage)) return 0;
  if (stage === "business_confirmation") return 1;
  if (["competitor_discovery_running", "competitor_confirmation", "competitor_discovery_failed"].includes(stage)) return 2;
  return 3;
}

export function NewCaseStepper({ stage }: { stage: WorkspaceStage }) {
  const current = activeIndex(stage);
  return (
    <nav aria-label="New Case progress" className="border-b border-white/10 px-5 py-5 lg:border-b-0 lg:px-0 lg:py-0">
      <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white/40 lg:mb-8">Free preflight</p>
      <ol className="grid grid-cols-4 gap-2 lg:block lg:space-y-2">
        {steps.map((step, index) => {
          const complete = index < current;
          const active = index === current;
          return (
            <li
              key={step.label}
              aria-current={active ? "step" : undefined}
              className={`relative rounded-xl px-2 py-2.5 lg:px-4 lg:py-4 ${active ? "bg-white/[0.07]" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${
                  complete ? "border-[#A5D020] bg-[#A5D020] text-[#151914]" : active ? "border-[#A5D020] text-[#A5D020]" : "border-white/20 text-white/35"
                }`}>
                  {complete ? <Check size={14} strokeWidth={3} /> : active ? <CircleDot size={14} /> : index + 1}
                </span>
                <span className={`hidden text-sm font-semibold lg:block ${active ? "text-white" : complete ? "text-white/70" : "text-white/35"}`}>{step.label}</span>
              </div>
              <p className="mt-1 hidden pl-10 text-xs leading-5 text-white/38 lg:block">{step.detail}</p>
              <span className={`mt-2 block h-0.5 rounded-full lg:hidden ${complete || active ? "bg-[#A5D020]" : "bg-white/10"}`} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
