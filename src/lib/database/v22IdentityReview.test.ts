import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import sample from '../identity-review/fixtures/synthetic.json';
import {canonicalDigest,canonicalJsonText} from '../verified-analysis-v22/digest';
import {initialCapabilityRevision} from '../report-capability/revision';
import type {CapabilityReport} from '../report-capability/generated/types';
import {validateCapabilityReport} from '../report-capability/validate';
let db:PGlite;
const base=sample.base,m=base.input_manifest,owner=m.user_id,caseId=m.case_id,id=base.id;
const proof=sample.variants.meeting_point;
const {request_id,state,...originalPreview}=proof;
const preview={...originalPreview,expected_delivery_revision:1};
let oldRevision:any,oldShare:any;
async function rpc(name:string,args:unknown[]=[]){return (await db.query<{value:any}>(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) as value`,args)).rows[0]?.value;}
async function prepare(value:unknown=preview){return rpc('prepare_v22_public_reassessment',[owner,caseId,id,request_id,JSON.stringify(value),canonicalJsonText(value)]);}
async function commit(){return rpc('commit_v22_public_reassessment',[owner,caseId,id,request_id]);}

describe.sequential('identity review database boundary',()=>{
 beforeAll(async()=>{
  db=new PGlite();await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  for(const name of (await readdir('supabase/migrations')).sort())await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
  await db.exec('begin');
  await db.query('insert into public.users(id,clerk_user_id,email) values($1,$2,$3)',[owner,'identity-review','identity@example.invalid']);
  const q=sample.request;
  await db.query(`insert into public.client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
   values($1,$2,$3,$4,$5,$6::jsonb,null,$7,$8::jsonb)`,[caseId,owner,q.business_identity.site_url,q.business_identity.normalized_domain,q.business_identity.business_name,JSON.stringify(q.business_identity),q.evidence_input.context.primary_service,JSON.stringify(q.evidence_input.context.target_market)]);
  await db.query('select public.save_v22_business_scope($1,$2,0,$3::jsonb)',[owner,caseId,JSON.stringify(m.business)]);
  // Restore a completed historical base into an isolated database. No live RPC.
  await db.query(`insert into public.analysis_jobs(id,case_id,job_type,current_stage,idempotency_key,status,progress,capability_report_id,completed_at) values($1,$2,'prospect_report','completed',$1::uuid::text,'succeeded',100,$1,now())`,[id,caseId]);
  for(const s of q.evidence_input.sources){const b=s.binding;await db.query(`insert into public.data_snapshots(id,case_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum) values($1,$2,$3,$4,$5,$6,'report_generation','healthy',$7::jsonb,$8)`,[b.snapshot_id,caseId,b.source_type,b.schema_version,b.fetched_at,b.expires_at,JSON.stringify(s.payload),b.payload_checksum]);}
  await db.query(`insert into public.analysis_input_manifests(id,user_id,case_id,job_id,business_version_id,mode,input_checksum,payload) values($1,$2,$3,$4,$5,'acquisition',$6,$7::jsonb)`,[m.id,owner,caseId,id,m.business.id,m.input_checksum,JSON.stringify(m)]);
  await db.query(`insert into public.capability_generation_recipes(manifest_id,user_id,case_id,generation_input_checksum,recipe) values($1,$2,$3,$4,$5::jsonb)`,[m.id,owner,caseId,m.generation_input_checksum,JSON.stringify(sample.recipe)]);
  await db.query(`insert into public.capability_report_versions(id,manifest_id,user_id,case_id,schema_version,payload_checksum,payload) values($1,$2,$3,$4,'2.2.8',$5,$6::jsonb)`,[id,m.id,owner,caseId,canonicalDigest(base),JSON.stringify(base)]);
  await db.query(`insert into public.workflow_charges(id,user_id,case_id,workflow_kind,idempotency_key,analysis_job_id,discovery_job_id,state,final_capability_report_id,settled_at) values($1,$2,$3,'prospect',$1::uuid::text,$1,$1,'consumed',$1,now())`,[id,owner,caseId]);
  await db.query(`insert into public.credit_ledger(user_id,case_id,workflow_charge_id,analysis_job_id,kind,delta,balance_after,idempotency_key) values($1,$2,$3,$3,'prospect_debit',-1,0,'saved-base-debit')`,[owner,caseId,id]);
  await db.exec('commit');
  const content={...initialCapabilityRevision(base as unknown as CapabilityReport),status:'approved'};
  oldRevision=await rpc('save_v22_completed_report_revision',[owner,caseId,id,JSON.stringify(content)]);
  oldShare=await rpc('create_v22_capability_share',[owner,caseId,id,oldRevision.id,'a'.repeat(64)]);
 },30000);
 afterAll(async()=>{await db.close();});
 it('hydrates original input and denies other owners',async()=>{
  expect(validateCapabilityReport(base).ok).toBe(true);expect(validateCapabilityReport(proof.report).ok).toBe(true);
  const v=await rpc('get_v22_identity_workspace',[owner,caseId,id]);expect(v.request).toEqual(sample.request);
  expect(await rpc('get_v22_identity_workspace',['11111111-1111-4111-8111-111111111111',caseId,id])).toBe(null);
 });
 it('persists before sending; rejects duplicate reservations and restores the cumulative budget',async()=>{
  const ledger={case_ref:caseId,normalized_domain:'example.test',attempts:[{number:1,stage:'link',outcome:'started'}]};
  expect(await rpc('save_v22_identity_lookup_ledger',[owner,caseId,id,JSON.stringify(ledger),true])).toEqual(ledger);
  await expect(rpc('save_v22_identity_lookup_ledger',[owner,caseId,id,JSON.stringify(ledger),true])).rejects.toThrow('IDENTITY_LOOKUP_CONFLICT');
  ledger.attempts[0].outcome='success';await rpc('save_v22_identity_lookup_ledger',[owner,caseId,id,JSON.stringify(ledger),false]);
  expect((await rpc('get_v22_identity_workspace',[owner,caseId,id])).ledger).toEqual(ledger);
  for(let n=2;n<=3;n++){ledger.attempts.push({number:n,stage:'name',outcome:'started'});await rpc('save_v22_identity_lookup_ledger',[owner,caseId,id,JSON.stringify(ledger),true]);}
  ledger.attempts.push({number:4,stage:'name',outcome:'started'});await expect(rpc('save_v22_identity_lookup_ledger',[owner,caseId,id,JSON.stringify(ledger),true])).rejects.toThrow('IDENTITY_LOOKUP_BUDGET');
 });
 it('rejects stale revisions, modified snapshots and unbound branches',async()=>{
  await expect(prepare({...preview,expected_identity_revision:1})).rejects.toThrow('IDENTITY_CONFLICT');
  const bad=structuredClone(preview);bad.report.input_manifest.snapshots[0].payload_checksum='sha256:'+'0'.repeat(64);
  await expect(prepare(bad)).rejects.toThrow('IDENTITY_INVALID');
  await expect(prepare({...preview,selection:{...preview.selection,branch_ref:'cid:999'}})).rejects.toThrow('IDENTITY_SOURCE_CONFLICT');
 });
 it('does not commit a preview after another delivery edit wins',async()=>{
  await db.exec('begin');
  try{
   await prepare();
   const draft={...initialCapabilityRevision(base as unknown as CapabilityReport,1),status:'draft'};
   await rpc('save_v22_completed_report_revision',[owner,caseId,id,JSON.stringify(draft)]);
   await expect(commit()).rejects.toThrow('IDENTITY_CONFLICT');
  }finally{await db.exec('rollback');}
 });
 it.each(['storefront','hybrid'] as const)('persists explicit %s address confirmation and the compared result',async mode=>{
  const {request_id:requestId,state:_state,...raw}=sample.variants[`${mode}_visit`];
  const value={...raw,expected_delivery_revision:1};
  await db.exec('begin');
  try{
   await rpc('prepare_v22_public_reassessment',[owner,caseId,id,requestId,JSON.stringify(value),canonicalJsonText(value)]);
   await rpc('commit_v22_public_reassessment',[owner,caseId,id,requestId]);
   const saved=await rpc('get_v22_identity_workspace',[owner,caseId,value.report.id]);
   expect(saved.request.business_identity.operating_location).toEqual(value.identity.operating_location);
   expect(saved.request.business_identity.operating_location.state).toBe('seo_confirmed');
   expect(saved.request.business_identity.operating_location.confirmation_ref.confirmed_by).toBe(owner);
   expect(saved.request.business_identity.operating_location.confirmation_ref.confirmed_at).toBe(value.report.input_manifest.evaluated_at);
   expect(saved.report.contact_checks.find((c:{field:string})=>c.field==='address').result).toBe('match');
   expect((await db.query<{identity:unknown}>('select identity from public.case_business_identity_versions where case_id=$1 order by revision desc limit 1',[caseId])).rows[0].identity).toEqual(value.identity);
  }finally{await db.exec('rollback');}
 });
 it.each(['service_area','meeting_point'] as const)('rejects forged %s customer-access confirmation at the SQL boundary',async mode=>{
  const value=structuredClone(preview);
  value.selection.operating_model=mode;value.selection.customers_can_visit=true;
  await expect(prepare(value)).rejects.toThrow('IDENTITY_VISIT_CONFIRMATION_INVALID');
 });
 it('rejects missing ticks, false attribution, another branch, changed address and blank reason',async()=>{
  const {request_id:requestId,state:_state,...raw}=sample.variants.hybrid_visit;
  const prepareVisit=(value:unknown)=>rpc('prepare_v22_public_reassessment',[owner,caseId,id,requestId,JSON.stringify(value),canonicalJsonText(value)]);
  for(const patch of [{confirmed_by:'11111111-1111-4111-8111-111111111111'},{confirmed_at:'2026-11-06T00:00:00Z'},{selected_branch_ref:'another-branch'}]){
   const value={...structuredClone(raw),expected_delivery_revision:1};Object.assign(value.identity.operating_location.confirmation_ref,patch);
   await expect(prepareVisit(value)).rejects.toThrow('IDENTITY_VISIT_CONFIRMATION_INVALID');
  }
  const noTick={...structuredClone(raw),expected_delivery_revision:1};noTick.selection.customers_can_visit=false;
  await expect(prepareVisit(noTick)).rejects.toThrow('IDENTITY_VISIT_CONFIRMATION_INVALID');
  for(const reason of ['', '  ', '\n\t'])await expect(prepare({...preview,selection:{...preview.selection,reason}})).rejects.toThrow('IDENTITY_INVALID');
  // Even fully rehashed forged input cannot replace the bound GBP address.
  const bad={...structuredClone(raw),expected_delivery_revision:1};
  bad.identity.operating_location.location.address='999 Forged Street';bad.identity.operating_location.confirmation_ref.address='999 Forged Street';
  bad.recipe.request.business_identity=bad.identity;
  const manifest=bad.report.input_manifest;
  manifest.identity_checksum=canonicalDigest(bad.identity);
  manifest.generation_input_checksum=canonicalDigest({...sample.request,business_identity:bad.identity});
  const {input_checksum,...content}=manifest;manifest.input_checksum=canonicalDigest(content);bad.report_checksum=canonicalDigest(bad.report);
  await expect(prepareVisit(bad)).rejects.toThrow('IDENTITY_VISIT_ADDRESS_INVALID');
 });
 it('creates an append-only version and new unapproved report, without debit; retries return the same report',async()=>{
  const before=(await db.query<{n:number}>('select count(*)::int as n from public.credit_ledger')).rows;
  await prepare();const saved=await commit();expect(saved.state).toBe('committed');expect(await commit()).toEqual(saved);
  const newId=proof.report.id;
  const completed=await db.query<{payload:unknown}>('select payload from public.get_v22_completed_capability_report($1,$2,$3)',[owner,caseId,newId]);expect(completed.rows[0].payload).toEqual(proof.report);
  expect((await db.query<{n:number}>('select count(*)::int as n from public.report_content_revisions where report_id=$1',[newId])).rows[0].n).toBe(0);
  expect((await db.query<{n:number}>('select count(*)::int as n from public.credit_ledger')).rows).toEqual(before);
  expect((await rpc('get_v22_identity_workspace',[owner,caseId,newId])).ledger.attempts).toHaveLength(3);
  expect((await db.query<{payload:unknown}>('select payload from public.capability_report_versions where id=$1',[id])).rows[0].payload).toEqual(base);
  await expect(db.query(`update public.case_business_identity_versions set identity='{}'`)).rejects.toThrow();
  await expect(db.query(`delete from public.capability_reassessment_requests`)).rejects.toThrow();
  expect((await db.query<{content:unknown}>('select * from public.report_content_revisions where id=$1',[oldRevision.id])).rows[0].content).toEqual(oldRevision.content);
  expect((await db.query<{revision_id:string}>('select revision_id from public.capability_report_shares where id=$1',[oldShare.id])).rows[0].revision_id).toBe(oldRevision.id);
  await expect(rpc('create_v22_capability_share',[owner,caseId,newId,oldRevision.id,'b'.repeat(64)])).rejects.toThrow('CAPABILITY_APPROVAL_CHANGED');
  const content={...initialCapabilityRevision(proof.report as unknown as CapabilityReport),status:'approved'};
  const approval=await rpc('save_v22_completed_report_revision',[owner,caseId,newId,JSON.stringify(content)]);
  expect((await rpc('create_v22_capability_share',[owner,caseId,newId,approval.id,'c'.repeat(64)])).revision_id).toBe(approval.id);
 });
 it('uses latest confirmed mode for new first service; meeting point alone is unsupported',async()=>{
  await expect(rpc('v22_current_service_identity',[caseId])).rejects.toThrow('FIRST_SERVICE_OPERATING_MODEL_UNSUPPORTED');
  for(const [i,mode] of ['storefront','service_area','hybrid'].entries()){
   const value=sample.variants[mode as 'storefront'].identity;
   await db.query(`insert into public.case_business_identity_versions(id,user_id,case_id,revision,base_report_id,identity,identity_checksum) values(gen_random_uuid(),$1,$2,$3,$4,$5::jsonb,$6)`,[owner,caseId,i+2,id,JSON.stringify(value),canonicalDigest(value)]);
   const mapped=await rpc('v22_current_service_identity',[caseId]);expect(mapped.operating_model).toBe(mode);expect(mapped.primary_location).toEqual(sample.request.evidence_input.context.target_market);
  }
  expect((await db.query<{business_identity:unknown}>('select business_identity from public.client_cases where id=$1',[caseId])).rows[0].business_identity).toEqual(sample.request.business_identity);
 });
});
