import type {CapabilityReport, DeliveryRevision} from './generated/types';
import {canonicalDigest} from '../verified-analysis-v22/digest';

export function candidateSelectionValid(report:CapabilityReport, revision:DeliveryRevision) {
  const pool=report.action_candidates;
  if(!pool || revision.schema_version!=='v22_delivery_revision_v3' || !revision.client_action_ids) return false;
  const ids=revision.actions.map(a=>a.id),clientIds: string[]=revision.client_action_ids;
  const visible=ids.filter(id=>clientIds.includes(id));
  if(JSON.stringify(visible)!==JSON.stringify(clientIds))return false;
  for(const selection of [ids,visible]) {
    const seen=new Set<string>();
    for(const id of selection) {
      const a=pool.find(a=>a.id===id);
      if(!a || seen.has(id) || a.dependencies.some(dep=>!seen.has(dep)))return false;
      seen.add(id);
    }
  }
  const technical=report.prioritization!.candidates.filter(e=>e.technical_finding_ids?.length).map(e=>e.input.action_id).sort();
  const expected=technical.length && !technical.some(id=>clientIds.includes(id))
    ? {confirmed:true,omitted_action_ids:technical,selected_action_ids:ids,client_action_ids:clientIds}:undefined;
  return expected ? !!revision.technical_omission_confirmation && canonicalDigest(expected)===canonicalDigest(revision.technical_omission_confirmation)
    : !Object.hasOwn(revision,'technical_omission_confirmation');
}
