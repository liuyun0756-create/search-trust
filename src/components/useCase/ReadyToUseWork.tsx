import Link from "next/link";
import { ArrowRight, ClipboardList, FileText, SearchCheck } from "lucide-react";
import type { ClientWorkExample } from "./client-work-example";
import { ClientDeliveryPreview } from "./ClientDeliveryPreview";
import s from "./client-work-preview.module.css";

export function ReadyToUseWork({
  example,
}: {
  example: ClientWorkExample;
}) {
  return (
    <section className={s.readySection} aria-labelledby="ready-work-title">
      <header className={s.readyHeading}>
        <p className={s.kicker}>Less preparation. More client work.</p>
        <h2 id="ready-work-title">From analysis to client-ready work.</h2>
        <p>
          Findings, evidence, execution steps and a client explanation—organized
          into a report and action plan, without rebuilding the material from a
          checklist.
        </p>
      </header>

      <div className={s.readyRail}>
        <span>Sample report</span>
        <span>{example.business.name}</span>
        <span>{example.page.path}</span>
      </div>

      <div className={s.workChapter}>
        <div className={s.chapterHeading}>
          <span className={s.chapterNumber}>01</span>
          <div>
            <p className={s.kicker}>The diagnosis record</p>
            <h3>Findings you can explain.</h3>
          </div>
          <SearchCheck size={25} aria-hidden="true" />
        </div>
        <div className={s.findingFrame}>
          <div className={s.findingLead}>
            <p className={s.documentOverline}>Finding 01 · Service page clarity</p>
            <h4>{example.decision.finding}</h4>
            <p>
              Checked page: <span>{example.page.address}</span>
            </p>
          </div>
          <div className={s.findingGrid}>
            <div className={s.evidenceRecords}>
              <div className={s.columnLabel}>ID / Source <span>Observed evidence</span></div>
              {example.evidence.map((evidence) => (
                <div className={s.evidenceRecord} key={evidence.id}>
                  <div>
                    <span>{evidence.id}</span>
                    <strong>{evidence.source}</strong>
                  </div>
                  <p>{evidence.observation}</p>
                </div>
              ))}
            </div>
            <aside className={s.decisionPanel} aria-label="Recommendation and limits">
              <div>
                <p className={s.kicker}>Recommendation</p>
                <h5>Improve the existing page first.</h5>
                <p>{example.decision.recommendation}</p>
              </div>
              <div>
                <strong>Why this is a practical first action</strong>
                <p>{example.decision.practicalReason}</p>
              </div>
              <div>
                <strong>What the evidence does not establish</strong>
                <p>{example.decision.evidenceLimit}</p>
              </div>
            </aside>
          </div>
        </div>
        <p className={s.valueLine}>
          The reason for the recommendation is already beside the work—not left
          for you to reconstruct.
        </p>
      </div>

      <div className={s.workChapter}>
        <div className={s.chapterHeading}>
          <span className={s.chapterNumber}>02</span>
          <div>
            <p className={s.kicker}>The execution brief</p>
            <h3>Actions with the next steps included.</h3>
          </div>
          <ClipboardList size={25} aria-hidden="true" />
        </div>
        <div className={s.actionFrame}>
          <div className={s.actionHead}>
            <p className={s.documentOverline}>
              Action 01 · Update the existing service page
            </p>
            <h4>{example.action.title}</h4>
            <p>{example.action.goal}</p>
            <div className={s.actionMeta}>
              <div><span>Target</span><strong>{example.action.target}</strong></div>
              <div><span>Suggested priority</span><strong>{example.action.priority}</strong></div>
              <div><span>Suggested implementation role</span><strong>{example.action.role}</strong></div>
              <div><span>Status</span><strong>{example.implementationStatus}</strong></div>
            </div>
          </div>
          <div className={s.actionGrid}>
            <div>
              <p className={s.columnLabel}>Work steps</p>
              <ol className={s.workSteps}>
                {example.action.steps.map((step, index) => (
                  <li key={step.title}>
                    <span>0{index + 1}</span>
                    <div><strong>{step.title}</strong><p>{step.text}</p></div>
                  </li>
                ))}
              </ol>
            </div>
            <div className={s.actionSide}>
              <div>
                <p className={s.columnLabel}>Done means</p>
                <ul className={s.completionList}>
                  {example.action.completion.map((item) => (
                    <li key={item}><span aria-hidden="true" />{item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className={s.columnLabel}>Review arrangement</p>
                <dl className={s.reviewList}>
                  {example.action.review.map((item) => (
                    <div key={item.title}><dt>{item.title}</dt><dd>{item.text}</dd></div>
                  ))}
                </dl>
              </div>
            </div>
          </div>
        </div>
        <p className={s.valueLine}>
          The recommendation already includes the target, steps and completion
          checks for a work handoff.
        </p>
      </div>

      <div className={s.workChapter}>
        <div className={s.chapterHeading}>
          <span className={s.chapterNumber}>03</span>
          <div>
            <p className={s.kicker}>The client delivery</p>
            <h3>A report you can review and share.</h3>
          </div>
          <FileText size={25} aria-hidden="true" />
        </div>
        <ClientDeliveryPreview example={example} />
        <Link className={s.fullSampleLink} href="/sample-report">
          View the complete sample reports <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>

      <aside className={s.flexibilityNote}>
        <div>
          <p className={s.kicker}>Professional review</p>
          <h3>Ready to use. Flexible when needed.</h3>
          <p>
            When the plan fits the client, review it and use the existing
            delivery flow. When circumstances call for a change, adjust the
            action order, scope, steps and arrangements without rebuilding the
            plan.
          </p>
        </div>
        <div>
          <ul>
            {[
              "Order",
              "Action scope",
              "Steps",
              "Owner & timing",
              "Completion & review",
            ].map((label) => <li key={label}>{label}</li>)}
          </ul>
          <small>
            Adjusting an action does not rewrite its original evidence.
          </small>
        </div>
      </aside>
    </section>
  );
}
