"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { methodChapters, type MethodStageId } from "./method-case";

type JourneyContextValue = { active: MethodStageId; select: (id: MethodStageId) => void };
const JourneyContext = createContext<JourneyContextValue | null>(null);

export function MethodJourney({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<MethodStageId>(methodChapters[0].id);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = Math.min(window.innerHeight * 0.42, 380);
      let current: MethodStageId = methodChapters[0].id;
      for (const chapter of methodChapters) {
        const heading = document.getElementById(chapter.id);
        const stage = heading?.closest("[data-method-stage]") ?? heading?.closest("section") ?? heading;
        if (stage && stage.getBoundingClientRect().top <= line) current = chapter.id;
      }
      setActive(current);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("hashchange", schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", schedule);
    };
  }, []);

  const value = useMemo(() => ({ active, select: setActive }), [active]);
  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useMethodJourney() {
  const value = useContext(JourneyContext);
  if (!value) throw new Error("Method journey components must be inside MethodJourney");
  return value;
}
