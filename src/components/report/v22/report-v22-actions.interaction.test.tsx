// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { E2E_IDS } from "../../../../e2e/fixtures/ids";
import { createdShareFixture } from "../../../../e2e/fixtures/share";
import { ReportV22Actions } from "./report-v22-actions";

afterEach(() => vi.unstubAllGlobals());

describe("ReportV22Actions interactions", () => {
  it("creates and revokes a fragment-only client share", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "DELETE") return new Response(null, { status: 204 });
      return new Response(JSON.stringify(createdShareFixture), { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ReportV22Actions caseId={E2E_IDS.caseId} reportId={E2E_IDS.reportId} mode="advisor" />);

    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByRole("dialog", { name: "Share client report" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create secure link" }));
    expect(await screen.findByText(createdShareFixture.url)).toBeInTheDocument();
    expect(new URL(createdShareFixture.url).search).toBe("");

    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Create secure link" })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining(`/${E2E_IDS.shareId}`), { method: "DELETE" });
  });
});
