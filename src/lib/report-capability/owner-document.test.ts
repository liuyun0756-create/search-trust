import { describe, expect, it, vi } from "vitest";
import { generatedDelivery } from "./fixtures/generated-delivery";
import { loadCapabilityOwnerDocument } from "./owner-document";
import v12 from "./fixtures/candidates/five.json";
import identity from "../identity-review/fixtures/synthetic.json";
import v20 from "./fixtures/action-advice-v20/sql-report.json";
import v21 from "./fixtures/identity-inheritance-v21/report.json";
import v22 from "./fixtures/customer-reviews-v22/report.json";
import v22Input from "./fixtures/customer-reviews-v22/bound.json";
import { validateCapabilityReport, validateSavedIdentity } from "./validate";
describe("owner report page data gate",()=>{
  it.each([
    ["v5 prospect", generatedDelivery("public-0.json").report, false],
    ["v12 prospect", v12, false],
    ["v13 prospect", identity.base, true],
    ["v20 prospect", v20, true],
    ["v21 prospect", v21, true],
    ["v22 prospect", v22, true],
    ["verified execution", generatedDelivery("service-first.json").report, false],
  ] as const)("identity review requires v13 prospect (%s)", async (_name, raw, available) => {
    const checked = validateCapabilityReport(raw);
    expect(checked.ok).toBe(true);
    if (!checked.ok) throw new Error("Invalid saved report fixture");
    const report = checked.report;
    const savedIdentity: unknown = v22Input.request.business_identity;
    if (!validateSavedIdentity(savedIdentity)) throw new Error("Invalid saved identity fixture");
    const repo = { loadCompletedReport: vi.fn(async () => report), loadRevision: vi.fn(async () => null),
      loadSavedIdentity: vi.fn(async () => raw === v22 ? savedIdentity : undefined) };
    const result = await loadCapabilityOwnerDocument(repo, report.input_manifest.user_id, report.input_manifest.case_id, report.id, false);
    expect(result!.identityReviewAvailable).toBe(available);
    if (raw === v22) expect(result!.identityStatus?.[0]?.value).toBe("Manually confirmed");
    if (raw === v12) expect(result!.identityStatus?.map(row=>row.value)).toEqual(["No saved match","Unknown","Unconfirmed"]);
  });
  it("never reads revisions for an uncompleted or unowned candidate",async()=>{
    const repo={loadCompletedReport:vi.fn(async()=>null),loadRevision:vi.fn(),loadSavedIdentity:vi.fn()};
    expect(await loadCapabilityOwnerDocument(repo,"user","case","report",true)).toBeNull();
    expect(repo.loadRevision).not.toHaveBeenCalled();
    expect(repo.loadSavedIdentity).not.toHaveBeenCalled();
  });
  it.each(["original","draft","approved"] as const)("renders %s without passing a draft as approved content",async(status)=>{
    const {report,saved}=generatedDelivery("service-first.json");
    saved.content.summary="Custom delivery wording.";
    if(status==="draft"){saved.status="draft";saved.content.status="draft";saved.approved_at=null;}
    const repo={loadCompletedReport:vi.fn(async()=>report),loadRevision:vi.fn(async()=>status==="original"?null:saved),loadSavedIdentity:vi.fn()};
    const result=await loadCapabilityOwnerDocument(repo,report.input_manifest.user_id,report.input_manifest.case_id,report.id,true);
    expect(result!.document.summary).toBe(status==="approved"?"Custom delivery wording.":report.summary);
    expect(result!.document.evidence).toEqual(report.evidence);
    expect(result!.approvedRevision).toBe(status==="approved"?saved.revision:null);
    expect(result!.editable.expected_revision).toBe(status==="original"?0:saved.revision);
    expect(result!.editable.summary).toBe(status==="original"?report.summary:"Custom delivery wording.");
    expect(result!.deliveryStatus).toBe(status);
    expect(result!.implementationRevisionId).toBe(status==="approved"?saved.id:null);
    const system=await loadCapabilityOwnerDocument(repo,report.input_manifest.user_id,report.input_manifest.case_id,report.id,false);
    expect(system!.document.summary).toBe(report.summary);
  });
});
