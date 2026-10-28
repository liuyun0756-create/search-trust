import styles from "./method-guide.module.css";
import visual from "./method-visuals.module.css";
import { MethodScopeExplorer } from "./MethodScopeExplorer";
import { Layers3, MapPin, Search, GitCompareArrows } from "lucide-react";
import { MethodTabs } from "./MethodTabs";
import { Heading, Reference, sources } from "./method-guide-shared";
const breadthExamples = [
  {
    label: "A competitor ranks higher",
    caption: "Local competition",
    icon: MapPin,
    question: "Is the ranking gap actually a fixable business issue?",
    checks:
      "Confirm the service, location and search intent. Compare the available business and page information before turning a competitor difference into a task.",
    decision:
      "If the client’s own information is wrong, propose that correction. A different local position alone is not enough to justify copying the competitor’s page.",
    limit:
      "SEO check: local context and current business details. A single search snapshot does not establish a ranking cause.",
    source: sources.local,
    sourceLabel: "Google guidance: local ranking",
  },
  {
    label: "Impressions hold. Clicks fall.",
    caption: "Search performance",
    icon: Search,
    question:
      "Should you rewrite the title—or investigate a different query mix?",
    checks:
      "Identify affected pages and queries, then compare clicks, CTR and position in a suitable period. The SEO checks search intent and the current results presentation.",
    decision:
      "If the loss is tied to different queries, investigate that shift first. Only propose a title or page change when target-specific evidence supports it.",
    limit:
      "SEO check: demand, seasonality and search-result changes. An aggregate trend does not establish the cause.",
    source: sources.search,
    sourceLabel: "Google guidance: traffic changes",
  },
  {
    label: "GSC and GA4 diverge",
    caption: "Measurement",
    icon: GitCompareArrows,
    question: "Are the sources in conflict—or measuring different things?",
    checks:
      "Align the property, dates, landing pages and Google organic traffic scope. The SEO checks tracking, consent and URL differences before interpreting the disagreement.",
    decision:
      "Investigate measurement before recommending a content change. Keep both signals visible; do not force clicks and sessions to match.",
    limit:
      "SEO check: configuration and release history. Clicks and sessions are different measurements, not interchangeable totals.",
    source: sources.measurement,
    sourceLabel: "Google guidance: GSC and Analytics",
  },
];

export function MethodScope() {
  return (
    <section id="method-scope" className={styles.section}>
      <Heading
        number="01"
        label="Scope & boundaries"
        title="Start wider than the page."
      >
        Connect the business, the search context and the available performance
        evidence. A report names its checked scope; the wider method also
        includes checks the SEO must complete.
      </Heading>
      <MethodScopeExplorer />
      <p className={styles.note}>
        Availability depends on the sources, pages and eligible data in the
        Case. This is not a promise of exhaustive technical, backlink or local
        rank-grid coverage.
      </p>
      <div className={`${styles.breadth} ${visual.breadthCompact}`}>
        <div className={styles.subheading}>
          <Layers3 size={21} aria-hidden="true" />
          <h3>Try a diagnostic question.</h3>
        </div>
        <p className={styles.note}>
          Conditional method examples · not collected findings or real client
          results.
        </p>
        <MethodTabs
          label="Explore a diagnostic question"
          items={breadthExamples.map((example) => ({
            label: example.label,
            caption: example.caption,
            content: (
              <article className={styles.exampleBody}>
                <div className={styles.exampleQuestion}>
                  <example.icon size={25} aria-hidden="true" />
                  <h4>{example.question}</h4>
                </div>
                <div className={styles.twoColumns}>
                  <div>
                    <span className={styles.eyebrow}>
                      Check before recommending
                    </span>
                    <p>{example.checks}</p>
                  </div>
                  <div>
                    <span className={styles.eyebrow}>
                      How the decision could change
                    </span>
                    <p>{example.decision}</p>
                  </div>
                </div>
                <p className={styles.note}>{example.limit}</p>
                <Reference href={example.source}>
                  {example.sourceLabel}
                </Reference>
              </article>
            ),
          }))}
        />
        <p className={styles.note}>
          These references support general principles, not a Google endorsement
          of SearchTrust or validation of its proprietary model.
        </p>
      </div>
    </section>
  );
}
