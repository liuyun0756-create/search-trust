"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ClipboardCheck,
  FileText,
  Fingerprint,
  PencilLine,
  ShieldCheck,
} from "lucide-react";
import { deliverables, sampleCase } from "./deliverable-content";
import s from "./delivery-showcase.module.css";

const steps = [
  {
    label: "Adapt the plan",
    icon: PencilLine,
    title: "Adapt the work to the client you know.",
    description:
      "Bring the client’s priorities, people and publishing constraints into the proposed work.",
    takeaway: "You edit the action plan. Original observations stay unchanged.",
  },
  {
    label: "Review delivery",
    icon: ClipboardCheck,
    title: "Check what your client will receive.",
    description:
      "Review the recommendation, the three actions and the open questions before approving the plan version.",
    takeaway: "Clearer for the client does not mean hiding the limits.",
  },
  {
    label: "Add your identity",
    icon: Fingerprint,
    title: "Put your professional identity on the PDF.",
    description:
      "Add your logo, name, client name and footer when exporting. Present the work with your professional identity.",
    takeaway:
      "Branding applies to that PDF export. SearchTrust identification remains.",
  },
];
const adjustments = [
  [
    "Work scope",
    "Clarify the existing repair-service page.",
    "Start with client-approved service coverage and the repair process.",
  ],
  [
    "Responsibility",
    "SEO scopes; client approves; publishing owner implements.",
    "SEO prepares the copy; the client confirms facts; the website owner publishes.",
  ],
  [
    "Completion & review",
    "Check the published page and revisit the same search scope.",
    "Check the live content and contact path, then review the same page over agreed comparison periods.",
  ],
];

