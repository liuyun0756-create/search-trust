// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const clerk = vi.hoisted(() => ({
  getToken: vi.fn(async () => "clerk-test-token"),
  signOut: vi.fn(async () => undefined),
  openSignIn: vi.fn(async () => undefined),
}));

vi.mock("@clerk/nextjs", () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: "clerk-user",
      fullName: "Clerk User",
      imageUrl: "",
      primaryEmailAddress: { emailAddress: "clerk@example.invalid" },
    },
  }),
  useAuth: () => ({ getToken: clerk.getToken }),
  useClerk: () => ({ signOut: clerk.signOut, openSignIn: clerk.openSignIn }),
}));

import { AppAuthProvider, useAppAuth, useAppUser } from "./client-auth";
import { E2E_IDENTITY } from "./e2e-v22/config";

function Probe() {
  const { isLoaded, isSignedIn, user } = useAppUser();
  const { getToken, openSignIn, signOut } = useAppAuth();
  return (
    <div>
      <output>{`${isLoaded}:${isSignedIn}:${user?.id ?? "none"}`}</output>
      <button type="button" onClick={() => void getToken().then((token) => document.body.setAttribute("data-token", token ?? ""))}>Token</button>
      <button type="button" onClick={openSignIn}>Sign in</button>
      <button type="button" onClick={() => void signOut()}>Sign out</button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  document.body.removeAttribute("data-token");
});

describe("AppAuthProvider", () => {
  it("delegates normal application identity to Clerk", async () => {
    render(<AppAuthProvider><Probe /></AppAuthProvider>);
    expect(screen.getByText("true:true:clerk-user")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Token" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(document.body).toHaveAttribute("data-token", "clerk-test-token"));
    expect(clerk.openSignIn).toHaveBeenCalledOnce();
    expect(clerk.signOut).toHaveBeenCalledOnce();
  });

  it("uses the fixed synthetic identity only in local E2E mode", async () => {
    vi.stubEnv("NEXT_PUBLIC_E2E_TEST_MODE", "true");
    vi.stubEnv("NEXT_PUBLIC_E2E_BASE_URL", "http://127.0.0.1:3100");
    render(<AppAuthProvider><Probe /></AppAuthProvider>);

    expect(screen.getByText(`true:true:${E2E_IDENTITY.clerkUserId}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Token" }));
    await waitFor(() => expect(document.body).toHaveAttribute("data-token", E2E_IDENTITY.bearerToken));
    expect(clerk.getToken).not.toHaveBeenCalled();
  });
});
