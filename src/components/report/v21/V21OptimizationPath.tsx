import { CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import {
  buildActiveWorkPhases,
  formatWorkLayer,
  IMPROVEMENT_SEQUENCE,
  type OptimizationPath,
} from "@/lib/report-v21";
import { isAnalystView, type V21ViewMode } from "./viewMode";

export function V21OptimizationPath({
  optimizationPath,
  viewMode = "analyst",
}: {
  optimizationPath: OptimizationPath;
  viewMode?: V21ViewMode;
}) {
  const analyst = isAnalystView(viewMode);
  const activePhases = buildActiveWorkPhases(optimizationPath);

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        <div>
          <p className="text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">
            Improvement sequence
          </p>
          <p className="mt-1 text-[13px] font-medium leading-relaxed text-gray-500">
            The fixed SearchTrust order for repairing trust signals. This is a method overview, not a progress control.
          </p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {IMPROVEMENT_SEQUENCE.map((phase) => (
            <article
              key={phase.number}
              className="min-h-[112px] rounded-xl border border-gray-100 bg-gray-50/70 p-3.5"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#A5D020] text-[11px] font-black text-[#1A212B]">
                  {phase.number}
                </span>
                <span className="text-[11px] font-black uppercase tracking-[0.1em] text-gray-500">
                  {phase.layerRange}
                </span>
              </div>
              <h3 className="mt-2.5 text-[14px] font-black leading-snug text-[#1A212B]">
                {phase.title}
              </h3>
              <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-gray-500">
                {phase.detail}
              </p>
            </article>
          ))}
        </div>

        {analyst && (
          <div className="mt-6 border-t border-gray-100 pt-5">
            <p className="text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">
              Current audit work plan
            </p>
            <p className="mt-1 text-[13px] font-medium leading-relaxed text-gray-500">
              Confirmed work from this audit, ordered by the lowest affected trust layer.
            </p>

            {activePhases.length ? (
              <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-[#FCFCFB] px-4">
                {activePhases.map((phase) => (
                  <article key={phase.number} className="grid gap-3 py-4 md:grid-cols-[190px_minmax(0,1fr)]">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[#7A8A15]">
                        Phase {phase.number} · {phase.layerRange}
                      </p>
                      <h3 className="mt-1 text-[14px] font-black text-[#1A212B]">{phase.title}</h3>
                    </div>
                    <div className="space-y-3">
                      {phase.affectedLayers.map((layerKey) => {
                        const actions = phase.actions.filter((action) => action.affected_layer === layerKey);
                        return (
                          <div key={layerKey}>
                            <p className="text-[12px] font-bold text-gray-500">{formatWorkLayer(layerKey)}</p>
                            <ul className="mt-1.5 space-y-1.5">
                              {actions.map((action) => (
                                <li
                                  key={action.id || action.task_title}
                                  className="flex items-start gap-2 text-[13px] font-semibold leading-relaxed text-[#1A212B]"
                                >
                                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A5D020]" />
                                  <span>{action.task_title}</span>
                                  <span className="shrink-0 text-[11px] font-bold uppercase text-gray-400">
                                    {action.priority}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-[13px] font-semibold text-emerald-800">
                No active remediation work was confirmed in this audit.
              </div>
            )}
          </div>
        )}
      </section>

      {analyst && (
        <section className="rounded-[22px] border border-gray-100 bg-white p-5 shadow-sm md:p-6">
          <div>
            <p className="text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">
              Completion, observation &amp; re-audit
            </p>
            <p className="mt-1 text-[13px] font-medium leading-relaxed text-gray-500">
              Use completion gates to close implementation work and observation windows to evaluate impact.
            </p>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <GuidancePanel
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Completion gate"
              items={
                activePhases.length
                  ? activePhases.map((phase) => `Phase ${phase.number}: ${phase.completionGate}`)
                  : ["No active phase requires a completion gate."]
              }
            />
            <GuidancePanel
              icon={<Clock3 className="h-4 w-4" />}
              title="Observation window"
              items={
                activePhases.length
                  ? activePhases.map((phase) => `Phase ${phase.number}: ${phase.observationWindow}`)
                  : ["Continue normal monitoring and reassess after meaningful page changes."]
              }
            />
            <GuidancePanel
              icon={<RefreshCw className="h-4 w-4" />}
              title="Re-audit checkpoint"
              items={[
                "Run a fresh full audit after the relevant observation window.",
                "Compare the new rule vector and layer statuses before closing the work.",
              ]}
            />
          </div>

          <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-[12px] font-semibold leading-relaxed text-blue-900">
            Work on the next phase may begin immediately. The observation window indicates when search impact can be evaluated more reliably.
          </p>
        </section>
      )}
    </div>
  );
}

function GuidancePanel({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <article className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
      <div className="flex items-center gap-2 text-[#7A8A15]">
        {icon}
        <h3 className="text-[12px] font-black uppercase tracking-[0.1em]">{title}</h3>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[12px] font-medium leading-relaxed text-gray-600">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#A5D020]" />
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
