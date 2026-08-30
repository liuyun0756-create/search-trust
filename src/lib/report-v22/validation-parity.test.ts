import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import prospect from "./contracts/fixtures/prospect.json";
import verified from "./contracts/fixtures/verified.json";
import document from "./test-fixtures/validation/cases.json";
import manifest from "./test-fixtures/validation/manifest.json";
import { applyOperations, loadValidationCases } from "./test-support/validation-cases";
import { validateReportV22 } from "./validate";

const fixtures: Record<string, unknown> = { prospect, verified };
const cases = loadValidationCases(document, fixtures);

describe("shared v2.2 validation corpus", () => {
  it.each(cases)("$id", (testCase) => {
    const baseBefore = structuredClone(fixtures[testCase.fixture]);
    const input = applyOperations(fixtures[testCase.fixture], testCase.operations);
    const before = JSON.stringify(input);
    const result = validateReportV22(input);
    expect(result.ok).toBe(testCase.accepted);
    if (!result.ok) expect(result.errors).toEqual(expect.arrayContaining([expect.objectContaining(testCase.error!)]));
    else expect(result.report).toBe(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(fixtures[testCase.fixture]).toEqual(baseBefore);
  });

  it("checks every resource and base fixture against the auxiliary manifest", () => {
    const paths: Record<string, string> = {
      "cases.json": "./test-fixtures/validation/cases.json",
      "normalization-data.json": "./generated/normalization-data.json",
    };
    expect(Object.keys(manifest.files).sort()).toEqual(Object.keys(paths).sort());
    expect(Object.keys(manifest.fixtures).sort()).toEqual(["prospect", "verified"]);
    for (const [name, expected] of Object.entries(manifest.files)) {
      const payload = readFileSync(new URL(paths[name], import.meta.url));
      expect(`sha256:${createHash("sha256").update(payload).digest("hex")}`).toBe(expected);
    }
    for (const [name, expected] of Object.entries(manifest.fixtures)) {
      const payload = readFileSync(new URL(`./contracts/fixtures/${name}.json`, import.meta.url));
      expect(`sha256:${createHash("sha256").update(payload).digest("hex")}`).toBe(expected);
    }
  });

  it("does not echo query text in the new validation errors", () => {
    const queries = ["private-customer-query", "PRIVATE-CUSTOMER-QUERY", "third-query"];
    const input = applyOperations(prospect, [
      { op: "set", path: ["case_context", "queries"], value: queries },
      { op: "set", path: ["market_snapshot", "queries"], value: queries },
    ]);
    const result = validateReportV22(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].path).toBe("/case_context/queries");
      expect(JSON.stringify(result.errors).toLowerCase()).not.toContain("private-customer-query");
    }
  });
});

describe("strict shared corpus loader", () => {
  it.each([
    { op: "eval", path: ["x"] },
    { op: [], path: ["x"] },
    { op: "remove", path: ["missing"] },
    { op: "set", path: ["missing", "x"], value: 1 },
    { op: "set", path: [], value: 1 },
    { op: "set", path: ["items", -1], value: 1 },
    { op: "set", path: ["items", 1], value: 1 },
    { op: "set", path: ["items", "0"], value: 1 },
    { op: "set", path: ["items", true], value: 1 },
    { op: "set", path: ["__proto__"], value: 1 },
    { op: "set", path: ["x"], value: 1, extra: true },
    { op: "reorder_keys", path: ["object"], keys: ["a", "a"] },
    { op: "reorder_keys", path: ["object"], keys: ["a"] },
    { op: "reorder_keys", path: ["items"], keys: ["0"] },
  ])("rejects malformed operation %#", (operation) => {
    expect(() => applyOperations({ items: [1], object: { a: 1, b: 2 } }, [operation])).toThrow("Invalid v2.2 validation case");
  });

  it.each(["duplicate", "unknown_fixture", "empty", "bad_result", "bad_error", "unknown_field"])("rejects malformed corpus %s", (kind) => {
    const bad = structuredClone(document) as { version: number; cases: Array<Record<string, unknown>> };
    if (kind === "duplicate") bad.cases.push(bad.cases[0]);
    else if (kind === "unknown_fixture") bad.cases[0].fixture = "missing";
    else if (kind === "empty") bad.cases = [];
    else if (kind === "bad_result") bad.cases[0].accepted = "true";
    else if (kind === "bad_error") bad.cases[2].error = { code: "unknown", path: "/" };
    else bad.cases[0].extra = true;
    expect(() => loadValidationCases(bad, fixtures)).toThrow("Invalid v2.2 validation case");
  });

  it("clones assigned values, removes array items and preserves reordered object keys", () => {
    const value = { nested: [] };
    const result = applyOperations({ items: [1, 2], object: { a: 1, b: 2 } }, [
      { op: "set", path: ["new"], value },
      { op: "remove", path: ["items", 0] },
      { op: "reorder_keys", path: ["object"], keys: ["b", "a"] },
    ]) as { new: { nested: boolean[] }; items: number[]; object: Record<string, unknown> };
    result.new.nested.push(true);
    expect(value).toEqual({ nested: [] });
    expect(result.items).toEqual([2]);
    expect(Object.keys(result.object)).toEqual(["b", "a"]);
  });
});
