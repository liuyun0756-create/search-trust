import type {CapabilityReport, DeliveryRevision, EditableAction} from './generated/types';
import {actionNeedsVerification} from './action-visibility';

export function editableCandidate(action: NonNullable<CapabilityReport['action_candidates']>[number]): EditableAction {
  const {finding_ids: _findings, dependencies: _dependencies, ...editable}=action;
  return structuredClone(editable);
}
export function selectionDependenciesValid(report:CapabilityReport, draft:DeliveryRevision):boolean {
  const pool=report.action_candidates ?? report.actions;
  const ids=draft.actions.map(a=>a.id),clientIds:string[]=draft.client_action_ids ?? ids;
  if(ids.length!==report.actions.length || ids.length>3 || new Set(ids).size!==ids.length || clientIds.some(id=>!ids.includes(id)))return false;
  for(const selection of [ids,ids.filter(id=>clientIds.includes(id))]) {
    const seen=new Set<string>();
    for(const id of selection){const a=pool.find(a=>a.id===id);if(!a || a.dependencies.some(dep=>!seen.has(dep)))return false;seen.add(id);}
  }
  return true;
}
export function normalizeSelection(draft:DeliveryRevision):DeliveryRevision {
  const next=structuredClone(draft);
  next.client_action_ids=next.actions.filter(a=>draft.client_action_ids?.some(id=>id===a.id)).map(a=>a.id) as DeliveryRevision['client_action_ids'];
  delete next.technical_omission_confirmation;
  return next;
}
export function technicalOmissionConfirmation(report:CapabilityReport,draft:DeliveryRevision):DeliveryRevision['technical_omission_confirmation']|undefined {
  const technical=report.prioritization!.candidates.filter(e=>e.technical_finding_ids?.length).map(e=>e.input.action_id).sort();
  const visible:string[]=draft.client_action_ids ?? [];
  if(!technical.length || technical.some(id=>visible.includes(id)))return undefined;
  return {confirmed:true,omitted_action_ids:technical as [string,...string[]],selected_action_ids:draft.actions.map(a=>a.id) as DeliveryRevision['client_action_ids'] & string[],client_action_ids:[...visible] as DeliveryRevision['client_action_ids'] & string[]};
}
export function replaceCandidate(report:CapabilityReport,draft:DeliveryRevision,candidateId:string,index:number,cached?:EditableAction):DeliveryRevision|null {
  const source=report.action_candidates?.find(a=>a.id===candidateId);
  if(!source || !draft.actions[index] || draft.actions.some(a=>a.id===candidateId))return null;
  const next=normalizeSelection(draft),outgoing=next.actions[index]!;
  next.actions[index]=cached?structuredClone(cached):editableCandidate(source);
  next.client_action_ids=next.actions.filter(a=>a.id===candidateId ? !actionNeedsVerification(report,candidateId) : a.id!==outgoing.id && draft.client_action_ids?.some(id=>id===a.id)).map(a=>a.id) as DeliveryRevision['client_action_ids'];
  return selectionDependenciesValid(report,next)?next:null;
}
