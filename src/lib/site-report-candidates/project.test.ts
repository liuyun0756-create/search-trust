import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { projectSiteCandidate } from "./project";
import prospect from "../report-capability/fixtures/generated/public-1.json";
import service from "../report-capability/fixtures/generated/service-first.json";
import zero from "../report-capability/fixtures/generated/public-0.json";
import candidates from "./generated/reports.json";

describe("Controlled site candidate projection", () => {
  it.each([prospect, service, zero])("preserves observations, numbers, limits and actionable material", raw => {
    const doc = projectSiteCandidate(raw);
    expect(doc.title).toBe(raw.title);
    expect(doc.summary).toBe(raw.summary);
    expect(doc.limitations).toEqual(raw.limitations);
    expect(doc.evidence.map(e => [e.value, e.unit, e.object, e.observed_at])).toEqual(raw.evidence.map(e => [e.value, e.unit, e.object, e.observed_at]));
    expect(doc.findings.map(f => [f.observed_fact, f.judgment, f.limitations])).toEqual(raw.findings.map(f => [f.observed_fact, f.judgment, f.limitations]));
    expect(doc.actions.map(a => [a.title, a.steps, a.completion, a.materials.map(m => [m.body, m.readiness, m.confirmation_items])])).toEqual(raw.actions.map(a => [a.title, a.steps, a.completion, a.materials.map(m => [m.body, m.readiness, m.confirmation_items])]));
    for (let i = 0; i < raw.findings.length; i++) {
      expect(doc.findings[i].evidence_ids.map(id => doc.evidence.find(e => e.id === id)?.value))
        .toEqual(raw.findings[i].evidence_ids.map(id => raw.evidence.find(e => e.id === id)?.value));
    }
  });
  it("retains no owner, case, snapshot, job, source payload or original identity metadata", () => {
    const json = JSON.stringify(projectSiteCandidate(service));
    for (const key of ["user_id", "case_id", "snapshot_id", "job_id", "input_manifest", "payload_checksum", "binding_id", "source_checksum"]) {
      expect(json).not.toContain(`"${key}"`);
    }
    for (const id of [service.id, service.input_manifest.user_id, service.input_manifest.case_id, ...service.evidence.map(e => e.id)]) expect(json).not.toContain(id);
  });
  it("refuses malformed reports instead of manufacturing a marketing fallback", () => {
    expect(() => projectSiteCandidate({ title: "Great results" })).toThrow("Invalid candidate report");
    const bad = structuredClone(prospect); bad.findings[0].evidence_ids = ["missing"];
    expect(() => projectSiteCandidate(bad)).toThrow();
  });
  it("publishes a complete zero-action diagnosis without filler or refund wording", () => {
    const item = candidates.reports.find(r => r.id === "diagnosis")!;
    expect(item.document.actions).toHaveLength(0);
    expect(item.document.findings.length).toBeGreaterThan(0);
    expect(item.document.limitations.length).toBeGreaterThan(0);
    expect(item.context).toContain("1 credit; it is not refunded");
  });
  it("does not replace the public sample page or relax its current entry restriction", () => {
    const page = readFileSync("src/app/sample-report/page.tsx", "utf8");
    expect(page).toContain("<SampleReportsV22");
    expect(page).not.toContain("ReleaseReportPreview");
    expect(readFileSync("src/components/sampleReport/SampleReportsV22.tsx", "utf8")).toContain("Direct service-only setup is not available yet.");
  });
});
