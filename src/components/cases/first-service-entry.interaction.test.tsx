// @vitest-environment jsdom
import { randomUUID } from "node:crypto";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { FirstServiceEntry } from "./first-service-entry";
import type { EntryView } from "@/lib/first-service-setup/entry-contract";
const caseId = randomUUID(),
  ownerId = randomUUID();
const initial: EntryView = {
  caseId,
  scopeHash: "sha256:" + "a".repeat(64),
  creditBalance: 2,
  sourcesReady: true,
  otherWork: false,
  gscSnapshotId: randomUUID(),
  ga4SnapshotId: randomUUID(),
  service: "AC repair",
  market: "Austin",
  queries: ["repair Austin", "repair near me", "repair service"],
  workflow: null,
  candidates: [],
  supplements: [],
};
let view: EntryView, fetcher: ReturnType<typeof vi.fn>;
const active = (
  phase: NonNullable<EntryView["workflow"]>["phase"] = "awaiting_confirmation",
) => ({
  ...structuredClone(initial),
  workflow: {
    id: randomUUID(),
    discoveryId: randomUUID(),
    phase,
    remainingAttempts: 2,
  },
  candidates: [1, 2, 3, 4].map((i) => ({
    name: `Rival ${i}`,
    website: `https://rival${i}.example/`,
    reason: "Same service and area",
  })),
});
beforeEach(() => {
  sessionStorage.clear();
  view = structuredClone(initial);
  fetcher = vi.fn(async () => Response.json(view));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const mount = () =>
  render(<FirstServiceEntry caseId={caseId} ownerId={ownerId} />);
const writes = () =>
  fetcher.mock.calls.filter(
    (c) => (c[1] as RequestInit | undefined)?.method === "POST",
  );
describe("first-service deliberate paid entry", () => {
  it("never charges on mount and requires explicit consent", async () => {
    mount();
    const start = await screen.findByRole("button", {
      name: "Use 1 credit & start",
    });
    expect(start).toBeDisabled();
    expect(writes()).toHaveLength(0);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox"));
    await user.click(start);
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(JSON.parse(writes()[0][1].body)).toMatchObject({
      action: "start",
      acceptedCredit: true,
      websites: [],
    });
  });
  it("recovers current state on reload rather than starting a second workflow", async () => {
    view = active("discovering");
    mount();
    expect(await screen.findByText("Checking the market")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Use 1 credit & start" }),
    ).toBeNull();
    expect(writes()).toHaveLength(0);
  });
  it("limits confirmation to three candidates and submits only selected URLs", async () => {
    view = active();
    mount();
    const user = userEvent.setup();
    await screen.findByText("Rival 1");
    const boxes = screen.getAllByRole("checkbox");
    for (let i = 0; i < 3; i++) await user.click(boxes[i]);
    expect(boxes[3]).toBeDisabled();
    await user.click(
      screen.getByRole("button", {
        name: "Confirm competitors & prepare report",
      }),
    );
    await waitFor(() => expect(writes()).toHaveLength(1));
    expect(JSON.parse(writes()[0][1].body)).toMatchObject({
      action: "confirm",
      workflowId: view.workflow!.id,
      websites: view.candidates.slice(0, 3).map((c) => c.website),
    });
  });
  it("keeps an uncertain paid intent and retries exactly the same request", async () => {
    fetcher.mockImplementation(async (_url, init) => {
      if (init?.method === "POST") throw Error("Network interrupted");
      return Response.json(view);
    });
    mount();
    await screen.findByRole("checkbox");
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Use 1 credit & start" }),
    );
    await screen.findByRole("button", { name: "Retry saved request" });
    await user.click(
      screen.getByRole("button", { name: "Retry saved request" }),
    );
    await waitFor(() => expect(writes()).toHaveLength(2));
    expect(writes()[0][1].body).toBe(writes()[1][1].body);
    expect(
      screen.getByRole("button", { name: "Use 1 credit & start" }),
    ).toBeDisabled();
  });
  it("clears an ambiguous start after status proves it was committed", async () => {
    fetcher.mockImplementation(async (_url, init) => {
      if (init?.method === "POST") {
        const c = JSON.parse(init.body);
        view = {
          ...initial,
          workflow: {
            id: c.workflowId,
            discoveryId: c.discoveryId,
            phase: "discovering",
            remainingAttempts: 3,
          },
        };
        throw Error("Lost response");
      }
      return Response.json(view);
    });
    mount();
    await screen.findByRole("checkbox");
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Use 1 credit & start" }),
    );
    await screen.findByRole("button", { name: "Retry saved request" });
    await user.click(
      screen.getByRole("button", { name: "Check current status" }),
    );
    await screen.findByText("Checking the market");
    expect(
      screen.queryByRole("button", { name: "Retry saved request" }),
    ).toBeNull();
    expect(writes()).toHaveLength(1);
  });
  it("does not send if the intent cannot be safely saved", async () => {
    const original = sessionStorage;
    vi.stubGlobal("sessionStorage", {
      getItem: original.getItem.bind(original),
      removeItem: original.removeItem.bind(original),
      setItem: () => {
        throw Error("Storage unavailable");
      },
    });
    mount();
    await screen.findByRole("checkbox");
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox"));
    await user.click(
      screen.getByRole("button", { name: "Use 1 credit & start" }),
    );
    await screen.findByRole("alert");
    expect(writes()).toHaveLength(0);
  });
  it("blocks expired results and exhausted budgets without another paid start", async () => {
    view = active("refresh_required");
    view.workflow!.remainingAttempts = 0;
    mount();
    await screen.findByText("These market results have expired");
    expect(screen.getByText(/No more discovery executions/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /Confirm competitors/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Use 1 credit/ })).toBeNull();
    expect(writes()).toHaveLength(0);
  });
});

it("keeps status readable but offers no new paid start while intake is paused", async () => {
  render(
    <FirstServiceEntry
      caseId={caseId}
      ownerId={ownerId}
      intakeEnabled={false}
    />,
  );
  await screen.findByText(/New first-service analyses are temporarily paused/);
  expect(
    screen.queryByRole("button", { name: "Use 1 credit & start" }),
  ).toBeNull();
  expect(
    screen.getByRole("button", { name: "Check current status" }),
  ).toBeEnabled();
  expect(writes()).toHaveLength(0);
});
it("can confirm an already reserved workflow while new intake is paused", async () => {
  view = active();
  render(
    <FirstServiceEntry
      caseId={caseId}
      ownerId={ownerId}
      intakeEnabled={false}
    />,
  );
  await screen.findByText("Rival 1");
  const user = userEvent.setup();
  await user.click(screen.getAllByRole("checkbox")[0]);
  await user.click(
    screen.getByRole("button", {
      name: "Confirm competitors & prepare report",
    }),
  );
  await waitFor(() => expect(writes()).toHaveLength(1));
  expect(JSON.parse(writes()[0][1].body)).toMatchObject({
    action: "confirm",
    workflowId: view.workflow!.id,
  });
});
