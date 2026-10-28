import {
  ArrowRight,
  ChevronDown,
  ClipboardCheck,
  FileSearch,
  ShieldCheck,
} from "lucide-react";
import type { DeliveryPlanAction } from "@/lib/report-delivery/plan";
import {
  sampleCase,
  stageChanges,
  type Chapter,
  type Deliverable,
} from "./deliverable-content";
import type { ReactNode } from "react";
import s from "./sample-deliverable.module.css";

export function ActionDetails({ action }: { action: DeliveryPlanAction }) {
  return (
    <dl className={s.actionFields}>
      {[
        ["Target / scope", action.target],
        ["Execution steps", action.steps],
        ["Completion standard", action.completion],
        ["Suggested owner", action.owner],
        ["Timing", action.schedule],
        ["Follow-up", action.review],
      ].map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value || "To be agreed"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReportDocument({
  report,
  onNext,
  chapter,
  navigation,
}: {
  report: Deliverable;
  onNext?: () => void;
  chapter?: Chapter;
  navigation?: ReactNode;
}) {
  const prefix = `sample-${report.stage}`;
  return (
    <article className={s.paper} aria-label={`${report.name} document`}>
      <header className={s.cover}>
        <div className={s.documentBar}>
          <span>
            <FileSearch size={16} aria-hidden="true" /> SEARCHTRUST
          </span>
          <span>REPORT {report.stage === "prospect" ? "01" : "02"} / 02</span>
        </div>
        <h3>{report.name}</h3>
        <dl className={s.identity}>
          <div>
            <dt>Prepared for</dt>
            <dd>{sampleCase.name}</dd>
          </div>
          <div>
            <dt>Core service</dt>
            <dd>Air-conditioning repair</dd>
          </div>
          <div>
            <dt>Service area</dt>
            <dd>Local coverage to confirm</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>Proposed work · review required</dd>
          </div>
        </dl>
        <p className={s.scope}>
          <strong>Available basis</strong>
          {report.scope}
        </p>
      </header>
      <div className={s.documentBody}>
        <section
          id={`${prefix}-summary`}
          className={s.reportSection}
          hidden={!!chapter && chapter !== "summary"}
          tabIndex={-1}
          aria-label="Summary"
        >
          <p className={s.eyebrow}>01 / Summary</p>
          <h4>{report.headline}</h4>
          {report.stage === "verified" && (
            <div className={s.changes}>
              <p className={s.smallHeading}>
                What changed from the first report?
              </p>
              <dl>
                {stageChanges.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {report.summary.map((text) => (
            <p key={text}>{text}</p>
          ))}
          <div className={s.recommendation}>
            <ClipboardCheck size={20} aria-hidden="true" />
            <div>
              <strong>
                Recommended{" "}
                {report.stage === "prospect" ? "first step" : "work"}
              </strong>
              <p>{report.decision}</p>
            </div>
          </div>
          <p className={s.caution}>
            <ShieldCheck size={16} aria-hidden="true" />
            {report.caution}
          </p>
        </section>
        <section
          id={`${prefix}-evidence`}
          className={s.reportSection}
          hidden={!!chapter && chapter !== "evidence"}
          tabIndex={-1}
          aria-label="Evidence & open questions"
        >
          <p className={s.eyebrow}>02 / Evidence & open questions</p>
          <h4>The basis for the recommendation.</h4>
          <div className={s.evidenceList}>
            {report.evidence.map((item, i) => (
              <div className={s.evidence} key={item.source}>
                <span className={s.index}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h5>{item.source}</h5>
                  <p>{item.finding}</p>
                  <p className={s.supports}>
                    <strong>Supports:</strong> {item.supports}
                  </p>
                  <p className={s.pending}>
                    <strong>Still to confirm:</strong> {item.pending}
                  </p>
                  <details className={s.disclosure}>
                    <summary>
                      Inspect the basis{" "}
                      <ChevronDown size={15} aria-hidden="true" />
                    </summary>
                    <dl className={s.actionFields}>
                      <div>
                        <dt>Checked scope</dt>
                        <dd>{item.scope}</dd>
                      </div>
                    </dl>
                  </details>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section
          id={`${prefix}-actions`}
          className={s.reportSection}
          hidden={!!chapter && chapter !== "actions"}
          tabIndex={-1}
          aria-label="Proposed actions"
        >
          <p className={s.eyebrow}>03 / Proposed actions</p>
          <h4>Three actions to review first.</h4>
          <p>
            {report.stage === "prospect"
              ? "Use these to agree on a responsible first scope. Confirm the conditions before treating them as implementation tasks."
              : "Confirm owners, dependencies and timing before approval. Measurement checks may need to happen before the page changes go live."}
          </p>
          <ol className={s.actions}>
            {report.actions.map((action, i) => (
              <li key={action.actionId}>
                <div className={s.actionTitle}>
                  <span className={s.index}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h5>{action.title}</h5>
                </div>
                <ActionDetails action={action} />
              </li>
            ))}
          </ol>
        </section>
        <section
          id={`${prefix}-inputs`}
          className={s.reportSection}
          hidden={!!chapter && chapter !== "inputs"}
          tabIndex={-1}
          aria-label="Client input"
        >
          <p className={s.eyebrow}>04 / Client input</p>
          <h4>
            {report.stage === "prospect"
              ? "What we need to confirm with you."
              : "What we need before work proceeds."}
          </h4>
          <ul className={s.inputList}>
            {report.inputs.map((input) => (
              <li key={input}>{input}</li>
            ))}
          </ul>
        </section>
        <section
          id={`${prefix}-review`}
          className={s.reportSection}
          hidden={!!chapter && chapter !== "review"}
          tabIndex={-1}
          aria-label="Review & limits"
        >
          <p className={s.eyebrow}>05 / Review & limits</p>
          <h4>Keep completion and results separate.</h4>
          <dl className={s.actionFields}>
            {report.review.map((item) => (
              <div key={item.title}>
                <dt>{item.title}</dt>
                <dd>{item.detail}</dd>
              </div>
            ))}
          </dl>
          <div className={s.limitBox}>
            <strong>What this report does not claim</strong>
            <ul>
              {report.limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      {navigation || (
        <footer className={s.paperFooter}>
          <span>SEO review before client delivery</span>
          {onNext ? (
            <button className={s.secondary} type="button" onClick={onNext}>
              See what changes after access{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ) : (
            <a className={s.secondary} href="#plan-review">
              Try reviewing this plan{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </a>
          )}
        </footer>
      )}
    </article>
  );
}
