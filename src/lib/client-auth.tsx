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
  openSignIn(): void;
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
      openSignIn: () => {
        void openSignIn();
      },
    }),
    [getToken, isLoaded, isSignedIn, openSignIn, signOut, user],
  );
  return <AppAuthContext.Provider value={value}>{children}</AppAuthContext.Provider>;
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  if (isLocalE2ETestMode()) {
    return <AppAuthContext.Provider value={syntheticAppAuthValue()}>{children}</AppAuthContext.Provider>;
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
