// @vitest-environment jsdom
import {cleanup,render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach,describe,expect,it,vi} from "vitest";
import {PlanningSettings} from "./PlanningSettings";
import {defaultPlanningSettings} from "@/lib/planning-settings/contracts";
const caseId="00000000-0000-4000-8000-000000000002";
const initial=()=>({caseId,siteUrl:"https://client.example/",revision:0,settings:defaultPlanningSettings()});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe("planning settings UI",()=>{
  it("does not write on mount, marks edits unsaved and confirms the exact saved version",async()=>{
    const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>Response.json(init?.method==="PUT"?{...initial(),revision:1,settings:JSON.parse(String(init.body)).settings}:initial()));vi.stubGlobal("fetch",fetcher);
    const status=vi.fn(),user=userEvent.setup();render(<PlanningSettings caseId={caseId} onStatus={status}/>);
    await screen.findByLabelText("Client's confirmed business focus");expect(fetcher).toHaveBeenCalledOnce();expect(status).toHaveBeenLastCalledWith({ready:true,revision:0});
    await user.selectOptions(screen.getByLabelText("Client's confirmed business focus"),"contact_path");
    await user.selectOptions(screen.getByLabelText("Your execution capacity"),"limited");
    await user.selectOptions(screen.getByLabelText("Your publishing access"),"needs_approval");
    expect(status).toHaveBeenLastCalledWith({ready:false,revision:0});
    await user.click(screen.getByRole("button",{name:"Save planning settings"}));
    await screen.findByText(/Saved for the next diagnosis/);
    expect(status).toHaveBeenLastCalledWith({ready:true,revision:1});
    expect(JSON.parse(String(fetcher.mock.calls[1][1]!.body))).toMatchObject({expectedRevision:0,settings:{priority:"contact_path",execution_conditions:{capacity:"limited",publishing_access:"needs_approval"}}});
  });
  it.each([409,503])("keeps unsaved input and blocks confirmation after %s",async code=>{
    const fetcher=vi.fn(async(_url:unknown,init?:RequestInit)=>init?.method==="PUT"?Response.json({error:{message:"Settings changed; compare before saving."}},{status:code}):Response.json(initial()));vi.stubGlobal("fetch",fetcher);
    const status=vi.fn(),user=userEvent.setup();render(<PlanningSettings caseId={caseId} onStatus={status}/>);
    await screen.findByLabelText("Client's confirmed business focus");await user.selectOptions(screen.getByLabelText("Client's confirmed business focus"),"business_identity");
    await user.click(screen.getByRole("button",{name:"Save planning settings"}));await screen.findByRole("alert");
    expect(screen.getByLabelText("Client's confirmed business focus")).toHaveValue("business_identity");expect(status).toHaveBeenLastCalledWith({ready:false,revision:0});
    await user.click(screen.getByRole("button",{name:/Reload saved settings · discard/}));
    await waitFor(()=>expect(screen.getByLabelText("Client's confirmed business focus")).toHaveValue("unknown"));expect(status).toHaveBeenLastCalledWith({ready:true,revision:0});
  });
  it("rejects a foreign page locally without sending it",async()=>{
    const fetcher=vi.fn(async()=>Response.json(initial()));vi.stubGlobal("fetch",fetcher);const user=userEvent.setup();
    render(<PlanningSettings caseId={caseId} onStatus={vi.fn()}/>);await screen.findByLabelText("Client's confirmed business focus");
    await user.type(screen.getByRole("textbox"),"https://foreign.example/");await user.click(screen.getByRole("button",{name:"Save planning settings"}));await screen.findByRole("alert");expect(fetcher).toHaveBeenCalledOnce();
  });
});
