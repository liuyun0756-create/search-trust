"use client";

import { useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Check, ClipboardCheck, FileSearch, MessagesSquare, Search, TrendingUp } from "lucide-react";

import styles from "./reasoning-decision.module.css";

const stories = [
  {
    number: "01", category: "Page strategy", tabTitle: "Build a new page?",
    question: "A competitor has a service page. Do we need one too?",
    scope: "Core service · existing URL · query intent",
    diagram: ["Existing page", "Service details", "Contact step"],
    diagramLabel: "Follow the page, not the competitor's template",
    stages: [
      {
        headline: "A competitor's page raises a question—not a brief.",
        fields: [
          ["Public observation", "In this example, service information is scattered across the pages checked. A confirmed competitor has a dedicated page."],
          ["Client to confirm", "Is there an existing service URL we missed? Is this service a business priority, and which areas does it cover?"],
        ],
      },
      {
        headline: "Check what the existing page already serves.",
        fields: [
          ["GSC · page + queries", "The example page has impressions and clicks for related service queries. Check whether the query intent matches its content."],
          ["Page + business details", "The client confirms the URL and priority. The page review finds unclear service scope, process and contact steps."],
          ["Before reviewing results", "Confirm GA4 event definitions, the same-page baseline and any redesign or tracking changes."],
        ],
      },
      {
        headline: "Improve the page already in place.",
        fields: [
          ["Proposed work", "Add confirmed service details and clear contact steps to the existing URL. Consider a new page only after verifying a genuine gap."],
          ["Completion + review", "Check the published information and contact route; record the change date, then revisit the same page and agreed metrics."],
        ],
      },
    ],
    limit: "Not proven: page content caused fewer enquiries. Search exposure and clicks do not establish that cause.",
    clientWording: "This service already has a page attracting relevant searches. Let's clarify the service and contact steps there before creating another page, then review the same URL after the change.",
  },
  {
    number: "02", category: "Local competition", tabTitle: "Copy a competitor?",
    question: "A competitor outranks us. Should we copy their page?",
    scope: "Service · search location · result type",
    diagram: ["Same service?", "Same location?", "Same result type?"],
    diagramLabel: "Qualify the comparison before borrowing the solution",
    stages: [
      {
        headline: "First, establish whether this is a useful comparison.",
        fields: [
          ["Search context", "Keep the query and observation location. Separate organic listings from local results and service providers from directories."],
          ["Client to confirm", "Does this business offer the same service in the same area? Which service matters most to the client's current work?"],
        ],
      },
      {
        headline: "Find the client's gap, not the competitor's formula.",
        fields: [
          ["GSC · query → page", "Check which client URL receives relevant searches and whether that page answers the same service intent."],
          ["Page comparison", "Compare specific service details, coverage and contact information. Record a missing explanation—not just a different layout."],
          ["Business confirmation", "Ask for accurate service materials and confirm any conflicting public business details before proposing corrections."],
        ],
      },
      {
        headline: "Recommend a specific fix, not a copy.",
        fields: [
          ["If a gap is confirmed", "Name the affected client page or business field, the missing information and the materials needed to correct it."],
          ["If the comparison fails", "Revisit the competitor set. Do not turn an unrelated ranking result into a client task."],
        ],
      },
    ],
    limit: "A competitor's position does not prove why it ranks—or that copying its page would improve this client's performance.",
    clientWording: "Before copying another site's page, we'll confirm it serves the same searches. Then we'll address a specific gap in your own page, using business details you can verify.",
  },
  {
    number: "03", category: "Enquiries & measurement", tabTitle: "Why fewer enquiries?",
    question: "Enquiries are falling. Is the page the cause?",
    scope: "Service page · organic visits · contact events",
    diagram: ["Search visit", "Contact route", "Recorded event"],
    diagramLabel: "Check each handoff · a recorded event is not lead quality",
    stages: [
      {
        headline: "Define what the client means by “fewer”.",
        fields: [
          ["Client to confirm", "Fewer actual enquiries, or fewer recorded events? Since when, for which service and area?"],
          ["Public contact path", "Inspect phone links, form entry points and contact instructions. Private lead volume and quality remain unknown."],
        ],
      },
      {
        headline: "Trace the same page through search and measurement.",
        fields: [
          ["GSC · page + queries", "Compare relevant impressions, clicks and CTR within a consistent page, query and date scope."],
          ["GA4 · organic landing page", "Check visits and relevant key events; verify their definitions and collection. A phone-link click is not a completed call."],
          ["SEO / client checks", "Test the form and contact route. Confirm actual enquiry feedback, redesign dates and tracking changes."],
        ],
      },
      {
        headline: "Fix what evidence supports first.",
        fields: [
          ["Measurement or route fails", "Verify tracking or repair the contact path first, then check it works before interpreting the trend."],
          ["Page content has a clear gap", "Compare its business importance and supporting evidence with other actions before prioritizing a rewrite."],
        ],
      },
    ],
    limit: "No single metric proves why enquiries changed. Keep actual lead feedback and concurrent changes in view.",
    clientWording: "We'll check the contact route and measurement alongside search data first. Then we can agree what to fix without assuming page content caused the change.",
  },
] as const;

const stageLabels = ["BEFORE ACCESS", "AFTER ACCESS", "WORK DECISION"] as const;
const stageIcons = [Search, BarChart3, ClipboardCheck] as const;
const questionIcons = [FileSearch, TrendingUp, MessagesSquare] as const;
const subscribe = () => () => {};

