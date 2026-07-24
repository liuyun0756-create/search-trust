import type { OptimizationPath } from "@/lib/report-v21";
import { V21ActionItems } from "./V21ActionItems";
import { isAnalystView, type V21ViewMode } from "./viewMode";

const PHASES = [
  { layers: "L1-L3", title: "Stabilize the business entity", detail: "Establish the basic eligibility, presence, and consistency signals that let the page connect to one real business.", outcome: "A stable foundation for later page improvements." },
  { layers: "L4-L5", title: "Make the service page locally credible", detail: "Add specific local facts and real-world context that cannot be reused unchanged on any other page.", outcome: "Stronger local relevance and evidence." },
  { layers: "L6-L7", title: "Add accountable, unique proof", detail: "Support claims with accountable details and page-specific value.", outcome: "More defensible trust and less template-like content." },
  { layers: "L8", title: "Reassess search-era fit", detail: "Algorithm Fit is an outcome layer. It is reassessed after the earlier trust signals have been improved, rather than treated as a standalone copy task.", outcome: "A clearer view of how the full page is likely to be interpreted." },
];

export function V21OptimizationPath({ optimizationPath, viewMode = "analyst" }: { optimizationPath: OptimizationPath; viewMode?: V21ViewMode }) {
  const analyst = isAnalystView(viewMode);
  return (
    <div className="space-y-5">
      {analyst && <V21ActionItems actions={optimizationPath.must_execute_now} title="Must execute now" viewMode={viewMode} />}
      {analyst && <V21ActionItems actions={optimizationPath.defer_until_later} title="Address after the foundation" viewMode={viewMode} />}
      {analyst && <V21ActionItems actions={optimizationPath.do_not_prioritize_yet} title="Do not prioritize yet" viewMode={viewMode} />}
      <div className="rounded-[22px] border border-gray-100 bg-white p-5 shadow-sm">
        <p className="mb-4 text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">Improvement sequence</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {PHASES.map((phase, index) => <article key={phase.layers} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
            <div className="flex items-center gap-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#A5D020] text-[12px] font-black text-[#1A212B]">{index + 1}</span><p className="text-[12px] font-black uppercase tracking-[0.12em] text-gray-500">{phase.layers}</p></div>
            <h3 className="mt-3 text-[16px] font-black text-[#1A212B]">{phase.title}</h3><p className="mt-2 text-[13px] font-medium leading-relaxed text-gray-600">{phase.detail}</p><p className="mt-3 text-[13px] font-bold leading-relaxed text-[#1A212B]">Expected: {phase.outcome}</p>
          </article>)}
        </div>
      </div>
      {analyst && optimizationPath.fix_order_warning && <div className="rounded-[20px] border border-amber-100 bg-amber-50 p-5"><p className="mb-2 text-[12px] font-black uppercase tracking-[0.14em] text-amber-700">Why order matters</p><p className="text-[14px] font-medium leading-relaxed text-amber-900">{optimizationPath.fix_order_warning}</p></div>}
    </div>
  );
}
