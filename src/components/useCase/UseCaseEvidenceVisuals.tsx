import type { EvidenceVisualKind } from "./use-case-data";
import styles from "./use-cases-v22.module.css";

type EvidenceVisualProps = {
  kind: EvidenceVisualKind;
};

const sourceItems = [
  ["W", "Website", "Services and available pages"],
  ["B", "Business identity", "Public information and fit"],
  ["S", "Search context", "Location, service and intent"],
  ["C", "Competition", "A confirmed real competitor"],
];

function PublicEvidenceVisual() {
  return (
    <div className={styles.evidenceVisual} role="img" aria-label="Four public evidence sources combine into a responsible first client discussion">
      <div className={styles.visualHeader}><span>Public evidence file</span><span className={styles.statusPill}>4 sources checked</span></div>
      <p className={styles.visualQuestion}>What can the SEO responsibly discuss now?</p>
      <div className={styles.sourceList}>
        {sourceItems.map(([letter, title, detail]) => (
          <div className={styles.sourceItem} key={title}>
            <span className={styles.sourceMark}>{letter}</span>
            <span><strong>{title}</strong><small>{detail}</small></span>
          </div>
        ))}
      </div>
      <div className={styles.visualDecision}><span>Working decision</span><strong>Lead with a specific business problem.</strong></div>
    </div>
  );
}

function PageDecisionVisual() {
  return (
    <div className={styles.evidenceVisual} role="img" aria-label="A page decision path compares an existing page, evidence and business fit before choosing an action">
      <div className={styles.visualHeader}><span>Page decision path</span><span className={styles.statusPill}>One service</span></div>
      <div className={styles.decisionPath}>
        <div className={styles.pathPrompt}><span>01</span><strong>Does a matching page already exist?</strong><small>Client confirmation + site review</small></div>
        <div className={styles.pathPrompt}><span>02</span><strong>Is it already receiving relevant demand?</strong><small>Queries + page-level evidence</small></div>
        <div className={styles.pathPrompt}><span>03</span><strong>Can the current page support the service?</strong><small>Business priority + usable material</small></div>
      </div>
      <div className={styles.threeOutcomes}>
        <span>Improve existing</span><span>Investigate first</span><span>Add only if confirmed</span>
      </div>
      <div className={styles.visualDecision}><span>Selected path</span><strong>Improve the page already doing the work.</strong></div>
    </div>
  );
}

function IdentityConflictVisual() {
  const rows = [
    ["Business name", "North & Co Heating", "North Co. Heating", "Partial match"],
    ["Phone", "020 7946 0182", "020 7946 0188", "Conflict"],
    ["Service area", "Not stated", "Not stated", "Missing"],
  ];
  return (
    <div className={styles.evidenceVisual} role="img" aria-label="Business identity fields are compared individually and marked as partial matches, conflicts or missing">
      <div className={styles.visualHeader}><span>Identity comparison</span><span className={styles.statusPill}>Field by field</span></div>
      <div className={styles.comparisonLabels}><span>Field</span><span>Website</span><span>Public profile</span><span>Status</span></div>
      <div className={styles.comparisonRows}>
        {rows.map(([field, website, profile, status]) => (
          <div className={styles.comparisonRow} key={field}>
            <strong>{field}</strong><span data-label="Website">{website}</span><span data-label="Public profile">{profile}</span><em data-state={status}>{status}</em>
          </div>
        ))}
      </div>
      <div className={styles.visualDecision}><span>Next move</span><strong>Confirm the truth, then assign the correction.</strong></div>
    </div>
  );
}

function SearchPathVisual() {
  const nodes = [
    ["01", "Query", "Relevant service intent"],
    ["02", "Landing page", "The page receiving demand"],
    ["03", "Page experience", "Offer and contact path"],
    ["04", "Key event", "Configured and checked"],
  ];
  return (
    <div className={styles.evidenceVisual} role="img" aria-label="Evidence follows a search query through the landing page and page experience to a configured key event">
      <div className={styles.visualHeader}><span>One evidence path</span><span className={styles.statusPill}>GSC + GA4</span></div>
      <div className={styles.searchPath}>
        {nodes.map(([number, title, detail]) => (
          <div className={styles.searchNode} key={number}><span>{number}</span><strong>{title}</strong><small>{detail}</small></div>
        ))}
      </div>
      <div className={styles.signalRow}><span data-tone="support">Supports</span><span data-tone="conflict">Conflicts</span><span data-tone="open">Still open</span><span data-tone="check">Check measurement</span></div>
      <div className={styles.visualDecision}><span>Working decision</span><strong>Narrow the cause before changing the page.</strong></div>
    </div>
  );
}

function PriorityStackVisual() {
  const actions = [
    ["01", "Improve the core service page", "Demand + business value + clear page issue"],
    ["02", "Confirm and correct business details", "Identity conflict + direct correction path"],
    ["03", "Check enquiry measurement", "Required before reliable review"],
  ];
  return (
    <div className={styles.evidenceVisual} role="img" aria-label="Three priority actions are ordered with a visible reason and no unexplained score">
      <div className={styles.visualHeader}><span>Recommended starting plan</span><span className={styles.statusPill}>SEO editable</span></div>
      <div className={styles.priorityList}>
        {actions.map(([number, action, reason]) => (
          <div className={styles.priorityItem} key={number}>
            <span className={styles.priorityNumber}>{number}</span>
            <span><strong>{action}</strong><small>{reason}</small></span>
            <span className={styles.grip} aria-hidden="true">⠿</span>
          </div>
        ))}
      </div>
      <div className={styles.priorityBasis}><span>Impact</span><span>Business value</span><span>Severity</span><span>Evidence</span><span>Dependencies</span></div>
      <div className={styles.visualDecision}><span>Working decision</span><strong>Start with work the team can explain and verify.</strong></div>
    </div>
  );
}

function ReviewTimelineVisual() {
  const stages = [
    ["Planned", "Improve the confirmed service page", "Scope approved"],
    ["Implemented", "Service and contact information updated", "Change recorded"],
    ["Reviewed", "Same page and evidence checked again", "Limits retained"],
    ["Next decision", "Keep, adjust, pause or investigate", "SEO review"],
  ];
  return (
    <div className={styles.evidenceVisual} role="img" aria-label="The report keeps planned, implemented, reviewed and next-decision states separate">
      <div className={styles.visualHeader}><span>Action history</span><span className={styles.statusPill}>One object over time</span></div>
      <div className={styles.timeline}>
        {stages.map(([stage, action, status], index) => (
          <div className={styles.timelineItem} key={stage}>
            <span className={styles.timelineMarker}>{String(index + 1).padStart(2, "0")}</span>
            <span><small>{stage}</small><strong>{action}</strong></span>
            <em>{status}</em>
          </div>
        ))}
      </div>
      <div className={styles.visualDecision}><span>Review rule</span><strong>Describe change without inventing causation.</strong></div>
    </div>
  );
}

export function UseCaseEvidenceVisual({ kind }: EvidenceVisualProps) {
  if (kind === "public-evidence") return <PublicEvidenceVisual />;
  if (kind === "page-decision") return <PageDecisionVisual />;
  if (kind === "identity-conflict") return <IdentityConflictVisual />;
  if (kind === "search-path") return <SearchPathVisual />;
  if (kind === "priority-stack") return <PriorityStackVisual />;
  return <ReviewTimelineVisual />;
}
