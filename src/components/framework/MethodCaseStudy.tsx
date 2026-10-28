"use client";

import { useId, useState } from "react";
import {
  ArrowDown,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileSearch,
  FileText,
  GitBranch,
  MessageSquare,
  MousePointer2,
  Search,
} from "lucide-react";
import styles from "./method-guide.module.css";
import visual from "./method-visuals.module.css";
import { Heading } from "./method-guide-shared";

const evidence = [
  {
    source: "Client confirmation",
    status: "Confirmed in this example",
    icon: MessageSquare,
    fact: "A service page exists. This service is a business priority.",
    detail:
      "Use the client-confirmed page as the target. Check that its purpose and service scope match the business before proposing another page.",
    supports: "Confirms the page to improve.",
    target: "page",
  },
  {
    source: "Search Console",
    status: "Evidence assumed for this example",
    icon: Search,
    fact: "The page receives impressions and clicks for relevant service queries.",
    detail:
      "The page is already serving related search demand. This supports inspecting and improving that page; it does not explain the cause of any enquiry change.",
    supports: "Supports working on the existing page.",
    target: "page",
  },
  {
    source: "Page inspection",
    status: "Observation in this example",
    icon: FileSearch,
    fact: "Service scope, process and contact steps remain unclear.",
    detail:
      "These are specific gaps the team can address with approved business information. Confirm the wording and contact route with the client.",
    supports: "Defines the three proposed page changes.",
    target: "actions",
  },
  {
    source: "GA4 / pending check",
    status: "Still to verify",
    icon: MousePointer2,
    fact: "Key-event meaning and collection need checking.",
    detail:
      "Verify what the events record and whether collection changed. Keep lead quality and other concurrent changes open before interpreting enquiry performance.",
    supports: "Keeps enquiry causes unresolved.",
    target: "limit",
  },
];

