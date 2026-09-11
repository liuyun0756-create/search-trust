"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { GoogleLoginModal } from "@/components/common/GoogleLoginModal";
import { track } from "@/lib/analytics-client";
import { useAppUser } from "@/lib/client-auth";
import { useAuthenticatedFetch } from "@/lib/use-authenticated-fetch";

interface AuditModalContextType {
  openLogin: () => void;
  credits: number | null;
  refreshCredits: (options?: { force?: boolean }) => Promise<number | null>;
}

const AuditModalContext = createContext<AuditModalContextType | null>(null);

export function useAuditModal() {
  const context = useContext(AuditModalContext);
  if (!context) throw new Error("useAuditModal must be used within AuditModalProvider");
  return context;
}

export function AuditModalProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAppUser();
  const authenticatedFetch = useAuthenticatedFetch();
  const [loginOpen, setLoginOpen] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const creditsLoadedRef = useRef(false);
  const creditsRequestRef = useRef<Promise<number | null> | null>(null);

  const refreshCredits = useCallback(async (options?: { force?: boolean }) => {
    if (!options?.force && creditsLoadedRef.current) return credits;
    if (creditsRequestRef.current) return creditsRequestRef.current;

    creditsRequestRef.current = (async () => {
      try {
        const response = await authenticatedFetch("/api/user/credits");
        if (!response.ok) return credits;
        const body = await response.json();
        const nextCredits = typeof body.credits === "number" ? body.credits : null;
        creditsLoadedRef.current = true;
        setCredits(nextCredits);
        return nextCredits;
      } catch {
        return credits;
      } finally {
        creditsRequestRef.current = null;
      }
    })();

    return creditsRequestRef.current;
  }, [authenticatedFetch, credits]);

  useEffect(() => {
    if (isSignedIn) void refreshCredits();
    if (isLoaded && !isSignedIn) {
      creditsLoadedRef.current = false;
      setCredits(null);
    }
  }, [isLoaded, isSignedIn, refreshCredits]);

  const openLogin = useCallback(() => {
    track("login modal opened", { source: "case_checkout" });
    setLoginOpen(true);
  }, []);

  return (
    <AuditModalContext.Provider value={{ openLogin, credits, refreshCredits }}>
      {children}
      <GoogleLoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSignInStart={() => setLoginOpen(false)}
      />
    </AuditModalContext.Provider>
  );
}
