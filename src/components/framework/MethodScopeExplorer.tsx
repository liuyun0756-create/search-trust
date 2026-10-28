"use client";

import { useId, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Building2,
  Check,
  ClipboardCheck,
  FileSearch,
  FileText,
  GitCompareArrows,
  MapPin,
  MousePointer2,
  Search,
  ShieldCheck,
  Target,
} from "lucide-react";
import styles from "./method-visuals.module.css";

const scopes = [
  {
    title: "Business & competition",
    icon: Building2,
    group: "Business & public evidence",
    question: "Are these businesses competing for the same demand?",
    evidence: [
      "Public search context and confirmed competitors.",
      "Services and target locations.",
    ],
    checks: [
      "Confirm service fit, intent and the observed location.",
      "Distinguish direct competitors from directories.",
    ],
    outcome:
      "Confirm the comparison before turning a market difference into a task.",
    kind: "competition",
  },
  {
    title: "Pages & access",
    icon: FileSearch,
    question: "Is the right page available for this service?",
    evidence: [
      "Discovered pages and checked responses.",
      "Selected page content and service coverage.",
    ],
    checks: [
      "Confirm missed pages and intended targets.",
      "Selected-page checks are not an exhaustive crawl.",
    ],
    outcome:
      "Decide whether to inspect an existing page or verify a possible page gap.",
    kind: "pages",
  },
  {
    title: "Public business identity",
    icon: MapPin,
    question: "Do the website and public profile agree?",
    evidence: [
      "Available names, phone numbers and website links.",
      "Locations and published service areas.",
    ],
    checks: [
      "Check branches, tracking numbers and current details.",
      "Confirm a difference before calling it an error.",
    ],
    outcome:
      "Separate information that needs correction from differences the client must explain.",
    kind: "identity",
  },
  {
    title: "Content & credibility",
    icon: ShieldCheck,
    question: "Can a visitor understand and trust this offer?",
    evidence: [
      "Service details, business identity and page evidence.",
      "L1–L8 helps organize the content review.",
    ],
    checks: [
      "Confirm claims and supporting business materials.",
      "The eight-layer model is not Google’s ranking formula.",
    ],
    outcome:
      "Name the missing explanation or supporting material the page actually needs.",
    kind: "content",
  },
  {
    title: "Search performance",
    icon: Search,
    group: "Client performance data",
    question: "Which pages and queries need a closer look?",
    evidence: [
      "Eligible GSC impressions, clicks, CTR and average position.",
      "Corresponding queries, pages and supported periods.",
    ],
    checks: [
      "Investigate intent, demand and search-result changes.",
      "A site-wide trend is not a page diagnosis.",
    ],
    outcome:
      "Locate the affected queries and pages before choosing a modification.",
    kind: "search",
  },
  {
    title: "On-site behavior",
    icon: MousePointer2,
    question: "What happens after relevant visitors arrive?",
    evidence: [
      "Eligible GA4 landing-page traffic and engagement.",
      "Configured key events within the supported scope.",
    ],
    checks: [
      "Check what events mean and ask about lead quality.",
      "An event is not automatically a qualified enquiry.",
    ],
    outcome:
      "Identify whether the contact path or its measurement needs closer inspection.",
    kind: "behavior",
  },
  {
    title: "Measurement & review",
    icon: GitCompareArrows,
    group: "Reliability & review",
    question: "Can these observations support the same decision?",
    evidence: [
      "Available source health and target matching.",
      "Period comparisons within the supported scope.",
    ],
    checks: [
      "Check tracking changes and implementation history.",
      "Comparable periods alone do not establish cause.",
    ],
    outcome:
      "Decide whether the evidence is comparable or measurement needs checking first.",
    kind: "measurement",
  },
];

function PageOutline({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.diagramPage}>
      <div className={styles.pageChrome}>
        <i />
        <i />
        <i />
        <span>Page illustration</span>
      </div>
      <strong>
        <FileText size={16} />
        {title}
      </strong>
      {children}
    </div>
  );
}

