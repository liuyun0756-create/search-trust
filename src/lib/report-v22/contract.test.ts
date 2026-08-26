import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import manifest from "./contracts/manifest.json";
import prospectFixture from "./contracts/fixtures/prospect.json";
import verifiedFixture from "./contracts/fixtures/verified.json";
import { validateReportV22 } from "./validate";


function clone(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function setAtPath(root: unknown, path: Array<string | number>, value: unknown): void {
  let cursor: unknown = root;
  for (const part of path.slice(0, -1)) {
    if (typeof part === "number") {
      if (!Array.isArray(cursor)) throw new Error("Expected array while mutating fixture");
      cursor = cursor[part];
    } else {
      if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) throw new Error("Expected object while mutating fixture");
      cursor = (cursor as Record<string, unknown>)[part];
    }
  }
  const last = path.at(-1);
  if (typeof last === "number") {
    if (!Array.isArray(cursor)) throw new Error("Expected array at fixture mutation target");
    cursor[last] = value;
  } else if (typeof last === "string") {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) throw new Error("Expected object at fixture mutation target");
    (cursor as Record<string, unknown>)[last] = value;
  }
}

function deleteAtPath(root: unknown, path: string[]): void {
  let cursor: unknown = root;
  for (const part of path.slice(0, -1)) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) throw new Error("Expected object while deleting fixture field");
    cursor = (cursor as Record<string, unknown>)[part];
  }
  if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) throw new Error("Expected object at fixture delete target");
  delete (cursor as Record<string, unknown>)[path.at(-1) ?? ""];
}

function expectInvalid(value: unknown, code: string, message: string): void {
  const result = validateReportV22(value);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors.some((error) => error.code === code && error.message.includes(message))).toBe(true);
  }
}

describe("report_v2_2 shared fixtures", () => {
  it.each([
    ["prospect", prospectFixture],
    ["verified", verifiedFixture],
  ])("accepts the %s fixture", (_name, fixture) => {
    const result = validateReportV22(fixture);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.report.report_version.schema_version).toBe("2.2.0");
  });

  it("rejects an unknown field", () => {
    const fixture = clone(prospectFixture);
    setAtPath(fixture, ["unexpected"], true);
    expectInvalid(fixture, "REPORT_CONTRACT_INVALID", "additional properties");
  });

  it("rejects a missing root field", () => {
    const fixture = clone(prospectFixture);
    deleteAtPath(fixture, ["executive_decision"]);
    expectInvalid(fixture, "REPORT_CONTRACT_INVALID", "required property");
  });

  it("rejects an invalid report type", () => {
    const fixture = clone(prospectFixture);
    setAtPath(fixture, ["report_version", "report_type"], "preview");
    expectInvalid(fixture, "REPORT_CONTRACT_INVALID", "equal to one of the allowed values");
  });

  it("rejects duplicate evidence IDs", () => {
    const fixture = clone(prospectFixture);
    const record = fixture as { evidence_index: unknown[] };
    record.evidence_index.push(clone(record.evidence_index[0]));
    expectInvalid(fixture, "REPORT_REFERENCE_INVALID", "Duplicate IDs");
  });

  it("rejects dangling evidence references", () => {
    const fixture = clone(prospectFixture);
    setAtPath(fixture, ["findings", 0, "evidence_ids"], ["ev_missing_reference"]);
    expectInvalid(fixture, "REPORT_REFERENCE_INVALID", "Unknown evidence references");
  });

  it("rejects dangling finding references", () => {
    const fixture = clone(prospectFixture);
    setAtPath(fixture, ["top_actions", 0, "finding_ids"], ["fn_missing_reference"]);
    expectInvalid(fixture, "REPORT_REFERENCE_INVALID", "Unknown finding references");
  });

  it("rejects incorrectly ordered actions", () => {
    const fixture = clone(prospectFixture);
    setAtPath(fixture, ["top_actions", 1, "sequence"], 3);
    expectInvalid(fixture, "REPORT_REFERENCE_INVALID", "sequences 1, 2, 3");
  });

  it("rejects first-party data in a prospect report", () => {
    const fixture = clone(prospectFixture);
    setAtPath(fixture, ["first_party_performance", "gsc", "connection_state"], "verified");
    setAtPath(fixture, ["first_party_performance", "gsc", "snapshot_id"], "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    expectInvalid(fixture, "REPORT_REFERENCE_INVALID", "must not contain first-party snapshots");
  });

  it("rejects contradictory full evidence coverage", () => {
    const fixture = clone(verifiedFixture);
    setAtPath(fixture, ["first_party_performance", "gbp", "health_status"], "unhealthy");
    expectInvalid(fixture, "REPORT_REFERENCE_INVALID", "Full evidence coverage requires healthy");
  });
});

describe("v2.2 contract manifest", () => {
  it("matches every committed contract file", () => {
    const contractRoot = fileURLToPath(new URL("./contracts/", import.meta.url));
    for (const [relativePath, expectedHash] of Object.entries(manifest.files)) {
      const payload = readFileSync(`${contractRoot}${relativePath}`);
      const actualHash = `sha256:${createHash("sha256").update(payload).digest("hex")}`;
      expect(actualHash).toBe(expectedHash);
    }
  });
});
