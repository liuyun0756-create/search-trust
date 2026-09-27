// @vitest-environment jsdom

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import prospectFixture from "@/lib/report-v22/contracts/fixtures/prospect.json";
import type { SearchTrustReportV2_2 } from "@/lib/report-v22/generated/types";
import { initialDeliveryPlan } from "@/lib/report-delivery/plan";
import { DeliveryPlanEditor } from "./delivery-plan-editor";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => { vi.unstubAllGlobals(); refresh.mockReset(); });

const originalPlan = initialDeliveryPlan(prospectFixture as unknown as SearchTrustReportV2_2);

describe("DeliveryPlanEditor", () => {
  it("saves a reordered draft and requires review before approval", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (init.method === "PUT") return new Response(JSON.stringify({ revision: 1, status: "draft", plan: body.plan }), { status: 200 });
      return new Response(JSON.stringify({ revision: 2, status: "approved", plan: originalPlan }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<DeliveryPlanEditor caseId="case-1" reportId="report-1" initialState={{ plan: originalPlan, originalPlan, revision: 0, status: "original", editingAvailable: true }} />);

    expect(screen.getByRole("button", { name: "Approve for client delivery" })).toBeDisabled();
    const rows = screen.getAllByRole("listitem");
    await user.click(within(rows[1]).getByRole("button", { name: "Move up" }));
    expect(screen.getByRole("button", { name: "Approve for client delivery" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/delivery-plan"), expect.objectContaining({ method: "PUT" })));
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).plan[0].actionId).toBe(originalPlan[1].actionId);
    expect(await screen.findByText(/Draft saved/)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /I have reviewed the client preview/ }));
    await user.click(screen.getByRole("button", { name: "Approve for client delivery" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/delivery-plan"), expect.objectContaining({ method: "POST" })));
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).expectedRevision).toBe(1);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).reviewConfirmed).toBe(true);
    expect(refresh).toHaveBeenCalled();
  });
});
