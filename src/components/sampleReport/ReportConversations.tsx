"use client";

import { useState } from "react";
import {
  ChevronDown,
  FileText,
  MessageCircle,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { reportConversations } from "./report-conversation-content";
import s from "./report-conversations.module.css";

export function ReportConversations() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  return (
    <section
      id="report-conversations"
      className={s.section}
      aria-labelledby="conversation-title"
    >
      <header className={s.heading}>
        <div>
          <p className={s.eyebrow}>Bring the report into the conversation</p>
          <h2 id="conversation-title">
            When the client asks “Why?”,
            <br />
            <span>show your reasoning.</span>
          </h2>
          <p>
            Explain the recommendation, agree on the work and keep expectations
            grounded in evidence.
          </p>
        </div>
        <p className={s.notice}>
          Illustrative conversations using the reports above.
          <br />
          Not real client correspondence or results.
        </p>
      </header>
      <div className={s.cards}>
        {reportConversations.map((item, index) => {
          const open = !!expanded[item.id];
          return (
            <article
              className={s.card}
              aria-labelledby={`conversation-${item.id}`}
              key={item.id}
            >
              <header className={s.cardHeading}>
                <span className={s.caseNumber}>0{index + 1}</span>
                <div>
                  <p>{item.stage}</p>
                  <h3 id={`conversation-${item.id}`}>{item.title}</h3>
                </div>
                <MessageCircle size={19} aria-hidden="true" />
              </header>
              <div className={s.thread}>
                <div className={s.clientMessage}>
                  <span className={s.speaker}>
                    <UserRound size={13} aria-hidden="true" /> Client
                  </span>
                  <p>{item.question}</p>
                </div>
                <div className={s.seoMessage}>
                  <span className={s.speaker}>
                    <span className={s.seoAvatar}>S</span> You · SEO
                  </span>
                  <p>{item.answer}</p>
                </div>
                <section
                  className={s.excerpt}
                  aria-label={`${item.title} report excerpt`}
                >
                  <div className={s.documentLabel}>
                    <FileText size={15} aria-hidden="true" />
                    <span>
                      Verified Action Plan <small>{item.documentLabel}</small>
                    </span>
                  </div>
                  <h4>{item.documentTitle}</h4>
                  <dl>
                    {item.rows.map((row, j) => (
                      <div key={row.label}>
                        <dt>
                          {item.id === "scope" && (
                            <span className={s.rowNumber}>0{j + 1}</span>
                          )}
                          {row.label}
                        </dt>
                        <dd>{row.text}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className={s.limit}>
                    <ShieldCheck size={14} aria-hidden="true" />
                    <p>
                      <strong>{item.noteLabel}</strong>
                      {item.note}
                    </p>
                  </div>
                </section>
                <div className={s.followUp}>
                  <span className={s.followUpLabel}>The client asks next</span>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`reply-${item.id}`}
                    onClick={() =>
                      setExpanded((current) => ({
                        ...current,
                        [item.id]: !current[item.id],
                      }))
                    }
                  >
                    <span>{item.followUp}</span>
                    <ChevronDown size={17} aria-hidden="true" />
                  </button>
                  <div
                    id={`reply-${item.id}`}
                    hidden={!open}
                    className={s.reply}
                  >
                    <span className={s.speaker}>
                      <span className={s.seoAvatar}>S</span> You · SEO
                    </span>
                    <p>{item.reply}</p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