export function DeliveryShowcase() {
  const [step, setStep] = useState(0);
  const [adapted, setAdapted] = useState(true);
  const [branded, setBranded] = useState(true);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 2
          : event.key === "ArrowRight"
            ? (index + 1) % 3
            : event.key === "ArrowLeft"
              ? (index + 2) % 3
              : null;
    if (next === null) return;
    event.preventDefault();
    setStep(next);
    tabs.current[next]?.focus();
  }
  return (
    <section
      id="plan-review"
      className={s.section}
      aria-labelledby="plan-review-title"
    >
      <header className={s.heading}>
        <p className={s.eyebrow}>From generated plan to client delivery</p>
        <h2 id="plan-review-title">
          Your judgment. Your name.
          <br />
          <span>Ready for your client.</span>
        </h2>
        <p>
          Review the evidence, adapt the action plan and approve what your
          client receives. Add your professional identity when exporting the
          PDF.
        </p>
      </header>
      <div className={s.showcase}>
        <div
          className={s.tabs}
          role="tablist"
          aria-label="Explore client delivery"
        >
          {steps.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                role="tab"
                id={`delivery-tab-${i}`}
                aria-controls={`delivery-panel-${i}`}
                aria-selected={step === i}
                tabIndex={step === i ? 0 : -1}
                ref={(node) => {
                  tabs.current[i] = node;
                }}
                onClick={() => setStep(i)}
                onKeyDown={(event) => keyDown(event, i)}
              >
                <span className={s.number}>0{i + 1}</span>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
                {i < 2 && (
                  <ArrowRight
                    className={s.tabArrow}
                    size={15}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
        {steps.map((item, i) => (
          <div
            key={item.label}
            id={`delivery-panel-${i}`}
            role="tabpanel"
            aria-labelledby={`delivery-tab-${i}`}
            hidden={step !== i}
            tabIndex={0}
            className={s.panel}
          >
            <div className={s.copy}>
              <p className={s.eyebrow}>0{i + 1} / Your professional call</p>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              {i === 0 && (
                <div className={s.context}>
                  <span>One practical adjustment</span>
                  <p>
                    The client approves the service facts. You define the copy
                    changes. Their website owner handles publishing.
                  </p>
                </div>
              )}
              {i === 1 && (
                <ol className={s.sequence}>
                  <li>
                    <span>1</span>Save your changes
                  </li>
                  <li>
                    <span>2</span>Check the client version
                  </li>
                  <li>
                    <span>3</span>Approve that plan version
                  </li>
                </ol>
              )}
              {i === 2 && (
                <ul className={s.brandItems}>
                  {[
                    "Your logo",
                    "Your professional name",
                    "Client name",
                    "Footer note",
                  ].map((text, j) => (
                    <li key={text}>
                      <span>0{j + 1}</span>
                      {text}
                    </li>
                  ))}
                </ul>
              )}
              <div className={s.boundary}>
                <ShieldCheck size={18} aria-hidden="true" />
                <p>{item.takeaway}</p>
              </div>
            </div>
            <div className={s.stage}>
              <div className={s.stageBar}>
                <span>
                  <FileText size={15} aria-hidden="true" /> Same Case · Verified
                  Action Plan
                </span>
                <small>Delivery illustration</small>
              </div>
              {i === 0 && (
                <>
                  <div
                    className={s.toggle}
                    role="group"
                    aria-label="Compare the action plan"
                  >
                    <button
                      type="button"
                      aria-pressed={!adapted}
                      onClick={() => setAdapted(false)}
                    >
                      Proposed plan
                    </button>
                    <button
                      type="button"
                      aria-pressed={adapted}
                      onClick={() => setAdapted(true)}
                    >
                      SEO adaptation
                    </button>
                  </div>
                  <article
                    className={s.paper}
                    aria-label="Action adaptation illustration"
                  >
                    <div className={s.paperTop}>
                      <span>Action 01 / Service page</span>
                      <span>
                        {adapted ? "SEO adaptation" : "Proposed work"}
                      </span>
                    </div>
                    <h4>Improve the confirmed repair-service page.</h4>
                    <dl className={s.adjustments}>
                      {adjustments.map(([label, before, after]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd className={adapted ? s.changed : undefined}>
                            {adapted && (
                              <PencilLine size={14} aria-hidden="true" />
                            )}
                            {adapted ? after : before}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className={s.evidenceLock}>
                      <ShieldCheck size={15} aria-hidden="true" /> Evidence and
                      source limits · unchanged
                    </div>
                  </article>
                </>
              )}
              {i === 1 && (
                <article
                  className={s.paper}
                  aria-label="Client report illustration"
                >
                  <div className={s.paperTop}>
                    <span>Verified Action Plan</span>
                    <span>Client reading view</span>
                  </div>
                  <h4>{deliverables.verified.headline}</h4>
                  <p className={s.paperIntro}>
                    Clarify the service and contact steps on the confirmed page,
                    rather than create a duplicate.
                  </p>
                  <div className={s.reviewLabel}>
                    <span>01 / Work scope</span>
                    <small>Three proposed actions</small>
                  </div>
                  <ol className={s.actionList}>
                    {deliverables.verified.actions.map((action, j) => (
                      <li key={action.actionId}>
                        <span>0{j + 1}</span>
                        {action.title}
                      </li>
                    ))}
                  </ol>
                  <div className={s.reviewRow}>
                    <span>02 / Completion check</span>
                    <p>
                      Before marking work complete, check the live content,
                      contact path and relevant event collection.
                    </p>
                  </div>
                  <div className={s.reviewRow}>
                    <span>03 / Client confirmation</span>
                    <p>
                      Confirm service details, the publishing owner and the
                      agreed review period.
                    </p>
                  </div>
                  <div className={s.limits}>
                    <ShieldCheck size={17} aria-hidden="true" />
                    <p>
                      {deliverables.verified.caution} Event meaning and
                      collection still need checking.
                    </p>
                  </div>
                </article>
              )}
              {i === 2 && (
                <>
                  <div
                    className={s.toggle}
                    role="group"
                    aria-label="Compare PDF identity"
                  >
                    <button
                      type="button"
                      aria-pressed={!branded}
                      onClick={() => setBranded(false)}
                    >
                      Default cover
                    </button>
                    <button
                      type="button"
                      aria-pressed={branded}
                      onClick={() => setBranded(true)}
                    >
                      With your identity
                    </button>
                  </div>
                  <article
                    className={`${s.paper} ${s.cover}`}
                    aria-label="PDF identity illustration"
                  >
                    <div className={s.coverBrand}>
                      {branded ? (
                        <>
                          <span className={s.logo}>
                            N<span>01</span>
                          </span>
                          <span>
                            NORTHLINE
                            <br />
                            <small>Independent SEO</small>
                          </span>
                          <span className={s.pin}>01</span>
                        </>
                      ) : (
                        <span>SEARCHTRUST</span>
                      )}
                    </div>
                    <p className={s.eyebrow}>Evidence-backed client work</p>
                    <h4>
                      Verified
                      <br />
                      Action Plan
                    </h4>
                    <div className={s.coverRule} />
                    <dl>
                      <div>
                        <dt>
                          Prepared for{" "}
                          {branded && <span className={s.pin}>03</span>}
                        </dt>
                        <dd>{sampleCase.name}</dd>
                      </div>
                      <div>
                        <dt>
                          Prepared by{" "}
                          {branded && <span className={s.pin}>02</span>}
                        </dt>
                        <dd>
                          {branded
                            ? "Northline · Independent SEO"
                            : "SearchTrust"}
                        </dd>
                      </div>
                    </dl>
                    <footer>
                      <span>
                        {branded
                          ? "Prepared for our next planning discussion."
                          : "Client action plan"}
                        {branded && <span className={s.pin}>04</span>}
                      </span>
                      <strong>SearchTrust</strong>
                    </footer>
                  </article>
                </>
              )}
            </div>
          </div>
        ))}
        <div className={s.footnote}>
          <Check size={16} aria-hidden="true" />
          <p>
            {step === 2
              ? "PDF branding is set for each export, is not saved and does not apply to online share links. Northline is an example professional identity."
              : step === 1
                ? "Review and approval happen in the workspace before delivery. Later edits do not update PDFs already downloaded."
                : "Illustrated changes only. In your workspace, you can adjust action order, scope, steps, completion criteria, owner, timing and review arrangements."}
          </p>
        </div>
      </div>
      <div className={s.cta}>
        <p>Bring your judgment to a real client Case.</p>
        <div>
          <Link href="/cases/new">
            Start a Prospect Case <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/cases/service">
            Continue with a client Case{" "}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
