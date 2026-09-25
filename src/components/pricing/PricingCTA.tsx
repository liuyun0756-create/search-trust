"use client";

import { ArrowRight } from "lucide-react";

import { RunAuditButton } from "@/components/common/RunAuditButton";
import { useAppUser } from "@/lib/client-auth";

import { CreditPurchaseButton } from "./CreditPurchaseButton";
import styles from "./pricing-v22.module.css";

export function PricingCTA() {
  const { isLoaded, isSignedIn } = useAppUser();
  const startLabel = isLoaded && isSignedIn
    ? "Start a Case"
    : "Create account — get 5 credits";

  return (
    <section className={`${styles.pricingBody} ${styles.ctaSection}`} aria-labelledby="pricing-cta-title">
      <div className={`${styles.sectionInner} ${styles.ctaPanel}`}>
        <div>
          <p className={styles.eyebrow}>No subscription / no expiration</p>
          <h2 id="pricing-cta-title">Start with five credits. Add more only when the work requires it.</h2>
          <p>Use one shared balance for Prospect Analysis and Verified Action Plan generation across every Case.</p>
        </div>
        <div className={styles.ctaActions}>
          <RunAuditButton trackingSource="pricing_footer_free_credits" className={styles.primaryCta}>
            {startLabel}<ArrowRight aria-hidden="true" />
          </RunAuditButton>
          <CreditPurchaseButton trackingSource="pricing_footer_purchase" className={styles.purchaseCta}>
            Add 1 credit · $19
          </CreditPurchaseButton>
          <p className={styles.ctaFinePrint}>Permanent balance · Secure Dodo Payments checkout</p>
        </div>
      </div>
    </section>
  );
}
