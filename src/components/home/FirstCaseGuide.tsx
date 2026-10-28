import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { RunAuditButton } from "@/components/common/RunAuditButton";
import styles from "./home-workflow.module.css";

const steps = [
  {
    title: "Bring the context",
    detail: "Have the website, main service and target area ready. Prospect does not require client analytics access.",
  },
  {
    title: "Confirm before analysis",
    detail: "Website and business confirmation is free. Starting competitor discovery and the full Prospect analysis uses 1 credit.",
  },
  {
    title: "Review the result",
    detail: "Check the findings, supporting evidence and three proposed actions before using them with a client.",
  },
];

export function FirstCaseGuide() {
  return (
    <section id="try-your-first-case" className={styles.guideSection} aria-labelledby="first-case-title">
      <div className={styles.guide}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>YOUR FIRST CASE / PUT IT TO THE TEST</p>
            <h2 id="first-case-title">Try it on a business<br />you already understand.</h2>
          </div>
          <p className={styles.introduction}>Use the first report to judge whether the findings are specific, the evidence supports them and the proposed actions are worth discussing.</p>
        </header>
        <ol className={styles.steps}>
          {steps.map((step, index) => (
            <li key={step.title}>
              <span className={styles.stepNumber} aria-hidden="true">0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>
        <div className={styles.guideFooter}>
          <div>
            <p className={styles.assurance}>5 permanent credits when you join.</p>
            <p className={styles.note}>Choosing an entry does not use a credit.</p>
          </div>
          <div className={styles.actions}>
            <RunAuditButton trackingSource="home_v22_footer" className={styles.primary}>Start a Prospect Case <ArrowRight size={17} aria-hidden="true" /></RunAuditButton>
            <Link href="/cases/service" className={styles.secondary}>Continue with a client Case <ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
        </div>
        <p className={styles.serviceNote}>Service starts from an existing Prospect Case. Direct service setup is not available yet.</p>
      </div>
    </section>
  );
}