export function MethodCaseStudy() {
  const [selected, setSelected] = useState<number | null>(null);
  const id = useId();
  const target = selected === null ? null : evidence[selected].target;
  return (
    <section
      id="prospect-diagnosis"
      className={`${styles.section} ${visual.caseSection}`}
    >
      <Heading
        number="02"
        label="One case / A changing judgment"
        title="A new page—or a better existing one?"
      >
        Follow one core air-conditioning repair service. See what the public
        check raised, what new evidence changed and what you would recommend.
      </Heading>
      <article
        className={visual.caseBoard}
        aria-label="Fictional service-page decision"
      >
        <header className={visual.caseHeader}>
          <span>
            <FileText size={16} aria-hidden="true" />
            Method example · Not a real client result
          </span>
          <span>AC repair / Same Case</span>
        </header>
        <div className={visual.comparison}>
          <div className={visual.before}>
            <span className={visual.kicker}>01 / Before analytics access</span>
            <h3>A possible page gap.</h3>
            <div
              className={visual.pageComparison}
              aria-label="Illustration of public page observations"
            >
              <div className={visual.observationPage}>
                <div className={visual.pageChrome}>
                  <i />
                  <i />
                  <i />
                </div>
                <span className={visual.miniLabel}>Client / pages checked</span>
                <strong>General services</strong>
                <span>Heating</span>
                <span className={visual.serviceHighlight}>
                  AC repair <small>Brief mention</small>
                </span>
                <span>Maintenance</span>
              </div>
              <div className={visual.observationPage}>
                <div className={visual.pageChrome}>
                  <i />
                  <i />
                  <i />
                </div>
                <span className={visual.miniLabel}>Confirmed competitor</span>
                <strong>AC repair</strong>
                <span>Dedicated service page</span>
                <div className={visual.pageFoot}>
                  <FileSearch size={17} />
                  <span>A comparison to investigate</span>
                </div>
              </div>
            </div>
            <p className={visual.observationText}>
              Within the public pages checked, the service explanation is
              scattered. A confirmed competitor has a dedicated page.
            </p>
            <div className={visual.initialCall}>
              <span className={visual.kicker}>Initial judgment</span>
              <h4>Confirm the existing page before proposing a new one.</h4>
              <p>
                <strong>Not found does not mean missing.</strong> Check the
                intended page and the client’s service priorities. A
                competitor’s page alone does not establish a ranking cause.
              </p>
            </div>
          </div>
          <div id="verified-action" className={visual.after}>
            <span className={visual.kicker}>
              02 / After client confirmation & eligible data access
            </span>
            <h3>New evidence changes the call.</h3>
            <div className={visual.confirmedPage}>
              <FileText size={22} aria-hidden="true" />
              <div>
                <strong>Existing AC repair page</strong>
                <span>One confirmed target for the evidence below</span>
              </div>
              <Check size={18} aria-hidden="true" />
            </div>
            <p className={visual.interactionHint}>
              Select a source to see how it informs the decision.
            </p>
            <div className={visual.evidenceList}>
              {evidence.map((item, index) => (
                <div
                  className={visual.evidenceItem}
                  key={item.source}
                  data-open={selected === index}
                >
                  <button
                    type="button"
                    aria-label={`${item.source}: how this informs the decision`}
                    aria-expanded={selected === index}
                    aria-controls={`${id}-evidence-${index}`}
                    onClick={() =>
                      setSelected(selected === index ? null : index)
                    }
                  >
                    <item.icon size={18} aria-hidden="true" />
                    <span>
                      <strong>{item.source}</strong>
                      <small className={visual.evidenceStatus}>
                        {item.status}
                      </small>
                      <span className={visual.evidenceFact}>{item.fact}</span>
                    </span>
                    <ChevronDown size={15} aria-hidden="true" />
                  </button>
                  <div
                    id={`${id}-evidence-${index}`}
                    hidden={selected !== index}
                    className={visual.evidenceDetail}
                  >
                    <p>{item.detail}</p>
                    <strong>
                      <ArrowDown size={14} aria-hidden="true" />
                      {item.supports}
                    </strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={visual.decisionConnector}>
          <ArrowDown size={16} aria-hidden="true" />
          <span>New evidence → revised recommendation</span>
        </div>
        <div className={visual.finalDecision}>
          <div className={visual.finalTitle} data-highlight={target === "page"}>
            <div className={visual.decisionIcon}>
              <ClipboardCheck size={25} aria-hidden="true" />
            </div>
            <div>
              <span className={visual.kicker}>Your working decision</span>
              <h3>Improve the existing service page first.</h3>
              <p>
                Use the confirmed page. Compare this action with other
                candidates before setting the final priority.
              </p>
            </div>
          </div>
          <ol
            className={visual.actionStrip}
            data-highlight={target === "actions"}
          >
            {[
              "Clarify service scope",
              "Explain the service process",
              "Make contact steps clear",
            ].map((action, index) => (
              <li key={action}>
                <span>0{index + 1}</span>
                {action}
              </li>
            ))}
          </ol>
          <p className={visual.changeSummary}>
            <GitBranch size={16} aria-hidden="true" />
            <span>
              <strong>What changed:</strong> a possible new-page task becomes
              work on an existing, confirmed page.
            </span>
          </p>
          <p className={visual.caseLimit} data-highlight={target === "limit"}>
            <strong>Still unproven:</strong> that page content caused fewer
            enquiries, or that these edits will produce a ranking or revenue
            gain. Verify events and record other concurrent changes.
          </p>
        </div>
        <p className={visual.caseDisclaimer}>
          Page illustrations and evidence assumptions explain the method. They
          are not collected source snapshots, completed work or measured client
          results.
        </p>
      </article>
      <div
        className={visual.outcomeRow}
        aria-label="Possible outcomes of new evidence"
      >
        <p>
          Evidence can change
          <br />
          the answer in four ways.
        </p>
        {[
          ["Support", "Keep the original direction."],
          ["Revise", "Change the proposed action."],
          ["Defer", "Prioritize stronger candidates."],
          ["Investigate", "Resolve a missing check."],
        ].map(([label, text]) => (
          <div key={label} data-current={label === "Revise"}>
            <strong>
              <span>{label}</span>
              {label === "Revise" && <small>This case</small>}
            </strong>
            <p>{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
