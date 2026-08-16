import { CheckCircle2, Clock3, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import {
  buildAuditWorkPhases,
  formatWorkLayer,
  IMPROVEMENT_SEQUENCE,
  type ActiveWorkPhase,
  type ReportV21,
} from "@/lib/report-v21";
import { isAnalystView, type V21ViewMode } from "./viewMode";

export function V21OptimizationPath({
  reportV21,
  viewMode = "analyst",
}: {
  reportV21: ReportV21;
  viewMode?: V21ViewMode;
}) {
  const analyst = isAnalystView(viewMode);
  const allWorkPhases = buildAuditWorkPhases(reportV21);

  return (
    <div className="space-y-5">
      <section className="rounded-[22px] border border-gray-100 bg-white p-5 shadow-sm md:p-6">
        {analyst ? (
          <>
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

            <div className="mt-6 border-t border-gray-100 pt-5">
              <p className="text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">
                Audit work plan
              </p>
              <p className="mt-1 text-[13px] font-medium leading-relaxed text-gray-500">
                All confirmed items grouped by phase and ordered from the lowest affected trust layer.
              </p>

              {allWorkPhases.length ? (
                <WorkPhaseRows phases={allWorkPhases} />
              ) : (
                <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-[13px] font-semibold text-emerald-800">
                  No remediation work was confirmed in this audit.
                </div>
              )}
            </div>
          </>
        ) : (
          <ClientRoadmapSummary phases={allWorkPhases} />
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
                allWorkPhases.length
                  ? allWorkPhases.map((phase) => `Phase ${phase.number}: ${phase.completionGate}`)
                  : ["No active phase requires a completion gate."]
              }
            />
            <GuidancePanel
              icon={<Clock3 className="h-4 w-4" />}
              title="Observation window"
              items={
                allWorkPhases.length
                  ? allWorkPhases.map((phase) => `Phase ${phase.number}: ${phase.observationWindow}`)
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

function ClientRoadmapSummary({ phases }: { phases: ActiveWorkPhase[] }) {
  return (
    <div>
      <p className="text-[12px] font-black uppercase tracking-[0.14em] text-[#7A8A15]">
        Recommended implementation plan
      </p>
      <p className="mt-1 max-w-3xl text-[13px] font-medium leading-relaxed text-gray-500">
        These are the work phases confirmed by this audit, ordered from the earliest trust dependency. Detailed implementation tasks remain in the Full Trust Audit.
      </p>

      {phases.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {phases.map((phase) => (
            <article
              key={phase.number}
              className="rounded-2xl border border-[#E4EDD2] bg-[#FBFDF6] p-5"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#A5D020] text-[13px] font-black text-[#1A212B]">
                  {phase.number}
                </span>
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#7A8A15]">
                  Phase {phase.number} · {phase.layerRange}
                </p>
              </div>
              <h3 className="mt-4 text-[18px] font-black tracking-tight text-[#1A212B]">
                {phase.title}
              </h3>
              <p className="mt-2 text-[13px] font-medium leading-relaxed text-gray-600">
                {phase.detail}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-[13px] font-semibold text-emerald-800">
          No active implementation phase was confirmed in this audit.
        </div>
      )}
    </div>
  );
}

function WorkPhaseRows({
  phases,
}: {
  phases: ActiveWorkPhase[];
}) {
  return (
    <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-[#FCFCFB] px-4">
      {phases.map((phase) => (
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
