// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { DecisionWorkspace } from "./DecisionWorkspace";
import { requestDecision, DecisionError } from "@/lib/review-decisions/client";
import { markerKey } from "@/lib/review-decisions/draft";
import fixture from "@/lib/review-decisions/contracts/fixture.json";
import type {
  Context,
  Revision,
  PublicCommand,
} from "@/lib/review-decisions/types";
vi.mock("@/lib/review-decisions/client", async (original) => ({
  ...(await original<typeof import("@/lib/review-decisions/client")>()),
  requestDecision: vi.fn(),
}));
const context = fixture.context as Context,
  receipt = fixture.revision as Revision;
const identity = {
  ownerId: receipt.user_id,
  caseId: receipt.case_id,
  reportId: receipt.report_id,
};
let currentContext: Context;
let records: Revision[],
  writes: PublicCommand[],
  failure: string | null,
  emptyHistoryFailure: boolean;
beforeEach(() => {
  vi.clearAllMocks();
  currentContext = structuredClone(context);
  records = [];
  writes = [];
  failure = null;
  emptyHistoryFailure = false;
  sessionStorage.clear();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  vi.mocked(requestDecision).mockImplementation(async (_i, c) => {
    if (c.operation === "context")
      return structuredClone(currentContext) as never;
    if (c.operation === "history") {
      if (emptyHistoryFailure) throw new DecisionError(503, "UNAVAILABLE");
      return {
        review_id: receipt.review_id,
        report_id: receipt.report_id,
        items: records
          .filter((r) => !c.cursor || r.revision < c.cursor)
          .slice(0, 20)
          .map((r) => ({
            id: r.id,
            revision: r.revision,
            previous_id: r.previous_id,
            recorded_at: r.recorded_at,
            checksum: r.checksum,
            decision_count: r.decisions.length,
          })),
        next_cursor:
          records.filter((r) => !c.cursor || r.revision < c.cursor).length > 20
            ? records.filter((r) => !c.cursor || r.revision < c.cursor)[19]
                .revision
            : null,
      } as never;
    }
    if (c.operation === "read") {
      const r = records.find((r) => r.id === c.decision_id);
      if (!r) throw new DecisionError(404, "UNAVAILABLE");
      return structuredClone(r) as never;
    }
    writes.push(c);
    if (failure === "stale") throw new DecisionError(409, "STALE");
    if (failure === "forbidden") throw new DecisionError(403, "FORBIDDEN");
    const prior = records.find((r) => r.id === c.request.id);
    const r = prior ?? {
      ...structuredClone(receipt),
      ...structuredClone(c.request),
      revision: records.length + 1,
    };
    if (!prior) records.unshift(r);
    if (failure === "lost") throw new DecisionError(503, "UNAVAILABLE");
    return r as never;
  });
});
afterEach(() => vi.restoreAllMocks());
async function open() {
  render(
    <DecisionWorkspace identity={identity} reviewId={receipt.review_id} />,
  );
  await screen.findByRole("heading", { name: "What should happen next?" });
}
async function edit() {
  fireEvent.click(screen.getByRole("radio", { name: /Continue/ }));
  fireEvent.change(screen.getByLabelText(/Why this decision/), {
    target: { value: "Keep this direction while checking the contact path." },
  });
}
async function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Review & save →" }));
  const dialog = await screen.findByRole("dialog");
  expect(
    within(dialog).getByRole("button", { name: "Save version · 0 credits" }),
  ).toBeDisabled();
  fireEvent.click(within(dialog).getByRole("checkbox"));
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Save version · 0 credits" }),
  );
}
it("starts undecided, explicitly saves then keeps history read-only", async () => {
  await open();
  expect(
    screen
      .getAllByRole("radio")
      .every((el) => !(el as HTMLInputElement).checked),
  ).toBe(true);
  await edit();
  await submit();
  await screen.findByRole("heading", { name: "Your reasoning, preserved." });
  expect(writes).toHaveLength(1);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(sessionStorage.length).toBe(0);
  fireEvent.click(screen.getByRole("button", { name: "Edit a new version →" }));
  await screen.findByLabelText(/Why this decision/);
  expect(screen.getByLabelText(/Why this decision/)).toHaveValue(
    "Keep this direction while checking the contact path.",
  );
  fireEvent.change(screen.getByLabelText(/Why this decision/), {
    target: { value: "Changed judgment" },
  });
  await submit();
  await screen.findByRole("heading", { name: "Your reasoning, preserved." });
  expect(records).toHaveLength(2);
  expect(records[1].decisions[0].reason).toBe(
    "Keep this direction while checking the contact path.",
  );
});
it("requires adjustment evidence and shows conditional fields", async () => {
  await open();
  fireEvent.click(screen.getByRole("radio", { name: /Adjust/ }));
  expect(screen.getByLabelText(/Target/)).toHaveValue(
    context.approved[0].target,
  );
  fireEvent.click(screen.getByRole("button", { name: "Review & save →" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Complete the reason",
  );
  expect(writes).toHaveLength(0);
  fireEvent.change(screen.getByLabelText(/Why this decision/), {
    target: { value: "Clarify the scope." },
  });
  fireEvent.click(screen.getAllByRole("checkbox")[0]);
  await submit();
  await screen.findByText("Read-only history");
});
it("supports clearing a saved decision through a new empty version", async () => {
  records = [structuredClone(receipt)];
  render(
    <DecisionWorkspace identity={identity} reviewId={receipt.review_id} />,
  );
  await screen.findByText("Read-only history");
  fireEvent.click(screen.getByRole("button", { name: "Edit a new version →" }));
  await screen.findByRole("radio", { name: /Continue/ });
  fireEvent.click(screen.getByRole("button", { name: "Clear this decision" }));
  await submit();
  await screen.findByText("Read-only history");
  expect(records[0].decisions).toEqual([]);
  expect(records[1].decisions).toHaveLength(1);
});
it("keeps private text out of storage and recovers lost receipt by ID", async () => {
  await open();
  await edit();
  failure = "lost";
  await submit();
  await screen.findByText("Save result needs checking");
  expect(writes).toHaveLength(1);
  const stored = sessionStorage.getItem(
    markerKey(identity, receipt.review_id),
  )!;
  expect(stored).not.toContain("contact");
  expect(Object.keys(JSON.parse(stored))).toHaveLength(5);
  expect(
    screen.getByRole("button", { name: "Review & save →" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Check this save" }));
  await screen.findByText("Read-only history");
  expect(writes).toHaveLength(1);
  expect(records).toHaveLength(1);
});
it("refresh recovery checks the prior request, never submits automatically", async () => {
  records = [structuredClone(receipt)];
  sessionStorage.setItem(
    markerKey(identity, receipt.review_id),
    JSON.stringify({
      ...identity,
      reviewId: receipt.review_id,
      requestId: receipt.id,
    }),
  );
  render(
    <DecisionWorkspace identity={identity} reviewId={receipt.review_id} />,
  );
  await screen.findByText("Save result needs checking");
  expect(writes).toEqual([]);
  fireEvent.click(screen.getByRole("button", { name: "Check this save" }));
  await waitFor(() =>
    expect(
      screen.queryByText("Save result needs checking"),
    ).not.toBeInTheDocument(),
  );
  expect(writes).toEqual([]);
});
it("preserves draft on stale head and blocks blind resubmission", async () => {
  await open();
  await edit();
  failure = "stale";
  await submit();
  await screen.findByText(/A newer decision version exists/);
  expect(screen.getByLabelText(/Why this decision/)).toHaveValue(
    "Keep this direction while checking the contact path.",
  );
  expect(
    screen.getByRole("button", { name: "Review & save →" }),
  ).toBeDisabled();
  expect(writes).toHaveLength(1);
});
it("does not treat history failure as no decisions", async () => {
  emptyHistoryFailure = true;
  render(
    <DecisionWorkspace identity={identity} reviewId={receipt.review_id} />,
  );
  await screen.findByRole("button", { name: "Retry loading workspace" });
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(writes).toHaveLength(0);
});
it("clears private text and evidence when save access is lost", async () => {
  await open();
  await edit();
  failure = "forbidden";
  await submit();
  await screen.findByText(/Private evidence and drafts have been cleared/);
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(sessionStorage.length).toBe(0);
});
it("adds and removes independent new work without changing originals", async () => {
  await open();
  fireEvent.click(screen.getByRole("button", { name: /Propose new work/ }));
  expect(screen.getByLabelText(/Target/)).toHaveValue("");
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Remove proposed work" }));
  expect(screen.getByRole("radio", { name: /Continue/ })).not.toBeChecked();
});
it("keeps an in-memory draft while inspecting history and confirms leaving", async () => {
  await open();
  await edit();
  fireEvent.click(screen.getByRole("button", { name: "Version history" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Return to your draft →" }),
  );
  expect(screen.getByLabelText(/Why this decision/)).toHaveValue(
    "Keep this direction while checking the contact path.",
  );
  vi.mocked(window.confirm).mockReturnValue(false);
  fireEvent.click(screen.getByRole("link", { name: "← Back to report" }));
  expect(window.confirm).toHaveBeenCalledWith(
    "Leave without saving your decision draft?",
  );
});
it("retries an unknown write with exactly the same request and ID", async () => {
  await open();
  await edit();
  failure = "lost";
  await submit();
  await screen.findByText("Save result needs checking");
  const original = structuredClone(writes[0]);
  failure = null;
  fireEvent.click(
    screen.getByRole("button", { name: "Retry the same request" }),
  );
  await screen.findByText("Read-only history");
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(original);
  expect(records).toHaveLength(1);
});
it("loads older history and always edits from the latest head", async () => {
  const id = (n: number) =>
    `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  records = Array.from({ length: 21 }, (_, i) => ({
    ...structuredClone(receipt),
    id: id(21 - i),
    revision: 21 - i,
    previous_id: i === 20 ? null : id(20 - i),
    previous_checksum: i === 20 ? null : receipt.checksum,
    decisions: [
      { ...receipt.decisions[0], reason: `Reason for version ${21 - i}` },
    ],
  }));
  render(
    <DecisionWorkspace identity={identity} reviewId={receipt.review_id} />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Load older versions" }),
  );
  fireEvent.click(await screen.findByRole("button", { name: /Version 1\s/ }));
  await screen.findByText("Reason for version 1");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit a new version →" }));
  await waitFor(() =>
    expect(screen.getByLabelText(/Why this decision/)).toHaveValue(
      "Reason for version 21",
    ),
  );
});
it("keeps a zero-action diagnosis and allows only an explicit empty save", async () => {
  currentContext.approved = [];
  currentContext.references = [];
  currentContext.evidence.actions = [];
  await open();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Propose new work/ }),
  ).toBeDisabled();
  expect(
    screen.getByText(/This snapshot has no approved actions/),
  ).toBeInTheDocument();
  await submit();
  await screen.findByText("Read-only history");
  expect(records[0].decisions).toEqual([]);
});
