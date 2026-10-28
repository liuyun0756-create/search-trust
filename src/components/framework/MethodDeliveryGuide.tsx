import Link from "next/link";
import { ArrowRight, FileText, Film, MousePointer2 } from "lucide-react";
import { sampleCase, sampleReports } from "../sampleReport/sample-report-data";
import { Heading } from "./method-guide-shared";
import styles from "./method-guide.module.css";
import ui from "./method-workflow.module.css";
import { ReportScrollRegion } from "./ReportScrollRegion";

const report = sampleReports.find((item) => item.stage === "verified")!;

/** Read-only presentation of the complete existing sample, not a second report or editor. */
function FullSampleReport() {
  return (
    <ReportScrollRegion className={ui.reportViewer}>
      <article className={ui.reportPaper}>
        <header className={ui.reportCover}>
          <p className={styles.eyebrow}>SearchTrust / Full fictional sample</p>
          <h3>{report.name}</h3>
          <p>{report.moment}</p>
          <dl>
            <div>
              <dt>Client</dt>
              <dd>{sampleCase.name}</dd>
            </div>
            <div>
              <dt>Service</dt>
              <dd>{sampleCase.service}</dd>
            </div>
          </dl>
          <p className={ui.note}>{sampleCase.note}</p>
        </header>
        <section>
          <span className={styles.eyebrow}>01 / Finding & recommendation</span>
          <h4>{report.client.headline}</h4>
          <p>{report.client.summary}</p>
          <p className={ui.reportDecision}>{report.client.decision}</p>
        </section>
        <section>
          <span className={styles.eyebrow}>02 / Supporting basis</span>
          <h4>The evidence behind the decision</h4>
          <p>{report.sourceScope}</p>
          <ol className={ui.reportEvidence}>
            {report.evidence.map((item) => (
              <li key={item.source}>
                <h5>{item.source}</h5>
                <p>{item.finding}</p>
                <p>
                  <strong>What it supports:</strong> {item.implication}
                </p>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <span className={styles.eyebrow}>03 / Judgment</span>
          <h4>What this means for the work</h4>
          <dl className={ui.reportJudgment}>
            {report.judgment.map((item) => (
              <div key={item.question}>
                <dt>{item.question}</dt>
                <dd>{item.answer}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section>
          <span className={styles.eyebrow}>04 / Proposed work</span>
          <h4>Three actions for review</h4>
          <p className={ui.note}>Proposed only · not implemented or reviewed</p>
          <ol className={ui.reportActions}>
            {report.client.actions.map((action, i) => (
              <li key={action}>
                <span>0{i + 1}</span>
                {action}
              </li>
            ))}
          </ol>
          <h5>What we need from you</h5>
          <p>{report.client.clientRequest}</p>
          <h5>How we will review it</h5>
          <p>{report.client.review}</p>
        </section>
        <section className={ui.reportLimits}>
          <span className={styles.eyebrow}>05 / Delivery boundary</span>
          <h4>What this report does not claim</h4>
          <ul>
            {report.limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
          <dl className={ui.reportJudgment}>
            {report.status.map((item) => (
              <div key={item.label}>
                <dt>{item.label}</dt>
                <dd>{item.detail}</dd>
              </div>
            ))}
          </dl>
        </section>
        <footer className={ui.note}>
          End of fictional sample · Review required before any real client
          delivery.
        </footer>
      </article>
    </ReportScrollRegion>
  );
}

export function MethodDeliveryGuide() {
  return (
    <section id="delivery-title" className={styles.section}>
      <Heading
        number="05"
        label="Reviewed delivery"
        title="Make the plan yours before you send it."
      >
        Review the findings, adapt the proposed actions to your client and check
        the report you are about to share.
      </Heading>
      <div className={ui.deliveryWorkspace}>
        <div className={ui.reportFrame}>
          <div className={ui.readerBar}>
            <span>
              <FileText size={17} aria-hidden="true" /> One report · all
              sections available
            </span>
            <span>Scroll to read</span>
          </div>
          <FullSampleReport />
        </div>
        <aside
          className={ui.editingGuide}
          aria-label="Review and editing walkthrough"
        >
          <div
            className={ui.videoPlaceholder}
            role="img"
            aria-label="Editing walkthrough video placeholder; no video available yet"
          >
            <span className={ui.filmIcon}>
              <Film size={34} aria-hidden="true" />
              <MousePointer2 size={19} aria-hidden="true" />
            </span>
            <strong>Editing walkthrough</strong>
            <p>Video will be added here.</p>
            <span>Reserved for a recording of the report workspace</span>
          </div>
          <h3>
            The report is the starting point.
            <br />
            You approve the plan.
          </h3>
          <ol className={ui.reviewSteps}>
            <li>
              <span>01</span>
              <div>
                <h4>Inspect the basis</h4>
                <p>
                  Check the finding, target, sources and unresolved conditions
                  before deciding what to recommend.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h4>Adjust the actions</h4>
                <p>
                  Edit order, title, scope, steps, completion criteria, owner,
                  schedule and review arrangements.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h4>Confirm the delivery version</h4>
                <p>
                  Save and approve the edited plan. Preview the client report
                  before creating a new PDF or share.
                </p>
              </div>
            </li>
          </ol>
          <div className={ui.editingBoundary}>
            <strong>What you can edit today</strong>
            <p>
              Current workspace editing covers the three-action plan, not all
              report text. Original observations do not change when you edit an
              action. A shared version stays pinned; later plan changes need a
              newly confirmed delivery version.
            </p>
          </div>
          <Link className={styles.secondary} href="/sample-report">
            Read both full report samples{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </section>
  );
}
