"use client";

import { useEffect } from "react";
import { ArrowLeft, ArrowRight, BookOpen, List } from "lucide-react";
import {
  chapters,
  type Chapter,
  type Deliverable,
} from "./deliverable-content";
import { ReportDocument } from "./ReportDocument";
import s from "./sample-deliverable.module.css";

export type ReadingMode = "chapters" | "continuous";

export function ReportReader({
  report,
  chapter,
  mode,
  active,
  onChapter,
  onObservedChapter,
  onMode,
  onNext,
}: {
  report: Deliverable;
  chapter: Chapter;
  mode: ReadingMode;
  active: boolean;
  onChapter: (chapter: Chapter) => void;
  onObservedChapter: (chapter: Chapter) => void;
  onMode: (mode: ReadingMode) => void;
  onNext?: () => void;
}) {
  const prefix = `sample-${report.stage}`;
  const index = chapters.findIndex(([id]) => id === chapter);

  useEffect(() => {
    if (!active || mode !== "continuous") return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const sections = chapters.map(([id]) => ({
        id,
        element: document.getElementById(`${prefix}-${id}`),
      }));
      const visible = sections.filter(
        ({ element }) => element && element.getBoundingClientRect().top <= 190,
      );
      onObservedChapter(visible.at(-1)?.id ?? "summary");
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [active, mode, prefix, onObservedChapter]);

  return (
    <>
      <div className={s.readingToolbar}>
        <span>
          <BookOpen size={16} aria-hidden="true" /> Complete report · 5 chapters
        </span>
        <div className={s.readingModes} role="group" aria-label="Reading mode">
          <button
            type="button"
            aria-pressed={mode === "chapters"}
            onClick={() => onMode("chapters")}
          >
            <List size={15} aria-hidden="true" /> By chapter
          </button>
          <button
            type="button"
            aria-pressed={mode === "continuous"}
            onClick={() => onMode("continuous")}
          >
            <BookOpen size={15} aria-hidden="true" /> Continuous
          </button>
        </div>
      </div>
      <div className={s.readerLayout}>
        <nav className={s.chapterNav} aria-label={`${report.name} chapters`}>
          <p className={s.eyebrow}>In this report</p>
          <label className={s.mobileChapter}>
            <span>
              Chapter {index + 1} / {chapters.length}
            </span>
            <select
              aria-label="Choose a report chapter"
              value={chapter}
              onChange={(event) => onChapter(event.target.value as Chapter)}
            >
              {chapters.map(([id, title], i) => (
                <option key={id} value={id}>
                  0{i + 1} · {title}
                </option>
              ))}
            </select>
          </label>
          {chapters.map(([id, title], i) => (
            <a
              key={id}
              href={`#${prefix}-${id}`}
              aria-current={chapter === id ? "location" : undefined}
              onClick={(event) => {
                if (
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return;
                event.preventDefault();
                onChapter(id);
              }}
            >
              <span>0{i + 1}</span>
              {title}
            </a>
          ))}
          <div className={s.chapterProgress}>
            <span>
              Chapter {index + 1} of {chapters.length}
            </span>
            <div aria-hidden="true">
              {chapters.map(([id], i) => (
                <i key={id} data-current={i === index} />
              ))}
            </div>
            <small>
              {mode === "chapters"
                ? "Full chapter, without the long scroll."
                : "Reading the complete report."}
            </small>
          </div>
        </nav>
        <ReportDocument
          report={report}
          chapter={mode === "chapters" ? chapter : undefined}
          navigation={
            <footer className={s.chapterFooter}>
              {mode === "chapters" ? (
                <>
                  <span className={s.chapterCount}>0{index + 1} / 05</span>
                  <div>
                    {index > 0 && (
                      <button
                        className={s.chapterBack}
                        type="button"
                        onClick={() => onChapter(chapters[index - 1][0])}
                      >
                        <ArrowLeft size={16} aria-hidden="true" /> Previous
                      </button>
                    )}
                    {index < chapters.length - 1 ? (
                      <button
                        className={s.secondary}
                        type="button"
                        onClick={() => onChapter(chapters[index + 1][0])}
                      >
                        Next: {chapters[index + 1][1]}{" "}
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    ) : onNext ? (
                      <button
                        className={s.secondary}
                        type="button"
                        onClick={onNext}
                      >
                        Read the Verified plan{" "}
                        <ArrowRight size={16} aria-hidden="true" />
                      </button>
                    ) : (
                      <a className={s.secondary} href="#plan-review">
                        Prepare client delivery{" "}
                        <ArrowRight size={16} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span>End of report · All 5 chapters</span>
                  <button
                    className={s.secondary}
                    type="button"
                    onClick={() => onChapter("summary")}
                  >
                    Back to summary <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </>
              )}
            </footer>
          }
        />
      </div>
    </>
  );
}
