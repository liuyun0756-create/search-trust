import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateCapabilityReport, validateDeliveryRevision } from "./validate";
import { projectCapabilityReport } from "./projection";
import { initialCapabilityRevision } from "./revision";
import { replayPriority } from "./priority";
import { canonicalDigest } from "../verified-analysis-v22/digest";
import historical from "./contracts/fixtures/acquisition-0.json";

const directory = path.join(process.cwd(), "src/lib/report-capability/fixtures/generated");
function report(name = "service-first.json") {
  const value = JSON.parse(readFileSync(path.join(directory, name), "utf8"));
  const checked = validateCapabilityReport(value);
  if (!checked.ok) throw new Error(`Invalid generated report: ${name}`);
  return checked.report;
}

describe("P4 frozen priority trace", () => {
  it("preserves absence on historical reports and rejects explicit null that would alter Python checksums", () => {
    expect(validateCapabilityReport(historical).ok).toBe(true);
    expect(validateCapabilityReport({...historical, prioritization:null}).ok).toBe(false);
  });
  it.each(readdirSync(directory).filter(name => name.endsWith(".json") && name !== "manifest.json"))("replays the exact Python rule decisions for %s", name => {
    const r = report(name), trace = r.prioritization!;
    expect(trace).toBeTruthy();
    expect(replayPriority(trace.candidates.map(e => e.input), r.findings, r.input_manifest.business, r.input_manifest.input_checksum,trace.rules_version)).toEqual(trace);
    expect(trace.action_order).toEqual(r.actions.map(a => a.id));
    expect(trace.limitations.join(" ")).toContain("not a revenue forecast");
    expect(r.actions.length).toBeLessThanOrEqual(3);
  });
  it("distinguishes confirmed page focus, non-match and unknown prose without guessing a revenue score", () => {
    const focused = report("service-target-focus.json"), other = report("service-other-focus.json"), unknown = report("service-unstructured-focus.json");
    expect(focused.actions[0]!.target).toBe("https://example.test/service");
    expect(focused.prioritization!.candidates.some(e => e.business_match === "confirmed_target")).toBe(true);
    expect(other.prioritization!.candidates.every(e => e.business_match === "not_matched")).toBe(true);
    expect(unknown.prioritization!.candidates.every(e => e.business_match === "unknown")).toBe(true);
    expect(unknown.prioritization!.business_priority).toBe("Increase revenue");
  });
  it.each(["missing", "rules", "explanation", "focus", "order", "input", "source", "cycle"])("rejects a %s mismatch instead of displaying a misleading reason", mutation => {
    const r = structuredClone(report("public-3.json")), trace = r.prioritization!;
    if (mutation === "missing") delete r.prioritization;
    if (mutation === "rules") Object.assign(trace, { rules_version:"made-up" });
    if (mutation === "explanation") trace.candidates[0].explanation = "Guaranteed revenue improvement.";
    if (mutation === "focus") trace.target_pages = ["https://example.test/invented"];
    if (mutation === "order") trace.action_order.reverse();
    if (mutation === "input") trace.candidates[0].input.finding_ids = ["unknown"];
    if (mutation === "source") r.actions[0]!.target = "https://example.test/invented";
    if (mutation === "cycle") trace.candidates[0].input.dependencies = [trace.candidates[0].input.action_id];
    expect(validateCapabilityReport(r).ok).toBe(false);
  });
  it("keeps system order and rationale separate from an SEO-edited approved delivery", () => {
    const r = report(), before = canonicalDigest(r), revision = initialCapabilityRevision(r);
    revision.actions.reverse(); revision.actions[0]!.title = "SEO-adjusted work";
    revision.actions[0]!.target = "https://example.test/seo-target";
    revision.status = "approved";
    expect(validateDeliveryRevision(revision, r)).toBe(true);
    const d = projectCapabilityReport(r, revision);
    expect(d.actions[0].id).toBe(revision.actions[0]!.id);
    expect(d.actions[0].whyNow).toMatchObject({ deliveryChanged:true, systemPosition:3 });
    expect(d.actions[0].whyNow?.systemTarget).not.toBe(revision.actions[0]!.target);
    expect(canonicalDigest(r)).toBe(before);
    d.actions[0].whyNow!.impactPaths.push("Do not mutate source");
    expect(canonicalDigest(r)).toBe(before);
  });
  it("does not apply a prior approved plan to a newly arrived report or replace its trace", () => {
    const a = report(), b = report("service-target-focus.json"), revision = initialCapabilityRevision(a);
    revision.status = "approved";
    expect(a.input_manifest.input_checksum).not.toBe(b.input_manifest.input_checksum);
    expect(validateDeliveryRevision(revision, b)).toBe(false);
    expect(() => projectCapabilityReport(b, revision)).toThrow("Approved revision required");
  });
});
