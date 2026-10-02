import { ActionPlanDemo } from "./ActionPlanDemo";

const dimensions = [
  {
    title: "Expected outcome impact",
    question: "What should this work improve? How directly does it connect to rankings, traffic or enquiry goals?",
    body: "Distinguish whether an action primarily addresses search visibility, page competitiveness, click acquisition or the contact path after arrival. Explain the part of the journey it aims to improve, rather than describing every change as ‘improving rankings’.",
    note: "These are impact directions, not proof that an outcome has been achieved.",
  },
  {
    title: "Scope and business value",
    question: "Which pages and services are affected? Do they matter to the client’s current business priorities?",
    body: "The same problem can have different value on a secondary page and a core service page. Use the analysis scope and known business context to understand whether it affects one page, several targets or an important service need.",
    note: "The SEO can add the client’s business priorities and adjust the suggested order.",
  },
  {
    title: "Problem severity",
    question: "Is this a clear obstacle, a performance weakness or a general improvement opportunity?",
    body: "Distinguish problems that prevent normal use, business information that needs correcting and content that could be improved. Not every finding belongs on an urgent task list.",
  },
  {
    title: "Strength of evidence",
    question: "How much support is there for the expected value? Which parts remain assumptions?",
    body: "Check for direct observations, supporting client data and whether the evidence refers to the same target. Separate well-supported judgments from opportunities that still need validation.",
    note: "An important-looking problem does not prove its impact. Strong evidence does not automatically make a task urgent.",
  },
  {
    title: "Prerequisites and dependencies",
    question: "Does other work need to happen first so this improvement can be implemented or reliably evaluated?",
    body: "Identify prerequisites such as business confirmation, restoring page access or checking measurement. Some work does not directly increase traffic, but provides the necessary foundation for what follows.",
  },
];

const rationale = [
  ["What should improve", "How the page serves core service demand, and the contact path for relevant visitors after they arrive."],
  ["Affected target", "One core service page that already receives relevant search impressions and clicks."],
  ["Why recommend this", "The page has specific information gaps, receives relevant search visits and supports a service the client has confirmed as a business priority."],
  ["Why consider it a priority", "Existing demand, a specific problem and a clear implementation target support the investment—not simply the fact that a competitor has a similar page."],
  ["What to confirm first", "Whether business material is accurate, the page is already being redesigned and relevant key events can support a review."],
  ["How to validate", "Check that changes are complete, then review search performance, engagement and relevant key events for the same page."],
];

const eyebrow = "text-xs font-bold uppercase leading-6 tracking-[0.18em] text-[#526c16]";
const bodyText = "text-base leading-7 text-[#586452]";

