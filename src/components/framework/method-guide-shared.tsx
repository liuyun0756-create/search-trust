import { ArrowRight } from "lucide-react";
import styles from "./method-guide.module.css";
export const sources = {
  local: "https://support.google.com/business/answer/7091?hl=en",
  search:
    "https://developers.google.com/search/docs/monitor-debug/debugging-search-traffic-drops",
  measurement:
    "https://developers.google.com/search/docs/monitor-debug/google-analytics-search-console",
};

export function Reference({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      className={styles.reference}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ArrowRight size={14} aria-hidden="true" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export function Heading({
  number,
  label,
  title,
  children,
}: {
  number: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <header className={styles.sectionHeading}>
      <p className={styles.eyebrow}>
        {number} / {label}
      </p>
      <h2>{title}</h2>
      <p className={styles.intro}>{children}</p>
    </header>
  );
}
