import {
  Database,
  ListFilter,
  ScanSearch,
  ListChecks,
  UserRoundCheck,
  ArrowDown,
  RotateCcw,
} from "lucide-react";
import styles from "./method-guide.module.css";
import ui from "./method-workflow.module.css";

const stages = [
  {
    icon: Database,
    title: "Gather relevant evidence",
    output: "A scoped set of observations",
    points: [
      "Public website and business information",
      "Confirmed competitors in the relevant service and location",
      "Eligible GSC and GA4 evidence after client access",
    ],
    detail:
      "Start with the service, target location and business identity. Name the pages and sources actually checked. Public observation does not reveal private traffic, lead quality or revenue.",
  },
  {
    icon: ListFilter,
    title: "Check what applies",
    output: "Usable evidence + explicit gaps",
    points: [
      "Match the target, period and search context",
      "Check source availability and collection limits",
      "Keep missing or conflicting evidence visible",
    ],
    detail:
      "A site-wide trend is not a page diagnosis. Check whether the available data supports the comparison. GSC clicks and GA4 sessions measure different things; a key event needs a known meaning and reliable collection. Additional checks may need your confirmation.",
  },
  {
    icon: ScanSearch,
    title: "Form a qualified finding",
    output: "A finding you can inspect",
    points: [
      "Separate observations from interpretations",
      "Keep supporting sources and confidence attached",
      "Name alternatives and unresolved conditions",
    ],
    detail:
      "Connect the evidence to a specific client question. An observed gap can support an investigation without proving a ranking or enquiry cause. The L1–L8 lens helps organize content and credibility checks; it is not Google’s ranking formula.",
  },
  {
    icon: ListChecks,
    title: "Propose the next work",
    output: "Three actions for your review",
    points: [
      "Name the target and reason to act",
      "Specify steps and completion checks",
      "State what to confirm and how to review",
    ],
    detail:
      "Review the candidates against the client’s business priorities, dependencies and delivery conditions. You confirm the final order and scope. A proposed action is neither completed work nor a guaranteed performance result.",
  },
];

export function MethodPipeline() {
  return (
    <section
      id="method-pipeline"
      className={styles.section}
      aria-labelledby="pipeline-title"
    >
      <header className={ui.heading}>
        <p className={styles.eyebrow}>
          From source to report / The working method
        </p>
        <h2 id="pipeline-title">How the evidence becomes a recommendation.</h2>
        <p>
          Not a list of disconnected checks. Each recommendation should retain
          its target, supporting basis and the conditions you still need to
          confirm.
        </p>
      </header>
      <div className={ui.pipeline}>
        <div className={ui.contextBar}>
          <strong>The client’s business sets the scope</strong>
          <span>Service · location · goal · execution conditions</span>
        </div>
        <ol className={ui.pipelineStages}>
          {stages.map((stage, index) => (
            <li key={stage.title}>
              <div className={ui.nodeTop}>
                <stage.icon size={24} aria-hidden="true" />
                <span>0{index + 1}</span>
              </div>
              <h3>{stage.title}</h3>
              <ul>
                {stage.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <strong className={ui.nodeOutput}>{stage.output}</strong>
              <details>
                <summary>What this involves</summary>
                <p>{stage.detail}</p>
              </details>
            </li>
          ))}
        </ol>
        <div className={ui.feedback}>
          <RotateCcw size={18} aria-hidden="true" />
          <p>
            <strong>When evidence is missing or conflicts:</strong> investigate
            or defer the judgment, then revisit it when the relevant information
            is available.
          </p>
        </div>
        <div className={ui.reviewGate}>
          <UserRoundCheck size={26} aria-hidden="true" />
          <div>
            <strong>Your review is the final decision.</strong>
            <p>
              Inspect the basis → adapt the action plan → save and approve →
              preview the client delivery.
            </p>
          </div>
          <span>Original observations stay intact.</span>
        </div>
      </div>
      <p className={ui.transition}>
        <ArrowDown size={18} aria-hidden="true" /> Follow the method through one
        client case—from the first question to the plan you approve.
      </p>
    </section>
  );
}
