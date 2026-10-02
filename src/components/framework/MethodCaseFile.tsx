"use client";

import { ArrowDown, ArrowDownRight, FileText } from "lucide-react";
import { caseSnapshots, methodChapters, type MethodStageId } from "./method-case";
import { useMethodJourney } from "./MethodJourney";

export function MethodCaseFile() {
  const { active } = useMethodJourney();
  const index = methodChapters.findIndex((chapter) => chapter.id === active);
  const chapter = methodChapters[index];
  const snapshot = caseSnapshots[active];

  return <aside className="method-case-rail" aria-label="Fictional case file as the method progresses">
    <div className="method-case-file">
      <header className="method-case-file-head">
        <div className="method-case-file-kicker"><FileText aria-hidden="true" size={16} /> EVOLVING CASE FILE <span>DEMONSTRATION</span></div>
        <p className="method-case-file-identity">Fictional local service business <span>·</span> Core service page</p>
        <div className="method-case-file-stage"><span>0{index + 1} / 06</span><div><small>{chapter.phase}</small><strong>{chapter.label}</strong></div></div>
      </header>
      <div className="method-case-file-body" key={active}>
        <p className="method-case-file-stamp">{snapshot.stamp}</p>
        <h3>{snapshot.question}</h3>
        <dl>
          <div className="method-case-fact"><dt>Observed</dt><dd>{snapshot.observed}</dd></div>
          <div className="method-case-evidence"><dt>Evidence now available</dt><dd>{snapshot.added}</dd></div>
          <div className="method-case-decision"><dt>Current work decision</dt><dd>{snapshot.decision}</dd></div>
        </dl>
        <div className="method-case-file-output"><span>WHAT THE SEO GETS <ArrowDownRight aria-hidden="true" size={14} /></span><p>{snapshot.output}</p></div>
        <p className="method-case-file-mobile-decision">{snapshot.decision}</p>
        <div className="method-case-file-open"><strong>Still to confirm</strong><p>{snapshot.stillOpen}</p></div>
      </div>
      <footer>Illustrative reasoning only. No real client result or completed work is implied.</footer>
    </div>
  </aside>;
}

export function MethodStageBand({ id }: { id: MethodStageId }) {
  const index = methodChapters.findIndex((chapter) => chapter.id === id);
  const chapter = methodChapters[index];
  const snapshot = caseSnapshots[id];
  return <div className="method-stage-band" aria-label={`Case file stage ${index + 1}: ${chapter.label}`}>
    <div><span>CASE FILE / 0{index + 1}</span><strong>{chapter.phase}</strong></div>
    <p>{snapshot.output}</p>
    <span className="method-stage-band-stamp">{snapshot.stamp}</span>
  </div>;
}

export function MethodStageHandoff({ from, to }: { from: MethodStageId; to: MethodStageId }) {
  const current = caseSnapshots[from];
  const next = caseSnapshots[to];
  const nextChapter = methodChapters.find((chapter) => chapter.id === to)!;
  return <div className="method-stage-handoff">
    <div><span>THE FILE MOVES FORWARD</span><p>{current.decision}</p></div>
    <a href={`#${to}`}><span>Next / {nextChapter.label}<strong>{next.question}</strong></span><ArrowDown aria-hidden="true" size={20} /></a>
  </div>;
}
