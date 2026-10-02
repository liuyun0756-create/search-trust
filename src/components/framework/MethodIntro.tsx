import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { MethodNavigation } from "./MethodNavigation";
import { MethodJourney } from "./MethodJourney";

const workStages = [
  {
    label: "01 / Prospect",
    title: "Win the work with a business-specific diagnosis.",
    evidence: "Website, public business information and confirmed competitors.",
    decision: "Show which observed problems deserve a first conversation—and which opportunities still need validation.",
    output: "Prospect Diagnosis + three priority actions",
  },
  {
    label: "02 / Deliver",
    title: "Turn client evidence into a defensible work plan.",
    evidence: "Search Console, GA4, confirmed business context and the relevant pages.",
    decision: "Confirm or revise the initial judgment, then compare the work that deserves priority.",
    output: "Verified Action Plan + completion criteria",
  },
  {
    label: "03 / Review",
    title: "Explain what changed and what should happen next.",
    evidence: "Implementation records, the same targets and suitably comparable performance.",
    decision: "Keep, adjust or investigate the direction without turning correlation into proof.",
    output: "Client-ready review + next-stage rationale",
  },
];

const professionalValue = [
  ["Win better conversations", "Lead with this business’s actual problems—not a generic audit checklist."],
  ["Deliver with a reason", "Tie each recommendation to evidence, a target, implementation detail and a completion standard."],
  ["Review without hand-waving", "Explain why the direction stays, changes or still needs investigation."],
];

const methodOutputs = [
  ["01", "Prospect Diagnosis", "Specific findings, traceable public evidence and three actions for the first client conversation."],
  ["02", "Verified Action Plan", "Judgments tested against eligible client data, with targets, priority rationale and completion criteria."],
  ["03", "Client-ready Review", "A clear account of the work, material changes, remaining limits and the next decision."],
];

const contextChecks = [
  ["Services", "What does the client actually offer? Which services are in scope for this analysis?"],
  ["Locations", "Which areas does the client serve? Where was this search observation made?"],
  ["Search intent", "Is the searcher looking for a provider, comparing options or seeking information?"],
  ["Real competitors", "Does the business offer relevant services, or is the result a directory or content platform?"],
];

const pageChecks = [
  {
    title: "Is there a suitable page for the service demand?",
    evidence: "Discovered service and location pages, page topics, checked access status and observed competitor page types.",
    decision: "Whether to improve an existing page or investigate a possible gap before deciding to add a page.",
  },
  {
    title: "Do the website and public business information agree?",
    evidence: "Available business names, contact details, website links, locations and service areas.",
    decision: "Which details conflict or are missing, which need client confirmation and which can become correction tasks.",
  },
  {
    title: "Does the page give people enough reason to choose this business?",
    evidence: "Service details, local context, business identity, who is accountable and information supporting the business’s credibility.",
    decision: "Which specific content and supporting evidence to add—not a generic instruction to ‘add content’ or ‘build trust’.",
  },
];

const exampleRows = [
  ["Analysis target", "How the website’s pages support one core service."],
  ["Observed evidence", "Within the pages checked, information about the service is mainly scattered across general pages. One confirmed competitor uses a dedicated page to explain the corresponding service."],
  ["Judgment", "The client’s approach to presenting this service deserves investigation. A competitor’s dedicated page does not, by itself, explain its rankings."],
  ["Recommended action", "First check whether an existing page was missed. If one exists, assess how to improve it. If the gap is confirmed, consider adding a dedicated service page."],
  ["Client confirmation", "Is this a priority service for the business? Can the business deliver it? Is there enough business-specific material to support the page?"],
];

const eyebrow = "text-xs font-bold uppercase leading-6 tracking-[0.18em] text-[#526c16]";
const bodyText = "text-base leading-7 text-[#586452]";
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#526c16]";

