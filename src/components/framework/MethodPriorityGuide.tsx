import styles from "./method-guide.module.css";
import { ActionPlanDemo } from "./ActionPlanDemo";
import { MethodTabs } from "./MethodTabs";
import { Heading } from "./method-guide-shared";

export function MethodPriorityGuide() {
  return (
    <section id="prioritization-title" className={styles.section}>
      <Heading
        number="03"
        label="Priority is a decision"
        title="An important finding is not always the next task."
      >
        Review severity, evidence, affected scope and dependencies. Then bring
        the client’s business priorities and delivery constraints into the order
        you approve.
      </Heading>
      <div className={styles.priorityLayout}>
        <div className={styles.candidates}>
          <p className={styles.eyebrow}>
            Three illustrative candidates / Not a fixed ranking
          </p>
          <ol>
            {[
              [
                "Improve the core service page",
                "Relevant search demand and a specific information gap.",
              ],
              [
                "Verify business contact details",
                "A public-information difference still needs confirmation.",
              ],
              [
                "Expand another service explanation",
                "A content gap needs accurate business material.",
              ],
            ].map(([title, body], index) => (
              <li key={title}>
                <span>{String.fromCharCode(65 + index)}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <MethodTabs
            label="Compare priority conditions"
            items={[
              {
                label: "Business priority",
                content: (
                  <>
                    <span className={styles.eyebrow}>
                      If the core service is the current focus
                    </span>
                    <h3>Consider the existing service page first.</h3>
                    <p>
                      It already attracts relevant searches and has a located
                      information gap. Confirm the business materials and
                      compare it with any more severe blockers.
                    </p>
                    <p className={styles.note}>
                      Expected direction: clearer service information and
                      contact steps—not a predicted uplift.
                    </p>
                  </>
                ),
              },
              {
                label: "Confirmed blocker",
                content: (
                  <>
                    <span className={styles.eyebrow}>
                      If the contact number is confirmed wrong
                    </span>
                    <h3>Bring the contact correction forward.</h3>
                    <p>
                      A verified contact problem can obstruct the next step.
                      Confirm which number belongs on which surface, correct it
                      and test the contact path.
                    </p>
                    <p className={styles.note}>
                      A difference alone is not a blocker: first rule out valid
                      branch or tracking numbers.
                    </p>
                  </>
                ),
              },
              {
                label: "Delivery timing",
                content: (
                  <>
                    <span className={styles.eyebrow}>
                      If the core page is being redesigned next week
                    </span>
                    <h3>Sequence work around the release.</h3>
                    <p>
                      Complete a confirmed, independent correction now. Agree
                      the service-page changes with the redesign team so the
                      same page is not rewritten twice.
                    </p>
                    <p className={styles.note}>
                      The SEO changes the schedule; the original evidence stays
                      attached to its original target.
                    </p>
                  </>
                ),
              },
            ]}
          />
        </div>
      </div>
      <div className={styles.ownership}>
        <div>
          <h3>System-supported starting order</h3>
          <p>
            Severity, evidence confidence, affected scope and dependencies
            inform recommendations. Verified adds supported client-evidence
            relationships.
          </p>
        </div>
        <div>
          <h3>Your professional adjustment</h3>
          <p>
            Expected impact, business importance, team capacity and release
            timing inform your review. These are not automatically calculated
            business-value weights or growth forecasts.
          </p>
        </div>
      </div>
      <details className={`${styles.disclosure} ${styles.planDemo}`}>
        <summary>
          Try adjusting the three-action plan <span>Isolated website demo</span>
        </summary>
        <ActionPlanDemo />
      </details>
    </section>
  );
}
