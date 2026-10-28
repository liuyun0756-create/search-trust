// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { preflightFixture } from "../../../e2e/fixtures/preflight";
import { FirstServiceClient } from "./first-service-client";

const mocks = vi.hoisted(() => ({ push: vi.fn(), preflight: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/preflight-v22", () => ({ runPreflight: mocks.preflight }));
const fetcher = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetcher);
  mocks.preflight.mockResolvedValue({ ...preflightFixture,
    identity_candidates: preflightFixture.identity_candidates.map((candidate) => ({ ...candidate,
      business: { ...candidate.business, public_gbp_url: "https://www.google.com/maps?cid=123456" } })),
  });
});
afterEach(() => vi.unstubAllGlobals());

async function confirmStep() {
  const user = userEvent.setup();
  render(<FirstServiceClient />);
  await user.type(screen.getByLabelText("Business website"), "example.com");
  await user.click(screen.getByRole("button", { name: "Check business details" }));
  await screen.findByRole("button", { name: "Save client and connect data" });
  return user;
}

describe("first-service client preparation", () => {
  it("reuses public identity confirmation and only saves a Case after explicit confirmation", async () => {
    fetcher.mockImplementation(async (_url, init) => new Response(JSON.stringify({ id: JSON.parse(init.body).draft_case_id, status: "active" }), { status: 201 }));
    const user = await confirmStep();
    expect(mocks.preflight).toHaveBeenCalledWith({ site_url: "example.com", gbp_url: null }, expect.any(AbortSignal));
    expect(fetcher).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Save client and connect data" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe("/api/v2/cases");
    const saved = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(saved).toMatchObject({ primary_service: preflightFixture.service_candidates[0].value, public_gbp_url: "https://www.google.com/maps?cid=123456" });
    expect(saved).not.toHaveProperty("report_type");
    expect(mocks.push).toHaveBeenCalledWith(`/cases/${saved.draft_case_id}/service-setup`);
  });
  it("preserves the same draft ID after a failed create response", async () => {
    fetcher.mockRejectedValueOnce(new Error("Connection lost"))
      .mockImplementationOnce(async (_url, init) => new Response(JSON.stringify({ id: JSON.parse(init.body).draft_case_id, status: "active" }), { status: 201 }));
    const user = await confirmStep();
    await user.click(screen.getByRole("button", { name: "Save client and connect data" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
    await user.click(screen.getByRole("button", { name: "Save client and connect data" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(JSON.parse(fetcher.mock.calls[0][1].body).draft_case_id).toBe(JSON.parse(fetcher.mock.calls[1][1].body).draft_case_id);
  });
  it.each(["active", "archived"])("offers an explicit existing %s Case link without overwriting or charging", async (status) => {
    const id = "00000000-0000-4000-8000-000000000123";
    fetcher.mockResolvedValue(new Response(JSON.stringify({ error: { code: "CASE_ALREADY_EXISTS", case_id: id, status } }), { status: 409 }));
    const user = await confirmStep();
    await user.click(screen.getByRole("button", { name: "Save client and connect data" }));
    if (status === "active") expect(await screen.findByRole("link", { name: "Continue with the existing client" })).toHaveAttribute("href", `/cases/${id}/service-setup`);
    else expect(await screen.findByRole("button", { name: "Restore this client and continue" })).toBeEnabled();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("restores an archived duplicate only on explicit click and keeps its original scope", async () => {
    const id = "00000000-0000-4000-8000-000000000123";
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "CASE_ALREADY_EXISTS", case_id: id, status: "archived" } }), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id, status: "active" })));
    const user = await confirmStep();
    await user.click(screen.getByRole("button", { name: "Save client and connect data" }));
    await user.click(await screen.findByRole("button", { name: "Restore this client and continue" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/cases/${id}/service-setup`));
    expect(fetcher.mock.calls[1][0]).toBe(`/api/v2/cases/${id}`);
    expect(fetcher.mock.calls[1][1].method).toBe("PATCH");
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ status: "active" });
  });
  it("ignores concurrent submissions while a Case save is outstanding", async () => {
    let finish!: (response: Response) => void;
    fetcher.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    await confirmStep();
    const button = screen.getByRole("button", { name: "Save client and connect data" });
    fireEvent.submit(button.closest("form")!);
    fireEvent.submit(button.closest("form")!);
    expect(fetcher).toHaveBeenCalledTimes(1);
    finish(new Response(JSON.stringify({ error: { message: "Try again" } }), { status: 503 }));
    await screen.findByRole("alert");
  });
  it("rejects an unexpected saved identity instead of navigating to another Case", async () => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ id: "unrelated", status: "active" }), { status: 201 }));
    const user = await confirmStep();
    await user.click(screen.getByRole("button", { name: "Save client and connect data" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be confirmed");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
