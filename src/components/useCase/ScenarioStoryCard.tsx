import Link from "next/link";
import { ArrowRight, FileCheck2, FileSearch, ShieldCheck } from "lucide-react";
import { practiceGroups, type PracticeScenario } from "./practice-scenarios";
import s from "./practice-workbench.module.css";

const artifactStyles = {
  brief: s.artifactBrief,
  comparison: s.artifactComparison,
  plan: s.artifactPlan,
  revision: s.artifactRevision,
  review: s.artifactReview,
};

export function ScenarioStoryCard({
  scenario,
  isActive,
  position,
  count,
}: {
  scenario: PracticeScenario;
  isActive: boolean;
  position: number;
  count: number;
}) {
  const group = practiceGroups.find((item) => item.id === scenario.groupId)!;
  return (
    <article
      id={`practice-${scenario.id}`}
      className={s.storyCard}
      data-testid={`practice-scene-${scenario.id}`}
      aria-hidden={!isActive}
      inert={!isActive}
      aria-label={`${position} of ${count}: ${scenario.title}`}
    >
      <div className={s.storyTop}>
        <div className={s.storyNarrative}>
          <div className={s.storyKicker}>
            <span>
              {String(position).padStart(2, "0")} /{" "}
              {String(count).padStart(2, "0")}
            </span>
            <span>
              {group.number} · {group.tabLabel}
            </span>
          </div>
          <p className={s.storyShortTitle}>{scenario.shortTitle}</p>
          <h3>{scenario.title}</h3>
          <p className={s.storyText}>{scenario.story}</p>
          <div className={s.storyTension}>
            <span>Where the usual approach stalls</span>
            <p>{scenario.tension}</p>
          </div>
          <div className={s.storyAssistance}>
            <span>Where SearchTrust helps</span>
            <p>{scenario.assistance}</p>
          </div>
        </div>
        <div className={s.storyEvidence}>
          <div
            className={`${s.artifactSheet} ${artifactStyles[scenario.artifact.kind]}`}
          >
            <div className={s.artifactHead}>
              <FileSearch size={18} aria-hidden="true" />
              <span>Illustrative workflow excerpt</span>
              <small>{scenario.artifact.kind}</small>
            </div>
            <p className={s.artifactLabel}>{scenario.artifact.label}</p>
            <h4>{scenario.artifact.title}</h4>
            <dl className={s.artifactRows}>
              {scenario.artifact.items.map((item, index) => (
                <div key={item.label}>
                  <dt>
                    <span>0{index + 1}</span>
                    {item.label}
                  </dt>
                  <dd>{item.text}</dd>
                </div>
              ))}
            </dl>
            <p className={s.artifactBoundary}>
              <ShieldCheck size={17} aria-hidden="true" />
              {scenario.boundary}
            </p>
          </div>
        </div>
      </div>
      <div className={s.storyBottom}>
        <div className={s.nextMove}>
          <FileCheck2 size={19} aria-hidden="true" />
          <div>
            <span>What you do next</span>
            <p>{scenario.nextMove}</p>
          </div>
        </div>
        <div className={s.storyLinks}>
          <Link className={s.primary} href={scenario.primaryCta.href}>
            {scenario.primaryCta.label}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link className={s.secondary} href={scenario.sampleLink.href}>
            {scenario.sampleLink.label}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          {scenario.methodLink && (
            <Link
              className={s.methodLink}
              href={`/framework#method-situation-${scenario.methodLink}`}
            >
              Explore the method
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
