import type { OptimizationPath } from "@/lib/report-v21";
import { V21ActionItems } from "./V21ActionItems";
import { safeList } from "./statusHelpers";
import { isAnalystView, type V21ViewMode } from "./viewMode";

export function V21OptimizationPath({
  optimizationPath,
  viewMode = "analyst",
}: {
  optimizationPath: OptimizationPath;
  viewMode?: V21ViewMode;
}) {
  const showTechnical = isAnalystView(viewMode);

  return (
    <div className="space-y-5">
      <V21ActionItems actions={optimizationPath.must_execute_now} title="Must execute now" viewMode={viewMode} />
      {showTechnical && <V21ActionItems actions={optimizationPath.defer_until_later} title="Defer until later" viewMode={viewMode} />}
      {showTechnical && <V21ActionItems actions={optimizationPath.do_not_prioritize_yet} title="Do not prioritize yet" viewMode={viewMode} />}

      <div className="rounded-[24px] border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-[20px] font-black tracking-tight text-[#1A212B]">Roadmap</h3>
        {safeList(optimizationPath.roadmap).length ? (
          <div className="space-y-4">
            {safeList(optimizationPath.roadmap).map((phase, index) => (
              <article key={phase.id || index} className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#A5D020] text-[13px] font-black text-[#1A212B]">
                    {phase.sequence || index + 1}
                  </span>
                  <h4 className="text-[16px] font-black text-[#1A212B]">{phase.phase_title}</h4>
                </div>
                <p className="mb-2 text-[14px] font-medium leading-relaxed text-gray-600">{phase.goal}</p>
                {phase.entry_condition && (
                  <p className="mb-3 text-[13px] font-medium leading-relaxed text-gray-500">
                    <span className="font-bold text-[#1A212B]">Entry condition: </span>
                    {phase.entry_condition}
                  </p>
                )}
                <V21ActionItems actions={phase.action_items} title="Roadmap actions" viewMode={viewMode} maxItems={showTechnical ? undefined : 2} />
                <List title="Expected outcomes" values={phase.expected_outcomes} />
              </article>
            ))}
          </div>
        ) : (
          <p className="text-[13px] font-medium text-gray-400">No structured roadmap available.</p>
        )}
      </div>

      {optimizationPath.fix_order_warning && (
        <div className="rounded-[20px] border border-amber-100 bg-amber-50 p-5">
          <p className="mb-2 text-[12px] font-black uppercase tracking-[0.14em] text-amber-700">Fix order warning</p>
          <p className="text-[14px] font-medium leading-relaxed text-amber-900">{optimizationPath.fix_order_warning}</p>
        </div>
      )}

      <List title="Completion signals" values={optimizationPath.completion_signals} />
    </div>
  );
}

function List({ title, values }: { title: string; values?: string[] | null }) {
  const items = safeList(values).filter(Boolean);
  if (!items.length) return null;

  return (
    <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
      <p className="mb-2 text-[12px] font-black uppercase tracking-[0.12em] text-gray-400">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2 text-[13px] font-medium leading-relaxed text-gray-600">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A5D020]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
