"use client";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ExecutionDraftDemo } from "./ExecutionDraftDemo";
import { ExecutionReviewDemo } from "./ExecutionReviewDemo";
import { executionSteps } from "./execution-demo-data";

const areas = [
  ["steps", "01 / Execution steps", "Where to change, what to do, when it is complete."],
  ["draft", "02 / Content draft", "Review, edit and copy business-specific material."],
  ["review", "03 / Review changes", "Compare content and performance for the same page."],
] as const;
type Area = typeof areas[number][0];
const eyebrow = "text-xs font-bold uppercase leading-6 tracking-[0.18em] text-[#526c16]";
const body = "text-base leading-7 text-[#586452]";

export function MethodExecution() {
  const [area, setArea] = useState<Area>("steps");
  const [stepIndex, setStepIndex] = useState(1);
  const [dirty, setDirty] = useState(false);
  const step = executionSteps[stepIndex];
  useEffect(() => {
    const followHash = () => {
      const match = areas.find(([id]) => location.hash === `#execution-${id}`);
      if (match) { setArea(match[0]); requestAnimationFrame(() => document.getElementById(`execution-${match[0]}`)?.scrollIntoView({ block: "start" })); }
    };
    followHash(); window.addEventListener("hashchange", followHash);
    return () => window.removeEventListener("hashchange", followHash);
  }, []);
  return <section aria-labelledby="execution-title" className="border-y border-[#d8ddcf] bg-[#f3f4ed] px-5 py-16 text-[#182018] sm:px-8 sm:py-24">
    <div className="mx-auto max-w-7xl">
      <p className={eyebrow}>Execution support / From recommendation to review</p>
      <h2 id="execution-title" className="mt-4 scroll-mt-28 text-4xl font-semibold">Turn a recommendation into work you can use.</h2>
      <p className={`mt-5 max-w-3xl ${body}`}>See how a recommendation could become a working brief, a reviewed content draft and a later check of the same page. The SEO confirms the business details, implements the work and decides what the follow-up evidence supports.</p>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[#586452]">This is an isolated website demonstration. Real reports provide action steps and review guidance, but do not yet save content drafts, confirmed implementation records or implementation-aligned before/after comparisons. Nothing here runs analysis, publishes a page or uses credits.</p>
      <div className="method-workspace">
        <aside aria-label="Execution example context" className="method-execution-context"><div><p className={eyebrow}>Fictional case / Same action throughout</p><h3 className="mt-2 text-lg font-semibold">Improve the existing air conditioning repair service page.</h3></div><p className="max-w-sm text-sm leading-6 text-[#586452]">Information and contact steps need clarification. Service areas, supported repairs, process and contact details still need client confirmation.</p></aside>
        <div role="group" aria-label="Execution workspaces" className="method-workspace-tabs">{areas.map(([id, label, description]) => <button key={id} id={`execution-${id}-button`} type="button" aria-pressed={area === id} aria-controls={`execution-${id}-panel`} onClick={() => setArea(id)}><strong>{label}</strong><small>{description}</small></button>)}</div>
        <p role="status" className="sr-only">{areas.find(([id]) => id === area)?.[1]} selected.</p>
        {dirty && <p className="border-b border-[#d8ddcf] bg-[#f1f5e6] px-5 py-3 text-sm leading-6">Unsaved draft changes are kept while you switch workspaces. Return to Content draft to save or cancel them.</p>}
        <section id="execution-steps-panel" aria-labelledby="execution-steps-button" hidden={area !== "steps"} className="method-workspace-panel">
          <h3 id="execution-steps" className="scroll-mt-28 text-2xl font-semibold">Break one recommendation into work someone can carry out.</h3>
          <p className={`mt-3 ${body}`}>Specify the location, sequence, required materials and completion criteria. Hand the reviewed brief to the content team, developer or client contact.</p>
          <div className="execution-step-layout"><ol aria-label="Implementation steps">{executionSteps.map((item, index) => <li key={item.title}><button type="button" aria-pressed={stepIndex === index} aria-controls="execution-step-brief" onClick={() => setStepIndex(index)}><strong><span className="mr-3 font-mono text-[#637e16]">0{index + 1}</span>{item.title}</strong><small>Completion criteria: {item.completion}</small></button></li>)}</ol>
            <div id="execution-step-brief" className="execution-step-body" role="region" aria-label="Selected implementation brief"><p className={eyebrow}>Step 0{stepIndex + 1} / Working brief</p><h4 className="mt-3 text-xl font-semibold">{step.title}</h4><p className={`mt-3 ${body}`}>{step.summary}</p><dl className="mt-6 space-y-5"><div><dt className="text-sm font-bold">Where to change</dt><dd className={`mt-2 ${body}`}>{step.location}</dd></div><div><dt className="text-sm font-bold">Instructions</dt><dd><ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-7 text-[#586452]">{step.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ul></dd></div><div><dt className="text-sm font-bold">Materials needed</dt><dd className={`mt-2 ${body}`}>{step.materials}</dd></div></dl>{stepIndex === 1 && <button type="button" className="mt-5 inline-flex min-h-11 items-center gap-3 border-b border-[#526c16] text-sm font-semibold" onClick={() => { setArea("draft"); requestAnimationFrame(() => document.getElementById("execution-draft-button")?.focus()); }}>View the draft for this step <ArrowRight size={16} /></button>}</div>
          </div>
        </section>
        <section id="execution-draft-panel" aria-labelledby="execution-draft-button" hidden={area !== "draft"} className="method-workspace-panel">
          <h3 id="execution-draft" className="scroll-mt-28 text-2xl font-semibold">Review and adapt prepared content.</h3><p className={`mt-3 ${body}`}>Use confirmed business information and specific findings. Leave missing information marked for completion rather than inventing it.</p>
          <ExecutionDraftDemo onDirtyChange={setDirty} />
        </section>
        <section id="execution-review-panel" aria-labelledby="execution-review-button" hidden={area !== "review"} className="method-workspace-panel">
          <h3 id="execution-review" className="scroll-mt-28 text-2xl font-semibold">Check the changes alongside the relevant performance.</h3><p className={`mt-3 ${body}`}>Compare content and data for the same page. Separate whether work is complete, whether performance changed and whether the evidence supports the next decision.</p>
          <ExecutionReviewDemo />
        </section>
      </div>
      <dl className="mt-7 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{[["Practical steps", "Know what to do first and where."], ["Usable content", "Review, edit and copy the draft."], ["Completion criteria", "Check whether the work is in place."], ["Change comparison", "Revisit the same target; do not assume causation."]].map(([label, text]) => <div key={label} className="border-t border-[#cbd3c0] pt-4"><dt className="font-semibold">{label}</dt><dd className="mt-2 text-sm leading-7 text-[#586452]">{text}</dd></div>)}</dl>
    </div>
  </section>;
}
