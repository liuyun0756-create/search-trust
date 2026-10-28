// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: { isLoaded: true, isSignedIn: true, user: { id: "account-a" } as { id: string } | null },
  fetch: vi.fn(), signIn: vi.fn(), track: vi.fn(),
}));
vi.mock("@/lib/client-auth", () => ({ useAppUser: () => mocks.auth, useAppAuth: () => ({ openSignIn: mocks.signIn }) }));
vi.mock("@/lib/use-authenticated-fetch", () => ({ useAuthenticatedFetch: () => mocks.fetch }));
vi.mock("@/lib/analytics-client", () => ({ track: mocks.track }));
vi.mock("@/components/common/GoogleLoginModal", () => ({ GoogleLoginModal: () => null }));
vi.mock("@/components/common/RunAuditButton", () => ({ RunAuditButton: ({ children, className }: { children: React.ReactNode; className?: string }) => <button className={className}>{children}</button> }));
import { AuditModalProvider } from "@/components/common/AuditModalProvider";
import { PricingExperience, safeCheckoutUrl } from "./PricingExperience";
import { PricingHero } from "./PricingHero";
import { PricingCTA } from "./PricingCTA";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const deferred = () => { let resolve!: (value: Response) => void; const promise = new Promise<Response>(r => { resolve = r; }); return { promise, resolve }; };
function Experience() { return <AuditModalProvider><PricingExperience><PricingHero /><PricingCTA /></PricingExperience></AuditModalProvider>; }
const calls = (path: string) => mocks.fetch.mock.calls.filter(call => call[0] === path);
const confirmPath = "/api/v2/credits/checkout/confirm";
const checkoutPath = "/api/v2/credits/checkout";

