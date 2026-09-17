"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAuditModal } from "@/components/common/AuditModalProvider";
import { track } from "@/lib/analytics-client";
import { useAppUser } from "@/lib/client-auth";
import { useAuthenticatedFetch } from "@/lib/use-authenticated-fetch";

function safeCheckoutUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "dodopayments.com" || url.hostname.endsWith(".dodopayments.com"))
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function CreditPurchaseButton({
  className,
  children,
  trackingSource,
}: {
  className?: string;
  children: React.ReactNode;
  trackingSource: string;
}) {
  const { isLoaded, isSignedIn } = useAppUser();
  const { openLogin } = useAuditModal();
  const authenticatedFetch = useAuthenticatedFetch();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function purchase() {
    track("credit purchase clicked", { source: trackingSource });
    if (!isLoaded || !isSignedIn) {
      openLogin();
      return;
    }
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await authenticatedFetch("/api/v2/credits/checkout", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "Secure checkout could not be opened.");
      const checkoutUrl = safeCheckoutUrl(payload?.checkout_url);
      if (!checkoutUrl) throw new Error("Secure checkout returned an invalid address.");
      window.location.assign(checkoutUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Secure checkout could not be opened.");
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={() => void purchase()} disabled={busy} className={className}>
        {busy ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Opening secure checkout…</> : children}
      </button>
      {message && <p role="alert" className="mt-3 text-center text-xs font-semibold text-[#8a4d18]">{message}</p>}
    </div>
  );
}

export function CreditPaymentReturnStatus() {
  const authenticatedFetch = useAuthenticatedFetch();
  const started = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const [kind, setKind] = useState<"success" | "pending" | "error">("pending");

  useEffect(() => {
    if (started.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") === "cancelled") {
      started.current = true;
      setKind("pending");
      setMessage("Checkout was cancelled. No credit was added and you can try again whenever you are ready.");
      window.history.replaceState(null, "", "/pricing");
      return;
    }
    const paymentId = params.get("payment_id");
    if (params.get("payment") !== "return" || !paymentId) return;
    started.current = true;
    setMessage("Confirming your credit purchase…");
    void authenticatedFetch("/api/v2/credits/checkout/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payment_id: paymentId }),
    }).then(async response => ({ response, payload: await response.json().catch(() => null) }))
      .then(({ response, payload }) => {
        if (!response.ok) throw new Error(payload?.error?.message || "Payment confirmation is still pending.");
        setKind("success");
        setMessage(`Payment confirmed. Your account now has ${payload.credit_balance} ${payload.credit_balance === 1 ? "credit" : "credits"}.`);
        window.history.replaceState(null, "", "/pricing");
      })
      .catch(error => {
        setKind("error");
        setMessage(error instanceof Error ? error.message : "Payment confirmation is temporarily unavailable.");
      });
  }, [authenticatedFetch]);

  if (!message) return null;
  return (
    <div role="status" className={`mx-auto mb-8 max-w-3xl rounded-2xl border px-5 py-4 text-center text-sm font-semibold ${kind === "success" ? "border-[#b9d770] bg-[#f3f9df] text-[#46610b]" : kind === "error" ? "border-[#e5c285] bg-[#fff8e9] text-[#805314]" : "border-[#d9dfd3] bg-white text-[#556155]"}`}>
      {message}
    </div>
  );
}
