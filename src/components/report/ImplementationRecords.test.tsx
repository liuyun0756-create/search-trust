// @vitest-environment jsdom
import {fireEvent, render, screen, waitFor} from "@testing-library/react";
import {afterEach, describe, expect, it, vi} from "vitest";
import {ImplementationRecords} from "./ImplementationRecords";
import fixture from "@/lib/implementation-records/contracts/fixture.json";
import {canonicalDigest} from "@/lib/verified-analysis-v22/digest";
const {source} = fixture;
const props = {caseId: source.caseId, reportId: source.reportId, deliveryRevisionId: source.deliveryRevisionId};
const day = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), {status});
function saved(entries: unknown[], revision = 1) {
  const content = {...fixture.history[0], entries, revision, recorded_at: new Date().toISOString()};
  const {checksum: _old, ...body} = content;
  return {source, history: [{...body, checksum: canonicalDigest(body)}]};
}
function fill() {
  fireEvent.click(screen.getByLabelText("I implemented this action"));
  fireEvent.change(screen.getByLabelText("Date implemented"), {target: {value: day}});
  fireEvent.change(screen.getByLabelText("Implementation timezone"), {target: {value: "UTC"}});
}
afterEach(() => vi.unstubAllGlobals());
describe("owner implementation record", () => {
  it("prefills an approved target, saves only chosen work and keeps the three states separate", async () => {
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method === "PUT") return response(saved(JSON.parse(init.body as string).entries.map((entry: Record<string, unknown>) => Object.fromEntries(Object.entries(entry).reverse()))));
      return response({source, history: []});
    });
    vi.stubGlobal("fetch", fetcher); render(<ImplementationRecords {...props}/>);
    await screen.findByLabelText("I implemented this action"); fill();
    expect(screen.getByLabelText("Actual scope")).toHaveValue(source.actions[0].target);
    expect(screen.getByText("Not performed by this record")).toBeVisible(); expect(screen.getByText("Not assessed")).toBeVisible();
    fireEvent.click(screen.getByRole("button", {name: "Save implementation record · free"}));
    await screen.findByText(/Implementation record saved/);
    const body = JSON.parse(fetcher.mock.calls.find(([, init]) => init?.method === "PUT")![1]!.body as string);
    expect(body.expectedRevision).toBe(0); expect(body.entries).toEqual([{action_id: source.actions[0].id, scope: source.actions[0].target, implemented_on: day, timezone: "UTC", note: null, responsible: null}]);
    expect(screen.getByText(/User recorded · revision 1/)).toBeVisible();
  });
  it("keeps a conflicting date correction and reloads only on explicit discard", async () => {
    const current = saved([{...fixture.history[0].entries[0], implemented_on: day, timezone: "UTC"}]);
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => init?.method === "PUT" ? response({error: {code: "CONFLICT"}}, 409) : response(current));
    vi.stubGlobal("fetch", fetcher); render(<ImplementationRecords {...props}/>);
    const date = await screen.findByLabelText("Date implemented");
    const correction = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    fireEvent.change(date, {target: {value: correction}});
    fireEvent.click(screen.getByRole("button", {name: "Save implementation record · free"}));
    await screen.findByRole("alert"); expect(date).toHaveValue(correction);
    expect(screen.getByRole("button", {name: "Save implementation record · free"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button", {name: "Reload saved record (discard local edits)"}));
    await waitFor(() => expect(screen.getByLabelText("Date implemented")).toHaveValue(day));
  });
  it("retains edits and the expected revision after a lost acknowledgement", async () => {
    let writes = 0;
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
      if (init?.method !== "PUT") return response({source, history: []});
      writes++;
      if (writes === 1) throw new Error("lost response");
      return response(saved(JSON.parse(init.body as string).entries));
    });
    vi.stubGlobal("fetch", fetcher); render(<ImplementationRecords {...props}/>);
    await screen.findByLabelText("I implemented this action"); fill();
    fireEvent.click(screen.getByRole("button", {name: "Save implementation record · free"})); await screen.findByRole("alert");
    expect(screen.getByLabelText("Date implemented")).toHaveValue(day);
    fireEvent.click(screen.getByRole("button", {name: "Save implementation record · free"})); await screen.findByText(/Implementation record saved/);
    const requests = fetcher.mock.calls.filter(([, init]) => init?.method === "PUT").map(([, init]) => JSON.parse(init!.body as string));
    expect(requests[0]).toEqual(requests[1]);
  });
  it("does not create a task when loading fails or a report has no actions", async () => {
    const fetcher = vi.fn(async () => response({source: {...source, actions: []}, history: []}));
    vi.stubGlobal("fetch", fetcher); render(<ImplementationRecords {...props}/>);
    await screen.findByText(/no proposed actions/);
    expect(screen.queryByRole("button", {name: "Save implementation record · free"})).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("plans from the saved date, not a correction that has not yet been saved", async () => {
    const current = saved([{...fixture.history[0].entries[0], implemented_on: day, timezone: "UTC"}]);
    const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => init?.method === "PUT"
      ? response(saved(JSON.parse(init.body as string).entries, 2)) : response(current));
    vi.stubGlobal("fetch", fetcher); render(<ImplementationRecords {...props}/>);
    const date = await screen.findByLabelText("Date implemented");
    const correction = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    expect(screen.getByText("Excluded").parentElement).toHaveTextContent(day);
    fireEvent.change(date, {target: {value: correction}});
    expect(screen.getByText("Excluded").parentElement).toHaveTextContent(day);
    fireEvent.click(screen.getByRole("button", {name: "Save implementation record · free"}));
    await screen.findByText("Based on saved implementation revision 2, not unsaved edits.");
    expect(screen.getByText("Excluded").parentElement).toHaveTextContent(correction);
  });
});
