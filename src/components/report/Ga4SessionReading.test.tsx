// @vitest-environment jsdom
import React from "react";
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {Ga4SessionReading} from "./Ga4SessionReading";
import {reading, readingJob} from "@/lib/ga4-session-readings/test-fixture";
afterEach(() => {cleanup(); vi.unstubAllGlobals();});

it("loads only after activation and displays neutral exact counts with limitations", async () => {
  const fetch = vi.fn(async (_url, _init) => Response.json(reading())); vi.stubGlobal("fetch", fetch);
  render(<Ga4SessionReading job={readingJob()}/>); expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", {name: "View saved session counts"}));
  await screen.findByText("+25.00%"); expect(screen.getByText("+25")).toBeTruthy();
  expect(screen.getByText(/not a measure of the effect/)).toBeTruthy();
  expect(fetch.mock.calls[0][1]).toMatchObject({cache: "no-store"});
  fireEvent.click(screen.getByRole("button", {name: "Hide saved session counts"}));
  expect(screen.queryByText("+25.00%")).toBeNull();
});

it("does not invent a percentage from zero", async () => {
  const r = {...reading(), before: 0, after: 12, difference: 12, relative_change_percent: null};
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(r)));
  render(<Ga4SessionReading job={readingJob()}/>); fireEvent.click(screen.getByRole("button"));
  await screen.findByText("Not calculated: the before count is zero."); expect(screen.queryByText(/Infinity/)).toBeNull();
});

it("explains unavailable evidence without displaying withheld counts", async () => {
  const r = {...reading(), state: "withheld", reasons: ["DATES_NOT_RETURNED"], before: null, after: null, difference: null, relative_change_percent: null};
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(r)));
  render(<Ga4SessionReading job={readingJob()}/>); fireEvent.click(screen.getByRole("button"));
  await screen.findByText(/Missing rows are not treated as zero/); expect(screen.queryByText("Count difference")).toBeNull();
});

it("read retry does not submit collection or save requests", async () => {
  const fetch = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(Response.json(reading())); vi.stubGlobal("fetch", fetch);
  render(<Ga4SessionReading job={readingJob()}/>); fireEvent.click(screen.getByRole("button"));
  fireEvent.click(await screen.findByRole("button", {name: "Retry reading saved counts"}));
  await screen.findByText("+25.00%"); expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls.every(([url, opts]) => url.includes("ga4-session-readings") && !opts.method)).toBe(true);
});

it("aborts old reads and removes results on source change", async () => {
  let finish!: (r: Response) => void;
  const fetch = vi.fn((_url, _init) => new Promise<Response>(resolve => {finish = resolve;})); vi.stubGlobal("fetch", fetch);
  const old = readingJob(), {rerender} = render(<Ga4SessionReading job={old}/>);
  fireEvent.click(screen.getByRole("button")); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
  rerender(<Ga4SessionReading job={{...old, id: "d0000000-0000-4000-8000-000000000099"}}/>);
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true); finish(Response.json(reading()));
  expect(screen.getByRole("button", {name: "View saved session counts"})).toBeTruthy();
  expect(screen.queryByText("+25.00%")).toBeNull();
});

it("rejects another observation's result", async () => {
  const r = {...reading(), observation_checksum: `sha256:${"0".repeat(64)}`};
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(r)));
  render(<Ga4SessionReading job={readingJob()}/>); fireEvent.click(screen.getByRole("button"));
  await screen.findByRole("button", {name: "Retry reading saved counts"}); expect(screen.queryByText("+25.00%")).toBeNull();
});