export function MethodPrioritization() {
  return (
    <section id="reasoning" aria-labelledby="prioritization-title" className="scroll-mt-24 bg-white px-5 py-16 text-[#182018] sm:px-8 sm:py-24">
      <div className="mx-auto max-w-7xl">
        <p className={eyebrow}>Prioritization / Your plan, your decision</p>
        <h2 id="prioritization-title" className="mt-4 max-w-4xl scroll-mt-28 text-balance font-[family-name:Georgia] text-4xl leading-tight tracking-[-0.04em] sm:text-5xl">Prioritize more valuable work. You decide the final order.</h2>
        <p className={`mt-6 max-w-3xl ${bodyText}`}>SearchTrust brings together expected outcome impact, business value, problem severity and supporting evidence to propose priority actions. Review the reasoning, adjust the order and edit the details around your client’s goals and delivery constraints to build your own work plan.</p>
        <p className="mt-6 max-w-3xl text-lg font-semibold leading-8">Every recommendation explains what it aims to improve, why it deserves attention now and how to validate it later.</p>

        <div className="method-plan-layout">
        <div className="plan-main">
          <p className="mt-4 max-w-3xl border-l-2 border-[#cbd3c0] pl-4 text-sm leading-7 text-[#586452]">The controls below change only this fictional example. In the report workspace, you can reorder the three generated actions and save edits to their work fields as a versioned plan. The five considerations here explain professional review; they are not a published numerical scoring formula.</p>
          <ActionPlanDemo />
          <details className="method-more mt-6"><summary>Adapt the plan to the client’s delivery constraints</summary><h3 className="text-xl font-semibold">The system provides an evidence-backed starting point. You set the work plan.</h3><p className={`mt-4 max-w-3xl ${bodyText}`}>Business priorities, team capacity, redesign plans and project progress also affect the order of delivery. Keep the original reasoning while adjusting the action order and content to turn the analysis into a practical plan.</p><p className={`mt-3 max-w-3xl ${bodyText}`}>For example, if the service page will be updated in next week’s redesign, you could bring forward the business information correction that can be completed this week.</p></details>
        </div>

        <div className="plan-dimensions">
          <h3 className="max-w-4xl text-2xl font-semibold leading-9 tracking-[-0.025em] sm:text-3xl">Not just whether a problem exists. What solving it is worth.</h3>
          <ol aria-label="Priority considerations" className="mt-8 divide-y divide-[#d8ddcf] border-b border-[#d8ddcf]">
            {dimensions.map((dimension, index) => (
              <li key={dimension.title} className={`grid gap-5 py-7 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-12 ${index === 0 ? "border-t-2 border-[#637e16] bg-[#f3f6eb] px-5 sm:px-7" : "px-5 sm:px-7"}`}>
                <div className="flex items-start gap-4"><span className="pt-1 font-mono text-sm font-bold text-[#637e16]">0{index + 1}</span><h4 className="text-xl font-semibold leading-7">{dimension.title}</h4></div>
                <div><p className="max-w-3xl text-sm font-semibold leading-7">{dimension.question}</p><details className="method-rule-details mt-3"><summary>How this affects priority</summary><p className={`mt-3 max-w-3xl ${bodyText}`}>{dimension.body}</p>
                  {index === 0 && <ul aria-label="Impact directions" className="mt-4 flex flex-wrap gap-2">{["Visibility & rankings", "Search clicks", "On-site actions", "Measurement & validation"].map((label) => <li key={label} className="rounded border border-[#cad6b6] px-2.5 py-1 text-xs font-semibold leading-5 text-[#526c16]">{label}</li>)}</ul>}
                  {dimension.note && <p className="mt-4 max-w-3xl text-sm leading-7 text-[#586452]">{dimension.note}</p>}
                </details></div>
              </li>
            ))}
          </ol>
        </div>

        <details className="plan-rationale method-more"><summary>Read the complete service-page recommendation</summary><div>
          <h3 className="max-w-4xl text-2xl font-semibold leading-9 tracking-[-0.025em] sm:text-3xl">Understand the recommendation before deciding to adopt it.</h3>
          <article aria-labelledby="priority-rationale-title" className="mt-8 bg-[#f0f3e8] p-6 sm:p-9 lg:p-10">
            <p className={eyebrow}>Method example · Not a real client result</p>
            <h4 id="priority-rationale-title" className="mt-3 max-w-4xl font-[family-name:Georgia] text-3xl leading-tight tracking-[-0.025em] sm:text-4xl">Improve the existing core service page. Clarify the service and the contact path.</h4>
            <dl className="mt-7 divide-y divide-[#d3dbc7] border-y border-[#d3dbc7]">{rationale.map(([label, text], index) => <div key={label} className={`grid gap-2 px-4 py-5 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8 ${index === 0 || index === 3 ? "border-l-4 border-l-[#637e16] bg-[#e4ebd7]" : ""}`}><dt className="text-sm font-bold leading-7">{label}</dt><dd className={`max-w-3xl ${bodyText}`}>{text}</dd></div>)}</dl>
            <p className="mt-5 text-sm leading-7 text-[#586452]">Expected value helps plan the work. It is not a guarantee of higher rankings or more traffic.</p>
          </article>
        </div></details>

        <details className="plan-ownership method-more"><summary>Where the system’s role ends and your decision begins</summary><div>
          <h3 className="text-2xl font-semibold leading-9 tracking-[-0.025em] sm:text-3xl">Evidence-backed recommendations. Your decision.</h3>
          <div className="mt-8 grid gap-9 lg:grid-cols-2 lg:gap-16">{[
            ["SearchTrust provides", ["Structured findings and observed evidence.", "Suggested actions and an initial order of priority.", "Expected impact and the recommendation rationale.", "Implementation requirements and review arrangements."]],
            ["The SEO decides", ["Which work fits the client’s current goals.", "What to bring forward, defer or redefine.", "How to schedule delivery around resources and project progress.", "The final plan to deliver to the client."]],
          ].map(([title, items]) => <div key={String(title)}><h4 className="text-xl font-semibold">{title}</h4><ul className="mt-4 list-disc space-y-3 pl-5 text-base leading-7 text-[#586452] marker:text-[#637e16]">{(items as string[]).map((item) => <li key={item}>{item}</li>)}</ul></div>)}</div>
          <p className={`mt-8 max-w-3xl ${bodyText}`}>You do not have to accept every suggestion or start from scratch. Review the evidence, adjust the order and edit the details to turn the suggested actions into a plan you stand behind.</p>
        </div></details></div>
      </div>
    </section>
  );
}
