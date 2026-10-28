"use client";

import { useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { ArrowRight, ClipboardList, FileSearch, ListOrdered, MessagesSquare, ScanSearch, Target, UserRound, Wrench } from "lucide-react";

import styles from "./client-conversation.module.css";

const conversations = [
  {
    id: "prospect",
    label: "Win the work",
    moment: "Before client access",
    message: "You have findings. Which belong in the first proposal?",
    contextNeeded: "Site checks and competitor research still need a business scope.",
    question: "Which service matters, and what should we tackle first?",
    brief: "A first scope to discuss",
    object: "AC repair",
    context: "Service area · to confirm",
    observation: "Service details are scattered across the pages checked.",
    action: "Confirm the existing page, then discuss improving it.",
    limit: "A competitor’s page alone does not justify a new one.",
    outcomes: [
      { title: "A first discussion scope", detail: "The service, area and work worth discussing." },
      { title: "Evidence to review", detail: "Observations behind the proposal." },
      { title: "Client questions to resolve", detail: "Business details still to confirm." },
    ],
    takeaway: "Bring a business-specific scope—not the whole audit—to the first conversation.",
  },
  {
    id: "service",
    label: "Deliver the work",
    moment: "After client access",
    message: "You have performance data. Which recommendation should change?",
    contextNeeded: "Search and on-site trends still need to be connected to specific work.",
    question: "What should we keep, revise or defer?",
    brief: "Proposed work & review",
    object: "Existing service page",
    context: "AC repair · same business",
    observation: "GSC shows relevant clicks; page checks find unclear contact steps.",
    action: "Clarify service details and the contact path.",
    limit: "Verify GA4 events before review; enquiry causes remain unproven.",
    outcomes: [
      { title: "A supported next priority", detail: "A decision tied to the available evidence." },
      { title: "Requirements for delivery", detail: "A target, proposed work and completion checks." },
      { title: "Checks for the next review", detail: "Metrics, scope and measurement to verify." },
    ],
    takeaway: "Connect the next decision to the evidence behind it.",
  },
] as const;

const outcomeIcons = [Target, ScanSearch, ListOrdered];
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function ClientConversation() {
  const [active, setActive] = useState(0);
  // Do not accept a click on server-rendered tabs before their handlers are ready.
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "Home" ? 0 : event.key === "End" ? 1
      : ["ArrowLeft", "ArrowRight"].includes(event.key) ? 1 - index : null;
    if (next === null) return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  }

  return (
    <section id="why-it-changes-work" className={styles.section} aria-labelledby="value-title">
      <div className={styles.inner}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>WHY IT CHANGES THE CONVERSATION</p>
            <h2 id="value-title">Turn your research into a client decision.</h2>
          </div>
          <div className={styles.tabs} role="tablist" aria-label="Choose a client relationship stage">
            {conversations.map((scene, index) => (
              <button key={scene.id} type="button" role="tab" id={`conversation-tab-${scene.id}`}
                disabled={!hydrated}
                aria-selected={active === index} aria-controls={`conversation-panel-${scene.id}`}
                tabIndex={active === index ? 0 : -1}
                ref={(element) => { tabs.current[index] = element; }}
                onClick={() => setActive(index)} onKeyDown={(event) => onTabKeyDown(event, index)}>
                {index === 0 ? <MessagesSquare size={19} aria-hidden="true" /> : <ClipboardList size={19} aria-hidden="true" />}
                <span><strong>{scene.label}</strong><small>{scene.moment}</small></span>
              </button>
            ))}
          </div>
        </header>

        <p className={styles.example}>Illustrative conversations · Not real client testimonials or results</p>

        {conversations.map((scene, index) => (
          <div key={scene.id} className={styles.panel} role="tabpanel" id={`conversation-panel-${scene.id}`}
            aria-labelledby={`conversation-tab-${scene.id}`} hidden={active !== index} tabIndex={active === index ? 0 : -1}>
            <div className={styles.canvas}>
              <div className={styles.start}>
                <p className={styles.label}>THE WORK STILL TO DO</p>
                <h3 className={styles.challenge}>{scene.message}</h3>
                <p className={styles.contextNeeded}>{scene.contextNeeded}</p>
                <div className={styles.question}>
                  <UserRound size={17} aria-hidden="true" />
                  <div><span>The client’s question</span><p>{scene.question}</p></div>
                </div>
              </div>

              <div className={styles.briefStage}>
                <ArrowRight className={styles.incoming} size={22} aria-hidden="true" />
                <article className={styles.brief} aria-label={scene.brief}>
                  <div className={styles.briefMeta}><span>SEARCHTRUST / DISCUSSION BRIEF</span><FileSearch size={17} aria-hidden="true" /></div>
                  <h3>{scene.brief}</h3>
                  <div className={styles.business}>
                    <span className={styles.businessIcon} aria-hidden="true">{index === 0 ? <Wrench size={23} strokeWidth={1.6} /> : <FileSearch size={23} strokeWidth={1.6} />}</span>
                    <div><strong>{scene.object}</strong><p>{scene.context}</p></div>
                  </div>
                  <dl className={styles.findings}>
                    <div><dt>Observed</dt><dd>{scene.observation}</dd></div>
                    <div className={styles.action}><dt>Proposed</dt><dd>{scene.action}</dd></div>
                  </dl>
                  <p className={styles.limit}><strong>Keep in view</strong> {scene.limit}</p>
                  <p className={styles.review}>For SEO review · not a completed task</p>
                </article>
                <ArrowRight className={styles.outgoing} size={22} aria-hidden="true" />
              </div>

              <div className={styles.outcomes}>
                <p className={styles.label}>BRING INTO THE CONVERSATION</p>
                <ul>
                  {scene.outcomes.map((outcome, outcomeIndex) => {
                    const Icon = outcomeIcons[outcomeIndex];
                    return <li key={outcome.title}><span className={styles.outcomeIcon} aria-hidden="true"><Icon size={19} strokeWidth={1.7} /></span><div><h4>{outcome.title}</h4><p>{outcome.detail}</p></div></li>;
                  })}
                </ul>
              </div>
            </div>
            <p className={styles.takeaway}>{scene.takeaway}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
