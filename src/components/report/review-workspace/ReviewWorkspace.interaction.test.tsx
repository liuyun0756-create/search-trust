// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { ReviewWorkspace } from "./ReviewWorkspace";
import { EvidenceFacts } from "./EvidenceFacts";
import fixture from "@/lib/review-workspace/contracts/fixture.json";
import {
  requestWorkspace,
  WorkspaceError,
  type PublicCommand,
} from "@/lib/review-workspace/client";
import type {
  WorkspaceView,
  ReviewFreezeSelection,
} from "@/lib/review-workspace/types";
const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/review-workspace/client", async (original) => ({
  ...(await original<typeof import("@/lib/review-workspace/client")>()),
  requestWorkspace: vi.fn(),
}));
const initial = fixture.view as WorkspaceView;
const identity = {
  ownerId: "10000000-0000-4000-8000-000000000001",
  caseId: initial.case_id,
  reportId: initial.report_id,
};
const target = {
  delivery_id: initial.selection.delivery.id,
  implementation_id: initial.selection.implementation.id,
  implementation_revision: initial.selection.implementation.revision,
};
const source = initial.selection.actions[0]!;
function view(selection?: ReviewFreezeSelection): WorkspaceView {
  const v = structuredClone(initial);
  v.state = "context";
  v.review_id = null;
  v.frozen_at = null;
  v.confirmation_fingerprint = null;
  v.actions.push({
    ...structuredClone(v.actions[0]),
    action_id: "ac-second",
    title: "Review the contact route",
  } as never);
  v.selection.actions.push({
    ...structuredClone(v.selection.actions[0]),
    action_id: "ac-second",
  } as never);
  if (selection) v.selection = structuredClone(selection);
  else
    v.selection.actions.forEach((a) => {
      a.page_current_id = null;
      a.page_previous_id = null;
      a.gsc_id = null;
      a.ga4_id = null;
    });
  v.actions.forEach((a, i) => {
    const s = v.selection.actions[i];
    if (!s.page_current_id) a.page = null;
    if (!s.gsc_id) a.gsc = null;
    if (!s.ga4_id) a.ga4 = null;
  });
  return v;
}
function mockService(override?: (body: PublicCommand) => unknown) {
  vi.mocked(requestWorkspace).mockImplementation(async (_id, body) => {
    const special = override?.(body);
    if (special !== undefined) return (await special) as WorkspaceView;
    if (body.operation === "context") return view();
    if (body.operation === "candidates")
      return {
        case_id: identity.caseId,
        report_id: identity.reportId,
        kind: body.kind,
        items: [
          {
            id:
              body.kind === "page"
                ? source.page_current_id!
                : body.kind === "gsc"
                  ? source.gsc_id!
                  : source.ga4_id!,
            revision: 0,
            at: initial.evaluated_at,
            delivery_id: target.delivery_id,
            delivery_revision: 1,
          },
        ],
        next_cursor: null,
      };
    if (body.operation === "preview")
      return {
        ...view(body.selection),
        state: "preview",
        confirmation_fingerprint: "sha256:" + "a".repeat(64),
      };
    if (body.operation === "save")
      return {
        ...view(body.selection),
        state: "saved",
        review_id: body.review_id,
        frozen_at: initial.frozen_at,
      };
    if (body.operation === "read") return initial;
    return {
      case_id: identity.caseId,
      report_id: identity.reportId,
      kind: "history",
      items: [],
      next_cursor: null,
    };
  });
}
beforeEach(() => {
  sessionStorage.clear();
  vi.clearAllMocks();
  mockService();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function open() {
  render(<ReviewWorkspace identity={identity} location={{ target }} />);
  await screen.findByLabelText("Choose a saved page check");
}
async function confirm() {
  fireEvent.click(screen.getByRole("button", { name: "Review selection →" }));
  await screen.findByRole("heading", {
    name: "Check exactly what this review will keep.",
  });
  await waitFor(() =>
    expect(
      screen.getByRole("heading", {
        name: "Check exactly what this review will keep.",
      }),
    ).toHaveFocus(),
  );
}
const check = () => screen.getByRole("checkbox");
describe("review workspace interactions", () => {
  it("starts with nothing selected and requires explicit confirmation before saving", async () => {
    await open();
    expect(screen.getByLabelText("Choose a saved page check")).toHaveValue("");
    await confirm();
    expect(
      screen.getByRole("button", { name: "Save evidence snapshot · Free" }),
    ).toBeDisabled();
    expect(
      screen.getAllByText("Page check", { exact: false }).length,
    ).toBeGreaterThan(1);
    fireEvent.click(check());
    fireEvent.click(
      screen.getByRole("button", { name: "Save evidence snapshot · Free" }),
    );
    await screen.findByRole("heading", { name: "Evidence snapshot saved." });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(
      screen.getByText("Decision editing is not enabled"),
    ).toBeInTheDocument();
    expect(sessionStorage.length).toBe(0);
  });
  it("retains choices across actions and clears dependent previous checks", async () => {
    await open();
    await waitFor(() =>
      expect(
        screen
          .getByLabelText("Choose a saved page check")
          .querySelectorAll("option").length,
      ).toBe(2),
    );
    fireEvent.change(screen.getByLabelText("Choose a saved page check"), {
      target: { value: source.page_current_id },
    });
    await screen.findByLabelText("Previous check · optional");
    fireEvent.click(
      screen.getByRole("button", {
        name: /Review the contact route.*Viewing|Review the contact route.*0 sources/,
      }),
    );
    expect(screen.getByLabelText("Choose a saved page check")).toHaveValue("");
    fireEvent.click(
      screen.getByRole("button", {
        name: new RegExp(initial.actions[0]!.title),
      }),
    );
    expect(screen.getByLabelText("Choose a saved page check")).toHaveValue(
      source.page_current_id,
    );
    fireEvent.change(screen.getByLabelText("Choose a saved page check"), {
      target: { value: "" },
    });
    expect(
      screen.queryByLabelText("Previous check · optional"),
    ).not.toBeInTheDocument();
    await screen.findByText(
      "The previous page check was cleared with the current-check change.",
    );
  });
  it("does not disguise a directory failure as missing evidence", async () => {
    mockService((body) =>
      body.operation === "candidates"
        ? Promise.reject(new Error("network"))
        : undefined,
    );
    await open();
    await screen.findAllByText(/Evidence could not be loaded/);
    expect(
      screen.queryByText("No saved source is available for this action."),
    ).not.toBeInTheDocument();
  });
  it("recovers a lost acknowledgement after remount with the same ID and selection", async () => {
    let first = true;
    mockService((body) => {
      if (body.operation === "save" && first) {
        first = false;
        return Promise.reject(new Error("timeout"));
      }
    });
    const mounted = render(
      <ReviewWorkspace identity={identity} location={{ target }} />,
    );
    await screen.findByLabelText("Choose a saved page check");
    await confirm();
    fireEvent.click(check());
    fireEvent.click(
      screen.getByRole("button", { name: "Save evidence snapshot · Free" }),
    );
    await screen.findByRole("button", { name: "Recover this save" });
    const savedBody = vi
      .mocked(requestWorkspace)
      .mock.calls.find((c) => c[1].operation === "save")![1];
    expect(sessionStorage.length).toBe(1);
    mounted.unmount();
    render(<ReviewWorkspace identity={identity} location={{ target }} />);
    await screen.findByRole("button", { name: "Recover this save" });
    fireEvent.click(screen.getByRole("button", { name: "Recover this save" }));
    await screen.findByRole("heading", { name: "Evidence snapshot saved." });
    const writes = vi
      .mocked(requestWorkspace)
      .mock.calls.filter((c) => c[1].operation === "save");
    expect(writes).toHaveLength(2);
    expect(writes[1][1]).toEqual(savedBody);
  });
  it("invalidates confirmation on stale save and keeps selections for another review", async () => {
    mockService((body) =>
      body.operation === "save"
        ? Promise.reject(new WorkspaceError(409, "STALE"))
        : undefined,
    );
    await open();
    await confirm();
    fireEvent.click(check());
    fireEvent.click(
      screen.getByRole("button", { name: "Save evidence snapshot · Free" }),
    );
    await screen.findByText(/The review basis changed/);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(sessionStorage.length).toBe(0);
    await confirm();
    expect(check()).not.toBeChecked();
  });
  it("shows unavailable session storage and continues an in-memory save", async () => {
    await open();
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    });
    await confirm();
    fireEvent.click(check());
    fireEvent.click(
      screen.getByRole("button", { name: "Save evidence snapshot · Free" }),
    );
    await screen.findByRole("heading", { name: "Evidence snapshot saved." });
    expect(
      screen.getByText(/Browser recovery storage is unavailable/),
    ).toBeInTheDocument();
  });
  it("clears sensitive facts when authorization changes", async () => {
    await open();
    mockService((body) =>
      body.operation === "preview"
        ? Promise.reject(new WorkspaceError(401, "UNAUTHORIZED"))
        : undefined,
    );
    fireEvent.click(screen.getByRole("button", { name: "Review selection →" }));
    await screen.findByRole("heading", { name: "Evidence is unavailable." });
    expect(screen.queryByText(initial.site_url)).not.toBeInTheDocument();
  });
  it("opens saved evidence read-only and creates a new draft without overwrite", async () => {
    render(
      <ReviewWorkspace
        identity={identity}
        location={{ reviewId: initial.review_id! }}
      />,
    );
    await screen.findByRole("heading", { name: "Evidence snapshot saved." });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare another snapshot" }),
    );
    expect(push).toHaveBeenCalledWith(
      `/cases/${identity.caseId}/reports/${identity.reportId}/review-evidence`,
    );
  });
  it("does not display withheld sessions as zero", () => {
    const a = structuredClone(initial.actions[0]!);
    a.ga4 = {
      ...a.ga4!,
      state: "withheld",
      before: null,
      after: null,
      difference: null,
      relative_change_percent: null,
      reasons: ["THRESHOLDED"],
    };
    render(<EvidenceFacts action={a} only="ga4" />);
    expect(
      screen.getByText("Reading withheld. No values are shown."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
