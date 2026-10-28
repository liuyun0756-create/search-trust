"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowDown,
  ChevronDown,
  FileSearch,
  ChartNoAxesCombined,
  Check,
} from "lucide-react";
import {
  chapters,
  deliverables,
  sampleFAQs,
  type Chapter,
  type ReportStage,
} from "./deliverable-content";
import { ReportReader, type ReadingMode } from "./ReportReader";
import { DeliveryShowcase } from "./DeliveryShowcase";
import { ReportConversations } from "./ReportConversations";
import { WorkflowGuide } from "./WorkflowGuide";
import s from "./sample-deliverable.module.css";

const stages: ReportStage[] = ["prospect", "verified"];

function WorkflowIntro({
  openReport,
}: {
  openReport: (stage: ReportStage) => void;
}) {
  return (
    <header className={s.hero}>
      <div className={s.heroStage}>
        <div className={s.reportArtwork} aria-hidden="true">
          <div className={`${s.artPaper} ${s.artProspect}`}>
            <span className={s.artNumber}>01</span>
            <FileSearch size={29} strokeWidth={1.3} />
            <strong>
              Prospect
              <br />
              Evidence Report
            </strong>
            <span className={s.artCaption}>A first scope to discuss</span>
            <span className={s.artSeal}>Evidence → Proposal</span>
          </div>
          <div className={`${s.artPaper} ${s.artVerified}`}>
            <span className={s.artNumber}>02</span>
            <ChartNoAxesCombined size={29} strokeWidth={1.3} />
            <strong>
              Verified
              <br />
              Action Plan
            </strong>
            <span className={s.artCaption}>The next work to review</span>
            <span className={s.artSeal}>
              <Check size={13} /> Prioritized actions
            </span>
          </div>
        </div>
        <div className={s.heroCopy}>
          <p className={s.eyebrow}>Two reports / One client workflow</p>
          <h1>
            Build the proposal.
            <br />
            <span>Then build the plan.</span>
          </h1>
          <p className={s.heroIntro}>
            Start the client conversation with a Prospect Evidence Report. After
            client access, continue the same Case with a Verified Action Plan.
            <span>
              Review the evidence, refine the actions and prepare your client
              delivery.
            </span>
          </p>
          <div
            className={s.heroActions}
            role="group"
            aria-label="Read a report"
          >
            <button
              className={s.primary}
              type="button"
              onClick={() => openReport("prospect")}
            >
              Read the Prospect report{" "}
              <ArrowDown size={16} aria-hidden="true" />
            </button>
            <button
              className={s.secondary}
              type="button"
              onClick={() => openReport("verified")}
            >
              Read the Verified plan <ArrowDown size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      <WorkflowGuide />
      <div className={s.continuity}>
        <span className={s.continuityMark}>
          01 <ArrowRight size={15} aria-hidden="true" /> 02
        </span>
        <p>
          <strong>Same client, same Case.</strong> New evidence informs the next
          report without erasing the earlier diagnosis.
          <small>
            Service analysis currently requires a completed Prospect Case.
            Direct service-only setup is not available yet.
          </small>
        </p>
      </div>
    </header>
  );
}

