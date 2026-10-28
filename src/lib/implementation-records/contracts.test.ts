import {describe, expect, it} from "vitest";
import fixture from "./contracts/fixture.json";
import {canonicalDigest} from "../verified-analysis-v22/digest";
import {localDate, parseEntries, parseImplementationRecord, parseImplementationView, type ImplementationSource} from "./contracts";
const source = fixture.source as ImplementationSource;
const at = new Date("2026-10-22T08:00:00Z");
const entry = fixture.history[0].entries[0];
describe("P5 closed, pinned implementation DTOs", () => {
  it("reads the Python-generated record and exact canonical checksum", () => {
    const record = parseImplementationRecord(fixture.history[0], source)!;
    expect(record).not.toBeNull();
    const {checksum, ...content} = record;
    expect(canonicalDigest(content)).toBe(checksum);
    expect(parseImplementationView({source, history: [record]}, source.caseId, source.reportId, source.deliveryRevisionId)).not.toBeNull();
  });
  it.each([
    {implemented_on: "2026-02-30"}, {implemented_on: "2026-99-99"}, {implemented_on: "2026-10-23"},
    {implemented_on: "2026-2-01"}, {implemented_on: "0000-01-01"}, {timezone: "not/a/zone"}, {timezone: "PST"},
    {scope: " "}, {scope: "x".repeat(2001)}, {scope: "x\u0000y"}, {responsible: ""}, {note: false},
    {action_id: "not-an-approved-action"}, {observed: true},
  ])("rejects invalid entry %j without a crash", change => {
    expect(parseEntries([{...entry, ...change}], source, at)).toBeNull();
  });
  it("uses implementation-local dates across UTC boundaries, not browser dates", () => {
    const instant = new Date("2026-10-22T00:30:00Z");
    expect(localDate(instant, "America/Los_Angeles")).toBe("2026-10-21");
    expect(parseEntries([{...entry, implemented_on: "2026-10-22", timezone: "America/Los_Angeles"}], source, instant)).toBeNull();
    expect(parseEntries([{...entry, implemented_on: "2026-10-22", timezone: "Asia/Shanghai"}], source, instant)).toHaveLength(1);
  });
  it("allows optional notes to be absent as null and clearing a mistaken mark", () => {
    expect(parseEntries([{...entry, note: null, responsible: null}], source, at)).toHaveLength(1);
    expect(parseEntries([], source, at)).toEqual([]);
    expect(parseEntries([entry, entry], source, at)).toBeNull();
  });
  it.each(["userId", "caseId", "reportId", "deliveryRevisionId", "reportChecksum", "deliveryRevision"] as const)("rejects a record rebound through %s", key => {
    const changed = {...source, [key]: key === "deliveryRevision" ? 2 : key === "reportChecksum" ? `sha256:${"0".repeat(64)}` : "00000000-0000-4000-8000-000000000000"};
    expect(parseImplementationRecord(fixture.history[0], changed)).toBeNull();
  });
  it("does not accept a mixed history or a non-decreasing revision chain", () => {
    const record = fixture.history[0];
    expect(parseImplementationView({source, history: [record, record]}, source.caseId, source.reportId, source.deliveryRevisionId)).toBeNull();
    expect(parseImplementationRecord({...record, page_verified: true}, source)).toBeNull();
    expect(parseImplementationRecord({...record, recorded_at: "2026-02-30T00:00:00Z", entries: []}, source)).toBeNull();
    expect(parseImplementationRecord({...record, recorded_at: "0000-01-01T00:00:00Z", entries: []}, source)).toBeNull();
  });
});
