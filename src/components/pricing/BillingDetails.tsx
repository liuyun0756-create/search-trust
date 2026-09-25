import Link from "next/link";
import { ArrowRight } from "lucide-react";

import styles from "./pricing-v22.module.css";

const protections = [
  {
    title: "Payment",
    detail: "$19 USD buys one additional permanent credit. It is a one-time purchase processed securely through Dodo Payments.",
  },
  {
    title: "Delivery",
    detail: "The credit is added after payment confirmation and joins the same account balance shared across all Cases.",
  },
  {
    title: "Technical failure",
    detail: "If a paid workflow fails for a technical reason, exactly one credit is returned automatically. A later new generation uses one credit again.",
  },
  {
    title: "Refund review",
    detail: "An unused purchased credit may be refunded after provider confirmation. A credit that has already been used requires manual review.",
  },
];

export function BillingDetails() {
  return (
    <section className={`${styles.pricingBody} ${styles.protectionSection}`} aria-labelledby="billing-protection-title">
      <div className={styles.sectionInner}>
        <div className={styles.protectionPanel}>
          <div>
            <p className={styles.eyebrow}>Billing and protection</p>
            <h2 id="billing-protection-title">Simple payment, clear failure protection.</h2>
          </div>
          <div>
            <div className={styles.protectionRows}>
              {protections.map((item) => (
                <div className={styles.protectionRow} key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
            <Link href="/refund-policy" className={styles.protectionLink}>Read the full Refund Policy<ArrowRight aria-hidden="true" /></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