function ScopeDiagram({ kind }: { kind: string }) {
  const arrow = <ArrowRight className={styles.diagramArrow} size={22} />;
  if (kind === "competition")
    return (
      <div className={styles.matchDiagram}>
        <div className={styles.entity}>
          <Building2 size={27} />
          <strong>Client business</strong>
          <span>Business context</span>
        </div>
        <div className={styles.matchFactors}>
          <span>
            <Target size={15} /> Service
          </span>
          <span>
            <MapPin size={15} /> Location
          </span>
          <span>
            <Search size={15} /> Search intent
          </span>
        </div>
        <div className={styles.entity}>
          <Building2 size={27} />
          <strong>Real competitor</strong>
          <span>Confirm the fit</span>
        </div>
      </div>
    );
  if (kind === "pages")
    return (
      <div className={styles.routeDiagram}>
        <div className={styles.entity}>
          <Search size={26} />
          <strong>Service demand</strong>
          <span>Which page serves it?</span>
        </div>
        {arrow}
        <div className={styles.pageOptions}>
          <span>
            <FileText size={17} /> Existing page?
          </span>
          <span className={styles.dashedNode}>
            <FileSearch size={17} /> Gap to verify
          </span>
        </div>
      </div>
    );
  if (kind === "identity")
    return (
      <div className={styles.identityDiagram}>
        {["Website", "Public profile"].map((title) => (
          <div key={title}>
            <strong>
              <Building2 size={18} />
              {title}
            </strong>
            {["Business name", "Contact details", "Service area"].map(
              (field) => (
                <span key={field}>
                  {field}
                  <GitCompareArrows size={14} />
                </span>
              ),
            )}
          </div>
        ))}
      </div>
    );
  if (kind === "content")
    return (
      <div className={styles.contentDiagram}>
        <PageOutline title="Service page">
          <span>What the service includes</span>
          <span>Who provides the service</span>
          <span>How to get in touch</span>
        </PageOutline>
        <div className={styles.annotations}>
          <span>
            <FileText size={17} /> Clear scope
          </span>
          <span>
            <ShieldCheck size={17} /> Supporting evidence
          </span>
          <span>
            <MousePointer2 size={17} /> Next step
          </span>
        </div>
      </div>
    );
  if (kind === "search")
    return (
      <div className={styles.routeDiagram}>
        <div className={styles.queryNodes}>
          <span>
            <Search size={15} /> Service queries
          </span>
          <span>
            <MapPin size={15} /> Local intent
          </span>
        </div>
        {arrow}
        <div className={styles.metricPage}>
          <FileSearch size={26} />
          <strong>Corresponding page</strong>
          <div>
            <span>Impressions</span>
            <span>Clicks</span>
            <span>CTR</span>
            <span>Position</span>
          </div>
        </div>
      </div>
    );
  if (kind === "behavior")
    return (
      <div className={styles.behaviorDiagram}>
        {[
          { icon: FileText, name: "Landing page", note: "Relevant visits" },
          {
            icon: MousePointer2,
            name: "Contact step",
            note: "Inspect the path",
          },
          {
            icon: ClipboardCheck,
            name: "Key event",
            note: "Meaning to verify",
          },
        ].map((item, i) => (
          <div key={item.name}>
            <item.icon size={24} />
            <strong>{item.name}</strong>
            <span>{item.note}</span>
            {i < 2 && <ArrowRight className={styles.flowArrow} size={18} />}
          </div>
        ))}
      </div>
    );
  return (
    <div className={styles.measureDiagram}>
      <div>
        <span>Search Console</span>
        <GitCompareArrows size={22} />
        <span>Google Analytics</span>
      </div>
      <ArrowDown size={18} />
      <div className={styles.alignment}>
        <span>Same target?</span>
        <span>Suitable dates?</span>
        <span>Comparable scope?</span>
      </div>
    </div>
  );
}

export function MethodScopeExplorer() {
  const [selected, setSelected] = useState(0);
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div className={styles.explorer}>
      <div
        className={styles.scopeNav}
        role="tablist"
        aria-label="Explore the diagnostic scope"
        aria-orientation="vertical"
      >
        {scopes.map((scope, index) => (
          <div key={scope.title} role="presentation">
            {scope.group && <p className={styles.navGroup}>{scope.group}</p>}
            <button
              type="button"
              role="tab"
              id={`${id}-tab-${index}`}
              aria-controls={`${id}-panel-${index}`}
              aria-selected={selected === index}
              tabIndex={selected === index ? 0 : -1}
              ref={(node) => {
                refs.current[index] = node;
              }}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => {
                let next = selected;
                if (event.key === "ArrowDown")
                  next = (selected + 1) % scopes.length;
                else if (event.key === "ArrowUp")
                  next = (selected + scopes.length - 1) % scopes.length;
                else if (event.key === "Home") next = 0;
                else if (event.key === "End") next = scopes.length - 1;
                else return;
                event.preventDefault();
                setSelected(next);
                refs.current[next]?.focus();
              }}
            >
              <scope.icon size={18} aria-hidden="true" />
              <span>{scope.title}</span>
              <ArrowRight
                size={15}
                className={styles.navArrow}
                aria-hidden="true"
              />
            </button>
          </div>
        ))}
      </div>
      <div className={styles.scopePanels}>
        {scopes.map((scope, index) => (
          <div
            key={scope.title}
            role="tabpanel"
            id={`${id}-panel-${index}`}
            aria-labelledby={`${id}-tab-${index}`}
            hidden={selected !== index}
            tabIndex={0}
            className={styles.scopePanel}
          >
            <div className={styles.panelHeading}>
              <span className={styles.kicker}>
                0{index + 1} / {scope.title}
              </span>
              <h3>{scope.question}</h3>
            </div>
            <div className={styles.diagram}>
              <span className={styles.diagramLabel}>
                How the check connects
              </span>
              <div aria-hidden="true">
                <ScopeDiagram kind={scope.kind} />
              </div>
            </div>
            <div className={styles.scopeFacts}>
              <div>
                <h4>
                  <FileSearch size={16} />
                  Available evidence
                </h4>
                <ul>
                  {scope.evidence.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4>
                  <ClipboardCheck size={16} />
                  SEO confirmation & limits
                </h4>
                <ul>
                  {scope.checks.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className={styles.scopeOutcome}>
              <Check size={18} aria-hidden="true" />
              <div>
                <strong>What this helps you decide</strong>
                <p>{scope.outcome}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
