// @vitest-environment jsdom
import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {ReviewEditor} from "./ReviewEditor";
import {deliveryFixture} from "@/lib/review-reports/test-support";
const {refresh}=vi.hoisted(()=>({refresh:vi.fn()}));vi.mock("next/navigation",()=>({useRouter:()=>({refresh})}));
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
describe("review editor saved state",()=>{
  it("saves draft then requires explicit confirmation for approval",async()=>{
    const {saved}=deliveryFixture();const fetcher=vi.fn(async(_url:string,options:RequestInit)=>{const q=JSON.parse(String(options.body));return Response.json({saved:{...saved,revision:q.content.expected_revision+1,status:q.content.status,content:q.content}});});
    vi.stubGlobal("fetch",fetcher);render(<ReviewEditor initial={{...saved.content,status:"draft"}}/>);
    fireEvent.change(screen.getByLabelText("Client summary"),{target:{value:"My client-ready summary."}});
    expect(screen.getByRole("button",{name:"Approve for delivery"})).toBeDisabled();fireEvent.click(screen.getByRole("button",{name:"Save draft"}));
    await screen.findByText(/Draft revision 1 saved/);fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Approve for delivery"}));
    await screen.findByText(/Revision 2 approved/);expect(fetcher).toHaveBeenCalledTimes(2);expect(refresh).toHaveBeenCalledTimes(2);expect(JSON.parse(String(fetcher.mock.calls[1][1].body))).toMatchObject({review_confirmed:true,content:{summary:"My client-ready summary.",expected_revision:1,status:"approved"}});
  });
  it("locks an unknown save and recovers the identical request identity/body",async()=>{
    const {saved}=deliveryFixture();let calls=0;const bodies:string[]=[];
    vi.stubGlobal("fetch",vi.fn(async(_u:string,o:RequestInit)=>{bodies.push(String(o.body));if(calls++===0)throw Error("lost response");const q=JSON.parse(String(o.body));return Response.json({saved:{...saved,content:q.content,status:q.content.status}});}));
    render(<ReviewEditor initial={{...saved.content,status:"draft"}}/>);fireEvent.click(screen.getByRole("button",{name:"Save draft"}));await screen.findByText(/Save result is unknown/);
    expect(screen.getByLabelText("Client summary")).toBeDisabled();fireEvent.click(screen.getByRole("button",{name:"Check the same save"}));await screen.findByText(/Draft revision 1 saved/);
    expect(bodies[0]).toBe(bodies[1]);expect(screen.getByLabelText("Client summary")).not.toBeDisabled();
  });
  it("preserves conflicting edits and supports zero-action approval",async()=>{
    const {saved}=deliveryFixture(true);vi.stubGlobal("fetch",vi.fn(async()=>Response.json({error:"conflict"},{status:409})));
    render(<ReviewEditor initial={{...saved.content,status:"draft"}}/>);fireEvent.change(screen.getByLabelText("Client summary"),{target:{value:"Keep these edits."}});fireEvent.click(screen.getByRole("checkbox"));fireEvent.click(screen.getByRole("button",{name:"Approve for delivery"}));
    await screen.findByText(/A newer revision exists/);expect(screen.getByLabelText("Client summary")).toHaveValue("Keep these edits.");expect(screen.getByText(/No next action is proposed/)).toBeVisible();expect(screen.getByRole("button",{name:"Save draft"})).toBeDisabled();
  });
});
