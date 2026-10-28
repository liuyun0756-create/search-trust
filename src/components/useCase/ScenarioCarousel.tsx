"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { PracticeScenario } from "./practice-scenarios";
import { ScenarioStoryCard } from "./ScenarioStoryCard";
import s from "./practice-workbench.module.css";

export function ScenarioCarousel({
  items,
  activeIndex,
  onActiveIndexChange,
  isVisible,
  label,
}: {
  items: PracticeScenario[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  isVisible: boolean;
  label: string;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const pendingIndex = useRef<number | null>(null);
  const settleTimer = useRef<number | null>(null);
  const pendingTimer = useRef<number | null>(null);
  const interactionTimer = useRef<number | null>(null);
  const userScroll = useRef(false);
  const visibleRef = useRef(isVisible);
  visibleRef.current = isVisible;
  const activeIndexRef = useRef(activeIndex);
  const onChangeRef = useRef(onActiveIndexChange);
  activeIndexRef.current = activeIndex;
  onChangeRef.current = onActiveIndexChange;

  const getTargets = useCallback(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return [];
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    return Array.from(track.children, (child) =>
      Math.min(max, Math.max(0, (child as HTMLElement).offsetLeft)),
    );
  }, []);

  const nearestIndex = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return 0;
    const targets = getTargets();
    return targets.reduce(
      (closest, target, index) =>
        Math.abs(target - viewport.scrollLeft) <
        Math.abs(targets[closest] - viewport.scrollLeft)
          ? index
          : closest,
      0,
    );
  }, [getTargets]);

  const settle = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || !visibleRef.current) return;
    const index = nearestIndex();
    const target = getTargets()[pendingIndex.current ?? index];
    if (
      pendingIndex.current !== null &&
      target !== undefined &&
      Math.abs(viewport.scrollLeft - target) > 2
    )
      return;
    pendingIndex.current = null;
    if (index !== activeIndexRef.current) onChangeRef.current(index);
  }, [getTargets, nearestIndex]);

  function scrollToIndex(index: number, behavior: ScrollBehavior) {
    const viewport = viewportRef.current;
    const target = getTargets()[index];
    if (!viewport || target === undefined) return;
    if (typeof viewport.scrollTo === "function")
      viewport.scrollTo({ left: target, behavior });
    else viewport.scrollLeft = target;
  }

  useLayoutEffect(() => {
    if (!isVisible) {
      pendingIndex.current = null;
      if (settleTimer.current !== null)
        window.clearTimeout(settleTimer.current);
      if (pendingTimer.current !== null)
        window.clearTimeout(pendingTimer.current);
      if (interactionTimer.current !== null)
        window.clearTimeout(interactionTimer.current);
      userScroll.current = false;
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (document.activeElement instanceof HTMLElement) {
      const focusedCard = document.activeElement.closest(`.${s.storyCard}`);
      if (
        focusedCard &&
        focusedCard !== trackRef.current?.children[activeIndex]
      ) {
        viewport.focus();
      }
    }
    pendingIndex.current = activeIndex;
    scrollToIndex(activeIndex, "auto");
    if (pendingTimer.current !== null)
      window.clearTimeout(pendingTimer.current);
    pendingTimer.current = window.setTimeout(() => {
      pendingIndex.current = null;
      settle();
    }, 250);
    // Reposition on a change of selected story or visible group; measurements stay local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const align = () => {
      if (visibleRef.current) scrollToIndex(activeIndexRef.current, "auto");
    };
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(align);
    observer?.observe(viewport);
    Array.from(track.children).forEach((child) => observer?.observe(child));
    void document.fonts?.ready.then(align);
    return () => observer?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  useEffect(
    () => () => {
      if (settleTimer.current !== null)
        window.clearTimeout(settleTimer.current);
      if (pendingTimer.current !== null)
        window.clearTimeout(pendingTimer.current);
      if (interactionTimer.current !== null)
        window.clearTimeout(interactionTimer.current);
    },
    [],
  );

  function onScroll() {
    if (!visibleRef.current || !userScroll.current) return;
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, 130);
    if (interactionTimer.current !== null)
      window.clearTimeout(interactionTimer.current);
    interactionTimer.current = window.setTimeout(() => {
      userScroll.current = false;
    }, 1000);
  }

  function interruptProgrammaticScroll() {
    pendingIndex.current = null;
    userScroll.current = true;
    if (pendingTimer.current !== null)
      window.clearTimeout(pendingTimer.current);
  }

  return (
    <div
      ref={viewportRef}
      className={s.storyViewport}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      tabIndex={0}
      onScroll={onScroll}
      onPointerDown={interruptProgrammaticScroll}
      onWheel={interruptProgrammaticScroll}
      onKeyDown={interruptProgrammaticScroll}
    >
      <div ref={trackRef} className={s.storyTrack}>
        {items.map((scenario, index) => (
          <ScenarioStoryCard
            key={scenario.id}
            scenario={scenario}
            isActive={isVisible && index === activeIndex}
            position={index + 1}
            count={items.length}
          />
        ))}
      </div>
    </div>
  );
}
