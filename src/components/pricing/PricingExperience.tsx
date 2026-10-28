"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useAuditModal } from "@/components/common/AuditModalProvider";
import { RunAuditButton } from "@/components/common/RunAuditButton";
import { useAppAuth, useAppUser } from "@/lib/client-auth";
import { useAuthenticatedFetch } from "@/lib/use-authenticated-fetch";
import { track } from "@/lib/analytics-client";
import { pricingCopy } from "./pricing-content";
import { usePaymentReturn } from "./use-payment-return";
import styles from "./pricing-v22.module.css";

export function safeCheckoutUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      && (url.hostname === "dodopayments.com" || url.hostname.endsWith(".dodopayments.com")) ? url.toString() : null;
  } catch { return null; }
}

function usePricingState() {
  const { isLoaded, isSignedIn, user } = useAppUser();
  const { openSignIn } = useAppAuth();
  const balance = useAuditModal();
  const fetcher = useAuthenticatedFetch();
  const owner = isLoaded && isSignedIn ? user?.id ?? null : null;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const [purchaseState, setPurchaseState] = useState<{ owner: string | null; busy: boolean; error: string | null }>({ owner, busy: false, error: null });
  const request = useRef<AbortController | null>(null);
  const payment = usePaymentReturn({ owner, isLoaded, fetcher, refreshCredits: balance.refreshCredits });
  const signIn = useCallback((source: string) => {
    if (!isLoaded) return;
    track("login modal opened", { source });
    openSignIn({ returnTo: window.location.pathname + window.location.search + window.location.hash });
  }, [isLoaded, openSignIn]);

  useEffect(() => {
    setPurchaseState({ owner, busy: false, error: null });
    return () => { request.current?.abort(); request.current = null; };
  }, [owner]);

  async function purchase(source: string) {
    if (!isLoaded || request.current || payment.blocksPurchase) return;
    track("credit purchase clicked", { source });
    if (!owner) { signIn(source); return; }
    const controller = new AbortController();
    request.current = controller;
    const current = () => ownerRef.current === owner && request.current === controller;
    setPurchaseState({ owner, busy: true, error: null });
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetcher("/api/v2/credits/checkout", { method: "POST", signal: controller.signal });
      const payload = await response.json().catch(() => null);
      if (!current()) return;
      const checkoutUrl = safeCheckoutUrl(payload?.checkout_url);
      if (!response.ok || !checkoutUrl) throw new Error("Checkout unavailable");
      window.location.assign(checkoutUrl);
    } catch {
      if (current()) {
        request.current = null;
        setPurchaseState({ owner, busy: false, error: pricingCopy.checkoutError });
      }
    } finally { window.clearTimeout(timer); }
  }

  const purchaseVisible = purchaseState.owner === owner ? purchaseState : { busy: false, error: null };
  return { ...balance, isLoaded, isSignedIn: Boolean(owner), signIn, purchase, payment,
    purchaseBusy: purchaseVisible.busy, purchaseError: purchaseVisible.error };
}

const PricingContext = createContext<ReturnType<typeof usePricingState> | null>(null);
export function usePricingExperience() {
  const value = useContext(PricingContext);
  if (!value) throw new Error("PricingExperience is required");
  return value;
}

export function PricingExperience({ children }: { children: ReactNode }) {
  const value = usePricingState();
  const { payment, signIn, isLoaded, isSignedIn } = value;
  const canRetry = payment.paymentId && isSignedIn && !["checking", "success"].includes(payment.kind);
  return <PricingContext.Provider value={value}>
    {payment.kind !== "none" && <div className={styles.paymentWrap}>
      <div className={styles.paymentBanner} data-kind={payment.kind}>
        <p role={payment.kind === "error" || payment.kind === "missing" ? "alert" : "status"}>
          {payment.kind === "checking" ? <LoaderCircle aria-hidden="true" className={styles.spin} /> : payment.kind === "success" ? <CheckCircle2 aria-hidden="true" /> : null}
          {payment.message}
        </p>
        <div className={styles.paymentActions}>
          {payment.kind === "identity" && <button type="button" disabled={!isLoaded} onClick={() => signIn("pricing_payment_return")} className={styles.secondaryCta}>Sign in</button>}
          {canRetry && <button type="button" onClick={() => void payment.retry()} className={styles.secondaryCta}>Check payment status</button>}
          {payment.kind === "success" && <RunAuditButton className={styles.secondaryCta} trackingSource="pricing_payment_success">Start a Case</RunAuditButton>}
          {["error", "missing", "failed", "cancelled", "identity"].includes(payment.kind) && <a className={styles.textLink} href={pricingCopy.supportHref}>Contact payment support</a>}
        </div>
      </div>
    </div>}
    {children}
  </PricingContext.Provider>;
}
