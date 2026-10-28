"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleHelp, ShieldCheck } from "lucide-react";
import { useCaseScenes } from "@/components/useCase/use-case-data";
import { UseCaseEvidenceVisual } from "@/components/useCase/UseCaseEvidenceVisuals";
import s from "./method-situations.module.css";

const limits = [
  "Public evidence cannot establish traffic, qualified enquiries or the prospect’s commercial priorities.",
  "A competitor’s page does not establish a ranking cause or prove that another page is required.",
  "A different phone number may belong to another branch or to call tracking. Confirm the intended business details first.",
  "Search activity and key events need a checked scope. They do not prove why enquiries changed.",
  "The proposed order needs the SEO’s review of business priority, dependencies and available capacity.",
  "Record implementation and review it against comparable evidence. A later change does not prove that the work caused it.",
];
const practiceTargets = [
  "first-conversation",
  "revisit-recommendation",
  "revisit-recommendation",
  "revisit-recommendation",
  "next-priorities",
  "next-priorities",
];

export function MethodSituations() {
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    function syncHash() {
      const match = window.location.hash.match(/^#method-situation-(\d{2})$/);
      if (match) setSelected(Math.max(0, Math.min(5, Number(match[1]) - 1)));
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  function select(index: number) {
    setSelected(index);
    window.history.replaceState(
      null,
      "",
      `#method-situation-${useCaseScenes[index].number}`,
    );
  }
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 5
          : event.key === "ArrowDown" || event.key === "ArrowRight"
            ? (index + 1) % 6
            : event.key === "ArrowUp" || event.key === "ArrowLeft"
              ? (index + 5) % 6
              : null;
    if (next === null) return;
    event.preventDefault();
    select(next);
    buttons.current[next]?.focus();
  }

  return (
    <section
      className={s.section}
      id="method-situations"
      aria-labelledby="method-situations-title"
    >
      {useCaseScenes.map((scene) => (
        <span
          className={s.anchor}
          id={`method-situation-${scene.number}`}
          key={scene.number}
          aria-hidden="true"
        />
      ))}
      <header className={s.heading}>
        <div>
          <p className={s.eyebrow}>The method in different situations</p>
          <h2 id="method-situations-title">
            Different client questions. The same evidence discipline.
          </h2>
        </div>
        <p>
          Choose a question to see what the SEO checks, what can change the
          recommendation and what remains open.
        </p>
      </header>
      <p className={s.disclosure}>
        Method illustrations · not real client results or source snapshots.
      </p>
      <div className={s.explorer}>
        <div
          className={s.navigation}
          role="tablist"
          aria-label="Choose a method situation"
          aria-orientation="vertical"
        >
          {useCaseScenes.map((scene, index) => (
            <button
              key={scene.number}
              type="button"
              role="tab"
              id={`method-situation-tab-${scene.number}`}
              aria-selected={selected === index}
              aria-controls={`method-situation-panel-${scene.number}`}
              tabIndex={selected === index ? 0 : -1}
              ref={(node) => {
                buttons.current[index] = node;
              }}
              onClick={() => select(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              <span>{scene.number}</span>
              <strong>{scene.shortTitle}</strong>
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
        {useCaseScenes.map((scene, index) => (
          <article
            key={scene.number}
            id={`method-situation-panel-${scene.number}`}
            role="tabpanel"
            aria-labelledby={`method-situation-tab-${scene.number}`}
            hidden={selected !== index}
            tabIndex={0}
            className={s.panel}
          >
            <header className={s.panelHeading}>
              <p className={s.eyebrow}>
                {scene.number} / {scene.group}
              </p>
              <h3>{scene.title}</h3>
              <p>{scene.moment}</p>
            </header>
            <div className={s.question}>
              <CircleHelp size={19} aria-hidden="true" />
              <div>
                <span>Question to answer</span>
                <p>{scene.realIssue}</p>
              </div>
            </div>
            <div className={s.visual}>
              <UseCaseEvidenceVisual kind={scene.visual} />
            </div>
            <div className={s.checks}>
              <div>
                <h4>What to check</h4>
                <ul>
                  {scene.analysis.map((check) => (
                    <li key={check}>
                      <Check size={17} aria-hidden="true" />
                      {check}
                    </li>
                  ))}
                </ul>
              </div>
              <div className={s.conclusion}>
                <span>Working decision</span>
                <strong>{scene.decision}</strong>
                <p>
                  <ShieldCheck size={16} aria-hidden="true" />
                  {limits[index]}
                </p>
              </div>
            </div>
            <Link
              className={s.practiceLink}
              href={`/use-cases#practice-${practiceTargets[index]}`}
            >
              See where this fits in your work{" "}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
