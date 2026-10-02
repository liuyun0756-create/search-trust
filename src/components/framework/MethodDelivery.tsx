"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import example from "./delivery-example.json";

const eyebrow = "text-xs font-bold uppercase leading-6 tracking-[0.18em] text-[#526c16]";
const body = "text-base leading-7 text-[#586452]";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#526c16]";
const linkStyle = `inline-flex min-h-11 items-center gap-2 py-2 text-sm font-semibold underline decoration-[#9aab83] underline-offset-4 ${focus}`;

export function MethodDelivery() {
  const [role, setRole] = useState<"client" | "seo">("client");
  const preview = useRef<HTMLHeadingElement>(null);
  const view = example.views[role];

  function previewClient() {
    setRole("client");
    preview.current?.focus({ preventScroll: true });
    preview.current?.scrollIntoView({ block: "start" });
  }

  return <section aria-labelledby="delivery-title" className="border-y border-[#d8ddcf] bg-[#f3f4ed] px-5 py-16 text-[#182018] sm:px-8 sm:py-24">
    <div className="mx-auto max-w-7xl">
      <div className="delivery-main"><div className="delivery-sidebar">
      <p className={eyebrow}>Client delivery / Analysis you can stand behind</p>
      <h2 id="delivery-title" className="mt-4 max-w-4xl scroll-mt-28 text-balance font-[family-name:Georgia] text-4xl leading-tight tracking-[-0.04em] sm:text-5xl">You can inspect the reasoning. Your client can understand why the work matters.</h2>
      <p className={`mt-6 max-w-3xl ${body}`}>Organize findings, evidence and actions into two reading views. Keep the professional reasoning and implementation detail for the SEO; give the client a clear account of the problem, the work priorities and the follow-up. Review before delivery, without rebuilding a client-readable explanation from scratch.</p>
      <p className="mt-5 text-lg font-semibold leading-8">Simplify the expression, not the facts.</p>
      <p className="mt-5 text-sm leading-7 text-[#586452]">One finding, two reading needs. Inspect the same evidence as an SEO, or see how the client will understand the proposed work.</p>
      </div>

      <div className="delivery-report-grid grid items-start gap-6">
        <div className="min-w-0 border border-[#cbd3c0] bg-white">
          <div className="border-b border-[#d8ddcf] bg-[#e9eddf] p-5 sm:p-7">
            <p className={eyebrow}>{example.label}</p>
            <h3 ref={preview} id="delivery-preview" tabIndex={-1} className={`mt-3 scroll-mt-28 text-xl font-semibold leading-8 ${focus}`}>One finding. Two ways to read it.</h3>
            <div role="group" aria-label="Report reading view" className="mt-5 flex flex-wrap gap-2">{(["seo", "client"] as const).map((key) => <button key={key} type="button" aria-pressed={role === key} aria-controls="delivery-report-body" onClick={() => setRole(key)} className={`min-h-11 border px-4 py-3 text-sm font-semibold ${focus} ${role === key ? "border-[#253b24] bg-[#253b24] text-white" : "border-[#b9c6a8] bg-white text-[#253b24] hover:bg-[#f5f7ef]"}`}>{example.views[key].label}</button>)}</div>
            <p className="mt-4 text-sm leading-7 text-[#586452]">Same case, finding and action. Switching views changes the explanation, not its certainty.</p>
          </div>
          <article id="delivery-report-body" aria-labelledby="delivery-report-heading" className="p-5 sm:p-8 lg:p-10">
            <header className="border-b border-[#d8ddcf] pb-6"><p className={eyebrow}>{view.label} / {example.version}</p><p className="mt-2 text-sm leading-7 text-[#586452]">{example.case}</p><p className="mt-2 text-sm leading-7 text-[#586452]">{example.scope}</p><h4 id="delivery-report-heading" className="mt-5 max-w-3xl font-[family-name:Georgia] text-3xl leading-tight tracking-[-0.025em] sm:text-4xl">{view.title}</h4><p className={`mt-4 ${body}`}>{view.intro}</p></header>
            <section aria-label="Shared supporting evidence" className="mt-6">
              <h5 className="text-base font-semibold">{role === "seo" ? "Supporting evidence in this illustration" : "Why this work is proposed"}</h5>
              <ul className="mt-3 space-y-3">{example.evidence.map((item) => <li key={item.source} className="border-l-2 border-[#b9c6a8] pl-4 text-sm leading-7"><span className="font-semibold">{item.source}: </span><span className="text-[#586452]">{item.text}</span></li>)}</ul>
              <p className="mt-3 text-sm leading-7 text-[#586452]">Illustrative evidence only. Source snapshots, observation times and comparison periods have not been supplied.</p>
            </section>
            <dl className="mt-6 divide-y divide-[#d8ddcf] border-y border-[#d8ddcf]">{view.sections.map((item) => <div key={item.label} className="py-5"><dt className="text-base font-semibold">{item.label}</dt><dd className={`mt-2 ${body}`}>{item.text}</dd></div>)}</dl>
            <aside aria-label="Conditions and limits in both report views" className="mt-6 bg-[#f3f4ed] p-5">
              <h5 className="text-base font-semibold">Still to confirm, in either view</h5><ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[#586452]">{example.pending.map((item) => <li key={item}>{item}</li>)}</ul>
              <p className="mt-4 text-sm leading-7"><strong>What this does not establish: </strong><span className="text-[#586452]">{example.limitations}</span></p>
            </aside>
            <dl aria-label="Work and review status" className="mt-6 grid gap-5 sm:grid-cols-3">{example.status.map((item) => <div key={item.label} className="border-t border-[#cbd3c0] pt-3"><dt className="text-sm font-semibold">{item.label}</dt><dd className="mt-2 text-sm leading-6 text-[#586452]">{item.text}</dd></div>)}</dl>
          </article>
        </div>
        <aside aria-label="Sample delivery materials" className="border-y border-[#cbd3c0] py-5 xl:sticky xl:top-28">
          <p className={eyebrow}>Inspect the example</p>
          <div className="mt-3 flex flex-col items-start gap-2">
            <button type="button" onClick={previewClient} className={linkStyle}>Preview client report<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></button>
            <a href="/samples/searchtrust-client-delivery-example.pdf" target="_blank" rel="noopener noreferrer" className={linkStyle}>View PDF sample<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="sr-only"> (opens in a new tab)</span></a>
            <Link href="/sample-report#report-scenarios" className={linkStyle}>View full report sample<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
          <p className="mt-4 text-sm leading-7 text-[#586452]">Demonstration materials only. The PDF uses the same example facts and limits; it is not a real client export. No client link is created and nothing is sent.</p>
          <p className="mt-4 border-t border-[#cbd3c0] pt-4 text-sm leading-7 text-[#586452]">This example is separate from the report workspace. Real reports support a versioned SEO plan, approval, client PDF and version-bound sharing. Confirmed implementation records and their follow-up comparisons are not part of this preview.</p>
        </aside>
      </div></div>
      <p role="status" className="sr-only">{view.label} selected. The same evidence, pending conditions and work status are retained.</p>
      <p className="mt-6 max-w-3xl text-lg font-semibold leading-8">Behind the client’s clear explanation is the full reasoning you can inspect.</p>

      <details className="method-more mt-8"><summary>What each reading view includes</summary><div>
        <h3 className="text-2xl font-semibold leading-9 sm:text-3xl">The same facts. Two reading needs.</h3>
        <div className="mt-6 grid gap-8 lg:grid-cols-2">{[
          { label: "SEO working view", title: "Keep the detail needed to judge, execute and review.", items: ["Specific findings and analysis targets.", "Evidence sources, observation times and applicable scope.", "Reasoning, confidence and conditions still to confirm.", "Action priority, execution requirements and completion criteria.", "Review metrics, baselines and important changes."], value: "Inspect the evidence, adjust the plan and prepare for the questions the client may ask." },
          { label: "Client report view", title: "Make the problem, priorities and next steps understandable.", items: ["The core issues worth attention now.", "Representative evidence supporting the judgment.", "Three proposed priority actions.", "Materials the client needs to provide or confirm.", "How implementation and performance will be checked."], value: "Help the client understand why the work matters, what is proposed and how to contribute." },
        ].map((item) => <div key={item.label}><p className={eyebrow}>{item.label}</p><h4 className="mt-3 text-xl font-semibold leading-8">{item.title}</h4><ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-[#586452]">{item.items.map((text) => <li key={text}>{text}</li>)}</ul><p className="mt-5 border-t border-[#cbd3c0] pt-4 text-base font-medium leading-7">{item.value}</p></div>)}</div>
        <p className={`mt-6 max-w-3xl ${body}`}>A client view is not a way to hide problems or show only good results. Missing data, pending confirmations and important limits stay visible, expressed in language the client can use.</p>
      </div></details>

      <section aria-labelledby="delivery-scenarios" className="mt-12 border-t border-[#cbd3c0] pt-8">
        <h3 id="delivery-scenarios" className="scroll-mt-28 text-2xl font-semibold leading-9 sm:text-3xl">Use the report to propose work, then explain delivery and progress.</h3>
        <div className="mt-7 grid gap-10 lg:grid-cols-2">{example.scenarios.map((scenario) => <section key={scenario.id} aria-labelledby={`delivery-${scenario.id}`} className="min-w-0">
          <p className={eyebrow}>{scenario.label}</p><h4 id={`delivery-${scenario.id}`} className="mt-3 scroll-mt-28 text-xl font-semibold leading-8">{scenario.title}</h4>
          <details className="method-more mt-5"><summary>What the report needs to answer</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-[#586452]">{scenario.questions.map((question) => <li key={question}>{question}</li>)}</ol></details>
          <div className="mt-6 border-l-2 border-[#526c16] bg-white p-5 sm:p-6">
            <p className={eyebrow}>Illustrative report excerpt · Not a client result</p><h5 className="mt-4 font-semibold">{scenario.id === "prospect" ? "The discussion starting point" : "The proposed work and follow-up"}</h5><p className={`mt-3 ${body}`}>{scenario.summary}</p>
            <div className="mt-5 space-y-3">{scenario.evidence.map((text) => <p key={text} className="border-l border-[#b9c6a8] pl-3 text-sm leading-7 text-[#586452]">{text}</p>)}</div>
            <h5 className="mt-5 font-semibold">{scenario.id === "prospect" ? "Three proposed priority actions" : "Plan, implementation and review"}</h5><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-[#586452]">{scenario.actions.map((text) => <li key={text}>{text}</li>)}</ol>
            <h5 className="mt-5 font-semibold">Client confirmation</h5><p className={`mt-2 ${body}`}>{scenario.needs}</p>
            <p className="mt-5 border-t border-[#d8ddcf] pt-4 text-sm leading-7"><strong>{scenario.id === "prospect" ? "Still to verify: " : "Actual status: "}</strong><span className="text-[#586452]">{scenario.boundary}</span></p>
          </div>
          <p className="mt-5 text-base font-medium leading-7">{scenario.value}</p>
        </section>)}</div>
      </section>

      <section aria-labelledby="delivery-review" className="mt-12 border-t border-[#cbd3c0] pt-8">
        <h3 id="delivery-review" className="scroll-mt-28 text-2xl font-semibold leading-9 sm:text-3xl">Confirm it yourself before delivering it as your professional judgment.</h3>
        <ol className="mt-7 grid gap-8 lg:grid-cols-3">{[
          ["Review the judgment", "Check evidence, conclusions and pending conditions. Keep the report within what the available materials can support."],
          ["Confirm the plan", "Review the action order, execution scope and client contributions, following the plan-adjustment approach in module 4."],
          ["Preview the delivery", "Inspect the report the client will actually see. Confirm that its wording is accurate before sharing or exporting."],
        ].map(([title, text], index) => <li key={title}><p className={eyebrow}>0{index + 1}</p><h4 className="mt-2 text-lg font-semibold leading-8">{title}</h4><p className={`mt-3 ${body}`}>{text}</p></li>)}</ol>
        <p className={`mt-6 max-w-3xl ${body}`}>The delivery must match the final reviewed plan. A later plan edit should not silently change an already approved client version. This website demo does not save approval, send reports or change a real plan.</p>
        <div className="mt-7 border-t border-[#cbd3c0] pt-6"><h4 className="text-lg font-semibold">Before sharing a real report, confirm the delivery boundary.</h4><dl className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{[["Report version", "Which reviewed version is being shared?"], ["Client visibility", "Which content will the client see?"], ["Unconfirmed information", "Which conditions and limitations remain visible?"], ["Later changes", "Does a revised plan need a newly confirmed delivery version?"]].map(([label, text]) => <div key={label}><dt className="text-sm font-semibold">{label}</dt><dd className="mt-2 text-sm leading-7 text-[#586452]">{text}</dd></div>)}</dl></div>
      </section>
    </div>
  </section>;
}
