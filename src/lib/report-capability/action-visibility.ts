import type {CapabilityReport, DeliveryRevision} from "./generated/types";

/** Legacy reports have no labels: preserve their approved reading behavior. */
export function actionNeedsVerification(report:CapabilityReport, actionId:string): boolean {
  if(report.schema_version !== "2.2.5") return false;
  const action=report.actions.find(a=>a.id===actionId);
  return !!action && action.finding_ids.every(id=>{
    const finding=report.findings.find(f=>f.id===id)!;
    return finding.status !== "confirmed" || finding.confidence === "low";
  });
}
export function clientActionIds(report:CapabilityReport, revision?:DeliveryRevision): string[] {
  if(report.schema_version === "2.2.5" && revision?.schema_version === "v22_delivery_revision_v2")
    return [...revision.client_action_ids!];
  return report.actions.filter(a=>!actionNeedsVerification(report,a.id)).map(a=>a.id);
}
export function editableVisibility(report:CapabilityReport, revision:DeliveryRevision): DeliveryRevision {
  if(report.schema_version !== "2.2.5" || revision.schema_version === "v22_delivery_revision_v2") return revision;
  return {...revision,schema_version:"v22_delivery_revision_v2",client_action_ids:clientActionIds(report) as DeliveryRevision["client_action_ids"]};
}
export function clientActions<T extends {clientVisible?:boolean}>(actions:T[]):T[] {
  return actions.filter(a=>a.clientVisible !== false);
}
