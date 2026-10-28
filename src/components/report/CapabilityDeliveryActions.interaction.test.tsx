// @vitest-environment jsdom
import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {CapabilityDeliveryActions,saveCapabilityPdf} from "./CapabilityDeliveryActions";
const props={caseId:"case",reportId:"report",revision:2,approved:true};
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe("approved delivery controls",()=>{
  it("blocks draft delivery while retaining link management",async()=>{
    const fetcher=vi.fn(async()=>Response.json({shares:[]}));vi.stubGlobal("fetch",fetcher);
    render(<CapabilityDeliveryActions {...props} approved={false}/>);
    expect(screen.getByRole("button",{name:"Download approved PDF"})).toBeDisabled();
    expect(screen.getByRole("button",{name:"Create client link"})).toBeDisabled();
    fireEvent.click(screen.getByRole("button",{name:"Manage shared links"}));
    await screen.findByText("No shared links yet.");expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("creates a pinned fragment link, without sending PDF branding, and revokes explicitly",async()=>{
    let revoked=false;
    const fetcher=vi.fn(async(_url:string,options?:RequestInit)=>{
      if(options?.method==="POST")return Response.json({url:`${window.location.origin}/share#${"a".repeat(43)}`});
      if(options?.method==="DELETE"){revoked=true;return Response.json({ok:true});}
      return Response.json({shares:[{id:"share",revision_id:"revision",created_at:"2026-10-20T00:00:00Z",expires_at:"2099-10-20T00:00:00Z",revoked_at:revoked?"2026-10-21T00:00:00Z":null}]});
    });vi.stubGlobal("fetch",fetcher);
    render(<CapabilityDeliveryActions {...props}/>);
    fireEvent.change(screen.getByLabelText("Your name or business"),{target:{value:"My agency"}});
    fireEvent.click(screen.getByRole("button",{name:"Create client link"}));
    await screen.findByText(/Link created/);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({expectedRevision:2});
    expect(screen.getByLabelText("New client link")).toHaveValue(`${window.location.origin}/share#${"a".repeat(43)}`);
    vi.stubGlobal("navigator",{clipboard:{writeText:vi.fn().mockRejectedValue(new Error("Denied"))}});
    fireEvent.click(screen.getByRole("button",{name:"Copy link"}));
    await screen.findByText("Copy failed. Select the link and copy it manually.");
    fireEvent.click(screen.getByRole("button",{name:"Revoke link"}));
    await screen.findByText(/Link revoked/);expect(screen.queryByLabelText("New client link")).not.toBeInTheDocument();
    expect(fetcher.mock.calls[2][1]?.method).toBe("DELETE");
  });
  it("shows stale-version failures and does not invent a share link",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json({error:"Refresh the approved revision."},{status:409})));
    render(<CapabilityDeliveryActions {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Create client link"}));
    await screen.findByText("Refresh the approved revision.");expect(screen.queryByLabelText("New client link")).not.toBeInTheDocument();
  });
  it("does not accept a different-origin link returned by a malformed response",async()=>{
    const fetcher=vi.fn(async()=>Response.json({url:`https://elsewhere.test/share#${"a".repeat(43)}`}));vi.stubGlobal("fetch",fetcher);
    render(<CapabilityDeliveryActions {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Create client link"}));
    await screen.findByText("Could not confirm this share link.");expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("retains a usable control after a PDF failure and sends the displayed revision",async()=>{
    const fetcher=vi.fn(async(_url:string,_options?:RequestInit)=>Response.json({error:"This text needs a supported font."},{status:422}));vi.stubGlobal("fetch",fetcher);
    render(<CapabilityDeliveryActions {...props}/>);fireEvent.click(screen.getByRole("button",{name:"Download approved PDF"}));
    await screen.findByText("This text needs a supported font.");
    await waitFor(()=>expect(screen.getByRole("button",{name:"Download approved PDF"})).toBeEnabled());
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({expectedRevision:2});
  });
  it("refuses a successful non-PDF response instead of saving it as a PDF",async()=>{
    await expect(saveCapabilityPdf(Response.json({ok:true}))).rejects.toThrow("PDF download failed");
  });
});