export function ReasoningDecisionTabs() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight": case "ArrowDown": nextIndex = (index + 1) % stories.length; break;
      case "ArrowLeft": case "ArrowUp": nextIndex = (index - 1 + stories.length) % stories.length; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = stories.length - 1; break;
      default: return;
    }
    event.preventDefault();
    setSelectedIndex(nextIndex);
    tabRefs.current[nextIndex]?.focus();
  }

  return (
    <section id="how-judgment-works" className={styles.section} aria-labelledby="reasoning-title">
      <div className={styles.inner}>
        <header className={styles.intro}>
          <p className={styles.eyebrow}>THE SEO DECISION / THREE QUESTIONS YOU HEAR</p>
          <h2 id="reasoning-title">Make a recommendation you can defend to your client.</h2>
          <p>Start with the client's question. Follow the checks, see what changes the call, and decide what belongs in the plan.</p>
        </header>

        <div className={styles.workbench}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarContent}>
              <p className={styles.eyebrow}>SELECT A CLIENT QUESTION</p>
              <div className={styles.tabs} role="tablist" aria-label="Choose a client question" aria-orientation="vertical">
                {stories.map((story, index) => {
                  const Icon = questionIcons[index];
                  return (
                    <button key={story.number} id={"reasoning-tab-" + story.number}
                      ref={(element) => { tabRefs.current[index] = element; }}
                      className={styles.tab} type="button" role="tab" disabled={!hydrated}
                      aria-selected={selectedIndex === index} aria-controls={"reasoning-panel-" + story.number}
                      tabIndex={selectedIndex === index ? 0 : -1}
                      onClick={() => setSelectedIndex(index)} onKeyDown={(event) => handleTabKeyDown(event, index)}>
                      <Icon size={19} strokeWidth={1.7} aria-hidden="true" />
                      <span><small>{story.number} / {story.category}</small><strong>{story.tabTitle}</strong></span>
                      <ArrowRight size={16} className={styles.tabArrow} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              <p className={styles.exampleNote}>Method illustrations, not real client results.</p>
              <p className={styles.sidebarNote}>A check to make is not a finding.<br />A finding is not yet a cause.</p>
            </div>
          </aside>

          {stories.map((story, storyIndex) => (
            <article key={story.number} id={"reasoning-panel-" + story.number} className={styles.panel}
              role="tabpanel" aria-labelledby={"reasoning-tab-" + story.number}
              tabIndex={selectedIndex === storyIndex ? 0 : -1} hidden={selectedIndex !== storyIndex}>
              <header className={styles.storyHeading}>
                <p className={styles.eyebrow}>DECISION RECORD / {story.number}</p>
                <h3>{story.question}</h3>
                <p className={styles.scope}><span>IN SCOPE</span>{story.scope}</p>
              </header>

              <figure className={styles.diagram}>
                <div>{story.diagram.map((item, index) => (
                  <span key={item}><span className={styles.diagramNode}>{index + 1}</span>{item}{index < 2 && <ArrowRight size={14} aria-hidden="true" />}</span>
                ))}</div>
                <figcaption>{story.diagramLabel}</figcaption>
              </figure>

              <div className={styles.stages} aria-label={"How the SEO decision develops for question " + story.number}>
                {story.stages.map((stage, index) => {
                  const Icon = stageIcons[index];
                  return (
                    <section key={stageLabels[index]} className={styles.stage + (index === 2 ? " " + styles.decision : "")} aria-labelledby={"reasoning-" + story.number + "-stage-" + index}>
                      <div className={styles.stageMarker} aria-hidden="true"><Icon size={19} strokeWidth={1.7} /><span>0{index + 1}</span></div>
                      <div className={styles.stageContent}>
                        <p className={styles.stageLabel}><span>{stageLabels[index]}</span>{index === 2 && <span className={styles.reviewStatus}><Check size={12} aria-hidden="true" /> For SEO review</span>}</p>
                        <h4 id={"reasoning-" + story.number + "-stage-" + index}>{stage.headline}</h4>
                        <dl className={styles.fields}>{stage.fields.map(([label, detail]) => (
                          <div key={label}><dt>{label}</dt><dd>{detail}</dd></div>
                        ))}</dl>
                      </div>
                    </section>
                  );
                })}
              </div>
              <p className={styles.limit}><strong>Keep in view</strong> {story.limit}</p>
              <div className={styles.clientSummary}>
                <MessagesSquare size={19} strokeWidth={1.7} aria-hidden="true" />
                <div><p className={styles.eyebrow}>IN THE CLIENT CONVERSATION · EXAMPLE WORDING</p><blockquote>“{story.clientWording}”</blockquote></div>
              </div>
            </article>
          ))}
        </div>

        <div className={styles.review}>
          <ClipboardCheck size={23} strokeWidth={1.7} aria-hidden="true" />
          <div><p className={styles.eyebrow}>SEO REVIEW BEFORE DELIVERY</p>
            <h3>Make the final call yours.</h3>
            <p>Reorder and edit the action plan—scope, steps, completion standard and review—then save a draft and approve it before sharing.</p>
            <p className={styles.reviewNote}>Source observations stay unchanged. A new scope needs its own supporting evidence.</p>
          </div>
          <Link href="/framework">See the complete method and examples <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}
