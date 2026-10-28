"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { CapabilityReportDocument } from "../report/CapabilityReportDocument";
import type { SiteCandidate } from "@/lib/site-report-candidates/project";

const sections = [
  { label: "Overview", selector: "article > header" },
  { label: "Findings & sources", selector: '[aria-label="Findings"]' },
  { label: "Action plan", selector: '[aria-label="Action plan"]' },
  { label: "Review limits", selector: "article > footer" },
];

/** Isolated local review artifact. Not imported by public marketing routes. */
export function ReleaseReportPreview({ reports, notice }: { reports: SiteCandidate[]; notice: string }) {
  const [index, setIndex] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const report = reports[index];

  function select(next: number) {
    setIndex(next);
    if (panel.current) panel.current.scrollTop = 0;
  }
  function keys(event: KeyboardEvent, current: number) {
    const next = event.key === "ArrowRight" ? (current + 1) % reports.length
      : event.key === "ArrowLeft" ? (current + reports.length - 1) % reports.length
      : event.key === "Home" ? 0 : event.key === "End" ? reports.length - 1 : null;
    if (next === null) return;
    event.preventDefault(); select(next); tabRefs.current[next]?.focus();
  }
  function jump(selector: string) {
    const container = panel.current;
    const target = container?.querySelector<HTMLElement>(selector);
    if (!container || !target) return;
    container.scrollTop += target.getBoundingClientRect().top - container.getBoundingClientRect().top - 20;
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }

  return <main className="release-preview">
    <header className="release-heading">
      <span className="release-brand">Search<span>Trust</span> / Release review</span>
      <h1>See the evidence.<br /><span>Inspect the proposed work.</span></h1>
      <p>Read what the report generator actually produces: observations, source values, priorities and work you can review.</p>
      <small>{notice}</small>
    </header>
    <div className="release-tabs" role="tablist" aria-label="Report outcomes">
      {reports.map((item, i) => <button key={item.id} type="button" role="tab"
        id={`candidate-tab-${item.id}`} aria-controls={`candidate-panel-${item.id}`}
        aria-selected={index === i} tabIndex={index === i ? 0 : -1}
        ref={node => { tabRefs.current[i] = node; }} onClick={() => select(i)} onKeyDown={event => keys(event, i)}>
        <span>{String(i + 1).padStart(2, "0")}</span>{item.label}
      </button>)}
    </div>
    <section id={`candidate-panel-${report.id}`} role="tabpanel" aria-labelledby={`candidate-tab-${report.id}`}>
      <div className="release-context">
        <p>{report.context}</p>
        <dl aria-label="Report contents">
          <div><dt>Findings</dt><dd>{report.document.findings.length}</dd></div>
          <div><dt>Source values</dt><dd>{report.document.evidence.length}</dd></div>
          <div><dt>Actions</dt><dd>{report.document.actions.length}</dd></div>
        </dl>
      </div>
      <div className="release-reader">
        <nav aria-label="Report chapters" className="release-chapters">
          <p>In this report</p>
          {sections.map((section, i) => <button key={section.label} type="button" onClick={() => jump(section.selector)}>
            <span>{String(i + 1).padStart(2, "0")}</span>{section.label}
          </button>)}
          <aside>Review the original plan. Edits are optional. Approval and delivery happen in the report workspace.</aside>
        </nav>
        <div ref={panel} className="release-document" tabIndex={0} aria-label="Scrollable report">
          <CapabilityReportDocument key={report.id} document={report.document} />
        </div>
      </div>
    </section>
    <footer className="release-footer">Local review only · No account, analysis charge, approval or share is created here.</footer>
  </main>;
}
