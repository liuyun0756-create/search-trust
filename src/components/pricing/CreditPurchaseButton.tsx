"use client";

import { LoaderCircle } from "lucide-react";
import { usePricingExperience } from "./PricingExperience";
import styles from "./pricing-v22.module.css";

export function CreditPurchaseButton({ className, children, trackingSource }: {
  className?: string; children: React.ReactNode; trackingSource: string;
}) {
  const { isLoaded, purchaseBusy, purchaseError, payment, purchase } = usePricingExperience();
  return <div className={styles.purchaseAction}>
    <button type="button" onClick={() => void purchase(trackingSource)} disabled={!isLoaded || purchaseBusy || payment.blocksPurchase} className={className}>
      {purchaseBusy ? <><LoaderCircle aria-hidden="true" className={styles.spin} /> Opening secure checkout…</> : payment.blocksPurchase ? "Confirm purchase above" : children}
    </button>
    {purchaseError && <p role="alert" className={styles.inlineError}>{purchaseError}</p>}
  </div>;
}
