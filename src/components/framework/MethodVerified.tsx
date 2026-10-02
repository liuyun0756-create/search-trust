import Link from "next/link";
import { ArrowRight } from "lucide-react";

const steps = [
  {
    title: "Identify what the initial judgment still needs.",
    body: "Public website and competitor information can reveal specific problems, but may not explain their significance for current performance. Separate observed facts from judgments that still need support from client data.",
    items: [
      ["", "Is a service page really missing, or was it not found within the checked scope?"],
      ["", "If a page lacks detail, is it already serving relevant search demand?"],
      ["", "A problem exists—but should it come before the other work?"],
    ],
    output: "The judgments to test, tied to specific pages or analysis targets.",
  },
  {
    title: "Check search performance and on-site behavior.",
    body: "Use comparable client data to examine how people discover the relevant page and what happens after they arrive. Read performance evidence alongside page checks, rather than choosing a direction from one metric alone.",
    items: [
      ["Search Console", "Impressions, clicks, CTR and average position for relevant queries and pages."],
      ["GA4", "Organic visits, engagement and configured key events for the corresponding landing page."],
      ["Data conditions", "Healthy sources, matched targets and periods, and enough data to support the judgment."],
    ],
    output: "Evidence that supports the initial judgment, conflicts with it or remains inconclusive.",
  },
  {
    title: "Make a clear decision about the work.",
    body: "Reassess the recommendations against new evidence. Confirm problems worth addressing, revise inaccurate assumptions and bring better-supported priorities to the front.",
    items: [
      ["Confirm the direction", "New evidence supports the original recommendation."],
      ["Revise the action", "The problem deserves attention, but needs a different approach."],
      ["Defer the work", "Current evidence does not justify putting it ahead of other work."],
      ["Investigate first", "Measurement or data issues prevent a reliable judgment and need resolving first."],
    ],
    output: "Specific targets, reasons for action and a clear order of priority.",
  },
];

const initialEvidence = [
  ["Public diagnosis", "Within the pages checked, information about one core service was mainly scattered across general pages. A confirmed competitor used a dedicated page to explain that service."],
  ["Initial judgment", "How the client’s pages support this service deserves investigation."],
  ["Still unresolved", "Whether a dedicated page was really missing, and whether adding a page would be better than improving an existing one."],
  ["Initial recommendation", "Confirm the existing pages first, then decide whether to improve or add a page."],
];

const newEvidence = [
  ["Client confirmation", "A corresponding service page already exists, and the service is a current business priority."],
  ["Search performance", "The page already receives impressions and clicks for relevant service queries. It is serving this type of search demand."],
  ["On-site behavior", "GA4 data that meets the analysis conditions suggests the page’s engagement deserves investigation. The meaning and collection of relevant key events also need checking."],
  ["Page inspection", "The existing page still leaves the service scope, process and next step for contacting the business unclear."],
];

const decisions = [
  ["Does the service need a new page?", "A corresponding page exists. Adding another page is no longer the default recommendation."],
  ["Does the existing page serve relevant demand?", "Relevant search impressions and clicks provide a basis for further investigation and improvement."],
  ["Which work deserves priority consideration?", "The business priority and page evidence make improving the existing page a better-supported action candidate."],
];

const deliverables = [
  ["Problem assessment", "Which problems are confirmed, which assumptions are revised and which still need checking."],
  ["Supporting evidence", "The observations and client data behind the conclusion."],
  ["Priority actions", "What to address first, which targets are involved and why the work deserves priority."],
  ["Execution & validation", "Implementation requirements, completion criteria, review metrics and timing."],
];

const eyebrow = "text-xs font-bold uppercase leading-6 tracking-[0.18em] text-[#526c16]";
const bodyText = "text-base leading-7 text-[#586452]";

