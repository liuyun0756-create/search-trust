// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { connectionCenterFixture, googleConnectionFixture } from "../../../e2e/fixtures/google";
import { E2E_IDS } from "../../../e2e/fixtures/ids";
import { ConnectionCenter } from "./connection-center";

afterEach(() => vi.unstubAllGlobals());

describe("ConnectionCenter interactions", () => {
  it("opens resource management from an identity-confirmation action", async () => {
    const user = userEvent.setup();
    const mismatch = connectionCenterFixture("mismatch");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("connection-center")) return new Response(JSON.stringify(mismatch), { status: 200 });
      if (url.endsWith("/api/v2/google/connections")) return new Response(JSON.stringify({ connections: [googleConnectionFixture] }), { status: 200 });
      if (url.includes("google-resources")) return new Response(JSON.stringify({ bindings: [] }), { status: 200 });
      throw new Error(`Unexpected interaction-test request: ${url}`);
    }));
    const { container } = render(<ConnectionCenter caseId={E2E_IDS.caseId} businessName="SearchTrust E2E Plumbing" siteUrl={E2E_IDS.siteUrl} initialData={mismatch} />);

    expect(screen.getByRole("progressbar", { name: "Verified Core sources ready" })).toHaveAttribute("aria-valuenow", "2");
    const ga4Card = container.querySelector('[data-source-key="ga4"]');
    expect(ga4Card).not.toBeNull();
    await user.click(within(ga4Card as HTMLElement).getByRole("button", { name: /Review identity/ }));

    const manager = container.querySelector("#manage-google-sources");
    await waitFor(() => expect(manager).toHaveAttribute("open"));
    expect(await screen.findByLabelText("Google account")).toBeInTheDocument();
  });
});
