"use client";

import { useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Files, Search, MapPin, ChartNoAxesCombined } from "lucide-react";
import { sampleCase, sampleReports, type ReportStage } from "@/components/sampleReport/sample-report-data";
import styles from "./report-outcome.module.css";

const subscribe = () => () => {};

// Homepage summaries of the same fictional case, not new findings or outcomes.
const summaries: Record<ReportStage, {
  decision: string;
  evidence: { title: string; detail: string; icon: typeof Search }[];
  actions: { title: string; detail: string }[];
  confirmation: string;
}> = {
  prospect: {
    decision: "Confirm the existing page before creating a new one.",
    evidence: [
      { title: "Service details are scattered", detail: "Across the public pages checked.", icon: Files },
      { title: "A competitor has a dedicated page", detail: "A comparison to investigate—not a reason to copy.", icon: Search },
    ],
    actions: [
      { title: "Confirm the target page", detail: "Check the existing URL and business priority." },
      { title: "Clarify the service and contact step", detail: "Improve approved details on the right page." },
      { title: "Test the judgment after access", detail: "Check search demand and measurement before fixing priorities." },
    ],
    confirmation: "Existing URL, service area, service process and approved business materials.",
  },
  verified: {
    decision: "Improve the confirmed service page. Don't create a duplicate.",
    evidence: [
      { title: "The client confirms an existing page", detail: "For a service that matters to the business.", icon: MapPin },
      { title: "Relevant searches reach that page", detail: "Illustrative GSC exposure and clicks—not proof of lost enquiries.", icon: ChartNoAxesCombined },
    ],
    actions: [
      { title: "Approve the service information", detail: "Confirm coverage, process and business details." },
      { title: "Make the contact route work", detail: "Clarify the next step and test the updated page." },
      { title: "Set up a reliable review", detail: "Check key events; agree a baseline and review window." },
    ],
    confirmation: "Service details, supporting materials, page-copy approval and parallel site changes.",
  },
};

export function ReportOutcomePreview() {
  const [activeIndex, setActiveIndex] = useState(0);
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = (index + 1) % sampleReports.length; break;
      case "ArrowLeft": next = (index - 1 + sampleReports.length) % sampleReports.length; break;
      case "Home": next = 0; break;
      case "End": next = sampleReports.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setActiveIndex(next);
    tabs.current[next]?.focus();
  }

  return (
    <section id="report-outcome" className={styles.section} aria-labelledby="output-title">
      <div className={styles.inner}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>THE DELIVERABLE / ONE CASE, TWO REPORTS</p>
          <h2 id="output-title">A proposal to discuss.<br />A work plan to review.</h2>
          <p>See what you can put in front of a client—from a public-evidence proposal to a more informed plan after data access.</p>
        </header>

        <div className={styles.reader}>
          <div className={styles.tabs} role="tablist" aria-label="Choose a sample report">
            {sampleReports.map((report, index) => (
              <button key={report.stage} id={"output-tab-" + report.stage} type="button" role="tab"
                className={styles.tab} ref={(element) => { tabs.current[index] = element; }}
                aria-selected={activeIndex === index} aria-controls={"output-panel-" + report.stage}
                tabIndex={activeIndex === index ? 0 : -1} disabled={!hydrated}
                onClick={() => setActiveIndex(index)} onKeyDown={(event) => handleKey(event, index)}>
                <span className={styles.tabNumber}>{report.number}</span>
                <span><strong>{report.name}</strong><small>{index === 0 ? "Discuss the first scope" : "Review the next priority"}</small></span>
                <FileText size={19} strokeWidth={1.6} aria-hidden="true" />
              </button>
            ))}
          </div>
          {sampleReports.map((report, index) => {
            const summary = summaries[report.stage];
            return (
              <div key={report.stage} id={"output-panel-" + report.stage} className={styles.panel}
                role="tabpanel" aria-labelledby={"output-tab-" + report.stage} hidden={activeIndex !== index}
                tabIndex={activeIndex === index ? 0 : -1}>
                <article className={styles.paper} aria-labelledby={"output-" + report.stage + "-title"}>
                  <header className={styles.paperHeader}>
                    <div className={styles.topline}><span><FileText size={16} aria-hidden="true" /> SEARCHTRUST</span><span>Fictional case · summary preview</span></div>
                    <div className={styles.identity}><h3 id={"output-" + report.stage + "-title"}>{report.name}</h3><span>{sampleCase.service}</span></div>
                  </header>

                  <div className={styles.body}>
                    <section className={styles.summary} aria-labelledby={"output-" + report.stage + "-summary"}>
                      <p className={styles.chapter}>{report.stage === "prospect" ? "THE FIRST RECOMMENDATION" : "REVISED AFTER CLIENT CONFIRMATION + DATA ACCESS"}</p>
                      <h4 id={"output-" + report.stage + "-summary"}>{summary.decision}</h4>
                    </section>
                    <div className={styles.details}>
                      <section className={styles.basis} aria-labelledby={"output-" + report.stage + "-evidence"}>
                        <h5 id={"output-" + report.stage + "-evidence"} className={styles.chapter}>THE SUPPORTING BASIS</h5>
                        <ul className={styles.evidence}>{summary.evidence.map((item) => {
                          const Icon = item.icon;
                          return <li key={item.title}><span className={styles.evidenceIcon}><Icon size={19} strokeWidth={1.6} aria-hidden="true" /></span><div><strong>{item.title}</strong><p>{item.detail}</p></div></li>;
                        })}</ul>
                      </section>
                      <section className={styles.plan} aria-labelledby={"output-" + report.stage + "-plan"}>
                        <h5 id={"output-" + report.stage + "-plan"} className={styles.chapter}>THREE ACTIONS FOR REVIEW</h5>
                        <ol>{summary.actions.map((action, actionIndex) => <li key={action.title}><span aria-hidden="true">0{actionIndex + 1}</span><div><strong>{action.title}</strong><p>{action.detail}</p></div></li>)}</ol>
                      </section>
                    </div>
                    <dl className={styles.boundaries}>
                      <div><dt>To confirm</dt><dd>{summary.confirmation}</dd></div>
                      <div><dt>Not established</dt><dd>{report.limits[1]}</dd></div>
                    </dl>
                  </div>
                  <footer className={styles.paperFooter}>
                    <div><span className={styles.statusDot} aria-hidden="true" /><p><strong>Proposed · not implemented</strong><span>SEO review required before delivery</span></p></div>
                    <Link href={"/sample-report#sample-" + report.stage} className={styles.readLink}>Read this complete report <ArrowRight size={17} aria-hidden="true" /></Link>
                  </footer>
                </article>
              </div>
            );
          })}
        </div>
        <p className={styles.editNote}>Inspect the finding, its supporting basis and the proposed work. This fictional example demonstrates the report structure—not measured client results.</p>
      </div>
    </section>
  );
}
