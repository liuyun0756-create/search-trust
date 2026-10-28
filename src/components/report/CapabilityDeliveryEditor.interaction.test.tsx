// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CapabilityDeliveryEditor, type CapabilitySaveResult } from "./CapabilityDeliveryEditor";
import type { DeliveryRevision } from "@/lib/report-capability/generated/types";
import sample from "@/lib/report-capability/contracts/fixtures/first_service-1.json";
import three from "@/lib/report-capability/contracts/fixtures/first_service-3.json";
import type {DeliveryOrderConstraints} from "@/lib/report-capability/order";

// Browser input fixture: server-side contract/provenance guards have separate tests.
const initial = (): DeliveryRevision => ({ schema_version: "v22_delivery_revision_v1", report_id: sample.id,
  user_id: sample.input_manifest.user_id, case_id: sample.input_manifest.case_id, source_checksum: `sha256:${"0".repeat(64)}`,
  expected_revision: 0, status: "draft", title: sample.title, summary: sample.summary, client_note: null,
  actions: sample.actions.map(({ finding_ids: _findings, dependencies: _deps, ...action }) => structuredClone(action)) as DeliveryRevision["actions"] });
afterEach(cleanup);

describe("Capability delivery editor", () => {
  it("moves independent work, clears approval consent, and restores only order while keeping prose",async()=>{
    const source=initial();source.actions=structuredClone(three.actions).map(({finding_ids:_f,dependencies:_d,...a})=>a) as DeliveryRevision["actions"];
    const constraints:DeliveryOrderConstraints={systemOrder:source.actions.map(a=>a.id),actions:source.actions.map(a=>({id:a.id,title:a.title,dependencies:[],layer:2}))};
    const save=vi.fn(async(content:DeliveryRevision):Promise<CapabilitySaveResult>=>({ok:true,revision:content.expected_revision+1,content}));
    render(<CapabilityDeliveryEditor initial={source} orderConstraints={constraints} onSave={save}/>);
    fireEvent.change(screen.getAllByLabelText("Action title")[0],{target:{value:"My edited action"}});fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button",{name:"Move action 1 down"}));expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getAllByLabelText("Action title")[1]).toHaveValue("My edited action");
    fireEvent.click(screen.getByRole("button",{name:"Restore system order"}));expect(screen.getAllByLabelText("Action title")[0]).toHaveValue("My edited action");
    fireEvent.click(screen.getByRole("button",{name:"Save draft"}));await screen.findByText("Draft revision 1 saved. Not approved for delivery.");
    expect(save.mock.calls[0][0].actions.map(a=>a.id)).toEqual(constraints.systemOrder);
  });
  it("disables moves across an explicit dependency or prerequisite boundary",async()=>{
    const source=initial();source.actions=structuredClone(three.actions).map(({finding_ids:_f,dependencies:_d,...a})=>a) as DeliveryRevision["actions"];
    const constraints:DeliveryOrderConstraints={systemOrder:source.actions.map(a=>a.id),actions:source.actions.map((a,i)=>({id:a.id,title:a.title,dependencies:i?[source.actions[i-1]!.id]:[],layer:i?2:0}))};
    render(<CapabilityDeliveryEditor initial={source} orderConstraints={constraints} onSave={vi.fn()}/>);
    await waitFor(()=>expect(screen.getByRole("button",{name:"Save draft"})).toBeEnabled());
    expect(screen.getByRole("button",{name:"Move action 1 down"})).toBeDisabled();expect(screen.getByRole("button",{name:"Move action 2 up"})).toBeDisabled();
    expect(screen.getAllByText("A prerequisite check fixes this boundary.")).toHaveLength(3);
  });
  it("approves unchanged content, then saves another complete revision", async () => {
    const save = vi.fn(async (content: DeliveryRevision): Promise<CapabilitySaveResult> => ({ ok: true, revision: content.expected_revision + 1, content }));
    render(<CapabilityDeliveryEditor initial={initial()} onSave={save} />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Approve for delivery" }));
    await screen.findByText("Revision 1 approved for delivery.");
    expect(save.mock.calls[0][0]).toMatchObject({ expected_revision: 0, status: "approved", summary: sample.summary });
    fireEvent.change(screen.getByLabelText("Client summary"), { target: { value: "A client-specific summary." } });
    fireEvent.change(screen.getByLabelText("Material content"), { target: { value: "Client-approved wording to review." } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Draft revision 2 saved. Not approved for delivery.");
    expect(save.mock.calls[1][0]).toMatchObject({ expected_revision: 1, status: "draft", summary: "A client-specific summary." });
    expect(save.mock.calls[1][0].actions[0]!.materials[0]!.body).toBe("Client-approved wording to review.");
    expect(sample.actions[0].materials[0].body).not.toBe("Client-approved wording to review.");
  });
  it.each(["unavailable", "throws"])("retains edits after a save %s and permits retry", async (failure) => {
    const save = vi.fn(async (): Promise<CapabilitySaveResult> => {
      if (failure === "throws") throw new Error("private server detail");
      return { ok: false, code: "CAPABILITY_UNAVAILABLE" };
    });
    render(<CapabilityDeliveryEditor initial={initial()} onSave={save} />);
    fireEvent.change(screen.getByLabelText("Material content"), { target: { value: "Unsaved client wording." } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText("Could not save. Your edits have been kept; please retry.");
    expect((screen.getByLabelText("Material content") as HTMLTextAreaElement).value).toBe("Unsaved client wording.");
    expect(screen.queryByText("private server detail")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  });
  it("blocks overwrite after a conflict and offers a copy of the unsaved draft", async () => {
    const clipboard = { writeText: vi.fn(async (_text: string) => undefined) };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
    const save = vi.fn(async (): Promise<CapabilitySaveResult> => ({ ok: false, code: "CAPABILITY_CONFLICT" }));
    render(<CapabilityDeliveryEditor initial={initial()} onSave={save} />);
    fireEvent.change(screen.getByLabelText("Client summary"), { target: { value: "Keep this draft." } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByText(/A newer revision was saved elsewhere/);
    expect((screen.getByRole("button", { name: "Approve for delivery" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Copy unsaved edits" }));
    await screen.findByText("Unsaved edits copied.");
    expect(JSON.parse(clipboard.writeText.mock.calls[0][0]).summary).toBe("Keep this draft.");
    expect(save).toHaveBeenCalledTimes(1);
  });
  it("reports copy failure without discarding the editable material", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn(async () => { throw new Error("denied"); }) } });
    render(<CapabilityDeliveryEditor initial={initial()} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy material" }));
    await screen.findByText("Copy failed. Select the text and copy it manually.");
    expect((screen.getByLabelText("Material content") as HTMLTextAreaElement).value).toBe(sample.actions[0].materials[0].body);
  });
  it("supports approval of a zero-action diagnosis", async () => {
    const source = initial(); source.actions = [];
    const save = vi.fn(async (content: DeliveryRevision): Promise<CapabilitySaveResult> => ({ ok: true, revision: 1, content }));
    render(<CapabilityDeliveryEditor initial={source} onSave={save} />);
    expect(screen.queryByLabelText("Action title")).toBeNull();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Approve for delivery" }));
    await screen.findByText("Revision 1 approved for delivery.");
    expect(save.mock.calls[0][0].actions).toEqual([]);
  });
});
