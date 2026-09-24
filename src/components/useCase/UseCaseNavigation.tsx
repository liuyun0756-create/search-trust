"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import type { UseCaseScene } from "./use-case-data";
import styles from "./use-cases-v22.module.css";

type NavigationScene = Pick<UseCaseScene, "number" | "shortTitle">;

export function UseCaseNavigation({ scenes }: { scenes: NavigationScene[] }) {
  const [current, setCurrent] = useState(scenes[0]?.number ?? "01");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const elements = scenes
      .map((scene) => document.getElementById(`scene-${scene.number}`))
      .filter((element): element is HTMLElement => Boolean(element));

    if (!("IntersectionObserver" in window) || elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setCurrent(visible[0].target.id.replace("scene-", ""));
      },
      { rootMargin: "-24% 0px -58%", threshold: [0, 0.05, 0.2] },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [scenes]);

  const selected = scenes.find((scene) => scene.number === current) ?? scenes[0];

  return (
    <nav className={styles.chapterNav} aria-label="In Practice scenes">
      <div className={styles.mobileChapterControl}>
        <span><small>Current scene</small><strong>{selected.number} / {scenes.length.toString().padStart(2, "0")} · {selected.shortTitle}</strong></span>
        <button type="button" aria-expanded={open} aria-controls="mobile-scene-list" onClick={() => setOpen((value) => !value)}>
          All scenes <ChevronDown aria-hidden="true" className={open ? styles.chevronOpen : undefined} />
        </button>
      </div>

      <div id="mobile-scene-list" className={`${styles.chapterList} ${open ? styles.chapterListOpen : ""}`}>
        <span className={styles.navLabel}>In practice / 06</span>
        {scenes.map((scene) => (
          <a
            key={scene.number}
            href={`#scene-${scene.number}`}
            aria-current={current === scene.number ? "step" : undefined}
            onClick={() => { setCurrent(scene.number); setOpen(false); }}
          >
            <span>{scene.number}</span>{scene.shortTitle}
          </a>
        ))}
      </div>
    </nav>
  );
}
