"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isCreditBalance, type RefreshCreditOptions } from "@/components/common/AuditModalProvider";
import { pricingCopy, creditLabel } from "./pricing-content";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type ReturnKind = "none" | "identity" | "checking" | "success" | "pending" | "error" | "failed" | "cancelled" | "missing";
type ReturnState = { owner: string | null; kind: ReturnKind; message: string; paymentId?: string };

export function readPaymentReturn(): { kind: "none" | "cancelled" | "return"; paymentId?: string } {
  const params = new URLSearchParams(window.location.search);
  const kind = params.get("payment");
  if (kind !== "return" && kind !== "cancelled") return { kind: "none" };
  return { kind, paymentId: params.get("payment_id")?.trim() || undefined };
}

export function usePaymentReturn({ owner, isLoaded, fetcher, refreshCredits }: {
  owner: string | null; isLoaded: boolean; fetcher: Fetcher;
  refreshCredits: (options?: RefreshCreditOptions) => Promise<number | null>;
}) {
  const [state, setState] = useState<ReturnState>({ owner, kind: "none", message: "" });
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const sequence = useRef(0);
  const request = useRef<AbortController | null>(null);

  const check = useCallback(async (paymentId: string) => {
    if (!owner || ownerRef.current !== owner || request.current) return;
    const id = ++sequence.current;
    const controller = new AbortController();
    request.current = controller;
    const current = () => sequence.current === id && ownerRef.current === owner;
    const publish = (kind: ReturnKind, message: string) => {
      if (current()) setState({ owner, kind, message, paymentId });
    };
    publish("checking", "Confirming your purchase…");
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetcher("/api/v2/credits/checkout/confirm", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ payment_id: paymentId }), signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!current()) return;
      if (!response.ok) {
        const code = payload?.error?.code;
        const message = payload?.error?.message;
        // The service currently exposes provider state through this exact error contract.
        if (code === "PAYMENT_NOT_COMPLETED" && ["Payment is pending.", "Payment is processing."].includes(message)) {
          publish("pending", "Payment is still being confirmed. Please do not pay again.");
        } else if (code === "PAYMENT_NOT_COMPLETED" && message === "Payment is failed.") {
          publish("failed", "The payment provider reported that this payment failed. Check its status again or contact support before trying another purchase.");
        } else if (response.status === 401 || code === "PAYMENT_OWNER_MISMATCH") {
          publish("identity", "Sign in with the account used for this purchase to confirm its status.");
        } else publish("error", pricingCopy.confirmationError);
        return;
      }
      if (payload?.ok !== true || !isCreditBalance(payload.credit_balance)
        || !isCreditBalance(payload.credits_added) || payload.credits_added > 1
        || typeof payload.already_confirmed !== "boolean") throw new Error("Invalid confirmation");
      publish("success", `Purchase confirmed. Your balance is ${creditLabel(payload.credit_balance)}.`);
      void refreshCredits({ force: true, confirmedBalance: payload.credit_balance });
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      url.searchParams.delete("payment_id");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } catch {
      publish("error", pricingCopy.confirmationError);
    } finally {
      window.clearTimeout(timer);
      if (current()) request.current = null;
    }
  }, [owner, fetcher, refreshCredits]);

  useEffect(() => {
    const returned = readPaymentReturn();
    if (returned.kind === "none") setState({ owner, kind: "none", message: "" });
    else if (returned.kind === "cancelled") setState({ owner, kind: "cancelled", paymentId: returned.paymentId,
      message: "Checkout was cancelled. If you completed a payment elsewhere, check its status before trying again." });
    else if (!returned.paymentId) setState({ owner, kind: "missing", message: "We couldn’t identify this payment return." });
    else if (!isLoaded || !owner) setState({ owner, kind: "identity", paymentId: returned.paymentId, message: "Sign in to confirm this purchase." });
    else void check(returned.paymentId);
    return () => {
      ++sequence.current;
      request.current?.abort();
      request.current = null;
    };
  }, [owner, isLoaded, check]);

  const visible = state.owner === owner ? state : { owner, kind: "none" as const, message: "" };
  return { ...visible, retry: () => visible.paymentId && check(visible.paymentId),
    blocksPurchase: !["none", "success", "cancelled", "failed"].includes(visible.kind) };
}
