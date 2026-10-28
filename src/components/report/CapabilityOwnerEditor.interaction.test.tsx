// @vitest-environment jsdom
import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {CapabilityOwnerEditor} from "./CapabilityOwnerEditor";
import {initialCapabilityRevision} from "@/lib/report-capability/revision";
import serviceFixture from "@/lib/report-capability/fixtures/generated/service-first.json";
import zeroFixture from "@/lib/report-capability/fixtures/generated/public-0.json";
import {validateCapabilityReport} from "@/lib/report-capability/validate";
function generatedDelivery(name:string) {
  const checked=validateCapabilityReport(structuredClone(name==="public-0.json"?zeroFixture:serviceFixture));
  if(!checked.ok) throw new Error("Invalid fixture");
  return {report:checked.report};
}
const {refresh}=vi.hoisted(()=>({refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh})}));
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});

describe("mounted owner delivery editor",()=>{
  it("saves complete edits then explicitly approves the same content without charging or regenerating",async()=>{
    const {report}=generatedDelivery("service-first.json"),initial=initialCapabilityRevision(report);
    const fetcher=vi.fn(async(_url:string,options:RequestInit)=>{
      const {content}=JSON.parse(String(options.body));
      // The database is free to return object keys in another order.
      return Response.json({ok:true,revision:content.expected_revision+1,content:Object.fromEntries(Object.entries(content).reverse())});
    });
    vi.stubGlobal("fetch",fetcher);
    render(<CapabilityOwnerEditor initial={initial}/>);
    fireEvent.click(screen.getByText("Review & approve · optional edits"));
    fireEvent.change(screen.getByLabelText("Client summary"),{target:{value:"My reviewed summary."}});
    expect(screen.getByRole("button",{name:"Approve for delivery"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Save draft"}));
    await screen.findByText("Draft revision 1 saved. Not approved for delivery.");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button",{name:"Approve for delivery"}));
    await screen.findByText("Revision 2 approved for delivery.");
    expect(fetcher).toHaveBeenCalledTimes(2);expect(refresh).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe(`/api/v2/cases/${initial.case_id}/reports/${report.id}/content-revision`);
    expect(fetcher.mock.calls[0][1].method).toBe("PUT");expect(fetcher.mock.calls[1][1].method).toBe("POST");
    expect(JSON.parse(String(fetcher.mock.calls[1][1].body))).toMatchObject({reviewConfirmed:true,content:{summary:"My reviewed summary.",expected_revision:1,status:"approved"}});
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });
  it.each([409,503,200])("keeps entered text after an unsuccessful or corrupt response (%i)",async(status)=>{
    const {report}=generatedDelivery("service-first.json");
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json(status===200?{ok:true,revision:1,content:{summary:"wrong"}}:{code:"private detail"},{status})));
    render(<CapabilityOwnerEditor initial={initialCapabilityRevision(report)}/>);
    fireEvent.click(screen.getByText("Review & approve · optional edits"));
    fireEvent.change(screen.getByLabelText("Client summary"),{target:{value:"Keep my unsaved work."}});
    fireEvent.click(screen.getByRole("button",{name:"Save draft"}));
    await waitFor(()=>expect(screen.getByText(status===409?/A newer revision was saved elsewhere/:/Could not save/)).toBeVisible());
    expect(screen.getByLabelText("Client summary")).toHaveValue("Keep my unsaved work.");
    expect(refresh).not.toHaveBeenCalled();
  });
  it("requires review again after editing approved-ready text",()=>{
    const {report}=generatedDelivery("public-0.json");
    render(<CapabilityOwnerEditor initial={initialCapabilityRevision(report)}/>);
    fireEvent.click(screen.getByText("Review & approve · optional edits"));
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button",{name:"Approve for delivery"})).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Report title"),{target:{value:"Updated title"}});
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button",{name:"Approve for delivery"})).toBeDisabled();
  });
});
