import {describe,expect,it} from "vitest";
import generated from "./fixtures/generated/public-3.json";
import service from "./fixtures/generated/service-first.json";
import {validateCapabilityReport,validateDeliveryRevision} from "./validate";
import {deliveryOrderConstraints,validDeliveryOrder} from "./order";
import {initialCapabilityRevision} from "./revision";
function checked(value:unknown){const r=validateCapabilityReport(value);if(!r.ok)throw Error("Invalid report");return r.report;}
describe("controlled delivery ordering",()=>{
  it("keeps access/indexing and explicit dependencies before other work",()=>{
    const r=checked(generated),c=deliveryOrderConstraints(r)!;
    expect(validDeliveryOrder(c.systemOrder,c)).toBe(true);expect(validDeliveryOrder([...c.systemOrder].reverse(),c)).toBe(false);
    const draft=initialCapabilityRevision(r);draft.actions.reverse();expect(validateDeliveryRevision(draft,r)).toBe(false);
  });
  it("allows independent actions to move without changing the system source",()=>{
    const r=checked(service),before=JSON.stringify(r),draft=initialCapabilityRevision(r);draft.actions.reverse();
    expect(validateDeliveryRevision(draft,r)).toBe(true);expect(JSON.stringify(r)).toBe(before);
  });
  it("rejects duplicate, missing or invented actions",()=>{
    const c=deliveryOrderConstraints(checked(service))!;
    expect(validDeliveryOrder([c.systemOrder[0],c.systemOrder[0]],c)).toBe(false);
    expect(validDeliveryOrder(c.systemOrder.slice(1),c)).toBe(false);expect(validDeliveryOrder(["invented"],c)).toBe(false);
  });
});
