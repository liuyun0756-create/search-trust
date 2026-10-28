"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import styles from "./method-guide.module.css";

/** One selected panel; automatic activation with keyboard focus kept on the tab. */
export function MethodTabs({
  label,
  items,
}: {
  label: string;
  items: { label: string; caption?: string; content: ReactNode }[];
}) {
  const id = useId();
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <div className={styles.tabs}>
      <div role="tablist" aria-label={label} className={styles.tabList}>
        {items.map((item, index) => (
          <button
            key={item.label}
            type="button"
            role="tab"
            id={`${id}-tab-${index}`}
            aria-selected={selected === index}
            aria-controls={`${id}-panel-${index}`}
            tabIndex={selected === index ? 0 : -1}
            ref={(node) => {
              tabs.current[index] = node;
            }}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              let next = selected;
              if (event.key === "ArrowRight")
                next = (selected + 1) % items.length;
              else if (event.key === "ArrowLeft")
                next = (selected - 1 + items.length) % items.length;
              else if (event.key === "Home") next = 0;
              else if (event.key === "End") next = items.length - 1;
              else return;
              event.preventDefault();
              setSelected(next);
              tabs.current[next]?.focus();
            }}
          >
            <span>{item.label}</span>
            {item.caption && <small>{item.caption}</small>}
          </button>
        ))}
      </div>
      {items.map((item, index) => (
        <div
          key={item.label}
          role="tabpanel"
          id={`${id}-panel-${index}`}
          aria-labelledby={`${id}-tab-${index}`}
          hidden={selected !== index}
          tabIndex={0}
          className={styles.tabPanel}
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
