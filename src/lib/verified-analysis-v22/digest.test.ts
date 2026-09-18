import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import prospect from "../report-v22/contracts/fixtures/prospect.json";
import { validateReportV22 } from "../report-v22/validate";
import { canonicalDigest } from "./digest";

describe("Verified canonical digest", () => {
  it("matches the backend jobs_v22 request_digest mapping-order fixture", () => {
    // SearchTrust-RD/tests/test_v22_job_digest.py; evaluated with request_digest.
    const value = { case_id: "11111111-1111-4111-8111-111111111111", limits: { b: 2, a: 1 } };
    expect(canonicalDigest(value)).toBe("sha256:806c1c9e6745c026be872efc9218adc3f902b6c01df5262a0ce4f1541b02d709");
    expect(canonicalDigest({ limits: { a: 1, b: 2 }, case_id: value.case_id })).toBe(canonicalDigest(value));
  });

  it("sorts numeric-looking keys lexicographically and preserves array order", () => {
    expect(canonicalDigest({ "2": "b", "10": "a" })).toBe(canonicalDigest(JSON.parse('{"10":"a","2":"b"}')));
    expect(canonicalDigest(["one", "two"])).not.toBe(canonicalDigest(["two", "one"]));
    expect(canonicalDigest({ nested: [null, true, "中文", 1.25] })).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("matches backend request_digest for the complete Prospect ReportV22 fixture", () => {
    // Computed by app.jobs_v22.digest.verified_request_digest(json.load(prospect.json)).
    expect(canonicalDigest(prospect)).toBe("sha256:0a093496b57a559ebed6660245eec41bac828cae11fc0c45473447ee668bde7a");
  });

  it.each([
    [1.0, "1"], [-0, "0"], [1e-6, "0.000001"], [1e-7, "1e-7"],
    [1e20, "100000000000000000000"], [1e21, "1e+21"],
    [333333333.33333329, "333333333.3333333"], [0.1 + 0.2, "0.30000000000000004"],
    [1000000000000000128, "1000000000000000100"],
    [Number.MIN_VALUE, "5e-324"], [Number.MAX_VALUE, "1.7976931348623157e+308"],
  ] as const)("uses ECMAScript numeric bytes for %s", (value, expectedBytes) => {
    expect(canonicalDigest(value)).toBe(`sha256:${createHash("sha256").update(expectedBytes).digest("hex")}`);
  });

  it("matches the Verified backend digest for a modified schema-valid Prospect with numeric boundaries", () => {
    const report = structuredClone(prospect);
    Object.assign(report.case_context.target_market, { latitude: 1.0, longitude: -0 });
    Object.assign(report.market_snapshot.target_market, { latitude: 1.0, longitude: -0 });
    Object.assign(report.identity.business.primary_location, { latitude: 1e-6, longitude: -0 });
    expect(validateReportV22(report).ok).toBe(true);
    expect(canonicalDigest(report)).toBe("sha256:5af54f0bb6d3391f48790d0066edf968951657b44bc85f90f43379d38f059f06");
  });

  it.each([undefined, NaN, Infinity, -Infinity, BigInt(1), { bad: undefined }, [undefined], new Date(), new Map(), Array(1)])("rejects values outside deterministic JSON: %s", (value) => {
    expect(() => canonicalDigest(value)).toThrow();
  });

  it.each([
    ["symbol-keyed object", () => ({ [Symbol("bad")]: undefined })],
    ["nested symbol-keyed object", () => ({ nested: { [Symbol("bad")]: 1 } })],
    ["non-enumerable property", () => Object.defineProperty({}, "bad", { value: undefined })],
    ["accessor property", () => Object.defineProperty({}, "bad", { get: () => 1, enumerable: true })],
    ["symbol-keyed array", () => Object.assign([], { [Symbol("bad")]: undefined })],
    ["extra array property", () => Object.assign([1], { bad: undefined })],
    ["non-enumerable array property", () => Object.defineProperty([1], "bad", { value: 1 })],
    ["non-enumerable array index", () => Object.defineProperty([1], "0", { value: 1, enumerable: false })],
    ["accessor array index", () => Object.defineProperty([1], "0", { get: () => 1, enumerable: true })],
    ["inherited sparse array index", () => Object.setPrototypeOf(Array(1), Object.assign(Object.create(Array.prototype), { 0: 1 }))],
    ["custom object prototype", () => Object.create({ bad: 1 })],
    ["Set", () => new Set([1])],
    ["class instance", () => new (class Value { a = 1; })()],
    ["array subclass", () => new (class Values extends Array {})()],
    ["function value", () => ({ bad: () => 1 })],
    ["symbol value", () => ({ bad: Symbol("bad") })],
    ["nested nonfinite number", () => ({ bad: NaN })],
  ] as const)("rejects %s instead of silently hashing it as plain JSON", (_label, makeValue) => {
    expect(() => canonicalDigest(makeValue())).toThrow(TypeError);
  });

  it("rejects object and array cycles with a deterministic boundary error", () => {
    const object: Record<string, unknown> = {};
    object.self = object;
    const array: unknown[] = [];
    array.push(array);
    for (const value of [object, array]) expect(() => canonicalDigest(value)).toThrow(TypeError);
  });

  it("accepts shared noncyclic values and plain null-prototype objects", () => {
    const shared = { a: 1 };
    expect(canonicalDigest([shared, shared])).toBe(canonicalDigest([{ a: 1 }, { a: 1 }]));
    expect(canonicalDigest(Object.assign(Object.create(null), { a: 1 }))).toBe(canonicalDigest({ a: 1 }));
  });
});
