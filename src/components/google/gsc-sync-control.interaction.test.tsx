// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { E2E_IDS } from "../../../e2e/fixtures/ids";
import { GscSyncControl } from "./gsc-sync-control";

afterEach(() => vi.unstubAllGlobals());

describe("GscSyncControl interactions", () => {
  it("keeps sync disabled until identity is matched", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ job: null, snapshot: null }), { status: 200 })));
    render(<GscSyncControl caseId={E2E_IDS.caseId} bindingId={E2E_IDS.gscBindingId} identityMatched={false} />);
    expect(screen.getByRole("button", { name: "Sync GSC data" })).toBeDisabled();
    expect(screen.getByText(/Confirm this resource's identity/)).toBeInTheDocument();
  });

  it("requests a confirmed sync and announces the active background state", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return new Response(JSON.stringify({ job_id: E2E_IDS.syncJobId, status: "queued" }), { status: 202 });
      return new Response(JSON.stringify({ job: { status: "running", attempt_count: 1, error_code: null }, snapshot: null }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const firstRender = render(<GscSyncControl caseId={E2E_IDS.caseId} bindingId={E2E_IDS.gscBindingId} identityMatched onStateChanged={changed} />);

    const button = await screen.findByRole("button", { name: "GSC sync in progress…" });
    expect(button).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Collecting search data");
    firstRender.unmount();

    // Render a fresh idle control so the click path is exercised without a live job.
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ job: null, snapshot: null }), { status: 200 }));
    render(<GscSyncControl caseId={E2E_IDS.caseId} bindingId={E2E_IDS.ga4BindingId} identityMatched onStateChanged={changed} />);
    const idle = await screen.findByRole("button", { name: "Sync GSC data" });
    await user.click(idle);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/gsc-sync"), expect.objectContaining({ method: "POST" })));
    expect(changed).toHaveBeenCalled();
  });
});