export function SampleReportsV22() {
  const [stage, setStage] = useState<ReportStage>("prospect");
  const [chapter, setChapter] = useState<Chapter>("summary");
  const [mode, setMode] = useState<ReadingMode>("chapters");
  const [readingTarget, setReadingTarget] = useState<{
    id: string;
    focus: boolean;
  } | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  // Scroll only after React has made the requested chapter visible.
  useEffect(() => {
    if (!readingTarget) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(readingTarget.id);
      target?.scrollIntoView({ block: "start" });
      if (readingTarget.focus) target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [readingTarget]);

  useEffect(() => {
    function syncHash() {
      const hash = window.location.hash.slice(1);
      const next = hash.startsWith("sample-verified")
        ? "verified"
        : hash.startsWith("sample-prospect")
          ? "prospect"
          : null;
      if (next) {
        setStage(next);
        setChapter(
          chapters.find(([id]) => hash === `sample-${next}-${id}`)?.[0] ??
            "summary",
        );
        setReadingTarget({ id: hash, focus: false });
      }
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  function openReport(next: ReportStage, chapter?: Chapter) {
    setStage(next);
    setChapter(chapter ?? "summary");
    const id = `sample-${next}${chapter ? `-${chapter}` : ""}`;
    window.history.replaceState(null, "", `#${id}`);
    setReadingTarget({ id, focus: true });
  }
  function chooseStage(next: ReportStage) {
    setStage(next);
    setChapter("summary");
    window.history.replaceState(null, "", `#sample-${next}`);
    setReadingTarget({ id: `sample-${next}`, focus: false });
  }
  function chooseChapter(next: Chapter) {
    openReport(stage, next);
  }
  function chooseMode(next: ReadingMode) {
    setMode(next);
    setReadingTarget({ id: `sample-${stage}-${chapter}`, focus: false });
  }
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 1
          : ["ArrowLeft", "ArrowRight"].includes(event.key)
            ? 1 - index
            : null;
    if (next === null) return;
    event.preventDefault();
    chooseStage(stages[next]);
    tabs.current[next]?.focus();
  }

  return (
    <div className={s.page}>
      <div className={s.inner}>
        <WorkflowIntro openReport={openReport} />
        <section
          id="report-scenarios"
          className={s.readerSection}
          aria-labelledby="reader-title"
        >
          <header className={s.readerHeading}>
            <div>
              <p className={s.eyebrow}>The deliverables</p>
              <h2 id="reader-title">Read the work you would review.</h2>
            </div>
            <p className={s.sampleNotice}>
              Demonstration reports · Fictional business and evidence.
              <br />
              No measured client results or collected source records.
            </p>
          </header>
          <div
            className={s.stageTabs}
            role="tablist"
            aria-label="Choose a report stage"
          >
            {stages.map((value, i) => (
              <button
                type="button"
                role="tab"
                key={value}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                id={`report-tab-${value}`}
                aria-controls={`sample-${value}`}
                aria-selected={stage === value}
                tabIndex={stage === value ? 0 : -1}
                onClick={() => chooseStage(value)}
                onKeyDown={(event) => onTabKey(event, i)}
              >
                <span className={s.tabNumber}>0{i + 1}</span>
                <span>
                  <strong>{deliverables[value].name}</strong>
                  <small>
                    {i === 0 ? "Before client access" : "After client access"}
                  </small>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            ))}
          </div>
          {stages.map((value) => (
            <div
              key={value}
              id={`sample-${value}`}
              className={s.readerPanel}
              role="tabpanel"
              aria-labelledby={`report-tab-${value}`}
              hidden={value !== stage}
              tabIndex={0}
            >
              <ReportReader
                report={deliverables[value]}
                chapter={chapter}
                mode={mode}
                active={stage === value}
                onChapter={chooseChapter}
                onObservedChapter={setChapter}
                onMode={chooseMode}
                onNext={
                  value === "prospect"
                    ? () => openReport("verified")
                    : undefined
                }
              />
            </div>
          ))}
          <div className={s.readerHandoff}>
            <div>
              <span className={s.eyebrow}>After reading</span>
              <p>Make the action plan yours. Prepare your client delivery.</p>
            </div>
            <a className={s.secondary} href="#plan-review">
              Review & branding <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </section>
        <DeliveryShowcase />
        <ReportConversations />
        <section className={s.section} aria-labelledby="sample-faq-title">
          <header className={s.sectionHeading}>
            <p className={s.eyebrow}>Report questions</p>
            <h2 id="sample-faq-title">Before you use it with a client.</h2>
          </header>
          <div className={s.faq}>
            {sampleFAQs.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <ChevronDown size={17} aria-hidden="true" />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className={s.final} aria-labelledby="sample-start-title">
          <div>
            <p className={s.eyebrow}>Try it with your own client</p>
            <h2 id="sample-start-title">Bring a business you know.</h2>
            <p>
              Check what the evidence supports, review the proposed actions and
              decide what you would put in front of the client.
            </p>
          </div>
          <div>
            <Link className={s.primary} href="/cases/new">
              Start a Prospect Case <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link className={s.secondary} href="/cases/service">
              Continue with a client Case{" "}
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          <p className={s.finalNote}>
            Website and business confirmation is free. Credits are used when a
            paid analysis workflow starts, not when you open these pages.
            Service work currently requires a completed Prospect Case.{" "}
            <Link href="/pricing">Pricing and credit details</Link>
          </p>
        </section>
      </div>
    </div>
  );
}
