"use client";

import { ArrowRight, LoaderCircle, RefreshCw } from "lucide-react";
import { RunAuditButton } from "@/components/common/RunAuditButton";
import { CreditPurchaseButton } from "./CreditPurchaseButton";
import { usePricingExperience } from "./PricingExperience";
import { pricingCopy } from "./pricing-content";
import styles from "./pricing-v22.module.css";

export function PricingPrimaryAction({ source, className = styles.primaryCta }: { source: string; className?: string }) {
  const { isLoaded, isSignedIn, credits, creditsStatus, creditsRefreshing, refreshCredits, signIn } = usePricingExperience();
  if (!isLoaded) return <button type="button" disabled className={className}><LoaderCircle aria-hidden="true" className={styles.spin} /> Loading your account…</button>;
  if (!isSignedIn) return <button type="button" className={className} onClick={() => signIn(source)}>{pricingCopy.freeAction}<ArrowRight aria-hidden="true" /></button>;
  if (creditsStatus === "error" && credits === null) return <button type="button" className={className} disabled={creditsRefreshing} onClick={() => void refreshCredits({ force: true })}><RefreshCw aria-hidden="true" /> Retry balance</button>;
  if (credits === 0) return <CreditPurchaseButton className={className} trackingSource={source}>{pricingCopy.buyAction}<ArrowRight aria-hidden="true" /></CreditPurchaseButton>;
  return <RunAuditButton className={className} trackingSource={source}>Start a Case<ArrowRight aria-hidden="true" /></RunAuditButton>;
}
