import type {BusinessIdentityV2, CapabilityReport, ContactCheck, OperatingModeAssessment} from '../report-capability/generated/types';
import {validateCapabilityReport} from '../report-capability/validate';
import {canonicalDigest} from '../verified-analysis-v22/digest';
import {isRecord,isUuid} from '../verified-analysis-v22/contracts';
import {modeLabels,type Workspace,type Preview} from './view';
export type {Workspace,Preview,Mode,Selection} from './view';
export function validCommand(v:unknown):v is Record<string,unknown>{
 if(!isRecord(v))return false;
 const allowed=v.operation==='preview'?['operation','request_id','selection','base_checksum','expected_identity_revision','expected_delivery_revision']:v.operation==='commit'?['operation','request_id']:['operation'];
 if(!['workspace','lookup','preview','commit'].includes(v.operation as string)||Object.keys(v).some(k=>!allowed.includes(k)))return false;
 if(v.operation==='commit'||v.operation==='preview')if(!isUuid(v.request_id))return false;
 if(v.operation==='preview'){
  const s=v.selection;
  return isRecord(s)&&Object.keys(s).every(k=>['branch_ref','operating_model','reason','customers_can_visit'].includes(k))&&(!Object.hasOwn(s,'customers_can_visit')||(typeof s.customers_can_visit==='boolean'&&(!s.customers_can_visit||['storefront','hybrid'].includes(s.operating_model as string))))&&Object.hasOwn(modeLabels,s.operating_model as string)&&typeof s.branch_ref==='string'&&s.branch_ref.length<=320&&/^(cid|place_id):.+$/.test(s.branch_ref)&&typeof s.reason==='string'&&!!s.reason.trim()&&s.reason.length<=1000&&typeof v.base_checksum==='string'&&/^sha256:[a-f0-9]{64}$/.test(v.base_checksum)&&['expected_identity_revision','expected_delivery_revision'].every(k=>Number.isSafeInteger(v[k])&&(v[k] as number)>=0);
 }
 return true;
}
export function validResponse(v:unknown,operation:string,owner:string,caseId:string,reportId:string):v is Workspace|Preview{
 if(!isRecord(v))return false;
 if(operation==='workspace'||operation==='lookup')return v.schema_version==='identity_review_workspace_v1'&&v.report_id===reportId&&typeof v.base_checksum==='string'&&/^sha256:[a-f0-9]{64}$/.test(v.base_checksum)&&Number.isSafeInteger(v.identity_revision)&&Number.isSafeInteger(v.delivery_revision)&&Number.isInteger(v.lookup_attempts)&&(v.lookup_attempts as number)>=0&&(v.lookup_attempts as number)<=3&&isRecord(v.identity)&&v.identity.schema_version==='business_identity_v2'&&isRecord(v.identity.operating_model)&&isRecord(v.automatic)&&Array.isArray(v.branches)&&v.branches.every(b=>isRecord(b)&&typeof b.ref==='string'&&typeof b.available_for_reassessment==='boolean'&&(b.domain_match===true||b.phone_match===true))&&Array.isArray(v.checks)&&Array.isArray(v.notes)&&typeof v.evidence_as_of==='string';
 const checked=validateCapabilityReport(v.report);if(!checked.ok)return false;const r=checked.report;
 return isUuid(v.request_id)&&['preview','committed'].includes(v.state as string)&&r.input_manifest.user_id===owner&&r.input_manifest.case_id===caseId&&r.input_manifest.base_report_ref?.report_id===reportId&&r.input_manifest.execution_type==='public_reassessment'&&canonicalDigest(r)===v.report_checksum&&isRecord(v.selection)&&isRecord(v.difference)&&v.difference.requires_approval===true&&v.difference.copy_migrated===false&&Array.isArray(v.difference.before)&&Array.isArray(v.difference.after)&&Array.isArray(v.difference.removed_action_ids)&&Array.isArray(v.difference.added_action_ids);
}
