"use client";

import {
  ClerkProvider,
  useAuth as useClerkAuth,
  useClerk,
  useUser as useClerkUser,
} from "@clerk/nextjs";
import {
  createContext,
  useContext,
  useMemo,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { E2E_IDENTITY, isLocalE2ETestMode } from "@/lib/e2e-v22/config";

export type AppUser = {
  id: string;
  fullName: string | null;
  imageUrl: string;
  primaryEmailAddress: { emailAddress: string } | null;
};

type AppAuthValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AppUser | null;
  getToken(): Promise<string | null>;
  signOut(): Promise<void>;
  openSignIn(options?: { returnTo?: string }): void;
};

const AppAuthContext = createContext<AppAuthValue | null>(null);

export function syntheticAppAuthValue(): AppAuthValue {
  return {
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: E2E_IDENTITY.clerkUserId,
      fullName: E2E_IDENTITY.fullName,
      imageUrl: "",
      primaryEmailAddress: { emailAddress: E2E_IDENTITY.emailAddress },
    },
    getToken: async () => E2E_IDENTITY.bearerToken,
    signOut: async () => undefined,
    openSignIn: () => undefined,
  };
}

function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, user } = useClerkUser();
  const { getToken } = useClerkAuth();
  const { openSignIn, signOut } = useClerk();
  const value = useMemo<AppAuthValue>(
    () => ({
      isLoaded,
      isSignedIn: Boolean(isSignedIn),
      user: user
        ? {
            id: user.id,
            fullName: user.fullName,
            imageUrl: user.imageUrl,
            primaryEmailAddress: user.primaryEmailAddress
              ? { emailAddress: user.primaryEmailAddress.emailAddress }
              : null,
          }
        : null,
      getToken: () => getToken(),
      signOut: async () => {
        await signOut();
      },
      openSignIn: (options) => {
        const returnTo = options?.returnTo;
        if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
          void openSignIn({ forceRedirectUrl: returnTo, signUpForceRedirectUrl: returnTo });
        } else {
          void openSignIn();
        }
      },
    }),
    [getToken, isLoaded, isSignedIn, openSignIn, signOut, user],
  );
  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

// Only mounted behind the existing loopback-only E2E guard; never used by Clerk.
function LocalE2EAuthProvider({ children }: { children: ReactNode }) {
  const base = useMemo(syntheticAppAuthValue, []);
  const [guest, setGuest] = useState(false);
  const [ready, setReady] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { setGuest(window.sessionStorage.getItem("searchtrust:e2e:auth") === "guest"); setReady(true); }, []);
  useEffect(() => { if (prompt) dialog.current?.showModal(); }, [prompt]);
  const close = () => { dialog.current?.close(); setPrompt(false); trigger.current?.focus(); };
  const value = useMemo<AppAuthValue>(() => ({ ...base, isLoaded: ready, isSignedIn: ready && !guest, user: !ready || guest ? null : base.user,
    openSignIn: () => { trigger.current = document.activeElement as HTMLElement; setPrompt(true); },
  }), [base, guest, ready]);
  return <AppAuthContext.Provider value={value}>{children}
    {prompt && <dialog ref={dialog} aria-label="Local test sign in" onCancel={close} className="fixed inset-0 m-auto rounded-xl border bg-white p-8 backdrop:bg-black/20">
      <p>Local identity fixture</p>
      <button type="button" className="m-3 rounded border p-3" onClick={() => { window.sessionStorage.removeItem("searchtrust:e2e:auth"); setGuest(false); close(); }}>Continue with test account</button>
      <button type="button" className="m-3 rounded border p-3" onClick={close}>Cancel</button>
    </dialog>}
  </AppAuthContext.Provider>;
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  if (isLocalE2ETestMode()) {
    return <LocalE2EAuthProvider>{children}</LocalE2EAuthProvider>;
  }
  return (
    <ClerkProvider>
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}

function useAppAuthContext(): AppAuthValue {
  const value = useContext(AppAuthContext);
  if (!value) throw new Error("App authentication requires AppAuthProvider.");
  return value;
}

export function useAppUser() {
  const { isLoaded, isSignedIn, user } = useAppAuthContext();
  return { isLoaded, isSignedIn, user };
}

export function useAppAuth() {
  const { getToken, openSignIn, signOut } = useAppAuthContext();
  return { getToken, openSignIn, signOut };
}
