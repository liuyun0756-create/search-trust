import { describe, expect, it, vi } from "vitest";
import { generatedDelivery } from "./fixtures/generated-delivery";
import { loadCapabilityOwnerDocument } from "./owner-document";
describe("owner report page data gate",()=>{
  it("never reads revisions for an uncompleted or unowned candidate",async()=>{
    const repo={loadCompletedReport:vi.fn(async()=>null),loadRevision:vi.fn()};
    expect(await loadCapabilityOwnerDocument(repo,"user","case","report",true)).toBeNull();
    expect(repo.loadRevision).not.toHaveBeenCalled();
  });
  it.each(["original","draft","approved"] as const)("renders %s without passing a draft as approved content",async(status)=>{
    const {report,saved}=generatedDelivery("service-first.json");
    saved.content.summary="Custom delivery wording.";
    if(status==="draft"){saved.status="draft";saved.content.status="draft";saved.approved_at=null;}
    const repo={loadCompletedReport:vi.fn(async()=>report),loadRevision:vi.fn(async()=>status==="original"?null:saved)};
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
