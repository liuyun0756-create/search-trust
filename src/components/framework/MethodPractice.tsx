"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowRight, ChevronDown } from "lucide-react";
import { practiceCases, practiceSteps, type PracticeCase, type PracticeStep } from "./practice-case-data";

const eyebrow = "text-xs font-bold uppercase leading-6 tracking-[0.18em] text-[#526c16]";
const body = "text-base leading-7 text-[#586452]";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#526c16]";
const linkStyle = `inline-flex min-h-11 items-center gap-2 py-2 text-sm font-semibold underline decoration-[#9aab83] underline-offset-4 ${focus}`;

function RecordFields({ fields }: { fields: readonly (readonly [string, string])[] }) {
  return <dl className="divide-y divide-[#d8ddcf]">{fields.map(([label, value]) => <div key={label} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-6"><dt className="text-sm font-semibold leading-7">{label}</dt><dd className="text-sm leading-7 text-[#586452]">{value}</dd></div>)}</dl>;
}

function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return <details className="group mt-5 border-y border-[#d8ddcf]">
    <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-semibold marker:hidden ${focus} [&::-webkit-details-marker]:hidden`}>{title}<ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 group-open:rotate-180" /></summary>
    <div className="pb-5">{children}</div>
  </details>;
}

function CaseStep({ step, children }: { step: PracticeStep; children: React.ReactNode }) {
  const index = practiceSteps.findIndex((item) => item.id === step);
  return <section aria-labelledby={`practice-${step}`} data-practice-step={step} className="border-t border-[#d8ddcf] pt-6">
    <h4 id={`practice-${step}`} tabIndex={-1} className={`scroll-mt-28 text-xl font-semibold leading-8 ${focus}`}><span className="mr-3 font-mono text-sm text-[#637e16]">0{index + 1}</span>{practiceSteps[index].label}</h4>
    <div className="mt-4">{children}</div>
  </section>;
}

function CaseDetails({ example }: { example: PracticeCase }) {
  return <div className="min-w-0 space-y-9">
    <CaseStep step="principle">
      <p className={body}>{example.principle}</p>
      <a href={example.sourceUrl} target="_blank" rel="noopener noreferrer" className={`mt-3 ${linkStyle}`}>{example.sourceTitle}<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="sr-only"> (opens in a new tab)</span></a>
      <p className="mt-2 text-sm leading-6 text-[#586452]">Public guidance, not a Google endorsement or validation of SearchTrust.</p>
    </CaseStep>
    <CaseStep step="judgment">
      <p className={body}>{example.judgment}</p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-[#586452]">{example.checks.map((check) => <li key={check}>{check}</li>)}</ul>
      <p className="mt-4 text-sm leading-7 text-[#586452]">Illustrated investigation approach—not a named practitioner’s project record or a claim of years of experience.</p>
    </CaseStep>
    <CaseStep step="rules">
      <p className="text-sm font-semibold leading-7">Analysis conditions illustrated in this method</p>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[#586452]">{example.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
      <div className="mt-5 border-l-2 border-[#a4b789] pl-4"><p className="text-sm font-semibold">Manual verification</p><p className={`mt-2 ${body}`}>{example.manual}</p></div>
      <p className="mt-4 text-sm leading-7 text-[#586452]">Website method preview: this checklist is not a record of a completed system run. Actual automated coverage and manual checks must be identified in the report; product alignment is pending.</p>
    </CaseStep>
    <CaseStep step="evidence">
      <p className={body}>{example.evidenceSummary}</p>
      <Disclosure title="View original evidence">
        <p className="text-sm font-semibold leading-7">No original evidence attached · Required record structure</p>
        <RecordFields fields={example.evidenceFields} />
        <p className="mt-3 text-sm leading-7 text-[#586452]">Only publish authorized, anonymized materials. Preserve relevant business context, sources and observation times; do not expose private client information.</p>
      </Disclosure>
    </CaseStep>
    <CaseStep step="conclusion">
      <div className="bg-[#edf1e5] p-5 sm:p-6"><p className={eyebrow}>Conditional reasoning · Not a verified finding</p><p className="mt-3 text-lg font-medium leading-8">{example.conditionalConclusion}</p></div>
      <p className={`mt-4 ${body}`}>{example.limit}</p>
    </CaseStep>
    <CaseStep step="action">
      <p className="text-sm font-semibold leading-7">Proposed approach · No implementation recorded</p>
      <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-7 text-[#586452]">{example.actions.map((action) => <li key={action}>{action}</li>)}</ol>
      <p className="mt-5 text-sm leading-7"><strong>Why not the obvious alternative?</strong> <span className="text-[#586452]">{example.rejectedAlternative}</span></p>
      <Disclosure title="View implementation records">
        <p className="text-sm font-semibold leading-7">No work or implementation date verified · Records needed</p>
        <RecordFields fields={example.implementationFields} />
      </Disclosure>
    </CaseStep>
    <CaseStep step="review">
      <p className={body}>{example.review}</p>
      <RecordFields fields={example.reviewChecks} />
      <div className="mt-4 border-l-2 border-[#a4b789] pl-4"><p className="text-sm font-semibold">Validation not completed</p><p className="mt-2 text-sm leading-7 text-[#586452]">No verified before/after results, implementation date or comparison periods are available. Missing data is not zero, and no simulated outcome is substituted.</p></div>
      <Disclosure title="View result comparison">
        <RecordFields fields={[["Comparison scope", "Not established: requires the same target, sources, filters and suitable periods."], ["Implementation date", "Not supplied."], ["Before / after periods", "Not supplied; no comparison can be calculated."]]} />
        <div className="mt-4 divide-y divide-[#d8ddcf] border-y border-[#d8ddcf]" role="group" aria-label="Unverified comparison values">{example.metrics.map((metric) => <div key={metric} className="py-4"><h5 className="text-sm font-semibold leading-7">{metric}</h5><dl className="mt-2 grid gap-3 sm:grid-cols-3">{[["Before", "Not supplied"], ["After", "Not supplied"], ["Change", "Not calculable"]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 text-sm leading-6 sm:block"><dt className="text-[#586452]">{label}</dt><dd className="sm:mt-1">{value}</dd></div>)}</dl></div>)}</div>
        <p className="mt-4 text-sm leading-7"><strong>Other influences to investigate:</strong> <span className="text-[#586452]">{example.context}</span></p>
      </Disclosure>
    </CaseStep>
    <aside aria-label="Example outcome and work value" className="border-t-4 border-[#31452a] bg-[#f3f4ed] p-5 sm:p-7">
      <p className={eyebrow}>Method example · Outcome not yet verified</p>
      <h4 className="mt-3 text-2xl font-semibold leading-9">Keep the initial idea, the decision and its limits together.</h4>
      <RecordFields fields={[
        ["Initial hypothesis", example.hypothesis],
        ["What was established", "No project conclusion established. The reasoning above shows what the required evidence could support."],
        ["What was done", "No actual work, target URL or implementation date is recorded. Proposed steps are not completed work."],
        ["What happened afterwards", "No verified results or comparison periods. Improvement, no change and a revised judgment all remain possible."],
        ["What happens next", example.next],
      ]} />
      <p className="mt-5 text-base font-semibold leading-7">Work value: {example.value}</p>
      <h5 className="mt-6 text-base font-semibold">Which repeated work could this reduce?</h5>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-[#586452]">{example.work.map((item) => <li key={item}>{item}</li>)}</ul>
      <p className="mt-4 text-sm leading-7 text-[#586452]">These are intended workflow benefits, not measured savings from this example. No product participation log or time record has been supplied, so no hours or percentages are claimed.</p>
    </aside>
  </div>;
}

export function MethodPractice() {
  const [selected, setSelected] = useState(0);
  const [activeStep, setActiveStep] = useState<PracticeStep>("principle");
  const [recordOpen, setRecordOpen] = useState(false);
  const example = practiceCases[selected];

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: PracticeStep = "principle";
      for (const step of practiceSteps) {
        const element = document.getElementById(`practice-${step.id}`);
        if (element && !element.closest("details:not([open])") && element.getBoundingClientRect().top <= 180) current = step.id;
      }
      setActiveStep(current);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [selected]);

  useEffect(() => {
    const follow = () => {
      if (!practiceSteps.some((step) => location.hash === `#practice-${step.id}`)) return;
      setRecordOpen(true);
      requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" }));
    };
    follow(); window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);

  return <section aria-labelledby="practice-title" onClickCapture={(event) => {
    const link = (event.target as Element).closest("a[href]");
    const target = link?.getAttribute("href");
    if (practiceSteps.some((step) => target === `#practice-${step.id}`)) {
      setRecordOpen(true);
      requestAnimationFrame(() => document.getElementById(target!.slice(1))?.scrollIntoView({ block: "start" }));
    }
  }} className="border-b border-[#d8ddcf] bg-white px-5 py-16 text-[#182018] sm:px-8 sm:py-24">
    <div className="mx-auto max-w-7xl">
      <p className={eyebrow}>Review / From work record to next decision</p>
      <h2 id="practice-title" className="mt-4 max-w-4xl scroll-mt-28 text-balance font-[family-name:Georgia] text-4xl leading-tight tracking-[-0.04em] sm:text-5xl">Check what was done. Then decide what the result really supports.</h2>
      <p className={`mt-6 max-w-3xl ${body}`}>A work brief is not proof of implementation, and a later metric change is not proof of cause. Follow the same page and the same decision from original evidence through the work record and a suitably comparable result check. Keep, adjust or investigate the direction on that basis.</p>
      <div className="method-review-desk" aria-label="Review status for the fictional service-page case">
        <div><span>01 / IMPLEMENTATION</span><strong>Not yet verified</strong><p>Record the live page, exact changes and date before describing the work as complete.</p></div>
        <div><span>02 / COMPARISON</span><strong>No result supplied</strong><p>Review the same page, relevant queries and eligible on-site data against a suitable baseline.</p></div>
        <div><span>03 / NEXT DECISION</span><strong>Still open</strong><p>Separate the effect of the work from seasonality, measurement changes and other explanations.</p></div>
      </div>
      <p className="mt-8 text-lg font-semibold leading-8">Inspect the full reasoning trail behind a defensible review.</p>
      <p className={`mt-3 max-w-3xl ${body}`}>The examples below trace Google’s public principles, SEO judgment, analysis rules, project evidence, action and result review. They show what a real project must document; they are not completed client case studies.</p>
      <nav aria-label="Methodology reading path" className="mt-7"><ol className="flex flex-wrap items-center gap-x-3 gap-y-1">{[["principle", "Public principles"], ["judgment", "Professional judgment"], ["rules", "Analysis rules"], ["evidence", "Project evidence"], ["action", "Optimization action"], ["review", "Result review"]].map(([id, label], index) => <li key={id} className="flex items-center gap-3"><a href={`#practice-${id}`} className={linkStyle}>{label}</a>{index < 5 && <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#8b977c]" />}</li>)}</ol></nav>

      <div className="mt-10 grid gap-8 border-y border-[#d8ddcf] py-8 lg:grid-cols-3">
        {[
          ["Google’s public principles", "A public basis for the direction of analysis.", "Use documented guidance on local search, search performance and measurement to identify relevant factors, comparable data and limits on a conclusion.", "View principle sources", "principle"],
          ["SEO experience and data validation", "Experience proposes a judgment. Data tests it.", "Start with business and competition context, then investigate possible causes. A real project record should show the initial idea, important trade-offs and the subsequent checks—not an unsupported experience claim.", "View the judgment and required records", "judgment"],
          ["SearchTrust’s analysis rules", "Turn recurring checks into a reusable workflow.", "Organize evidence, object matching, condition checks and action briefs, separating system analysis from manual verification. L1–L8 is one page-diagnosis tool within this wider method. The SEO reviews the final judgment.", "View conditions and scope", "rules"],
        ].map(([label, title, text, tag, target]) => <div key={label} className="flex flex-col"><p className={eyebrow}>{label}</p><h3 className="mt-3 text-xl font-semibold leading-8">{title}</h3><p className={`mt-3 flex-1 ${body}`}>{text}</p><a href={`#practice-${target}`} className={`mt-4 self-start ${linkStyle}`}>{tag}<ArrowDown aria-hidden="true" className="h-4 w-4 shrink-0" /></a></div>)}
      </div>

      <div className="mt-12">
        <h3 id="practice-examples" className="scroll-mt-28 text-2xl font-semibold leading-9 sm:text-3xl">Three familiar problems. Three kinds of professional judgment.</h3>
        <p className={`mt-4 max-w-3xl ${body}`}>Method examples, not verified client case studies. No authorized project evidence has been supplied for these examples. The cases show the investigation process and the records needed—not completed work, growth results or measured time savings.</p>
        <div role="group" aria-label="Choose a method example" className="mt-7 grid gap-3 lg:grid-cols-3">{practiceCases.map((item, index) => <button key={item.id} type="button" aria-label={item.title} aria-pressed={selected === index} aria-controls="practice-case-content" onClick={() => { setSelected(index); setActiveStep("principle"); }} className={`flex min-w-0 flex-col items-start border p-5 text-left transition-colors ${focus} sm:p-6 ${selected === index ? "border-[#31452a] bg-[#edf1e5] shadow-[inset_0_3px_0_#31452a]" : "border-[#d8ddcf] bg-white hover:bg-[#f7f8f2]"}`}>
          <span className={`flex w-full items-center justify-between gap-3 ${eyebrow}`}><span>Example 0{index + 1}</span><span>{selected === index ? "Selected" : "View example"}</span></span>
          <span className="mt-4 text-xl font-semibold leading-8">{item.title}</span>
          <span className="mt-3 flex-1 text-sm leading-7 text-[#586452]">{item.description}</span>
          <span className="mt-5 block text-xs font-semibold leading-6">Sources to examine: {item.sources}</span>
          <span className="mt-3 border-t border-[#cbd3c0] pt-3 text-xs leading-6 text-[#586452]">{item.status}</span>
        </button>)}</div>
        <p role="status" className="sr-only">Selected method example {selected + 1}: {example.title}. No verified project results.</p>
      </div>

      <article id="practice-case-content" aria-labelledby="practice-case-detail" className="mt-9 border border-[#d8ddcf] p-5 sm:p-8 lg:p-10">
        <header className="mb-8 max-w-3xl"><p className={eyebrow}>Method example · Not a real client result</p><h3 id="practice-case-detail" tabIndex={-1} className={`mt-3 scroll-mt-28 text-2xl font-semibold leading-9 sm:text-3xl ${focus}`}>{example.title}</h3><p className={`mt-4 ${body}`}>{example.description}</p></header>
        <dl className="case-outline">{[["Starting hypothesis", example.hypothesis], ["What the evidence could change", example.conditionalConclusion], ["Next investigation", example.next]].map(([label, text]) => <div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl>
        <p className="text-sm leading-7 text-[#586452]">No verified project outcome or implementation record is available. {example.limit}</p>
        <details className="method-more mt-6" open={recordOpen} onToggle={(event) => setRecordOpen(event.currentTarget.open)}><summary>Inspect all seven reasoning steps</summary>
        <div className="grid items-start gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
          <nav aria-label="Case reading steps" className="border-y border-[#d8ddcf] py-3 lg:border-y-0 lg:border-l lg:py-0">
            <p className="px-3 pb-2 text-xs font-bold uppercase leading-6 tracking-[0.14em] text-[#586452]">In this example</p>
            <ol>{practiceSteps.map((step, index) => <li key={step.id}><a href={`#practice-${step.id}`} aria-current={activeStep === step.id ? "step" : undefined} className={`flex min-h-11 items-center gap-3 px-3 py-2 text-sm leading-6 ${focus} ${activeStep === step.id ? "bg-[#edf1e5] font-semibold text-[#31452a]" : "text-[#586452] hover:bg-[#f7f8f2]"}`}><span className="font-mono text-xs">0{index + 1}</span>{step.label}</a></li>)}</ol>
          </nav>
          <CaseDetails key={example.id} example={example} />
        </div></details>
      </article>

      <div className="mt-12 border-t border-[#d8ddcf] pt-8">
        <h3 className="max-w-4xl text-2xl font-semibold leading-9 sm:text-3xl">Turn experience into a judgment you can inspect. Turn that judgment into action. Then check the data again.</h3>
        <p className={`mt-5 max-w-3xl ${body}`}>Inspect the public basis, the reasoning and the project evidence behind each recommendation. Understand why the action was chosen, review what changed after implementation and decide what comes next.</p>
        <dl className="mt-7 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">{[["Professional", "A judgment process that can be explained and reviewed."], ["Complete", "From finding the problem to implementation and follow-up."], ["Less repeated work", "Organize evidence, comparisons and delivery materials."], ["Under your control", "The SEO retains the final judgment and work decisions."]].map(([label, text]) => <div key={label} className="border-t border-[#d8ddcf] pt-4"><dt className="font-semibold">{label}</dt><dd className={`mt-2 ${body}`}>{text}</dd></div>)}</dl>
        <p className="mt-8 max-w-3xl text-base font-semibold leading-7">Credibility comes from judgments that can be verified and revised—not from every case showing growth.</p>
        <a href="#practice-case-detail" className={`mt-4 ${linkStyle}`}>View a method example<ArrowRight aria-hidden="true" className="h-4 w-4" /></a>
      </div>
    </div>
  </section>;
}
