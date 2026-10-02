"use client";
import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { methodChapters } from "./method-case";
import { useMethodJourney } from "./MethodJourney";

export { methodChapters } from "./method-case";

export function MethodNavigation() {
  const { active, select } = useMethodJourney();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const index = methodChapters.findIndex((chapter) => chapter.id === active);
  return <nav className="method-nav" aria-label="Our Method chapters" onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); } }}>
    <div className="method-nav-inner">
      <span className="method-nav-brand">ONE CASE, SIX DECISIONS <span>/ 06</span></span>
      <button ref={toggle} className="method-nav-toggle" type="button" aria-expanded={open} aria-controls="method-chapter-links" onClick={() => setOpen(!open)}><span><span className="method-nav-toggle-kicker">CASE PROGRESS</span>0{index + 1}/06 · {methodChapters[index]?.label}</span><ChevronDown aria-hidden="true" size={17} /></button>
      <ol id="method-chapter-links" className={open ? "method-nav-links is-open" : "method-nav-links"}>{methodChapters.map((chapter, i) => <li key={chapter.id}><a href={`#${chapter.id}`} aria-current={active === chapter.id ? "step" : undefined} data-past={i < index ? "true" : undefined} onClick={() => { select(chapter.id); setOpen(false); requestAnimationFrame(() => { const target = document.getElementById(chapter.id); target?.setAttribute("tabindex", "-1"); target?.focus({ preventScroll: true }); }); }}><span className="method-nav-marker" aria-hidden="true">{i < index ? "✓" : `0${i + 1}`}</span><span className="method-nav-label">{chapter.label}<small>{chapter.output}</small></span></a></li>)}</ol>
    </div>
  </nav>;
}