export function MethodOverview() {
  return (
      <section aria-labelledby="method-title" className="method-hero border-b border-[#d8ddcf] bg-[#f3f4ed] px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="method-hero-grid">
            <div className="method-hero-copy">
              <p className={eyebrow}>Our method / Built for local SEO work</p>
              <h1 id="method-title" className="mt-5 text-balance font-[family-name:Georgia] tracking-[-0.04em]">
                Win the client with a real business problem. Turn the evidence into work you can deliver.
              </h1>
              <p className={`hero-copy mt-7 max-w-3xl ${bodyText}`}>Before analytics access, use the website, public business information and confirmed competitors to find problems worth discussing. Once Search Console and GA4 are connected, test the judgment, set priorities and prepare work the SEO can review and the client can understand.</p>

              <dl className="method-value-list mt-8">
                {professionalValue.map(([title, description], index) => <div key={title}>
                  <dt><span aria-hidden="true">0{index + 1}</span>{title}</dt>
                  <dd>{description}</dd>
                </div>)}
              </dl>

              <div className="method-hero-actions mt-8">
                <a href="#method-outputs" className="method-action method-action-primary">See what you get <ArrowDown aria-hidden="true" size={17} /></a>
                <Link href="/sample-report" className="method-action method-action-secondary">View the full report sample <ArrowRight aria-hidden="true" size={17} /></Link>
              </div>
            </div>

            <aside className="method-decision-preview" aria-labelledby="method-decision-title">
              <p>Method example · Fictional case</p>
              <h2 id="method-decision-title">One question becomes a defensible work decision.</h2>
              <dl>
                <div><dt>Initial question</dt><dd>Does this core service need a new standalone page?</dd></div>
                <div><dt>What the investigation adds</dt><dd>A corresponding page already exists, receives relevant search visits and still leaves service and contact information unclear.</dd></div>
                <div className="method-decision-result"><dt>Work decision</dt><dd>Improve the existing service page before creating a possible duplicate.</dd></div>
              </dl>
              <div className="method-decision-why"><strong>Why this is stronger</strong><p>Existing demand, a specific problem and a confirmed business priority point to the same target—not merely to a competitor difference.</p></div>
              <p className="method-case-limit">Illustrated reasoning, not a real client result. Search visits do not prove the cause of lost enquiries.</p>
            </aside>
          </div>

          <section aria-labelledby="method-work-title" className="method-work-journey">
            <div className="method-section-intro"><p className={eyebrow}>From sale to delivery</p><h2 id="method-work-title">One evidence trail across the client relationship.</h2><p>Each stage starts with different information, but it keeps the problem, the reason and the next decision connected.</p></div>
            <ol>
              {workStages.map((stage, index) => <li key={stage.label}>
                <article>
                  <div className="method-stage-number"><span>0{index + 1}</span><i aria-hidden="true" /></div>
                  <p className="method-stage-label">{stage.label}</p>
                  <h3>{stage.title}</h3>
                  <dl><div><dt>Evidence in</dt><dd>{stage.evidence}</dd></div><div><dt>Decision</dt><dd>{stage.decision}</dd></div></dl>
                  <p className="method-stage-output"><span>You get</span>{stage.output}</p>
                </article>
              </li>)}
            </ol>
          </section>

          <section id="method-outputs" aria-labelledby="method-outputs-title" className="method-output-shelf">
            <div><p className={eyebrow}>What you leave with</p><h2 id="method-outputs-title">Not another audit checklist. A working set of decisions.</h2><p>SearchTrust organizes the evidence and working detail. You keep the final professional judgment.</p></div>
            <ol>{methodOutputs.map(([number, title, description]) => <li key={title}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol>
            <a href="#prospect-diagnosis" className="method-action method-action-scroll">See how the Prospect Diagnosis is built <ArrowDown aria-hidden="true" size={17} /></a>
          </section>
        </div>
      </section>
  );
}

export function MethodProspect() {
  return (
      <section aria-labelledby="prospect-diagnosis" className="bg-white px-5 py-16 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <p className={eyebrow}>Prospect / Before analytics access</p>
          <h2 id="prospect-diagnosis" className="mt-4 max-w-4xl scroll-mt-28 text-balance font-[family-name:Georgia] text-4xl leading-tight tracking-[-0.04em] sm:text-5xl">
            Before you have analytics access, find problems worth discussing with the client.
          </h2>
          <p className={`mt-6 max-w-3xl ${bodyText}`}>Start with the prospect’s services, target locations and website. Use public business information and confirmed competitors to examine how the business serves search demand and explains its offering. Identify problems worth addressing in the first phase of work.</p>

          <div className="mt-14 border-t border-[#d8ddcf] pt-8">
            <h3 className="max-w-4xl text-2xl font-semibold leading-9 tracking-[-0.025em] sm:text-3xl"><span className="text-[#526c16]">01 / </span>First, establish who competes for the same demand.</h3>
            <p className={`mt-4 max-w-3xl ${bodyText}`}>Finding another website in the industry is not enough. First confirm whether the client and competitor share a relevant service, location and search context.</p>
            <dl className="method-context-strip mt-6">
              {contextChecks.map(([label, question]) => (
                <div key={label} className="border-l-2 border-[#cbd8b5] pl-5">
                  <dt className="text-base font-bold">{label}</dt>
                  <dd className={`mt-2 max-w-lg ${bodyText}`}>{question}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 max-w-4xl text-sm leading-7 text-[#586452]">Keep the query and location attached to the observation, and distinguish organic search from local results. Competitors provide market context—not proof that copying their pages will improve rankings.</p>
          </div>

          <div className="method-check-grid"><div>
            <h3 className="max-w-4xl text-2xl font-semibold leading-9 tracking-[-0.025em] sm:text-3xl"><span className="text-[#526c16]">02 / </span>Follow the demand through to why someone would choose this business.</h3>
            <div className="mt-6">
              {pageChecks.map((check) => (
                <article key={check.title} className="diagnosis-row">
                  <h4 className="font-semibold tracking-[-0.02em]">{check.title}</h4>
                  <dl>
                    <div><dt className="text-sm font-bold text-[#526c16]">What we check</dt><dd className={`mt-2 ${bodyText}`}>{check.evidence}</dd></div>
                    <div><dt className="text-sm font-bold text-[#526c16]">What it helps decide</dt><dd className={`mt-2 ${bodyText}`}>{check.decision}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
            <p className="mt-8 max-w-4xl border-l-2 border-[#94b92c] pl-5 text-sm leading-7 text-[#586452]">The eight-layer trust model helps diagnose page content and credibility. It is one part of the method; business context, competition and subsequent performance data also inform the judgment.</p>
          </div>

          <div>
            <h3 className="max-w-4xl text-2xl font-semibold leading-9 tracking-[-0.025em] sm:text-3xl"><span className="text-[#526c16]">03 / </span>Go beyond identifying the problem. Explain what to do.</h3>
            <p className={`mt-4 max-w-3xl ${bodyText}`}>Connect the specific target, observed evidence, judgment and recommendation. Keep the conditions that need client confirmation visible, rather than turning every apparent gap into an execution task.</p>
            <article aria-labelledby="prospect-example-title" className="mt-8 bg-[#f0f3e8] p-6 sm:p-9 lg:p-10">
              <p className={eyebrow}>Method example · Not a real client result</p>
              <h4 id="prospect-example-title" className="mt-3 font-[family-name:Georgia] text-3xl leading-tight tracking-[-0.025em] sm:text-4xl">Does this service need a dedicated page?</h4>
              <dl className="mt-7 divide-y divide-[#d3dbc7] border-y border-[#d3dbc7]">
                {exampleRows.map(([label, content]) => (
                  <div key={label} className={`grid gap-2 py-5 md:grid-cols-[10rem_minmax(0,1fr)] md:gap-8 ${label === "Recommended action" ? "border-l-4 border-l-[#637e16] bg-[#e4ebd7] px-4" : "px-4"}`}>
                    <dt className="text-sm font-bold leading-7">{label}</dt>
                    <dd className={`max-w-3xl ${bodyText}`}>{content}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </div></div>

          <div className="mt-14 border-t border-[#d8ddcf] pt-8">
            <h3 className="max-w-4xl text-2xl font-semibold leading-9 tracking-[-0.025em] sm:text-3xl">Bring evidence to the first phase of work.</h3>
            <div className={`mt-4 max-w-3xl space-y-4 ${bodyText}`}>
              <p>Get findings specific to this business, traceable observations and three priority actions. Explain which pages or business details need attention, why the work is worth doing and which conditions still need client confirmation.</p>
              <p>Once the client connects analytics, test these judgments further and adjust the priorities.</p>
            </div>
            <ul className="mt-7 grid gap-5 lg:grid-cols-3">
              {[["Specific findings", "Where the problem is."], ["Supporting evidence", "Why the judgment was made."], ["Priority actions", "What to do in the first phase."]].map(([label, description]) => (
                <li key={label} className="border-t border-[#d8ddcf] pt-4 text-sm leading-7"><strong>{label}:</strong> <span className="text-[#586452]">{description}</span></li>
              ))}
            </ul>
            <p className="mt-7 max-w-3xl text-sm leading-7 text-[#586452]">Public evidence supports a proposal. It does not establish the client’s private traffic, lead quality or revenue.</p>
            <Link href="/sample-report" className={`mt-6 inline-flex min-h-12 items-center gap-3 rounded-lg bg-[#172018] px-6 py-3 text-sm font-bold text-white hover:bg-[#30402b] ${focusRing}`}>
              View a sample report <ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" />
            </Link>
          </div>
        </div>
      </section>
  );
}

// Keep the standalone composition available for component previews and tests.
export function MethodIntro() {
  return <><MethodOverview /><MethodJourney><MethodNavigation /><MethodProspect /></MethodJourney></>;
}
