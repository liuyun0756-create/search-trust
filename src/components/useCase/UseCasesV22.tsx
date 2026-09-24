import Link from "next/link";
import { ArrowDown, ArrowRight, Check, MoveRight } from "lucide-react";

import { RunAuditButton } from "@/components/common/RunAuditButton";

import { UseCaseEvidenceVisual } from "./UseCaseEvidenceVisuals";
import { UseCaseNavigation } from "./UseCaseNavigation";
import { useCaseScenes, type UseCaseScene } from "./use-case-data";
import styles from "./use-cases-v22.module.css";

function StoryLabel({ children }: { children: React.ReactNode }) {
  return <p className={styles.storyLabel}>{children}</p>;
}

function SceneStory({ scene, index }: { scene: UseCaseScene; index: number }) {
  const next = useCaseScenes[index + 1];

  return (
    <article id={`scene-${scene.number}`} className={styles.scene} data-scene={scene.number} aria-labelledby={`scene-title-${scene.number}`}>
      <div className={styles.sceneInner}>
        <header className={styles.sceneHeader}>
          <div className={styles.sceneMeta}>
            <span>{scene.number} / {scene.group}</span>
            <i aria-hidden="true" />
            <span>{scene.trigger}</span>
          </div>
          <h2 id={`scene-title-${scene.number}`}>{scene.title}</h2>
          <p className={styles.sceneMoment}>{scene.moment}</p>
        </header>

        <div className={styles.problemStory}>
          <div>
            <StoryLabel>The problem</StoryLabel>
            <p>{scene.problem}</p>
          </div>
          <div>
            <StoryLabel>The real issue</StoryLabel>
            <p>{scene.realIssue}</p>
          </div>
        </div>

        <div className={styles.visualStage}>
          <UseCaseEvidenceVisual kind={scene.visual} />
          <p className={styles.visualNote}>Illustrated method example · not a real client result</p>
        </div>

        <div className={styles.reasoningStage}>
          <div className={styles.analysisBlock}>
            <StoryLabel>How the problem gets analysed</StoryLabel>
            <ul>
              {scene.analysis.map((item) => <li key={item}><Check aria-hidden="true" />{item}</li>)}
            </ul>
          </div>
          <div className={styles.handlingBlock}>
            <StoryLabel>How SearchTrust handles it</StoryLabel>
            <p>{scene.handling}</p>
          </div>
        </div>

        <section className={styles.decisionStage} aria-label={`Working decision for scene ${scene.number}`}>
          <span>Working decision</span>
          <p>{scene.decision}</p>
        </section>

        <section className={styles.outcomeStage} aria-labelledby={`outcome-title-${scene.number}`}>
          <div className={styles.outcomeHeading}>
            <StoryLabel>What the SEO takes forward</StoryLabel>
            <h3 id={`outcome-title-${scene.number}`}>A decision that can move into real work.</h3>
          </div>
          <div className={styles.outcomeList}>
            {scene.outcomes.map((outcome, outcomeIndex) => (
              <div key={outcome.label}>
                <span>{String(outcomeIndex + 1).padStart(2, "0")}</span>
                <p><strong>{outcome.label}</strong>{outcome.text}</p>
              </div>
            ))}
          </div>
          <div className={styles.seoCall}>
            <span>SEO keeps the final call</span>
            <p>{scene.seoKeeps}</p>
          </div>
          {scene.link ? (
            <Link href={scene.link.href} className={styles.routeLink}>{scene.link.label}<ArrowRight aria-hidden="true" /></Link>
          ) : null}
        </section>

        {next ? (
          <a href={`#scene-${next.number}`} className={styles.sceneTransition}>
            <span><small>Next work moment</small><strong>{scene.transition}</strong></span>
            <span className={styles.nextScene}>{next.number}<ArrowDown aria-hidden="true" /></span>
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function UseCasesV22() {
  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>In practice / six real work moments</p>
            <h1>Know what to examine when the next SEO decision matters.</h1>
            <p className={styles.heroIntro}>See how SearchTrust helps an SEO move from a client’s real situation to a responsible decision—before the proposal, during delivery and when the work needs reviewing.</p>
            <p className={styles.heroPromise}><span aria-hidden="true" />Each story ends with evidence, a working decision and something the SEO can take forward.</p>
            <a href="#scene-01" className={styles.scrollLink}>Read the first work moment<ArrowDown aria-hidden="true" /></a>
          </div>

          <div className={styles.sceneIndex}>
            <p>Choose the moment that looks familiar</p>
            <ol>
              {useCaseScenes.map((scene) => (
                <li key={scene.number}>
                  <a href={`#scene-${scene.number}`}>
                    <span>{scene.number}</span>
                    <strong>{scene.shortTitle}</strong>
                    <MoveRight aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <UseCaseNavigation scenes={useCaseScenes} />

      <section className={styles.storyIntro} aria-labelledby="stories-title">
        <div>
          <p className={styles.eyebrow}>Six situations / one working discipline</p>
          <h2 id="stories-title">Start with the problem. Keep the evidence visible. Make the next move explicit.</h2>
        </div>
        <p>These are not feature tours. Each chapter follows a normal SEO working story: what happened, what the problem really means, how it gets analysed, how SearchTrust helps and what the SEO receives.</p>
      </section>

      <div className={styles.sceneCollection}>
        {useCaseScenes.map((scene, index) => <SceneStory key={scene.number} scene={scene} index={index} />)}
      </div>

      <section className={styles.finalCta}>
        <div>
          <p className={styles.eyebrow}>Your expertise / a clearer evidence trail</p>
          <h2>Bring one real business. Leave with a decision you can defend.</h2>
          <p>Start with the website and business context. SearchTrust organises what can be observed, what still needs confirmation and which actions are worth discussing next.</p>
        </div>
        <div className={styles.finalActions}>
          <RunAuditButton trackingSource="use_cases_v22" className={styles.primaryAction}>Start with one business<ArrowRight aria-hidden="true" /></RunAuditButton>
          <Link href="/sample-report" className={styles.secondaryAction}>See the complete report example<ArrowRight aria-hidden="true" /></Link>
        </div>
      </section>
    </main>
  );
}
