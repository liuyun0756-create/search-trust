"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp, Check, FileText, RotateCcw } from "lucide-react";
import { RunAuditButton } from "@/components/common/RunAuditButton";
import { type EditableReport, type SampleReport, sampleCase, sampleReports } from "./sample-report-data";
import "./sample-report.css";

type ReadingView = "client" | "seo";
const fields: { key: Exclude<keyof EditableReport, "actions">; label: string }[] = [
  { key: "headline", label: "Report headline" }, { key: "summary", label: "Executive summary" },
  { key: "decision", label: "Work decision" }, { key: "clientRequest", label: "Client confirmation" },
  { key: "review", label: "Follow-up plan" },
];
function clone(report: SampleReport) {
  return { client: { ...report.client, actions: [...report.client.actions] }, seo: { ...report.seo, actions: [...report.seo.actions] } };
}

function ReportDocument({ report }: { report: SampleReport }) {
  const [view, setView] = useState<ReadingView>("client");
  const [saved, setSaved] = useState(() => clone(report));
  const [draft, setDraft] = useState(() => clone(report));
  const [editing, setEditing] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [visitedViews, setVisitedViews] = useState<ReadingView[]>(["client"]);
  const [editChecked, setEditChecked] = useState(false);
  const [notice, setNotice] = useState("");
  const [revisedViews, setRevisedViews] = useState<ReadingView[]>([]);
  const [deskOpen, setDeskOpen] = useState(false);
  const display = saved[view];

  function changeView(next: ReadingView) {
    if (editing && JSON.stringify(draft[view]) !== JSON.stringify(saved[view]) && !window.confirm("Discard unsaved wording in this reading view?")) return;
    setDraft(saved); setEditing(false); setView(next); setVisitedViews((current) => current.includes(next) ? current : [...current, next]); setNotice(""); setDeskOpen(false);
  }
  function changeField(key: Exclude<keyof EditableReport, "actions">, value: string) {
    setDraft((current) => ({ ...current, [view]: { ...current[view], [key]: value } }));
  }
  function changeAction(index: number, value: string) {
    setDraft((current) => ({ ...current, [view]: { ...current[view], actions: current[view].actions.map((action, i) => i === index ? value : action) } }));
  }
  function moveAction(index: number, offset: number) {
    setDraft((current) => { const actions = [...current[view].actions]; [actions[index], actions[index + offset]] = [actions[index + offset], actions[index]]; return { ...current, [view]: { ...current[view], actions } }; });
  }
  function saveDraft() {
    if (!draft[view].headline.trim() || !draft[view].summary.trim() || !draft[view].decision.trim() || draft[view].actions.some((item) => !item.trim())) {
      setNotice("Add a headline, summary, decision and all three actions before saving the demo draft."); return;
    }
    setSaved(draft); setEditing(false); setReviewed(false); setVisitedViews([view]); setEditChecked(false);
    setRevisedViews((current) => current.includes(view) ? current : [...current, view]);
    setNotice("Demo wording saved in this page only. Review both reading views before delivery.");
    setDeskOpen(false);
  }
  function reset() {
    if (!window.confirm("Restore the original example wording for both views and clear the demo review state?")) return;
    const original = clone(report); setSaved(original); setDraft(original); setEditing(false); setReviewed(false); setVisitedViews([view]); setRevisedViews([]); setEditChecked(false);
    setNotice("Original example restored. No real report was changed.");
  }

  return <section id={`sample-${report.stage}`} aria-labelledby={`${report.stage}-heading`} className="sample-chapter scroll-mt-28">
    <div className="sample-chapter-heading"><div className="sample-stage-rail"><span>{report.number}</span><span>{report.stage === "prospect" ? "Win the client" : "Serve the client"}</span></div><div><p className="sample-eyebrow">{report.moment}</p><h2 id={`${report.stage}-heading`} className="sample-chapter-title">{report.name}</h2><p className="sample-lede">{report.purpose}</p></div></div>
    <div className="sample-workspace">
      <button type="button" className="sample-mobile-desk-button" aria-expanded={deskOpen} aria-controls={`${report.stage}-review-desk`} onClick={() => setDeskOpen(true)}>Open SEO review &amp; edit panel <ArrowRight size={17} aria-hidden="true" /></button>
      <article className="sample-paper" aria-label={`${report.name} ${view === "seo" ? "SEO working view" : "client report view"}`}>
        <header className="sample-paper-header"><div className="sample-paper-topline"><span>SEARCHTRUST / REPORT EXAMPLE</span><span>{report.number} / 02</span></div><p className="sample-paper-kicker">{view === "client" ? "CLIENT REPORT VIEW" : "SEO WORKING VIEW"} · FICTIONAL CASE</p><h3>{display.headline}</h3><div className="sample-meta"><span>Case: {sampleCase.name}</span><span>Service: {sampleCase.service}</span><span>Scope: {sampleCase.location}</span></div><p className="sample-source-note">{report.sourceScope}</p></header>
        <div className="sample-paper-body">
          <section aria-labelledby={`${report.stage}-summary`} className="sample-report-section sample-report-intro"><p className="sample-section-index">01 / THE SITUATION</p><h4 id={`${report.stage}-summary`}>{view === "client" ? "What we found" : "Diagnosis and scope"}</h4><p>{display.summary}</p></section>
          <section aria-labelledby={`${report.stage}-evidence`} className="sample-report-section"><div className="sample-section-head"><div><p className="sample-section-index">02 / SOURCE RECORD</p><h4 id={`${report.stage}-evidence`}>The evidence behind the decision</h4></div><span className="sample-locked">Read-only example evidence</span></div><ol className="sample-evidence-list">{report.evidence.map((item, index) => <li key={item.source}><span className="sample-evidence-index">0{index + 1}</span><div><h5>{item.source}</h5><p>{item.finding}</p><p className="sample-implication"><strong>What it supports: </strong>{item.implication}</p></div></li>)}</ol><p className="sample-source-disclaimer">Illustrative source descriptions. This example contains no collected snapshots, observation timestamps or values.</p></section>
          <section aria-labelledby={`${report.stage}-decision`} className="sample-report-section"><p className="sample-section-index">03 / JUDGMENT</p><h4 id={`${report.stage}-decision`}>What this means for the work</h4><div className="sample-decision"><p>{display.decision}</p></div><dl className="sample-judgment">{report.judgment.map((item) => <div key={item.question}><dt>{item.question}</dt><dd>{item.answer}</dd></div>)}</dl></section>
          <section aria-labelledby={`${report.stage}-plan`} className="sample-report-section"><p className="sample-section-index">04 / PROPOSED PLAN</p><h4 id={`${report.stage}-plan`}>Three actions for SEO and client review</h4><ol className="sample-actions">{display.actions.map((action, index) => <li key={index}><span>0{index + 1}</span><p>{action}</p></li>)}</ol><div className="sample-plan-foot"><div><h5>What the client needs to confirm</h5><p>{display.clientRequest}</p></div><div><h5>How to check the next step</h5><p>{display.review}</p></div></div></section>
          <section aria-labelledby={`${report.stage}-boundary`} className="sample-report-section sample-boundary"><p className="sample-section-index">05 / DELIVERY BOUNDARY</p><h4 id={`${report.stage}-boundary`}>What this report does not claim</h4><ul>{report.limits.map((limit) => <li key={limit}>{limit}</li>)}</ul><dl>{report.status.map((item) => <div key={item.label}><dt>{item.label}</dt><dd>{item.detail}</dd></div>)}</dl></section>
        </div><footer className="sample-paper-footer"><span>Method example / Not a real client result</span><span>SEO review required before any client delivery</span><button type="button" className="sample-mobile-footer-button" onClick={() => setDeskOpen(true)}>Review or edit this report <ArrowRight size={15} aria-hidden="true" /></button></footer>
      </article>
      {deskOpen && <button className="sample-desk-backdrop" type="button" aria-label="Close SEO review panel" onClick={() => setDeskOpen(false)} />}
      <aside id={`${report.stage}-review-desk`} className={`sample-desk ${deskOpen ? "sample-desk-open" : ""}`} aria-label={`${report.name} SEO review desk`} onKeyDown={(event) => { if (event.key === "Escape") setDeskOpen(false); }}><button type="button" className="sample-desk-close" onClick={() => setDeskOpen(false)}>Close panel ×</button><p className="sample-eyebrow">SEO REVIEW DESK</p><h3>Would you send this?</h3><p className="sample-desk-intro">Read the complete report, inspect its source limits, then refine the wording you would put in front of a client.</p>
        <div role="group" aria-label={`${report.name} reading view`} className="sample-view-switch"><button type="button" aria-pressed={view === "client"} onClick={() => changeView("client")}>Client report</button><button type="button" aria-pressed={view === "seo"} onClick={() => changeView("seo")}>SEO working view</button></div>
        <div className="sample-review-checklist"><p>Before delivery, check:</p><ul><li>Does the evidence support the conclusion?</li><li>Are the three actions appropriate for this client?</li><li>Are open questions and limits visible in both views?</li></ul></div>
        <div className="sample-edit-area"><p className="sample-eyebrow">WORDING &amp; PLAN</p><p>Editable: headline, explanation, decision, actions and follow-up. Source observations and status remain unchanged.</p>
          {!editing ? <button type="button" className="sample-primary-control" onClick={() => { setDraft(saved); setEditing(true); setNotice(""); }}>Edit {view === "client" ? "client" : "SEO"} wording <ArrowRight size={16} aria-hidden="true" /></button> : <div className="sample-edit-form">
            {fields.map((field) => <label key={field.key}>{field.label}<textarea rows={field.key === "headline" ? 2 : 4} value={draft[view][field.key]} onChange={(event) => changeField(field.key, event.target.value)} /></label>)}
            <fieldset><legend>Three proposed actions</legend>{draft[view].actions.map((action, index) => <div key={index} className="sample-action-edit"><label>Action {index + 1}<textarea rows={3} value={action} onChange={(event) => changeAction(index, event.target.value)} /></label><div><button type="button" onClick={() => moveAction(index, -1)} disabled={index === 0} aria-label={`Move action ${index + 1} up`}><ArrowUp size={16} /></button><button type="button" onClick={() => moveAction(index, 1)} disabled={index === 2} aria-label={`Move action ${index + 1} down`}><ArrowDown size={16} /></button></div></div>)}</fieldset>
            <div className="sample-form-actions"><button type="button" className="sample-primary-control" onClick={saveDraft}>Save demo draft</button><button type="button" className="sample-secondary-control" onClick={() => { setDraft(saved); setEditing(false); setNotice("Changes cancelled."); }}>Cancel</button></div>
          </div>}
        </div>
        {revisedViews.length > 0 && <label className="sample-edit-check"><input type="checkbox" checked={editChecked} onChange={(event) => setEditChecked(event.target.checked)} /> I checked the edited wording against the original evidence and conditions.</label>}
        <div className="sample-review-actions"><button type="button" className="sample-secondary-control" disabled={editing || visitedViews.length < 2 || (revisedViews.length > 0 && !editChecked)} onClick={() => { setReviewed(true); setNotice("Marked ready for this demonstration only. Nothing has been shared."); }}><Check size={16} aria-hidden="true" /> Mark demo ready</button><button type="button" className="sample-text-control" onClick={reset}><RotateCcw size={15} aria-hidden="true" /> Restore original example</button></div>
        <p role="status" className="sample-status">{notice || (reviewed ? "Demo review complete. No report has been sent or approved in the real workspace." : visitedViews.length < 2 ? "Preview both reading views before marking this demo ready." : "Not approved for real client delivery.")}</p>
        {revisedViews.length > 0 && <p className="sample-revision-note">Edited in this demo: {revisedViews.map((item) => item === "seo" ? "SEO view" : "Client view").join(", ")}. Check the other view for consistency; edits do not change source evidence.</p>}
        <p className="sample-demo-boundary">Website-only demonstration. Edits stay in this browser page until refresh; they do not update a real report, create a share link, run analysis or use credits.</p>
        {report.stage === "verified" && <><a className="sample-pdf-link" href="/samples/searchtrust-client-delivery-example.pdf" target="_blank" rel="noopener noreferrer"><FileText size={17} aria-hidden="true" /> View fixed PDF illustration <ArrowRight size={16} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a><p className="sample-pdf-note">The PDF is a fixed companion example; edits made here do not change it.</p></>}
      </aside>
    </div>
  </section>;
}

