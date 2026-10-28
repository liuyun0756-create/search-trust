// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FirstServiceConnections } from "./first-service-connections";
import type { FirstServiceSetupView } from "@/lib/first-service-setup/view";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), selector: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/components/google/google-resource-selector", () => ({ GoogleResourceSelector: (props: unknown) => { mocks.selector(props); return <div>Resource selection</div>; } }));
const view: FirstServiceSetupView = { caseId: "case", businessName: "Existing Client", siteUrl: "https://example.test/", service: "Repair", market: "Austin", publicProfile: "https://www.google.com/maps?cid=123", sources: [
  { key: "gsc", title: "Search Console", status: "healthy", summary: "Healthy source", resource: "example.test", fetchedAt: "2026-10-21T12:00:00Z", coverageStart: "2026-09-01", coverageEnd: "2026-09-30" },
  { key: "ga4", title: "Google Analytics", status: "needs_identity_confirmation", summary: "Confirm this resource belongs to the client.", resource: null, fetchedAt: null, coverageStart: null, coverageEnd: null },
] };
beforeEach(() => vi.clearAllMocks());
describe("first-service data preparation", () => {
  it("keeps paid start disabled even with healthy sources and does nothing on mount or OAuth return", async () => {
    render(<FirstServiceConnections view={view} gscSyncEnabled ga4SyncEnabled />);
    expect(screen.getByRole("button", { name: /First-service analysis/ })).toBeDisabled();
    expect(screen.getByText(/link saved, evidence pending/)).toBeInTheDocument();
    expect(screen.getByText(/completed diagnosis will use 1 credit even/)).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.selector).toHaveBeenCalledWith(expect.objectContaining({ caseId: "case", returnTo: "service-setup", embedded: true, gscSyncEnabled: true, ga4SyncEnabled: true }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Refresh status" }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
  it("does not present a missing profile as checked public evidence", () => {
    render(<FirstServiceConnections view={{ ...view, publicProfile: null }} gscSyncEnabled={false} ga4SyncEnabled={false} />);
    expect(screen.getByText(/link still needed/)).toBeInTheDocument();
    expect(screen.queryByText(/Create prospect report/i)).not.toBeInTheDocument();
  });
});