beforeEach(() => {
  mocks.auth = { isLoaded: true, isSignedIn: true, user: { id: "account-a" } };
  mocks.fetch.mockReset().mockImplementation(async (path: string) => path === "/api/user/credits" ? json({ credits: 5 }) : json({ error: { code: "INTERNAL_ERROR", message: "private-provider-data" } }, 500));
  mocks.signIn.mockClear(); mocks.track.mockClear();
  window.history.replaceState(null, "", "/pricing");
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("account and purchase states", () => {
  it("does not infer balance or open identity before auth is ready", () => {
    mocks.auth = { isLoaded: false, isSignedIn: false, user: null };
    render(<Experience />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Reports when you need them.");
    expect(screen.getAllByRole("button", { name: "Loading your account…" }).every(button => button.hasAttribute("disabled"))).toBe(true);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("guest CTAs open identity at pricing, never checkout or Case creation", () => {
    mocks.auth = { isLoaded: true, isSignedIn: false, user: null };
    render(<Experience />);
    fireEvent.click(screen.getAllByRole("button", { name: "Get my 5 free credits" })[0]);
    expect(mocks.signIn).toHaveBeenCalledWith({ returnTo: "/pricing" });
    fireEvent.click(screen.getByRole("button", { name: "Buy 1 credit · $19" }));
    expect(mocks.signIn).toHaveBeenCalledTimes(2);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it.each([5, 1, 0])("uses one shared request for balance %i", async credits => {
    mocks.fetch.mockResolvedValue(json({ credits }));
    render(<Experience />);
    await waitFor(() => expect(screen.getAllByText(`${credits} ${credits === 1 ? "credit" : "credits"} in your account`).length).toBeGreaterThan(0));
    expect(calls("/api/user/credits")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Get my 5 free credits" })).not.toBeInTheDocument();
    if (credits === 0) expect(screen.queryByRole("button", { name: "Start a Case" })).not.toBeInTheDocument();
  });
  it("unknown and malformed balance never become zero; retry recovers", async () => {
    const pending = deferred(); mocks.fetch.mockReturnValueOnce(pending.promise);
    render(<Experience />);
    expect(screen.getByText("Loading your balance…")).toBeVisible();
    await act(async () => pending.resolve(json({ credits: "0" })));
    expect(screen.getByText("Balance unavailable")).toBeVisible();
    expect(screen.queryByText("0 credits in your account")).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Retry balance" })[0]);
    await waitFor(() => expect(screen.queryByText("Balance unavailable")).not.toBeInTheDocument());
  });
  it("ignores old account results and clears balance on logout", async () => {
    const old = deferred(); mocks.fetch.mockReturnValueOnce(old.promise);
    const view = render(<Experience />);
    mocks.auth = { ...mocks.auth, user: { id: "account-b" } };
    mocks.fetch.mockResolvedValue(json({ credits: 1 })); view.rerender(<Experience />);
    await waitFor(() => expect(screen.getByText("1 credit in your account")).toBeVisible());
    await act(async () => old.resolve(json({ credits: 99 })));
    expect(screen.queryByText("99 credits in your account")).not.toBeInTheDocument();
    mocks.auth = { isLoaded: true, isSignedIn: false, user: null }; view.rerender(<Experience />);
    expect(screen.queryByText("1 credit in your account")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Get my 5 free credits" })).toHaveLength(3);
  });
  it("locks every purchase entry during one request and hides provider errors", async () => {
    const pending = deferred();
    mocks.fetch.mockImplementation(async (path: string) => path === checkoutPath ? pending.promise : json({ credits: 5 }));
    render(<Experience />);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Buy 1 credit · $19" })).toHaveLength(2));
    const buttons = screen.getAllByRole("button", { name: "Buy 1 credit · $19" });
    fireEvent.click(buttons[0]); fireEvent.click(buttons[1]); fireEvent.click(buttons[0]);
    expect(calls(checkoutPath)).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Opening secure checkout…" }).every(button => button.hasAttribute("disabled"))).toBe(true);
    await act(async () => pending.resolve(json({ checkout_url: "https://evil.example" })));
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Checkout could not be opened.");
    expect(screen.queryByText(/private-provider/)).not.toBeInTheDocument();
  });
  it.each([undefined, "javascript:alert(1)", "http://checkout.dodopayments.com", "https://dodopayments.com.evil.example", "https://user:pass@checkout.dodopayments.com"])("rejects unsafe checkout address %s", value => expect(safeCheckoutUrl(value)).toBeNull());
  it("allows only HTTPS Dodo checkout hosts", () => expect(safeCheckoutUrl("https://checkout.dodopayments.com/session")).toBe("https://checkout.dodopayments.com/session"));
  it.each([401, 503])("checkout HTTP %i offers a safe retry", async status => {
    mocks.fetch.mockImplementation(async (path: string) => path === checkoutPath ? json({ error: { message: "private-provider-data" } }, status) : json({ credits: 5 }));
    render(<Experience />);
    fireEvent.click(screen.getByRole("button", { name: "Buy 1 credit · $19" }));
    await waitFor(() => expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Checkout could not be opened."));
    expect(screen.getAllByRole("button", { name: "Buy 1 credit · $19" })[0]).toBeEnabled();
  });
  it("checkout timeout releases the shared lock", async () => {
    vi.useFakeTimers();
    mocks.fetch.mockImplementation((path: string, init?: RequestInit) => path !== checkoutPath ? Promise.resolve(json({ credits: 5 })) : new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("timeout")))));
    render(<Experience />);
    fireEvent.click(screen.getByRole("button", { name: "Buy 1 credit · $19" }));
    await act(async () => { await vi.advanceTimersByTimeAsync(15001); });
    expect(screen.getAllByRole("button", { name: "Buy 1 credit · $19" })[0]).toBeEnabled();
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent("Checkout could not be opened.");
  });
});

describe("payment return recovery", () => {
  const returned = () => window.history.replaceState({ keep: true }, "", "/pricing?campaign=existing&payment=return&payment_id=test-payment#pricing-deliverables");
  it("waits for identity and does not auto-purchase after sign in", async () => {
    returned(); mocks.auth = { isLoaded: false, isSignedIn: false, user: null };
    const view = render(<Experience />);
    expect(calls(confirmPath)).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    mocks.auth = { isLoaded: true, isSignedIn: true, user: { id: "account-a" } }; view.rerender(<Experience />);
    await waitFor(() => expect(calls(confirmPath)).toHaveLength(1));
    expect(calls(checkoutPath)).toHaveLength(0);
  });
  it.each([false, true])("success and already_confirmed=%s refresh balance, keep URL state and avoid double-credit claims", async already_confirmed => {
    returned(); let balanceReads = 0;
    const old = deferred();
    mocks.fetch.mockImplementation(async (path: string) => path === confirmPath ? json({ ok: true, credits_added: 1, credit_balance: 6, already_confirmed }) : ++balanceReads === 1 ? old.promise : json({ credits: 6 }));
    render(<Experience />);
    await waitFor(() => expect(screen.getByText("Purchase confirmed. Your balance is 6 credits.")).toBeVisible());
    expect(calls(confirmPath)).toHaveLength(1);
    expect(calls("/api/user/credits")).toHaveLength(2);
    await act(async () => old.resolve(json({ credits: 5 })));
    expect(screen.getByText("6 credits in your account")).toBeVisible();
    expect(window.location.search).toBe("?campaign=existing"); expect(window.location.hash).toBe("#pricing-deliverables");
    expect(window.history.state).toEqual({ keep: true });
    expect(mocks.track.mock.calls.flat().join(" ")).not.toContain("test-payment");
  });
  it("retains confirmed balance if the fresh balance request fails", async () => {
    returned();
    mocks.fetch.mockImplementation(async (path: string) => path === confirmPath ? json({ ok: true, credits_added: 1, credit_balance: 6, already_confirmed: false }) : json({}, 500));
    render(<Experience />);
    await waitFor(() => expect(screen.getByText(/Showing your last confirmed balance/)).toBeVisible());
    expect(screen.getByText("6 credits in your account")).toBeVisible();
  });
  it("pending retains payment reference; retries the same payment without new checkout", async () => {
    returned(); let confirmations = 0;
    mocks.fetch.mockImplementation(async (path: string) => path !== confirmPath ? json({ credits: 5 }) : ++confirmations === 1 ? json({ error: { code: "PAYMENT_NOT_COMPLETED", message: "Payment is processing." } }, 409) : json({ ok: true, credits_added: 1, credit_balance: 6, already_confirmed: false }));
    render(<Experience />);
    await waitFor(() => expect(screen.getByText(/Please do not pay again/)).toBeVisible());
    expect(window.location.search).toContain("payment_id=test-payment");
    const retry = screen.getByRole("button", { name: "Check payment status" });
    fireEvent.click(retry); fireEvent.click(retry);
    await waitFor(() => expect(screen.getByText(/Purchase confirmed/)).toBeVisible());
    expect(calls(confirmPath)).toHaveLength(2);
    expect(calls(confirmPath).map(call => JSON.parse(call[1].body).payment_id)).toEqual(["test-payment", "test-payment"]);
    expect(calls(checkoutPath)).toHaveLength(0);
  });
  it.each([401, 500])("handles HTTP %i without claiming payment failed", async status => {
    returned(); mocks.fetch.mockImplementation(async (path: string) => path === confirmPath ? json({ error: { code: status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR", message: "secret-order-id" } }, status) : json({ credits: 5 }));
    render(<Experience />);
    await waitFor(() => expect(screen.getByRole("link", { name: "Contact payment support" })).toBeVisible());
    expect(screen.queryByText(/secret-order-id|this payment failed/)).not.toBeInTheDocument();
    expect(window.location.search).toContain("payment_id");
  });
  it.each(["cancelled", "return"])("handles %s without a payment ID without a request", async kind => {
    window.history.replaceState(null, "", `/pricing?payment=${kind}`);
    render(<Experience />);
    expect(screen.getByRole("link", { name: "Contact payment support" })).toBeVisible();
    expect(calls(confirmPath)).toHaveLength(0);
    expect(screen.queryByText(/No credit was added|Purchase confirmed/)).not.toBeInTheDocument();
  });
  it("ignores a confirmation after logout", async () => {
    returned(); const pending = deferred();
    mocks.fetch.mockImplementation(async (path: string) => path === confirmPath ? pending.promise : json({ credits: 5 }));
    const view = render(<Experience />);
    mocks.auth = { isLoaded: true, isSignedIn: false, user: null }; view.rerender(<Experience />);
    await act(async () => pending.resolve(json({ ok: true, credits_added: 1, credit_balance: 6, already_confirmed: false })));
    expect(screen.queryByText(/Purchase confirmed/)).not.toBeInTheDocument();
    expect(window.location.search).toContain("payment_id");
  });
  it("ignores a confirmation after unmount", async () => {
    returned(); const pending = deferred();
    mocks.fetch.mockImplementation(async (path: string) => path === confirmPath ? pending.promise : json({ credits: 5 }));
    const view = render(<Experience />); view.unmount();
    await act(async () => pending.resolve(json({ ok: true, credits_added: 1, credit_balance: 6, already_confirmed: false })));
    expect(window.location.search).toContain("payment_id");
    expect(calls(confirmPath)[0][1].signal.aborted).toBe(true);
  });
  it("only maps an explicit provider failure to a failed payment", async () => {
    returned(); mocks.fetch.mockImplementation(async (path: string) => path === confirmPath ? json({ error: { code: "PAYMENT_NOT_COMPLETED", message: "Payment is failed." } }, 409) : json({ credits: 5 }));
    render(<Experience />);
    await waitFor(() => expect(screen.getByText(/provider reported that this payment failed/)).toBeVisible());
    expect(screen.getByRole("button", { name: "Check payment status" })).toBeEnabled();
  });
  it("times out a confirmation with a recoverable unknown status", async () => {
    returned(); vi.useFakeTimers();
    mocks.fetch.mockImplementation((path: string, init?: RequestInit) => path !== confirmPath ? Promise.resolve(json({ credits: 5 })) : new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("timeout")))));
    render(<Experience />);
    await act(async () => { await vi.advanceTimersByTimeAsync(15001); });
    expect(screen.getByText(/We couldn’t confirm the status yet/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Check payment status" })).toBeEnabled();
  });
});
