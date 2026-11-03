// @vitest-environment jsdom
import {fireEvent,render,screen,waitFor} from "@testing-library/react";
import {describe,it,expect,vi} from "vitest";
import fixture from "@/lib/report-capability/fixtures/labelled/public.json";
import {validateCapabilityReport,validateDeliveryRevision} from "@/lib/report-capability/validate";
import {initialCapabilityRevision} from "@/lib/report-capability/revision";
import {actionNeedsVerification} from "@/lib/report-capability/action-visibility";
import {CapabilityDeliveryEditor} from "./CapabilityDeliveryEditor";

describe("P0-07 explicit client inclusion",()=>{
  it("requires review after adding back, saves the selection, and restores it on reload",async()=>{
    const checked=validateCapabilityReport(structuredClone(fixture));if(!checked.ok)throw new Error("fixture");
    const report=checked.report,initial=initialCapabilityRevision(report);
    const index=initial.actions.findIndex(a=>actionNeedsVerification(report,a.id));expect(index).toBeGreaterThanOrEqual(0);
    const saved=vi.fn(async(content:typeof initial)=>{
      expect(validateDeliveryRevision(content,report)).toBe(true);
      return {ok:true as const,revision:content.expected_revision+1,content};
    });
    const view=render(<CapabilityDeliveryEditor initial={initial} onSave={saved}/>);
    const include=screen.getByLabelText(`Include action ${index+1} in client report`);
    expect(include).not.toBeChecked();
    const review=screen.getByLabelText("I have reviewed this content and its unresolved confirmations for client delivery.");
    fireEvent.click(review);expect(screen.getByText("Approve for delivery")).toBeEnabled();
    fireEvent.click(include);expect(review).not.toBeChecked();expect(screen.getByText("Approve for delivery")).toBeDisabled();
    fireEvent.click(review);fireEvent.click(screen.getByText("Approve for delivery"));
    await waitFor(()=>expect(saved).toHaveBeenCalledOnce());
    const content=saved.mock.calls[0][0];expect(content.client_action_ids).toContain(initial.actions[index].id);
    view.unmount();render(<CapabilityDeliveryEditor initial={{...content,expected_revision:1}} onSave={saved}/>);
    expect(screen.getByLabelText(`Include action ${index+1} in client report`)).toBeChecked();
    expect(screen.getByText("Approve for delivery")).toBeDisabled();
  });
});
