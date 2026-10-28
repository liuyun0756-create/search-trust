import { ArrowRight, FileCheck2, FileSearch } from "lucide-react";
import type { ClientWorkExample } from "./client-work-example";
import s from "./client-work-preview.module.css";

export function ReportOutcomePreviews({
  example,
}: {
  example: ClientWorkExample;
}) {
  return (
    <div className={s.previews} role="region" aria-label="Two report outcomes">
      <p className={s.sampleLabel}>
        Sample report <span aria-hidden="true">·</span> {example.business.name}
      </p>
      <div className={s.previewGrid}>
        <article className={s.previewColumn}>
          <div className={s.previewIntro}>
            <p className={s.kicker}>Before you win the work</p>
            <h2>A prospect report you can take into the conversation.</h2>
          </div>
          <div className={s.reportSheet}>
            <div className={s.sheetHeader}>
              <FileSearch size={21} aria-hidden="true" />
              <div>
                <span>
                  {example.business.name} · {example.business.city}
                </span>
                <strong>Prospect Evidence Report</strong>
              </div>
              <small>01</small>
            </div>
            <h3>{example.prospect.conclusion}</h3>
            <ol className={s.previewFindings}>
              {example.prospect.findings.map((finding, index) => (
                <li key={finding.title}>
                  <span>0{index + 1}</span>
                  <p>
                    <strong>{finding.title}</strong> {finding.text}
                  </p>
                </li>
              ))}
            </ol>
            <div className={s.previewCallout}>
              <p>
                <strong>Start here</strong> {example.prospect.start}
              </p>
              <p>
                <strong>One question for the first call</strong>{" "}
                {example.prospect.question}
              </p>
            </div>
            <p className={s.previewLimit}>
              Public page observations only. Service priorities and current
              coverage still need client confirmation.
            </p>
          </div>
          <div className={s.previewFooter}>
            <p>{example.prospect.use}</p>
            <a href="#practice-first-conversation">
              Explore prospect situations <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </article>

        <article className={s.previewColumn}>
          <div className={s.previewIntro}>
            <p className={s.kicker}>Once the work begins</p>
            <h2>An action plan you can put to work.</h2>
          </div>
          <div className={`${s.reportSheet} ${s.verifiedSheet}`}>
            <div className={s.sheetHeader}>
              <FileCheck2 size={21} aria-hidden="true" />
              <div>
                <span>
                  {example.business.name} · {example.page.path}
                </span>
                <strong>Verified Action Plan</strong>
              </div>
              <small>02</small>
            </div>
            <h3>{example.verified.conclusion}</h3>
            <p className={s.verifiedBasis}>{example.verified.basis}</p>
            <ol className={s.previewFindings}>
              {example.verified.actions.map((action, index) => (
                <li key={action.title}>
                  <span>0{index + 1}</span>
                  <p>
                    <strong>{action.title}</strong> {action.text}
                  </p>
                </li>
              ))}
            </ol>
            <p className={s.previewLimit}>{example.verified.limit}</p>
          </div>
          <div className={s.previewFooter}>
            <p>{example.verified.use}</p>
            <a href="#practice-revisit-recommendation">
              Explore ongoing client work <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </article>
      </div>
    </div>
  );
}
