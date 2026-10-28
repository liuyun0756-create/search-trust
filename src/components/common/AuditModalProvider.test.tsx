// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/client-auth", () => ({ useAppUser: () => ({ isLoaded: true, isSignedIn: true, user: { id: "test-account" } }) }));
vi.mock("@/lib/use-authenticated-fetch", () => ({ useAuthenticatedFetch: () => mocks.fetch }));
vi.mock("@/components/common/GoogleLoginModal", () => ({ GoogleLoginModal: () => null }));
import { AuditModalProvider, isCreditBalance, useAuditModal } from "./AuditModalProvider";
function Probe() {
  const { credits, creditsStatus, refreshCredits } = useAuditModal();
  return <><output>{`${creditsStatus}:${credits ?? "unknown"}`}</output><button onClick={() => { void refreshCredits(); void refreshCredits(); }}>Read balance</button><button onClick={() => void refreshCredits({ force: true, confirmedBalance: 6 })}>Confirmed balance</button></>;
}
beforeEach(() => mocks.fetch.mockReset());
describe("shared credit balance", () => {
  it.each([null, undefined, "5", -1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1])("rejects invalid balance %s", value => expect(isCreditBalance(value)).toBe(false));
  it("coalesces concurrent readers and rejects late stale data after confirmation", async () => {
    let old!: (value: Response) => void;
    mocks.fetch.mockReturnValueOnce(new Promise(resolve => { old = resolve; })).mockResolvedValueOnce(new Response("{}", { status: 503 }));
    render(<AuditModalProvider><Probe /></AuditModalProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Read balance" }));
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Confirmed balance" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("error:6"));
    await act(async () => old(new Response(JSON.stringify({ credits: 4 }))));
    expect(screen.getByRole("status")).toHaveTextContent("error:6");
    expect(mocks.fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
});
