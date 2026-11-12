import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import original from '../report-capability/fixtures/keywords-v14/bound.json';
import originalReport from '../report-capability/fixtures/keywords-v14/mixed.json';
import {canonicalDigest,canonicalJsonText} from '../verified-analysis-v22/digest';
let db:PGlite,report:any,bound:any;
const json=JSON.stringify;
async function rpc(name:string,args:unknown[]){return (await db.query<{value:any}>(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) value`,args)).rows[0]?.value;}

function freshFixture(){
 // Retimestamp a synthetic copy only. Original checked-in fixture bytes stay intact.
 const delta=Date.now()-1000-Date.parse(original.manifest.evaluated_at);
 function shift(v:any):any{
  if(Array.isArray(v))return v.map(shift);
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,shift(x)]));
  return typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)?new Date(Date.parse(v)+delta).toISOString():v;
 }
 const b=shift(original),r=shift(originalReport),m=b.manifest,q=b.request;
 const market=q.evidence_input.sources.find((s:any)=>s.kind==='serp');
 for(const s of q.evidence_input.sources){
  if(s.kind==='competitor')s.payload.market_snapshot_checksum=canonicalDigest(market.payload);
  if(s.kind==='public_gbp')s.payload.subject_reference_checksum=canonicalDigest(q.evidence_input.context.customer_public_gbp);
  s.binding.payload_checksum=canonicalDigest(s.payload);
 }
 for(const s of m.snapshots)s.payload_checksum=q.evidence_input.sources.find((v:any)=>v.kind===s.source_kind).binding.payload_checksum;
 m.identity_checksum=canonicalDigest(q.business_identity);m.generation_input_checksum=canonicalDigest(q);
 const {input_checksum:_,...content}=m;m.input_checksum=canonicalDigest(content);
 b.recipe.request=structuredClone(q);
 for(const s of b.recipe.request.evidence_input.sources){delete s.payload;if(s.shared_snapshot)delete s.shared_snapshot.snapshot;}
 r.input_manifest=structuredClone(m);r.keyword_visibility.sample.payload_checksum=market.binding.payload_checksum;
 return {bound:b,report:r};
}

describe.sequential('v14 keyword visibility SQL boundary',()=>{
 beforeAll(async()=>{
  db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  for(const name of (await readdir('supabase/migrations')).sort())await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
  ({bound,report}=freshFixture());const m=bound.manifest,q=bound.request;
  const owner=m.user_id,caseId=m.case_id,job=m.job_id,identity=q.business_identity;
  await db.query('insert into users(id,clerk_user_id,email,credit_balance) values($1,$2,$3,1)',[owner,'keyword-synthetic','keyword@example.invalid']);
  await db.query(`insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
   values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb)`,[caseId,owner,m.business.site_url,identity.normalized_domain,identity.business_name,json(identity),identity.operating_model.value,m.business.primary_service,json(m.target_market)]);
  await rpc('save_v22_business_scope',[owner,caseId,0,json(m.business)]);
  await db.query(`insert into analysis_jobs(id,case_id,job_type,status,current_stage,idempotency_key,created_at,deadline_at) values($1,$2,'prospect_report','queued','queued','keyword-synthetic',now()-interval '10 seconds',now()+interval '20 minutes')`,[job,caseId]);
  await db.query(`insert into workflow_charges(id,user_id,case_id,workflow_kind,idempotency_key,analysis_job_id,discovery_job_id) values($1,$2,$3,'prospect','keyword-synthetic',$1,$1)`,[job,owner,caseId]);
  await db.query(`insert into credit_ledger(user_id,case_id,workflow_charge_id,analysis_job_id,kind,delta,balance_after,idempotency_key) values($1,$2,$3,$3,'prospect_debit',-1,0,'keyword-synthetic')`,[owner,caseId,job]);
  const envelope={schema_version:'v22_analysis_request_envelope_v1',analyze_request:{case_id:caseId,report_type:'prospect',business_identity:identity,primary_service:m.business.primary_service,target_market:m.target_market,queries:m.keyword_queries,competitors:q.evidence_input.context.competitors,first_party_snapshots:[]},competitor_discovery:{local_synthetic:true}};
  await rpc('begin_v22_acquisition_preparation',[owner,caseId,job,'keyword-synthetic',m.business.id,canonicalJsonText(envelope)]);
  const token=randomUUID();expect((await rpc('claim_v22_acquisition_preparation',[job,1,token,3])).outcome).toBe('claimed');
  const {input_checksum,...canonical}=m;
  const body={p_user_id:owner,p_case_id:caseId,p_job_id:job,p_manifest:m,p_manifest_canonical:canonicalJsonText(canonical),p_recipe:bound.recipe,p_generation_canonical:canonicalJsonText(q),p_public_source_canonicals:Object.fromEntries(q.evidence_input.sources.map((s:any)=>[s.kind,canonicalJsonText(s.payload)])),p_previous_canonical:null,p_run_generation:1};
  expect((await rpc('freeze_v22_acquisition_preparation',[token,json({cost_schema_version:1,cost_ledger_revision:3}),json(body)])).manifest_id).toBe(m.id);
 },30000);
 afterAll(async()=>{await db.close();});
 it('completes real freeze, hydrates the exact input and stores 2.2.9 with valid candidates',async()=>{
  const m=bound.manifest;
  expect(await rpc('hydrate_v22_capability_generation_input',[json(m),json(bound.recipe)])).toEqual(bound.request);
  await rpc('validate_v22_candidate_pool',[json(report)]);
  const stored=await rpc('store_v22_capability_report',[m.user_id,m.case_id,m.job_id,json(report),canonicalJsonText(report),1]);
  expect(stored.schema_version).toBe('2.2.9');expect(stored.payload).toEqual(report);
  expect((await db.query('select count(*)::integer n from data_snapshots')).rows[0]).toEqual({n:4});
 });
 it('rejects forged positions, query bindings, source references and assessment counts',async()=>{
  for(const kind of ['position','query','source','count']){
   const bad=structuredClone(report);
   if(kind==='position')bad.keyword_visibility.rows[0].organic.position=19;
   if(kind==='query')bad.keyword_visibility.rows[0].query='not sampled';
   if(kind==='source')bad.keyword_visibility.sample.payload_checksum='sha256:'+'0'.repeat(64);
   if(kind==='count')bad.keyword_visibility.organic.checked_keywords=0;
   await expect(rpc('validate_v22_keyword_visibility',[json(bad)])).rejects.toThrow('CAPABILITY_KEYWORDS');
  }
 });
 it('rejects the new module on historical versions, preserves their path and restricts grants',async()=>{
  await expect(rpc('validate_v22_keyword_visibility',[json({...report,schema_version:'2.2.8'})])).rejects.toThrow('CAPABILITY_KEYWORDS_INVALID');
  await rpc('validate_v22_keyword_visibility',[json({schema_version:'2.2.8'})]);
  expect((await db.query(`select has_function_privilege('anon','public.validate_v22_keyword_visibility(jsonb)','execute') anon,
   has_function_privilege('authenticated','public.validate_v22_keyword_visibility(jsonb)','execute') authenticated,
   has_function_privilege('service_role','public.validate_v22_keyword_visibility(jsonb)','execute') service`)).rows[0]).toEqual({anon:false,authenticated:false,service:true});
 });
});
