import {readFileSync} from "node:fs";
import {describe, expect, it} from "vitest";
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import {canonicalDigest} from "../verified-analysis-v22/digest";
import {planImplementationWindow, type ComparisonLength} from "./comparison-window";
import type {ImplementationEntry} from "./contracts";
const load = (file: string) => JSON.parse(readFileSync(new URL(`./comparison-contracts/${file}`, import.meta.url), "utf8"));
const windows = load("windows.json") as {entry: ImplementationEntry; windows: {days: ComparisonLength; timezone: string; before: {start: string; end: string}; excluded: {start: string; end: string}; after: {start: string; end: string}}}[];
describe("calendar-only preview and actual backend descriptive contracts", () => {
  it.each(windows)("matches the Python window at $entry.implemented_on in $entry.timezone / $windows.days days", vector => {
    const result = planImplementationWindow(vector.entry, vector.windows.days, new Date("2026-12-31T12:00:00Z"));
    expect(result).toMatchObject(vector.windows); expect(result?.data_state).toBe("not_checked");
  });
  it("does not treat an unelapsed local date as a completed after window", () => {
    const entry = {...windows[0].entry, implemented_on: "2026-10-01", timezone: "America/Los_Angeles"};
    expect(planImplementationWindow(entry, 7, new Date("2026-10-09T01:00:00Z"))?.calendar_state).toBe("waiting");
    expect(planImplementationWindow(entry, 7, new Date("2026-10-09T08:00:00Z"))?.calendar_state).toBe("elapsed");
  });
  it.each([{implemented_on: "2026-02-30"}, {timezone: "not/a/zone"}, {implemented_on: "2011-12-30", timezone: "Pacific/Apia"}])("rejects unsafe preview %j", change => {
    expect(planImplementationWindow({...windows[0].entry, ...change})).toBeNull();
  });
  it("keeps strict exported request/result shapes and canonical evidence bindings", () => {
    const ajv = new Ajv2020({strict: false, allErrors: true}); addFormats(ajv);
    const validate = ajv.compile(load("comparison.schema.json"));
    const fixtures = load("fixtures.json"); expect(fixtures).toHaveLength(10);
    for (const fixture of fixtures) {
      expect(validate({request: fixture.request, result: fixture.result}), JSON.stringify(validate.errors)).toBe(true);
      const {checksum, ...content} = fixture.result;
      expect(canonicalDigest(content)).toBe(checksum);
      expect(fixture.result.input_checksum).toBe(canonicalDigest(fixture.request));
      expect(fixture.result.effect_conclusion).toBeNull(); expect(fixture.result.causal_attribution).toBe(false);
      if (fixture.result.state !== "comparable") expect(fixture.result.metrics).toEqual([]);
    }
    const positive = fixtures.find((fixture: {name: string}) => fixture.name === "positive");
    expect(positive.result.metrics[0]).toMatchObject({before: 280, after: 336, absolute_change: 56, relative_change: .2});
    const zero = fixtures.find((fixture: {name: string}) => fixture.name === "zero_baseline");
    expect(zero.result.metrics[0]).toMatchObject({before: 0, relative_change: null});
    expect(validate({request: positive.request, result: {...positive.result, causal_attribution: true}})).toBe(false);
  });
});
