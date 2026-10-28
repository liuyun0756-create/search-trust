"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { GoogleLoginModal } from "@/components/common/GoogleLoginModal";
import { track } from "@/lib/analytics-client";
import { useAppUser } from "@/lib/client-auth";
import { useAuthenticatedFetch } from "@/lib/use-authenticated-fetch";

export type CreditStatus = "idle" | "loading" | "ready" | "error";
export type RefreshCreditOptions = { force?: boolean; confirmedBalance?: number };
type Balance = { owner: string | null; credits: number | null; status: CreditStatus; refreshing: boolean };
interface AuditModalContextType {
  openLogin: () => void;
  credits: number | null;
  creditsStatus: CreditStatus;
  creditsRefreshing: boolean;
  refreshCredits: (options?: RefreshCreditOptions) => Promise<number | null>;
}

const AuditModalContext = createContext<AuditModalContextType | null>(null);

export function useAuditModal() {
  const context = useContext(AuditModalContext);
  if (!context) throw new Error("useAuditModal must be used within AuditModalProvider");
  return context;
}

export function isCreditBalance(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function AuditModalProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, user } = useAppUser();
  const owner = isLoaded && isSignedIn ? user?.id ?? null : null;
  const ownerRef = useRef(owner);
  ownerRef.current = owner;
  const authenticatedFetch = useAuthenticatedFetch();
  const [loginOpen, setLoginOpen] = useState(false);
  const [balance, setBalance] = useState<Balance>({ owner: null, credits: null, status: "idle", refreshing: false });
  const balanceRef = useRef(balance);
  const sequence = useRef(0);
  const requestRef = useRef<{ owner: string; controller: AbortController; promise: Promise<number | null> } | null>(null);
  const publish = useCallback((next: Balance) => {
    balanceRef.current = next;
    setBalance(next);
  }, []);

  const refreshCredits = useCallback((options?: RefreshCreditOptions): Promise<number | null> => {
    if (!owner || ownerRef.current !== owner) return Promise.resolve(null);
    const current = balanceRef.current.owner === owner ? balanceRef.current : null;
    const confirmed = isCreditBalance(options?.confirmedBalance) ? options.confirmedBalance : null;
    if (!options?.force && confirmed === null) {
      if (requestRef.current?.owner === owner) return requestRef.current.promise;
      if (current?.status === "ready") return Promise.resolve(current.credits);
    }
    requestRef.current?.controller.abort();
    const id = ++sequence.current;
    const controller = new AbortController();
    const preserved = confirmed ?? current?.credits ?? null;
    publish({ owner, credits: preserved, status: preserved === null ? "loading" : "ready", refreshing: true });
    const promise = (async () => {
      const timer = window.setTimeout(() => controller.abort(), 15000);
      const isCurrent = () => ownerRef.current === owner && sequence.current === id;
      try {
        const response = await authenticatedFetch("/api/user/credits", { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !isCreditBalance(body?.credits)) throw new Error("Invalid balance response");
        if (!isCurrent()) return null;
        publish({ owner, credits: body.credits, status: "ready", refreshing: false });
        return body.credits;
      } catch {
        if (!isCurrent()) return null;
        publish({ owner, credits: preserved, status: "error", refreshing: false });
        return preserved;
      } finally {
        window.clearTimeout(timer);
        if (isCurrent()) requestRef.current = null;
      }
    })();
    requestRef.current = { owner, controller, promise };
    return promise;
  }, [authenticatedFetch, owner, publish]);

  useEffect(() => {
    publish({ owner, credits: null, status: owner ? "loading" : "idle", refreshing: false });
    if (owner) void refreshCredits();
    return () => {
      ++sequence.current;
      requestRef.current?.controller.abort();
      requestRef.current = null;
    };
  }, [owner, refreshCredits, publish]);

  const openLogin = useCallback(() => {
    track("login modal opened", { source: "case_checkout" });
    setLoginOpen(true);
  }, []);

  const visible = balance.owner === owner ? balance : { credits: null, status: "loading" as const, refreshing: false };
  return (
    <AuditModalContext.Provider value={{ openLogin, credits: owner ? visible.credits : null, creditsStatus: visible.status, creditsRefreshing: visible.refreshing, refreshCredits }}>
      {children}
      <GoogleLoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSignInStart={() => setLoginOpen(false)}
      />
    </AuditModalContext.Provider>
  );
}
