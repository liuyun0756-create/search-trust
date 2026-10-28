import { describe, expect, it } from "vitest";
import sample from "./contracts/fixtures/first_service-1.json";
import { initialCapabilityRevision } from "./revision";
import { validateCapabilityReport, validateDeliveryRevision } from "./validate";
import { projectCapabilityReport } from "./projection";

function report() {
  const checked = validateCapabilityReport(structuredClone(sample));
  if (!checked.ok) throw new Error("Invalid fixture");
  return checked.report;
}

describe("Execution materials and controlled revisions", () => {
  it("supports unchanged approval, prose edits, and deep-copy isolation", () => {
    const r = report(), before = JSON.stringify(r), draft = initialCapabilityRevision(r);
    const m = draft.actions[0]!.materials[0]!;
    m.title = "SEO reviewed instructions";
    m.body = "Confirm the contact route and use the approved contact label.";
    draft.summary = "This summary is adapted by the SEO.";
    draft.client_note = "SEO supplied business information, separate from collected facts.";
    draft.status = "approved";
    expect(validateDeliveryRevision(draft, r)).toBe(true);
    const projection = projectCapabilityReport(r, draft);
    expect(projection.actions[0].materials[0]).toMatchObject({ body: m.body, readiness: "requires_confirmation" });
    projection.actions[0].materials[0].evidence_ids.pop();
    projection.actions[0].materials[0].confirmation_items.pop();
    expect(m.evidence_ids).not.toHaveLength(0);
    expect(m.confirmation_items).not.toHaveLength(0);
    expect(JSON.stringify(r)).toBe(before);
  });
  it.each(["evidence_ids", "readiness", "confirmation_items", "target", "id", "delete", "duplicate"])("rejects a material %s change", (field) => {
    const r = report(), draft = initialCapabilityRevision(r), material = draft.actions[0]!.materials[0]!;
    if (field === "delete") draft.actions[0]!.materials = [];
    else if (field === "duplicate") draft.actions[0]!.materials = [material, structuredClone(material)];
    else Object.assign(material, { [field]: field === "evidence_ids" ? ["invented"] : field === "confirmation_items" ? [] : field === "readiness" ? "ready_to_use" : "invented" });
    expect(validateDeliveryRevision(draft, r)).toBe(false);
  });
  it("does not reinterpret a draft as approved or accept invalid revision numbers", () => {
    const r = report(), draft = initialCapabilityRevision(r);
    expect(() => projectCapabilityReport(r, draft)).toThrow("Approved revision required");
    expect(() => initialCapabilityRevision(r, -1)).toThrow();
    expect(() => initialCapabilityRevision(r, 1.5)).toThrow();
  });
});
