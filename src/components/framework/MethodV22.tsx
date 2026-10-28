import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { RunAuditButton } from "@/components/common/RunAuditButton";
import { MethodGuide } from "./MethodGuide";
import { methodFAQ } from "./method-content";
import styles from "./method-guide.module.css";

export function MethodV22() {
  return <MethodGuide />;
}

export function MethodFAQ() {
  return (
    <section className={styles.ending} aria-labelledby="method-faq-title">
      <div className={styles.endingInner}>
        <h2 id="method-faq-title">Questions about the method</h2>
        <div className={styles.faq}>
          {methodFAQ.map(({ question, answer }) => (
            <details key={question}>
              <summary>
                {question}
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MethodCTA() {
  return (
    <section
      className={`${styles.ending} ${styles.finalCta}`}
      aria-labelledby="method-start-title"
    >
      <div className={styles.endingInner}>
        <div>
          <h2 id="method-start-title">
            Put the method to work on one business.
          </h2>
          <p>
            Start with a website and business confirmation, or return to an
            existing Case to add client data.
          </p>
          <p className={styles.note}>
            New accounts receive 5 permanent credits. Website entry and business
            confirmation are free. Starting competitor discovery and the full
            Prospect analysis uses 1 credit; generating or regenerating a
            Verified Action Plan uses 1 credit. Technical failure returns the
            charged credit.
          </p>
        </div>
        <div className={styles.finalActions}>
          <RunAuditButton
            trackingSource="method_footer"
            className={styles.primary}
          >
            Start a Prospect Case <ArrowRight size={17} aria-hidden="true" />
          </RunAuditButton>
          <Link className={styles.secondary} href="/cases/service">
            Continue with an existing Case{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <p className={styles.note}>
            These entries do not start analysis or use a credit. Service work
            currently requires an existing Case.
          </p>
        </div>
      </div>
    </section>
  );
}