export function SampleReportsV22() {
  return <div className="sample-page">
    <header className="sample-hero"><div className="sample-hero-inner"><p className="sample-eyebrow">SAMPLE REPORT / ONE CASE, TWO MOMENTS</p><h1>See the report you can review before you put your name on it.</h1><p>One fictional local business. First, a proposal grounded in public evidence. Then, after client access, a more specific action plan. Read both reports in full, switch between SEO and client views, and test how you would edit the delivery wording.</p><div className="sample-hero-facts"><span>01 / Win the client</span><ArrowRight size={18} aria-hidden="true" /><span>02 / Serve the client</span><span className="sample-fact-end">Same Case. A more informed decision.</span></div><p className="sample-hero-disclaimer">{sampleCase.note}. This page is a website demonstration, not a real report editor.</p></div></header>
    <div className="sample-journey"><div className="sample-journey-inner"><div><p className="sample-eyebrow">READ THE CONTINUOUS CASE</p><h2 id="report-scenarios" className="scroll-mt-28">Two reports. Two decisions. One evidence history.</h2><p>The first report makes a responsible proposal without private data. The second carries its open questions forward, tests them against eligible client evidence and changes the work decision where warranted.</p></div><nav aria-label="Report sample scenarios"><a href="#sample-prospect">01 Prospect proposal <ArrowRight size={16} aria-hidden="true" /></a><a href="#sample-verified">02 Service delivery and review <ArrowRight size={16} aria-hidden="true" /></a></nav></div></div>
    <div className="sample-chapters">{sampleReports.map((report, index) => <div key={report.stage}><ReportDocument report={report} />{index === 0 && <div className="sample-bridge"><div className="sample-bridge-mark">01 <ArrowRight size={18} aria-hidden="true" /> 02</div><div><p className="sample-eyebrow">WHAT ACCESS CHANGES</p><h2>The first question is not erased. It is answered more carefully.</h2><p>Report 01 asks whether a new service page is needed. The client confirms an existing page; relevant search exposure and renewed page inspection give the SEO a different, more specific work candidate. Report 02 preserves what remains unproven.</p></div></div>}</div>)}</div>
    <footer className="sample-final"><div><p className="sample-eyebrow">FROM EXAMPLE TO YOUR OWN CASE</p><h2>Start with a business you know. Keep the final judgment yours.</h2><p>Confirm the business and its competitors, review the evidence, and decide what you would actually present to the client. This button opens the existing business-confirmation flow; it does not generate a paid report by itself.</p></div><div className="sample-final-actions"><RunAuditButton trackingSource="sample_reports_v22" className="sample-final-primary">Start with one business <ArrowRight size={18} aria-hidden="true" /></RunAuditButton><Link href="/framework" className="sample-final-link">See how the method works <ArrowRight size={17} aria-hidden="true" /></Link></div></footer>
  </div>;
}
