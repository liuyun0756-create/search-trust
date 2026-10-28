"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import {
  Mail,
  UsersRound,
  ClipboardList,
  ChartNoAxesCombined,
  RotateCcw,
  ArrowUpRight,
  ChevronDown,
  SearchCheck,
} from "lucide-react";
import { methodConversations } from "./method-conversation-data";
import styles from "./method-guide.module.css";
import ui from "./method-conversations.module.css";

const icons = [Mail, UsersRound, ClipboardList, ChartNoAxesCombined, RotateCcw];

export function MethodConversations() {
  const id = useId();
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (["ArrowDown", "ArrowRight"].includes(event.key))
      next = (index + 1) % methodConversations.length;
    else if (["ArrowUp", "ArrowLeft"].includes(event.key))
      next =
        (index - 1 + methodConversations.length) % methodConversations.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = methodConversations.length - 1;
    else return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return (
    <section
      id="method-conversations"
      className={styles.section}
      aria-labelledby="conversation-title"
    >
      <header className={ui.heading}>
        <p className={styles.eyebrow}>
          The client conversation / Five working situations
        </p>
        <h2 id="conversation-title">
          Show what you noticed.
          <br />
          Explain why it deserves a closer look.
        </h2>
        <p>
          Give your client a specific finding, a clear reason to investigate and
          a useful next step.
        </p>
        <span className={ui.exampleNote}>
          Simulated emails and possible client concerns · Illustrative
          observations
        </span>
      </header>

      <div className={ui.workspace}>
        <div
          className={ui.directory}
          role="tablist"
          aria-label="Choose a client conversation"
          aria-orientation="vertical"
        >
          {(
            [
              ["prospect", "Win the work"],
              ["service", "Deliver the work"],
            ] as const
          ).map(([phase, label]) => (
            <div key={phase} className={ui.group} role="presentation">
              <p className={ui.groupLabel}>{label}</p>
              {methodConversations.map((scene, index) => {
                if (scene.phase !== phase) return null;
                const Icon = icons[index];
                return (
                  <button
                    key={scene.id}
                    type="button"
                    role="tab"
                    id={`${id}-tab-${scene.id}`}
                    aria-controls={`${id}-panel-${scene.id}`}
                    aria-selected={selected === index}
                    tabIndex={selected === index ? 0 : -1}
                    ref={(node) => {
                      tabs.current[index] = node;
                    }}
                    onClick={() => setSelected(index)}
                    onKeyDown={(event) => move(event, index)}
                  >
                    <Icon size={17} aria-hidden="true" />
                    <span>{scene.label}</span>
                    <ArrowUpRight
                      size={14}
                      aria-hidden="true"
                      className={ui.activeArrow}
                    />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className={ui.readingArea}>
          {methodConversations.map((scene, index) => (
            <div
              key={scene.id}
              role="tabpanel"
              id={`${id}-panel-${scene.id}`}
              aria-labelledby={`${id}-tab-${scene.id}`}
              tabIndex={0}
              hidden={selected !== index}
              className={ui.panel}
            >
              <header className={ui.sceneHeading}>
                <span>{scene.stage}</span>
                <h3>“{scene.question}”</h3>
              </header>

              <div className={ui.comparison}>
                <div>
                  <span className={ui.smallLabel}>A broad opening</span>
                  <p>“{scene.generic}”</p>
                </div>
                <div>
                  <span className={ui.smallLabel}>
                    A possible client question
                  </span>
                  <p>“{scene.concern}”</p>
                </div>
              </div>

              <article
                className={ui.email}
                aria-label={`${scene.label}: illustrative professional email`}
              >
                <header>
                  <span className={ui.emailLabel}>
                    <Mail size={16} aria-hidden="true" /> Your conversation with
                    the client
                  </span>
                  <h4>
                    <span>Subject</span>
                    {scene.subject}
                  </h4>
                </header>
                <div className={ui.emailBody}>
                  {scene.email.map((paragraph, i) => (
                    <p key={i}>
                      {paragraph.before}
                      <strong>{paragraph.highlight}</strong>
                      {paragraph.after}
                    </p>
                  ))}
                </div>
                <div className={ui.sourceLine}>
                  <SearchCheck size={16} aria-hidden="true" />
                  <span>Basis</span>
                  <p>{scene.sourceLabels.join(" · ")}</p>
                </div>
                <details className={ui.details}>
                  <summary>
                    View evidence & open questions{" "}
                    <ChevronDown size={15} aria-hidden="true" />
                  </summary>
                  <div>
                    <h5>Illustrative source basis</h5>
                    <ul>
                      {scene.sources.map((source) => (
                        <li key={source}>{source}</li>
                      ))}
                    </ul>
                    <h5>Still to confirm</h5>
                    <p>{scene.limit}</p>
                    <p className={ui.sourceNote}>
                      These are simulated observations. No collected URLs,
                      snapshots, dates or values are supplied. For your own
                      outreach, cite the checked source and observation date.
                    </p>
                  </div>
                </details>
              </article>

              <div className={ui.outcome}>
                <div>
                  <span className={ui.smallLabel}>What you bring</span>
                  <p>{scene.takeaway}</p>
                </div>
                <div>
                  <span className={ui.smallLabel}>
                    What the client can assess
                  </span>
                  <p>{scene.assessment}</p>
                </div>
              </div>
              <details className={`${ui.details} ${ui.methodDetails}`}>
                <summary>
                  View the reasoning{" "}
                  <ChevronDown size={15} aria-hidden="true" />
                </summary>
                <ol>
                  {scene.method.map((text, i) => (
                    <li key={text}>
                      <span>{["Check", "Judge", "Take forward"][i]}</span>
                      <p>{text}</p>
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
