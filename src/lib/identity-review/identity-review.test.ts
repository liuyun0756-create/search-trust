import {describe,it,expect,vi} from 'vitest';
import fixture from './fixtures/synthetic.json';
import {validCommand,validResponse} from './contracts';
import {validateCapabilityReport} from '../report-capability/validate';
import {canonicalDigest} from '../verified-analysis-v22/digest';
import {createIdentityReviewHandler} from './handler';
const m=fixture.base.input_manifest,reportId=fixture.base.id,owner=m.user_id,caseId=m.case_id;
describe('identity review contracts and owner boundary',()=>{
 it('validates actual Python reassessment and rejects fake time, base, settlement or checksum',()=>{
  for(const preview of Object.values(fixture.variants))expect(validResponse(preview,'preview',owner,caseId,reportId)).toBe(true);
  for(const patch of [{base_report_ref:null},{evidence_as_of:'2027-01-01T00:00:00Z'},{execution_type:null}]){
   const bad=structuredClone(fixture.variants.hybrid.report);Object.assign(bad.input_manifest,patch);const {input_checksum,...rest}=bad.input_manifest;bad.input_manifest.input_checksum=canonicalDigest(rest);expect(validateCapabilityReport(bad).ok).toBe(false);
  }
  expect(validateCapabilityReport({...fixture.variants.hybrid.report,settlement_policy:'one_credit_per_completed_analysis'}).ok).toBe(false);
 });
 it('rejects posted sources, ledger, owner and blank confirmation',()=>{
  for(const addition of [{ledger:{}},{user_id:owner},{report:{}},{identity:{}}])expect(validCommand({operation:'workspace',...addition})).toBe(false);
  expect(validCommand({operation:'preview',request_id:fixture.variants.hybrid.request_id,selection:{operating_model:'hybrid',branch_ref:'cid:123',reason:' '}})).toBe(false);
 });
 it('accepts an explicit tick only for storefront and hybrid',()=>{
  const p=fixture.variants.hybrid_visit;
  const command={operation:'preview',request_id:p.request_id,base_checksum:fixture.workspace.base_checksum,expected_identity_revision:0,expected_delivery_revision:0,selection:p.selection};
  expect(validCommand(command)).toBe(true);
  for(const operating_model of ['service_area','meeting_point'])expect(validCommand({...command,selection:{...p.selection,operating_model}})).toBe(false);
  expect(validCommand({...command,selection:{...p.selection,customers_can_visit:'true'}})).toBe(false);
  expect(validCommand({...command,selection:{...p.selection,reason:' '}})).toBe(false);
 });
 it('supplies the authenticated owner and rejects CSRF before forwarding',async()=>{
  const upstream=vi.fn(async()=>Response.json(fixture.workspace));
  const handler=createIdentityReviewHandler({enabled:()=>true,user:async()=>({userId:owner}),config:()=>({baseUrl:'https://backend.example',token:'local-token'}),fetch:upstream});
  const url=`https://app.example/api/v2/cases/${caseId}/reports/${reportId}/identity-review`,ctx={params:Promise.resolve({id:caseId,reportId})};
  const request=(origin:string,body:unknown={operation:'workspace'})=>new Request(url,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
  expect((await handler(request('https://wrong.example'),ctx)).status).toBe(403);expect(upstream).not.toHaveBeenCalled();
  expect((await handler(request('https://app.example',{operation:'workspace',user_id:owner}),ctx)).status).toBe(400);
  expect((await handler(request('https://app.example'),ctx)).status).toBe(200);
  const sent=JSON.parse((upstream.mock.calls[0] as unknown as [string,RequestInit])[1].body as string);expect(sent).toEqual({operation:'workspace',user_id:owner,case_id:caseId,report_id:reportId});
 });
});
