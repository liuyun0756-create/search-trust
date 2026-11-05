import {describe,it,expect} from 'vitest';
import raw from './fixtures/candidates/five.json';
import dependent from './fixtures/candidates/dependencies.json';
import empty from './fixtures/candidates/empty.json';
import type {CapabilityReport,DeliveryRevision} from './generated/types';
import {validateCapabilityReport,validateDeliveryRevision} from './validate';
import {canonicalDigest} from '../verified-analysis-v22/digest';

function revision(report:CapabilityReport,ids=report.actions.map(a=>a.id)):DeliveryRevision {
  return {schema_version:'v22_delivery_revision_v3',report_id:report.id,user_id:report.input_manifest.user_id,case_id:report.input_manifest.case_id,
    expected_revision:0,source_checksum:canonicalDigest(report),status:'draft',title:report.title,summary:report.summary,client_note:null,
    actions:ids.map(id=>{const {finding_ids:_f,dependencies:_d,...a}=report.action_candidates!.find(a=>a.id===id)!;return structuredClone(a);}) as DeliveryRevision['actions'],
    client_action_ids:ids as DeliveryRevision['client_action_ids']};
}
describe('P1-07 server contract and frozen candidates',()=>{
  it.each([raw,dependent,empty])('accepts Python fixture and exact trace',r=>{expect(validateCapabilityReport(r).ok).toBe(true);expect(validateDeliveryRevision(revision(r as unknown as CapabilityReport),r as unknown as CapabilityReport)).toBe(true);});
  it('requires a bound omission confirmation but permits the replacement',()=>{
    const r=raw as unknown as CapabilityReport,ids=['ac-synthetic-4','ac-synthetic-1','ac-synthetic-2'],v=revision(r,ids);
    expect(validateDeliveryRevision(v,r)).toBe(false);
    v.technical_omission_confirmation={confirmed:true,omitted_action_ids:['ac-synthetic-0'],selected_action_ids:[...ids] as never,client_action_ids:[...ids] as never};
    expect(validateDeliveryRevision(v,r)).toBe(true);
    v.actions.reverse();v.client_action_ids!.reverse();expect(validateDeliveryRevision(v,r)).toBe(false);
  });
  it('keeps dependencies hard even with confirmation',()=>{
    const r=dependent as unknown as CapabilityReport,ids=['ac-synthetic-4','ac-synthetic-1','ac-synthetic-2'],v=revision(r,ids);
    v.technical_omission_confirmation={confirmed:true,omitted_action_ids:['ac-synthetic-0'],selected_action_ids:[...ids] as never,client_action_ids:[...ids] as never};
    expect(validateDeliveryRevision(v,r)).toBe(false);
    const hidden=revision(r);hidden.client_action_ids=['ac-synthetic-1','ac-synthetic-2'];expect(validateDeliveryRevision(hidden,r)).toBe(false);
  });
  it.each(['append','duplicate','cross-report','material','checksum','body','pool','trace'])('rejects %s',kind=>{
    const r=structuredClone(raw) as unknown as CapabilityReport,v=revision(r);
    if(kind==='append')(v.actions as Array<DeliveryRevision["actions"][number]>).push(structuredClone(v.actions[0]!));
    if(kind==='duplicate')v.actions[1]=structuredClone(v.actions[0]!);
    if(kind==='cross-report')v.actions[0]!.id='other-report';
    if(kind==='material')v.actions[0]!.materials[0]!.evidence_ids=['fabricated'];
    if(kind==='checksum')v.source_checksum='sha256:'+'f'.repeat(64);
    if(kind==='body')r.actions[0]!.title='Forged selected body';
    if(kind==='pool')r.action_candidates!.pop();
    if(kind==='trace')r.prioritization!.candidates[0].technical_finding_ids=[];
    expect(validateDeliveryRevision(v,r)).toBe(false);
  });
});