export function MethodVerified() {
  return (
    <section id="diagnostic-map" aria-labelledby="verified-action" className="scroll-mt-24 border-y border-[#d8ddcf] bg-[#f3f4ed] px-5 py-16 sm:px-8 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <p className={eyebrow}>Verified / From diagnosis to action</p>
        <h2 id="verified-action" className="mt-4 max-w-4xl scroll-mt-28 text-balance font-[family-name:Georgia] text-4xl leading-tight tracking-[-0.04em] sm:text-5xl">
          Clarify the problems that need solving. Decide what to do next.
        </h2>
        <p className={`mt-6 max-w-3xl ${bodyText}`}>The prospect diagnosis helps you raise evidence-backed problems and opportunities. Once the client connects Search Console and GA4, combine actual performance with the relevant pages, business information and competitive context. Confirm or revise the initial judgments and establish clearer action priorities.</p>
        <p className="mt-6 max-w-3xl text-lg font-semibold leading-8">Not a few more charts in the report. A move from “what deserves investigation” to “what should we do now, and why?”</p>
        <ol aria-label="From diagnosis to action" className="mt-7 flex flex-col gap-3 text-sm font-bold sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5">
          {["Initial diagnosis", "Evidence review", "Work decision"].map((label, index) => (
            <li key={label} className="flex items-center gap-3 sm:gap-5">
              {index > 0 && <ArrowRight aria-hidden="true" className="hidden h-4 w-4 text-[#637e16] sm:block" />}
              <span className="font-mono text-xs text-[#637e16] sm:hidden">0{index + 1}</span>{label}
            </li>
          ))}
        </ol>

        <div className="method-verified-flow">

        <article aria-labelledby="verified-example-title" className="mt-16 border-t border-[#cbd3c0] pt-8">
          <p className={eyebrow}>Method example · Not a real client result</p>
          <h3 id="verified-example-title" className="mt-3 max-w-4xl font-[family-name:Georgia] text-3xl leading-tight tracking-[-0.03em] sm:text-4xl">From “do we need a new service page?” to “improve the existing core service page first.”</h3>

          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="verified-initial-title" className="min-w-0 bg-[#e9eddf] p-6 sm:p-8">
              <p className={eyebrow}>01 / From the prospect diagnosis</p>
              <h4 id="verified-initial-title" className="mt-3 text-xl font-semibold leading-7">What the public evidence told us.</h4>
              <p className="mt-6 font-[family-name:Georgia] text-3xl leading-tight">Is a dedicated service page actually missing?</p><p className={`mt-4 ${bodyText}`}>{initialEvidence[0][1]}</p><p className="mt-5 border-l-2 border-[#637e16] pl-4 text-sm leading-7">Not yet established. Confirm existing pages before proposing another one.</p>
              <details className="method-more mt-6"><summary>Inspect the initial reasoning</summary><dl className="space-y-5">{initialEvidence.slice(1).map(([label, text]) => <div key={label}><dt className="text-sm font-bold">{label}</dt><dd className={`mt-2 ${bodyText}`}>{text}</dd></div>)}</dl></details>
            </section>
            <section aria-labelledby="verified-evidence-title" className="min-w-0 bg-white p-6 sm:p-8">
              <p className={eyebrow}>02 / After client data is connected</p>
              <h4 id="verified-evidence-title" className="mt-3 text-xl font-semibold leading-7">What the additional evidence tells us.</h4>
              <dl className="mt-6 divide-y divide-[#d8ddcf]">{newEvidence.map(([label, text]) => <div key={label} className="py-5 first:pt-0 last:pb-0"><dt className="text-sm font-bold">{label}</dt><dd className={`mt-2 ${bodyText}`}>{text}</dd></div>)}</dl>
            </section>
          </div>

          <section aria-labelledby="verified-decisions-title" className="mt-8">
            <h4 id="verified-decisions-title" className="text-xl font-semibold leading-8 text-[#172018]">03 / What becomes clearer.</h4>
            <dl className="mt-5 divide-y divide-[#d8ddcf] border-y border-[#d8ddcf]">
              {decisions.map(([question, answer]) => <div key={question} className="grid gap-2 py-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-8"><dt className="text-base font-semibold leading-7">{question}</dt><dd className={bodyText}>{answer}</dd></div>)}
            </dl>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-[#586452]"><strong className="font-semibold text-[#182018]">Has the content been shown to cause too few enquiries?</strong> Not yet. Event measurement, visit intent and other possible factors still need checking.</p>
          </section>

          <section aria-labelledby="verified-work-title" className="mt-8 border-t-4 border-[#172018] bg-white p-6 sm:p-8 lg:p-10">
            <p className={eyebrow}>04 / Final work decision</p>
            <h4 id="verified-work-title" className="mt-3 max-w-4xl font-[family-name:Georgia] text-3xl leading-tight tracking-[-0.025em] sm:text-4xl">Improve the existing core service page. Clarify the service and the contact path.</h4>
            <p className="mt-4 text-base leading-7">Keep the confirmed page. Improve its service information and contact path; check relevant key events. Compare its priority with the other action candidates.</p>
            <details className="method-more mt-6"><summary>View the complete action brief and review criteria</summary><dl className="divide-y divide-[#d8ddcf] border-y border-[#d8ddcf]">
              <div className="grid gap-2 py-5 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8"><dt className="text-sm font-bold leading-7">Target</dt><dd className={bodyText}>The confirmed service page—not a new page that could duplicate it.</dd></div>
              <div className="grid gap-2 py-5 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8"><dt className="text-sm font-bold leading-7">Specific work</dt><dd><ul className={`list-disc space-y-2 pl-5 marker:text-[#637e16] ${bodyText}`}><li>Add accurate service scope, process and essential business information.</li><li>Make the next step for enquiring or contacting the business clear.</li><li>Check that relevant key events correctly record the intended behavior.</li></ul></dd></div>
              <div className="grid gap-2 py-5 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8"><dt className="text-sm font-bold leading-7">Priority rationale</dt><dd className={bodyText}>The page already serves relevant demand, the service is a business priority and specific content problems can be located. Compare these grounds with the other action candidates to decide whether this belongs in the top three.</dd></div>
              <div className="grid gap-2 py-5 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8"><dt className="text-sm font-bold leading-7">Completion criteria</dt><dd className={bodyText}>Business information is accurate, page changes are implemented, the contact path works and relevant events have been checked.</dd></div>
              <div className="grid gap-2 py-5 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8"><dt className="text-sm font-bold leading-7">How to review</dt><dd className={bodyText}>Review search performance, engagement and relevant key events for the same page. Interpret the results alongside the change date and other changes during the period.</dd></div>
            </dl></details>
          </section>
        </article>
        <details className="method-more">
          <summary>Inspect the three-stage verification method</summary>
          <h3 className="max-w-4xl text-2xl font-semibold leading-9 tracking-[-0.025em] sm:text-3xl">Follow the same problem. Fill the gaps in the evidence.</h3>
          <ol aria-label="How client data informs the decision" className="mt-8 grid gap-10 lg:grid-cols-3 lg:gap-8">
            {steps.map((step, index) => (
              <li key={step.title} className="flex min-w-0 flex-col border-t-2 border-[#cbd8b5] pt-5">
                <p className={eyebrow}>0{index + 1}</p>
                <h4 className="mt-3 text-xl font-semibold leading-7 tracking-[-0.02em] lg:min-h-21">{step.title}</h4>
                <p className={`mt-4 ${bodyText}`}>{step.body}</p>
                <ul className="mt-5 list-disc space-y-3 pl-5 text-sm leading-7 text-[#586452] marker:text-[#637e16]">
                  {step.items.map(([label, text]) => <li key={text}>{label && <strong className="font-semibold text-[#182018]">{label}: </strong>}{text}</li>)}
                </ul>
                <div className="mt-auto pt-6">
                  <div className="border-t border-[#cbd3c0] pt-5"><p className="text-sm font-bold text-[#526c16]">Stage output</p><p className="mt-2 text-sm font-medium leading-7">{step.output}</p></div>
                </div>
              </li>
            ))}
          </ol>
        </details></div>

        <div className="mt-14 border-t border-[#cbd3c0] pt-8">
          <h3 className="max-w-4xl text-2xl font-semibold leading-9 tracking-[-0.025em] sm:text-3xl">Not just more complete data. A clearer decision about the work.</h3>
          <p className={`mt-4 max-w-3xl ${bodyText}`}>Combine the public diagnosis with actual client performance to produce evidence-supported problem assessments and three priority actions. Explain to the client why these come first, then hand specific requirements to the delivery team.</p>
          <dl className="mt-8 grid gap-7 sm:grid-cols-2 lg:grid-cols-4">{deliverables.map(([label, text]) => <div key={label} className="border-t border-[#cbd3c0] pt-4"><dt className="text-base font-bold">{label}</dt><dd className={`mt-3 ${bodyText}`}>{text}</dd></div>)}</dl>
          <p className={`mt-8 max-w-3xl ${bodyText}`}>Review the full reasoning before delivering clear recommendations to the client. Where evidence is insufficient, keep the open checks visible rather than filling uncertainty with confident language.</p>
          <Link href="/sample-report" className="mt-6 inline-flex min-h-12 items-center gap-3 rounded-lg bg-[#172018] px-6 py-3 text-sm font-bold text-white hover:bg-[#30402b] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#526c16]">
            View a sample report <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
          </Link>
        </div>
      </div>
    </section>
  );
}
