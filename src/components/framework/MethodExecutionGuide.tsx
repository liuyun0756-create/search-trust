import { ClipboardCheck, PanelTop, ListChecks, ScanSearch } from "lucide-react";
import { Heading, Reference, sources } from "./method-guide-shared";
import { MethodTabs } from "./MethodTabs";
import styles from "./method-guide.module.css";
import ui from "./method-workflow.module.css";

const briefs = [
  {
    label: "01 What to change",
    icon: PanelTop,
    title: "Make the service clear and the next step easy to find.",
    intro:
      "Update the confirmed page using accurate information from your client.",
    points: [
      [
        "Service scope",
        "State which AC repairs the business provides and which areas it serves.",
      ],
      [
        "Service process",
        "Explain what happens when a customer gets in touch and how the repair service works.",
      ],
      [
        "Contact step",
        "Make the relevant phone number or enquiry form easy to find and use.",
      ],
    ],
    request: [
      "Ask your client for",
      "Supported repairs, service areas, the actual service process and the correct contact details.",
    ],
    outcome:
      "A specific page-update brief, ready to use yourself or discuss with your client’s developer.",
    visual: [
      "AC repair",
      "What we repair · Where we work",
      "What happens next",
      "Contact the business",
    ],
  },
  {
    label: "02 When it’s done",
    icon: ListChecks,
    title: "Set a clear finish line for the page update.",
    intro:
      "Check the published page against the agreed brief. These are checks to perform, not completed tasks.",
    points: [
      [
        "Accurate service information",
        "The client has confirmed the details and the agreed content changes are live.",
      ],
      [
        "A working contact path",
        "The phone link or form works and reaches the intended destination.",
      ],
      [
        "Checked event collection",
        "The relevant GA4 event records the intended action. Note any collection issues.",
      ],
    ],
    request: [
      "Record what changed",
      "Keep the page URL, exact changes and date they went live in your implementation record.",
    ],
    outcome:
      "Clear completion checks and a record you can refer to at the next review.",
    visual: [
      "Completion checks",
      "Approved details are live",
      "Contact path works",
      "Event collection checked",
    ],
  },
  {
    label: "03 What to review",
    icon: ScanSearch,
    title: "Review the same page before deciding what comes next.",
    intro:
      "Agree a baseline and a review date. Use a period that fits the available traffic and the timing of the changes.",
    points: [
      [
        "Confirm implementation",
        "Check which changes went live and note other page, site or tracking changes in the same period.",
      ],
      [
        "Revisit the evidence",
        "Compare the same page and relevant queries in GSC with eligible GA4 evidence. Check dates, traffic scope and collection.",
      ],
      [
        "Decide the next step",
        "Keep, revise or investigate the action. Identify missing information before proposing another change.",
      ],
    ],
    request: [
      "Keep the claim proportionate",
      "A performance change alone does not prove that your page update caused it.",
    ],
    outcome:
      "A reason to continue, adjust or investigate—and an explanation you can give your client.",
    visual: [
      "Same page, next review",
      "Implementation record",
      "Comparable evidence",
      "Keep · Revise · Investigate",
    ],
  },
];

export function MethodExecutionGuide() {
  return (
    <section id="execution-title" className={styles.section}>
      <Heading
        number="04"
        label="Execution & review"
        title="Know what to change—and what to check next."
      >
        Get a clear brief for the page you are working on: what to update, what
        to confirm with your client and how to review it afterwards.
      </Heading>
      <div className={ui.executionWorkspace}>
        <header className={ui.workObject}>
          <ClipboardCheck size={25} aria-hidden="true" />
          <div>
            <span className={styles.eyebrow}>Action example</span>
            <h3>Improve the existing AC repair service page.</h3>
            <p>Target: the service page confirmed by the client.</p>
          </div>
          <span className={ui.note}>
            Method example
            <br />
            Not a real client result
          </span>
        </header>
        <div id="practice-title">
          <MethodTabs
            label="Explore the execution brief"
            items={briefs.map((brief, index) => ({
              label: brief.label,
              content: (
                <>
                  <div className={ui.executionContent}>
                    <div className={ui.pageSketch} aria-hidden="true">
                      <div className={ui.sketchBar}>
                        <brief.icon size={18} />
                        <span>Working brief / 0{index + 1}</span>
                      </div>
                      <h4>{brief.visual[0]}</h4>
                      {brief.visual.slice(1).map((text, i) => (
                        <div className={ui.sketchBlock} key={text}>
                          <span>0{i + 1}</span>
                          <strong>{text}</strong>
                        </div>
                      ))}
                      <p>Illustrative structure · not a live page</p>
                    </div>
                    <div>
                      <h3>{brief.title}</h3>
                      <p className={ui.lead}>{brief.intro}</p>
                      <ol className={ui.checks}>
                        {brief.points.map(([title, text], i) => (
                          <li key={title}>
                            <span>0{i + 1}</span>
                            <div>
                              <h4>{title}</h4>
                              <p>{text}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                      <p className={ui.request}>
                        <strong>{brief.request[0]}</strong>
                        {brief.request[1]}
                      </p>
                    </div>
                  </div>
                  <p className={ui.executionOutcome}>
                    <strong>You leave with</strong>
                    {brief.outcome}
                  </p>
                  {index === 2 && (
                    <Reference href={sources.measurement}>
                      Google guidance: interpreting the two sources
                    </Reference>
                  )}
                </>
              ),
            }))}
          />
        </div>
      </div>
      <div className={ui.capability}>
        <p>
          SearchTrust provides the brief and review guidance. You carry out the
          work or coordinate it with your client, and record implementation
          outside this workflow.
        </p>
        <details>
          <summary>What is available today?</summary>
          <p>
            Reports include action steps, completion criteria and review
            guidance. The report workspace lets you edit the action plan.
            Content drafting, implementation-history tracking and comparisons
            aligned to implementation dates are not currently provided.
          </p>
        </details>
      </div>
    </section>
  );
}
