import { describe, expect, it } from "vitest";
import prospect from "../report-v22/contracts/fixtures/prospect.json";
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
    // Computed by app.jobs_v22.digest.request_digest(json.load(prospect.json)).
    expect(canonicalDigest(prospect)).toBe("sha256:5c437ac449da35e7ae9b060a3b0c8a54c7b9aa472dd77cc923b2f95388183f60");
  });

  it.each([undefined, NaN, Infinity, -Infinity, BigInt(1), { bad: undefined }, [undefined], new Date(), new Map(), Array(1)])("rejects values outside deterministic JSON: %s", (value) => {
    expect(() => canonicalDigest(value)).toThrow();
  });
});
