"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  legacyScenarioHashes,
  practiceGroups,
  practiceScenarios,
  practiceStages,
  type PracticeScenario,
  type StageId,
} from "./practice-scenarios";
import { ScenarioCarousel } from "./ScenarioCarousel";
import s from "./practice-workbench.module.css";

const initialIndexes: Record<StageId, number> = { prospect: 0, service: 0 };

const stageStories = Object.fromEntries(
  practiceStages.map((stage) => [
    stage.id,
    stage.groupIds.flatMap((groupId) => {
      const group = practiceGroups.find((item) => item.id === groupId)!;
      return group.scenarioIds.map((id) =>
        practiceScenarios.find((story) => story.id === id)!,
      );
    }),
  ]),
) as Record<StageId, PracticeScenario[]>;

function nextTabIndex(key: string, current: number, length: number) {
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (key === "ArrowRight") return (current + 1) % length;
  if (key === "ArrowLeft") return (current - 1 + length) % length;
  return null;
}

export function ScenarioWorkbench() {
  const [stageId, setStageId] = useState<StageId>("prospect");
  const [activeIndexes, setActiveIndexes] =
    useState<Record<StageId, number>>(initialIndexes);
  const stageTabs = useRef<Record<StageId, HTMLButtonElement | null>>({
    prospect: null,
    service: null,
  });

  function replaceStoryHash(story: PracticeScenario) {
    const url = new URL(window.location.href);
    url.hash = `practice-${story.id}`;
    window.history.replaceState(window.history.state, "", url);
  }

  function chooseStage(next: StageId) {
    setStageId(next);
    replaceStoryHash(stageStories[next][activeIndexes[next]]);
  }

  function chooseStory(stage: StageId, index: number) {
    const story = stageStories[stage][index];
    if (!story) return;
    setActiveIndexes((current) => ({ ...current, [stage]: index }));
    replaceStoryHash(story);
  }

  function handleStageKey(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    const next = nextTabIndex(event.key, index, practiceStages.length);
    if (next === null) return;
    event.preventDefault();
    const nextStage = practiceStages[next].id;
    chooseStage(nextStage);
    stageTabs.current[nextStage]?.focus();
  }

  useEffect(() => {
    function restoreFromHash() {
      const raw = window.location.hash.slice(1);
      if (raw === "practice-scenarios") return;
      const id = raw.startsWith("practice-")
        ? raw.slice("practice-".length)
        : legacyScenarioHashes[raw];
      const story = practiceScenarios.find((item) => item.id === id);
      if (!story) {
        if (raw) {
          setStageId("prospect");
          setActiveIndexes(initialIndexes);
        }
        return;
      }
      const group = practiceGroups.find((item) => item.id === story.groupId)!;
      const index = stageStories[group.stageId].findIndex(
        (item) => item.id === story.id,
      );
      setStageId(group.stageId);
      setActiveIndexes((current) => ({ ...current, [group.stageId]: index }));
      document
        .getElementById("practice-scenarios")
        ?.scrollIntoView?.({ block: "start" });
    }
    restoreFromHash();
    window.addEventListener("hashchange", restoreFromHash);
    window.addEventListener("popstate", restoreFromHash);
    return () => {
      window.removeEventListener("hashchange", restoreFromHash);
      window.removeEventListener("popstate", restoreFromHash);
    };
  }, []);

  return (
    <section
      id="practice-scenarios"
      className={s.workbenchSection}
      aria-labelledby="workbench-title"
    >
      {Object.keys(legacyScenarioHashes).map((id) => (
        <span key={id} id={id} className={s.anchor} aria-hidden="true" />
      ))}
      <header className={s.sectionHeading}>
        <div>
          <p className={s.eyebrow}>Choose a client situation</p>
          <h2 id="workbench-title">Where does your client work stand?</h2>
        </div>
        <p>
          Choose your stage, then move through the situations. Each card shows
          what you can review and the next decision you make.
        </p>
      </header>
      <p className={s.disclosure}>
        Fictional situations, not customer testimonials. Excerpts show how an
        SEO can use the reports—not additional report products.
      </p>
      <div
        className={s.stageTabs}
        role="tablist"
        aria-label="Choose a stage of work"
      >
        {practiceStages.map((stage, index) => (
          <button
            key={stage.id}
            type="button"
            role="tab"
            id={`practice-stage-tab-${stage.id}`}
            aria-controls={`practice-stage-panel-${stage.id}`}
            aria-selected={stageId === stage.id}
            tabIndex={stageId === stage.id ? 0 : -1}
            ref={(node) => {
              stageTabs.current[stage.id] = node;
            }}
            onClick={() => chooseStage(stage.id)}
            onKeyDown={(event) => handleStageKey(event, index)}
          >
            <span>{stage.number}</span>
            <strong>{stage.label}</strong>
            <small>{stageStories[stage.id].length} situations</small>
          </button>
        ))}
      </div>

      {practiceStages.map((stage) => {
        const items = stageStories[stage.id];
        const activeIndex = activeIndexes[stage.id];
        const visible = stageId === stage.id;
        return (
          <div
            key={stage.id}
            id={`practice-stage-panel-${stage.id}`}
            role="tabpanel"
            aria-labelledby={`practice-stage-tab-${stage.id}`}
            hidden={!visible}
            className={s.stagePanel}
          >
            <div className={s.stageIntro}>
              <p>{stage.description}</p>
              <p>
                Swipe the cards or use the arrows to explore each situation.
              </p>
            </div>
            <div className={s.storyPosition}>
              <span aria-live="polite" aria-atomic="true">
                {String(activeIndex + 1).padStart(2, "0")} /{" "}
                {String(items.length).padStart(2, "0")}
              </span>
              <button
                type="button"
                aria-label={`Previous ${stage.label} situation`}
                disabled={activeIndex === 0}
                onClick={() => chooseStory(stage.id, activeIndex - 1)}
              >
                <ChevronLeft size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Next ${stage.label} situation`}
                disabled={activeIndex === items.length - 1}
                onClick={() => chooseStory(stage.id, activeIndex + 1)}
              >
                <ChevronRight size={20} aria-hidden="true" />
              </button>
            </div>
            <ScenarioCarousel
              items={items}
              activeIndex={activeIndex}
              onActiveIndexChange={(index) => chooseStory(stage.id, index)}
              isVisible={visible}
              label={`${stage.label} situation cards`}
            />
            {stage.id === "service" && (
              <p className={s.serviceNote}>
                Service analysis starts from a completed Prospect Case, then
                adds client confirmation and eligible data access.
              </p>
            )}
          </div>
        );
      })}
    </section>
  );
}
