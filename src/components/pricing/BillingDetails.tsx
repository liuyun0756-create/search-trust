import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { creditRules } from "./pricing-content";
import styles from "./pricing-v22.module.css";

export function BillingDetails() {
  return <section className={styles.section} aria-labelledby="credit-rules-title"><div className={styles.sectionInner}>
    <div className={styles.rulesPanel}>
      <header><p className={styles.eyebrow}>Clear from the start</p><h2 id="credit-rules-title">Simple credit rules.</h2><p>Credit use is shown before you start a charged analysis.</p></header>
      <dl className={styles.rulesRows}>{creditRules.map(row => <div key={row.action}><dt>{row.action}</dt><dd>{row.rule}</dd></div>)}</dl>
    </div>
    <div className={styles.paymentNote}><p><LockKeyhole aria-hidden="true" />One-time purchases through Dodo Payments. Credits are added after payment confirmation.</p><Link className={styles.textLink} href="/refund-policy">Refund policy<ArrowRight aria-hidden="true" /></Link></div>
  </div></section>;
}
