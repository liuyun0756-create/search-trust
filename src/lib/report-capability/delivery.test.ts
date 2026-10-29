import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import manifest from "./fixtures/generated/manifest.json";
import { buildApprovedCapabilityDelivery } from "./delivery";
import { CapabilityReportDocument } from "@/components/report/CapabilityReportDocument";
import { generatedDelivery } from "./fixtures/generated-delivery";

describe("Actual generated report delivery", () => {
  it.each(Object.entries(manifest.files))("validates backend-generated %s and preserves the exported bytes", (name, checksum) => {
    const bytes = readFileSync(new URL(`./fixtures/generated/${name}`, import.meta.url));
    expect(`sha256:${createHash("sha256").update(bytes).digest("hex")}`).toBe(checksum);
    const { delivery, report } = generatedDelivery(name);
    const html = renderToStaticMarkup(createElement(CapabilityReportDocument, { document: delivery.document }));
    expect(html).toContain(report.title);
    expect(delivery.document.actions).toHaveLength(report.actions.length);
    expect(html.includes("No action proposed yet")).toBe(report.actions.length === 0);
    if (name === "service-first.json") { expect(html).toContain("750"); expect(html).toContain("2026-08-29"); }
  });
  it("shows the saved title, H1 and a conditional draft without presenting it as completed work", () => {
    const { delivery, report } = generatedDelivery("public-title-review.json");
    expect(report.input_manifest.ruleset_version).toBe("v22_capability_public_v5");
    expect(report.prioritization?.rules_version).toBe("v22_business_priority_v2");
    const action = delivery.document.actions.find(a => a.title === "Review the service-page title")!;
    expect(action.target).toBe("https://example.test/plumbing-repair");
    expect(action.materials[0].readiness).toBe("requires_confirmation");
    const html = renderToStaticMarkup(createElement(CapabilityReportDocument, { document: delivery.document }));
    expect(html).toContain("Current title: We tackle your plumbing problems");
    expect(html).toContain("Current H1: Plumbing repairs and upgrades");
    expect(html).toContain("Draft for SEO approval: Plumbing repair | Fixture Plumbing LLC");
    expect(html).toContain("Keep the current title");
    expect(report.summary).not.toContain("No action is proposed");
  });
  it("pins a delivery independently of a later draft and exposes exactly the approved narrative and materials", () => {
    const { report, saved } = generatedDelivery("service-first.json");
    saved.content.summary = "SEO-approved client summary.";
    saved.content.actions[0]!.materials[0]!.body = "SEO-approved execution wording.";
    const pinned = buildApprovedCapabilityDelivery(report, saved);
    const later = structuredClone(saved);
    later.revision = 2; later.content.expected_revision = 1; later.status = later.content.status = "draft";
    later.approved_at = null; later.content.summary = "Unapproved replacement.";
    expect(() => buildApprovedCapabilityDelivery(report, later)).toThrow("Approved persisted report revision required");
    expect(pinned.document.summary).toBe("SEO-approved client summary.");
    expect(pinned.document.actions[0].materials[0].body).toBe("SEO-approved execution wording.");
    expect(pinned.revisionId).toBe(saved.id);
    expect(pinned.document.evidence).toEqual(report.evidence);
  });
  it.each(["source", "user", "case", "revision", "approval", "id"])("rejects invalid persisted revision %s", (kind) => {
    const { report, saved } = generatedDelivery("service-first.json");
    if (kind === "source") saved.content.source_checksum = `sha256:${"0".repeat(64)}`;
    if (kind === "user") saved.user_id = "another-user";
    if (kind === "case") saved.case_id = "another-case";
    if (kind === "revision") saved.revision = 10;
    if (kind === "approval") saved.approved_at = null;
    if (kind === "id") saved.id = "arbitrary";
    expect(() => buildApprovedCapabilityDelivery(report, saved)).toThrow();
  });
});
