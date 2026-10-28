"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import {
  FolderSearch,
  Cable,
  ClipboardCheck,
  Send,
  FileText,
  ArrowRight,
  Layers,
} from "lucide-react";
import {
  workflows,
  deliverables,
  type ReportStage,
} from "./deliverable-content";
import s from "./sample-deliverable.module.css";

const stages: ReportStage[] = ["prospect", "verified"];
const presentation = {
  prospect: {
    title: "Turn public evidence into a first scope you can discuss.",
    intro:
      "Check the business, review the findings and shape the proposed work before sharing it with the prospect.",
    groups: [
      "Build the basis",
      "Make the scope yours",
      "Prepare client delivery",
    ],
    outcome:
      "Business-specific findings, three proposed actions and questions to confirm.",
    caption: "What you take into the conversation",
  },
  verified: {
    title: "Turn client evidence into the next plan of work.",
    intro:
      "Continue the same Case, revisit the first recommendation and agree what should happen next.",
    groups: [
      "Continue with evidence",
      "Reassess the work",
      "Agree the next scope",
    ],
    outcome: "Prioritized work, completion checks and review arrangements.",
    caption: "What you take into the next review",
  },
};

export function WorkflowGuide() {
  const [stage, setStage] = useState<ReportStage>("prospect");
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft")
      next = 1 - index;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 1;
    else return;
    event.preventDefault();
    setStage(stages[next]);
    buttons.current[next]?.focus();
  }

  return (
    <section
      id="report-workflow"
      aria-label="Client report workflow"
      className={s.workflowGuide}
    >
      <div
        className={s.workflowTabs}
        role="tablist"
        aria-label="Choose your work stage"
      >
        {stages.map((item, index) => (
          <button
            key={item}
            type="button"
            role="tab"
            id={`workflow-tab-${item}`}
            aria-controls={`workflow-panel-${item}`}
            aria-selected={stage === item}
            tabIndex={stage === item ? 0 : -1}
            ref={(element) => {
              buttons.current[index] = element;
            }}
            onClick={() => setStage(item)}
            onKeyDown={(event) => navigate(event, index)}
          >
            <span>0{index + 1}</span> {workflows[item].title}
          </button>
        ))}
      </div>
      {stages.map((item, index) => {
        const flow = workflows[item];
        const content = presentation[item];
        const icons = [
          index === 0 ? FolderSearch : Cable,
          ClipboardCheck,
          Send,
        ];
        return (
          <div
            key={item}
            role="tabpanel"
            id={`workflow-panel-${item}`}
            aria-labelledby={`workflow-tab-${item}`}
            tabIndex={0}
            hidden={stage !== item}
            className={`${s.workflowPanel} ${index === 1 ? s.workflowPanelVerified : ""}`}
          >
            <header className={s.workflowHeading}>
              <p className={s.eyebrow}>
                {index === 0
                  ? "Before client analytics access"
                  : "After client confirmation & eligible data access"}
              </p>
              <h2>{content.title}</h2>
              <p>{content.intro}</p>
              <div className={s.workflowArt} aria-hidden="true">
                <span className={s.workflowArtBack}>
                  <Layers size={32} strokeWidth={1.25} />
                </span>
                <span className={s.workflowArtFront}>
                  <FileText size={28} strokeWidth={1.25} />
                  <small>{index === 0 ? "EVIDENCE" : "CLIENT DATA"}</small>
                  <ArrowRight size={18} />
                  <ClipboardCheck size={26} strokeWidth={1.25} />
                </span>
              </div>
            </header>
            <ol className={s.workflowColumns}>
              {content.groups.map((group, groupIndex) => {
                const Icon = icons[groupIndex];
                return (
                  <li key={group}>
                    <div className={s.workflowGroupHeading}>
                      <span>
                        <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
                      </span>
                      <div>
                        <small>0{groupIndex + 1}</small>
                        <h3>{group}</h3>
                      </div>
                    </div>
                    <ol start={groupIndex * 2 + 1} className={s.workflowSteps}>
                      {flow.steps
                        .slice(groupIndex * 2, groupIndex * 2 + 2)
                        .map(([title, description]) => (
                          <li key={title}>
                            <h4>{title}</h4>
                            <p>{description}</p>
                          </li>
                        ))}
                    </ol>
                  </li>
                );
              })}
            </ol>
            <div className={s.workflowOutcome}>
              <FileText size={23} strokeWidth={1.5} aria-hidden="true" />
              <div>
                <p className={s.eyebrow}>{content.caption}</p>
                <strong>{deliverables[item].name}</strong>
              </div>
              <p>{content.outcome}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
