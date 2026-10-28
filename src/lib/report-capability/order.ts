import type { CapabilityReport } from "./generated/types";

export type DeliveryOrderConstraints = { systemOrder: string[]; actions: {id:string; title:string; dependencies:string[]; layer:number}[] };
export function deliveryOrderConstraints(report: CapabilityReport): DeliveryOrderConstraints | undefined {
  if (report.prioritization?.rules_version !== "v22_business_priority_v2") return undefined;
  return {systemOrder:report.actions.map(a=>a.id), actions:report.actions.map(a=>{
    const decision=report.prioritization!.candidates.find(e=>e.input.action_id===a.id)!;
    return {id:a.id,title:a.title,dependencies:[...a.dependencies],layer:{access_indexing:0,measurement:1,none:2}[decision.prerequisite]};
  })};
}
export function validDeliveryOrder(ids: string[], constraints: DeliveryOrderConstraints) {
  if (ids.length !== constraints.systemOrder.length || new Set(ids).size !== ids.length
    || ids.some(id=>!constraints.systemOrder.includes(id))) return false;
  const seen=new Set<string>();let layer=-1;
  for(const id of ids){
    const action=constraints.actions.find(a=>a.id===id);
    if(!action || action.layer<layer || action.dependencies.some(dep=>!seen.has(dep)))return false;
    seen.add(id);layer=action.layer;
  }
  return true;
}
