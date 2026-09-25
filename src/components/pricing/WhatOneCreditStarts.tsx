import { ArrowRight, Check } from "lucide-react";
import { Fragment } from "react";

import styles from "./pricing-v22.module.css";

const creditJourney = [
  { title: "Prepare the Case", detail: "Enter the site, confirm the business and define the scope.", cost: "Free", charge: "free" },
  { title: "Prospect Analysis", detail: "Generate the public-evidence diagnosis and first three actions.", cost: "1 credit", charge: "credit" },
  { title: "Connect client data", detail: "Connect or synchronise eligible Search Console and GA4 data.", cost: "Free", charge: "free" },
  { title: "Verified Action Plan", detail: "Test the original view and generate the next work plan.", cost: "1 credit", charge: "credit" },
  { title: "Review and deliver", detail: "Review, share or download an existing report.", cost: "Free", charge: "free" },
];

const workflows = [
  {
    step: "01 / Win the work",
    name: "Prospect Analysis",
    description: "Use public evidence to identify specific problems worth discussing before the client shares private performance data.",
    items: ["Business-specific findings", "Traceable public evidence", "Three first-phase actions", "SEO and client report views"],
  },
  {
    step: "02 / Serve the client",
    name: "Verified Action Plan",
    description: "Connect eligible Search Console and GA4 evidence to test the diagnosis and decide what should happen next.",
    items: ["Confirmed, revised or open judgments", "Three priority actions", "Execution requirements", "A defined review method"],
  },
];

const mixes = [
  {
    number: "01",
    title: "Prospecting across five businesses",
    formula: ["5 × Prospect Analysis"],
    copy: "Use all five included credits to prepare five separate evidence-based prospect conversations.",
  },
  {
    number: "02",
    title: "Two continuous client journeys",
    formula: ["2 × Prospect", "2 × Verified", "1 credit left"],
    copy: "Take two Cases from public diagnosis into a client-data-informed action plan, while keeping one credit available.",
  },
  {
    number: "03",
    title: "Any mix across any Case",
    formula: ["One shared balance", "No package choice"],
    copy: "Use the balance around your actual pipeline. Credits are not pre-assigned to a workflow or tied to one client.",
  },
];

const charged = [
  "Start one complete Prospect Analysis.",
  "Start one complete Verified Action Plan generation.",
  "Start another new generation after a previous result or returned credit.",
];

const included = [
  "Enter a website and confirm the business.",
  "Connect or synchronise Search Console and GA4.",
  "Add or correct a competitor while the current workflow remains active.",
  "Resume the same active workflow.",
  "Review, share or download an existing report.",
];

export function WhatOneCreditStarts() {
  return (
    <div className={styles.pricingBody}>
      <section className={styles.journeySection} aria-labelledby="credit-journey-title">
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>One Case / clear credit boundaries</p>
          <h2 id="credit-journey-title" className={styles.sectionTitle}>Credits pay for complete analysis—not every step around it.</h2>
          <p className={styles.sectionIntro}>Preparation, data connections and delivery stay available around the work. A credit is used only when SearchTrust starts one complete Prospect Analysis or Verified Action Plan generation.</p>

          <div className={styles.creditRail} aria-label="How credits are used through one client Case">
            {creditJourney.map((step, index) => (
              <article className={styles.railStep} data-charge={step.charge} key={step.title}>
                <div className={styles.railTop}><span>{String(index + 1).padStart(2, "0")}</span><span className={styles.costTag}>{step.cost}</span></div>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
          <p className={styles.railRule}><span aria-hidden="true" />One credit starts one complete generation. It is not a charge for every preparation, connection or delivery action.</p>
        </div>
      </section>

      <section className={styles.workflowSection} aria-labelledby="workflow-title">
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Two paid moments / one continuous Case</p>
          <h2 id="workflow-title" className={styles.sectionTitle}>Win the work, then continue with client evidence.</h2>
          <p className={styles.sectionIntro}>The two workflows answer different questions at different stages. The second continues the same Case instead of replacing the original diagnosis.</p>

          <div className={styles.workflowPair}>
            {workflows.map((workflow, index) => (
              <Fragment key={workflow.name}>
                <article className={styles.workflow}>
                  <div className={styles.workflowMeta}><span>{workflow.step}</span><span>1 credit</span></div>
                  <h3>{workflow.name}</h3>
                  <p>{workflow.description}</p>
                  <ul>{workflow.items.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul>
                </article>
                {index === 0 ? <div className={styles.workflowArrow} aria-hidden="true"><ArrowRight /></div> : null}
              </Fragment>
            ))}
          </div>
          <p className={styles.continuityNote}>The original question, evidence and limits remain visible when the Case moves into the verified stage.</p>
        </div>
      </section>

      <section className={styles.mixSection} aria-labelledby="credit-mix-title">
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>Five included credits / used your way</p>
          <h2 id="credit-mix-title" className={styles.sectionTitle}>Five credits can follow the way you actually work.</h2>
          <p className={styles.sectionIntro}>There is no package choice. The same permanent balance can support prospecting, ongoing service or a mixture of both.</p>
          <div className={styles.mixGrid}>
            {mixes.map((mix) => (
              <article className={styles.mixItem} key={mix.number}>
                <span>{mix.number}</span>
                <h3>{mix.title}</h3>
                <div className={styles.creditFormula}>{mix.formula.map((part) => <span key={part}>{part}</span>)}</div>
                <p>{mix.copy}</p>
              </article>
            ))}
          </div>
          <p className={styles.mixLimit}>These examples explain credit usage. They do not promise clients, rankings, traffic, enquiries or revenue.</p>
        </div>
      </section>

      <section className={styles.boundarySection} aria-labelledby="credit-boundary-title">
        <div className={styles.sectionInner}>
          <p className={styles.eyebrow}>One simple rule / visible exceptions</p>
          <h2 id="credit-boundary-title" className={styles.sectionTitle}>Know when a credit is used before you start.</h2>
          <div className={styles.boundaryGrid}>
            <section className={styles.boundaryColumn} aria-labelledby="uses-credit-title">
              <h3 id="uses-credit-title">Uses one credit</h3>
              <p>A new complete analysis or generation begins.</p>
              <ul>{charged.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>)}</ul>
            </section>
            <section className={styles.boundaryColumn} aria-labelledby="included-title">
              <h3 id="included-title">Does not use another credit</h3>
              <p>Prepare, continue or deliver work already in progress.</p>
              <ul>{included.map((item, index) => <li key={item}><span>{String(index + 1).padStart(2, "0")}</span>{item}</li>)}</ul>
            </section>
          </div>
          <p className={styles.boundaryRule}>A credit pays for a complete generation—not every preparation, connection, correction or delivery step around it.</p>
        </div>
      </section>
    </div>
  );
}
