"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CreditPurchaseButton } from "./CreditPurchaseButton";
import { PricingPrimaryAction } from "./PricingPrimaryAction";
import { usePricingExperience } from "./PricingExperience";
import { creditLabel, pricingCopy } from "./pricing-content";
import styles from "./pricing-v22.module.css";

export function PricingCTA() {
  const { isLoaded, isSignedIn, credits, creditsStatus } = usePricingExperience();
  const guest = isLoaded && !isSignedIn;
  const ready = isSignedIn && credits !== null && creditsStatus === "ready";
  const title = guest ? "Try the reports before buying more." : ready ? credits > 0 ? "Your next report is ready to start." : "Add a credit for your next report." : "Reports when you need them.";
  return <section className={styles.ctaSection} aria-labelledby="pricing-cta-title"><div className={`${styles.sectionInner} ${styles.ctaPanel}`}>
    <div><h2 id="pricing-cta-title">{title}</h2><p>{guest ? "New accounts receive five credits to experience the actual work. No subscription. No expiration." : credits !== null ? `${creditLabel(credits)} in your account. No subscription. No expiration.` : creditsStatus === "error" ? "Your balance is unavailable. Refresh it to see what’s available." : "Your account balance is loading. No subscription. No expiration."}</p></div>
    <div className={styles.ctaActions}><PricingPrimaryAction source="pricing_footer_free_credits" />
      {ready && credits > 0 ? <CreditPurchaseButton trackingSource="pricing_footer_purchase" className={styles.textLink}>{pricingCopy.buyAction}<ArrowRight aria-hidden="true" /></CreditPurchaseButton> : <Link className={styles.textLink} href={isSignedIn ? "/reports" : "/sample-report"}>{isSignedIn ? "View existing reports" : "Read the sample reports"}<ArrowRight aria-hidden="true" /></Link>}
    </div>
  </div></section>;
}
