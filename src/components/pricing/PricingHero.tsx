"use client";

import { ArrowDown, ArrowRight, Check, ShieldCheck, Wallet } from "lucide-react";
import { CreditPurchaseButton } from "./CreditPurchaseButton";
import { PricingPrimaryAction } from "./PricingPrimaryAction";
import { usePricingExperience } from "./PricingExperience";
import { creditLabel, pricingCopy as copy } from "./pricing-content";
import styles from "./pricing-v22.module.css";

export function PricingHero() {
  const { isLoaded, isSignedIn, credits, creditsStatus, creditsRefreshing, refreshCredits } = usePricingExperience();
  const guest = isLoaded && !isSignedIn;
  const ready = isSignedIn && creditsStatus === "ready" && credits !== null;
  const title = guest ? copy.guestTitle : ready ? credits > 0 ? copy.readyTitle : copy.emptyTitle : copy.neutralTitle;
  const intro = guest ? copy.guestIntro : ready && credits === 0 ? copy.emptyIntro : copy.readyIntro;
  return <section className={styles.hero} aria-labelledby="pricing-title">
    <div className={styles.sectionInner}>
      <header className={styles.heroCopy}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h1 id="pricing-title">{title[0]}<span>{title[1]}</span></h1>
        <p className={styles.heroIntro}>{intro}</p>
        <div className={styles.heroActions}>
          <PricingPrimaryAction source="pricing_free_credits" />
          <a className={styles.secondaryCta} href="#pricing-deliverables">See what one credit delivers<ArrowDown aria-hidden="true" /></a>
        </div>
        <p className={styles.heroNote}>{guest ? copy.freeNote : "One account balance · No recurring charge · No expiration"}</p>
      </header>
      <div className={styles.priceGrid}>
        <section className={`${styles.priceCard} ${styles.includedCard}`} aria-labelledby="included-title">
          <div className={styles.cardLabel}><Wallet aria-hidden="true" /><h2 id="included-title">{guest ? "Included with a new account" : "Your balance"}</h2></div>
          {guest ? <>
            <div className={styles.amount}><strong>5</strong><span>credits</span><b>$0</b></div>
            <p>Use your included credits to generate actual reports and plans—not just browse a demo.</p>
            <ul className={styles.featureList}>{copy.freeFeatures.map(item => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul>
          </> : <div className={styles.balanceBody}>
            <div role="status" aria-live="polite">
              {!isLoaded ? <p className={styles.balanceLoading}>Loading your account…</p>
                : credits !== null ? <div className={styles.amount}><strong>{credits}</strong><span>{credits === 1 ? "credit" : "credits"}</span></div>
                : <p className={styles.balanceLoading}>{creditsStatus === "error" ? "Balance unavailable" : "Loading your balance…"}</p>}
            </div>
            <p>{credits === 0 ? "Add a credit when you’re ready for your next report." : credits !== null ? "Available across your Cases. Use a credit when you’re ready to generate your next report or plan." : "Your available credits will appear here. We only show a balance after it is confirmed."}</p>
            {creditsStatus === "error" && <p className={styles.inlineError}>{credits !== null ? "Showing your last confirmed balance. Refresh to check for changes." : "We couldn’t load your balance. Please try again."}</p>}
            {credits !== null && <p className={styles.balanceNote}><Check aria-hidden="true" />Never expire · No subscription</p>}
            {creditsStatus === "error" && credits !== null && <button type="button" className={styles.textLink} disabled={creditsRefreshing} onClick={() => void refreshCredits({ force: true })}>Retry balance</button>}
          </div>}
          <div className={styles.cardAction}><PricingPrimaryAction source="pricing_free_credits_card" /><p>{guest ? "Your first reports start here." : credits !== null ? `${creditLabel(credits)} in your account` : "Your balance is not yet confirmed."}</p></div>
        </section>
        <section className={styles.priceCard} aria-labelledby="purchase-title">
          <div className={styles.cardLabel}><span className={styles.plusMark} aria-hidden="true">+</span><h2 id="purchase-title">Buy when you need more</h2></div>
          <div className={styles.amount}><strong>$19</strong><span>USD / credit</span></div>
          <p>One additional credit for your account. No recurring payment.</p>
          <ul className={styles.featureList}>{copy.purchaseFeatures.map(item => <li key={item}><Check aria-hidden="true" />{item}</li>)}</ul>
          <div className={styles.cardAction}><CreditPurchaseButton trackingSource="pricing_additional_credit" className={styles.secondaryCta}>{copy.buyAction}<ArrowRight aria-hidden="true" /></CreditPurchaseButton><p>Checkout with Dodo Payments</p></div>
        </section>
      </div>
      <p className={styles.failureNote}><ShieldCheck aria-hidden="true" />{copy.failureNote}</p>
    </div>
  </section>;
}
