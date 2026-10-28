// @vitest-environment jsdom
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { GenerateReview } from "./GenerateReview";
import { identity, revision, job } from "@/lib/review-intake/test-support";
const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
    clear: () => data.clear(),
  });
  vi.stubGlobal("fetch", fetcher);
  fetcher.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("requires a separate paid confirmation, then shows the saved task", async () => {
  fetcher
    .mockResolvedValueOnce(Response.json(null))
    .mockImplementation(async (_url, init) => {
      const c = JSON.parse(String(init?.body));
      const r = job();
      r.job_id = c.selection.job_id;
      r.selection = c.selection;
      return Response.json(r);
    });
  render(<GenerateReview identity={identity} revision={revision} />);
  const button = await screen.findByRole("button", {
    name: "Generate review · 1 credit",
  });
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(button);
  await screen.findByText("Review queued · 1 credit reserved");
  expect(fetcher.mock.calls[1][1]?.method).toBe("POST");
  expect(
    screen.getByText(/including a completed diagnosis with no next actions/),
  ).toBeVisible();
});
it("preserves identical body/UUID after an unknown start, including a refresh", async () => {
  const bodies: string[] = [];
  fetcher
    .mockResolvedValueOnce(Response.json(null))
    .mockImplementation(async (_url, init) => {
      if (init?.method === "GET") return Response.json(null);
      bodies.push(String(init?.body));
      throw Error("lost ack");
    });
  const first = render(
    <GenerateReview identity={identity} revision={revision} />,
  );
  fireEvent.click(await screen.findByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Generate review · 1 credit" }),
  );
  await screen.findByText(/The start result is unknown/);
  first.unmount();
  render(<GenerateReview identity={identity} revision={revision} />);
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Check the same generation request",
    }),
  );
  await waitFor(() => expect(bodies).toHaveLength(2));
  expect(bodies[0]).toBe(bodies[1]);
  expect(screen.queryByRole("checkbox")).toBeNull();
});
it("explains a paused intake without auto-starting or replacing the request", async () => {
  fetcher
    .mockResolvedValueOnce(Response.json(null))
    .mockResolvedValue(
      Response.json(
        { error: { code: "V22_PUBLIC_ENTRY_PAUSED" } },
        { status: 503 },
      ),
    );
  render(<GenerateReview identity={identity} revision={revision} />);
  fireEvent.click(await screen.findByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Generate review · 1 credit" }),
  );
  await screen.findByText(/New review generation is temporarily paused/);
  expect(screen.queryByText(/The start result is unknown/)).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(2);
  const original = fetcher.mock.calls[1][1]?.body;
  fireEvent.click(
    screen.getByRole("button", { name: "Check the same generation request" }),
  );
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  expect(fetcher.mock.calls[2][1]?.body).toBe(original);
});
it("recovers completion from a different device and links to the review route", async () => {
  const r = job();
  r.status = "succeeded";
  r.report_id = r.job_id;
  r.credit_state = "consumed";
  fetcher.mockResolvedValue(Response.json(r));
  render(<GenerateReview identity={identity} revision={revision} />);
  const link = await screen.findByRole("link", {
    name: "Review & approve the report →",
  });
  expect(link).toHaveAttribute(
    "href",
    `/cases/${identity.caseId}/reports/${r.job_id}/review`,
  );
  expect(screen.queryByRole("checkbox")).toBeNull();
});
it("blocks a new start while lookup is unknown and distinguishes a compensated task", async () => {
  fetcher.mockRejectedValueOnce(Error("offline"));
  const view = render(
    <GenerateReview identity={identity} revision={revision} />,
  );
  await screen.findByText(/saved task could not be checked/);
  expect(screen.queryByRole("checkbox")).toBeNull();
  const r = job();
  r.status = "failed";
  r.credit_state = "compensated";
  r.error_code = "TECHNICAL_FAILURE";
  fetcher.mockResolvedValue(Response.json(r));
  fireEvent.click(screen.getByRole("button", { name: "Check saved task" }));
  await screen.findByText("Review failed · reserved credit returned");
  fireEvent.click(
    screen.getByRole("button", { name: "Prepare a new attempt" }),
  );
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  view.unmount();
});
