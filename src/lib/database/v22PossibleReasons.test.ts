import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {randomUUID} from 'node:crypto';
import functionAudit from './test-support/reasons-function-audit.json';
import original from '../report-capability/fixtures/reasons-v17/bound.json';
import originalReport from '../report-capability/fixtures/reasons-v17/report.json';
import {canonicalDigest,canonicalJsonText} from '../verified-analysis-v22/digest';
import localEntityAudit from './test-support/local-entity-function-audit.json';
import v18Bound from '../report-capability/fixtures/local-entity-v18/bound.json';
import v18Report from '../report-capability/fixtures/local-entity-v18/report.json';
import actionAdviceAudit from './test-support/action-advice-function-audit.json';
import v20Bound from '../report-capability/fixtures/action-advice-v20/sql-bound.json';
import v20Report from '../report-capability/fixtures/action-advice-v20/sql-report.json';
import v20ExampleReport from '../report-capability/fixtures/candidates/v20.json';
let db:PGlite,report:any,bound:any;
const baselineAcls=new Map<string,string|null>();
const v17Results=new Map<string, unknown>();
const v18BaselineAcls=new Map<string,string|null>();
const v18Results=new Map<string, unknown>();
const v20Results=new Map<string, unknown>();

async function functionState(signature:string) {
 return (await db.query<{source:string,definition:string,acl:string|null}>(
  'select md5(prosrc) source, md5(pg_get_functiondef(oid)) definition, proacl::text acl from pg_proc where oid=$1::regprocedure',
  ['public.'+signature])).rows[0];
}
const json=JSON.stringify;
async function rpc(name:string,args:unknown[]){return (await db.query<{value:any}>(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) value`,args)).rows[0]?.value;}

function reportWithWireReviewCount(report:typeof v18Report, countText:string):string {
 const marker='REVIEW_COUNT_WIRE_VALUE';
 const comparison=report.gbp_comparison;
 const rows=comparison.rows.map((row,index)=>index!==1?row:{
  ...row,metrics:{...row.metrics,reviews_90d:{...row.metrics.reviews_90d,value:marker}},
 });
 return json({...report,gbp_comparison:{...comparison,rows}}).replace(json(marker),countText);
}

function freshFixture(version:number){
 // Retimestamp a synthetic copy only. Original checked-in fixture bytes stay intact.
 const delta=Date.now()-1000-Date.parse(original.manifest.evaluated_at);
 function shift(v:any):any{
  if(Array.isArray(v))return v.map(shift);
  if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,shift(x)]));
  return typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)?new Date(Date.parse(v)+delta).toISOString():v;
 }
 const b=shift(version===20?v20Bound:version===18?v18Bound:original),r=shift(version===20?v20Report:version===18?v18Report:originalReport),m=b.manifest,q=b.request;
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
 if(r.local_entity_coverage) for(const e of r.local_entity_coverage.evidence)e.sampled_at=q.evidence_input.sources.find((s:any)=>s.kind==='site').payload.selected_pages[Number(e.path.split('/')[3])].deep_snapshot.collected_at;
 r.input_manifest=structuredClone(m);r.keyword_visibility.sample.payload_checksum=market.binding.payload_checksum;
 return {bound:b,report:r};
}

describe.each([17,18,20])('v%i comparison SQL boundary',version=>{
 beforeAll(async()=>{
  db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
  for(const name of (await readdir('supabase/migrations')).sort()){
   if(name.startsWith('20261119100000')) for(const row of localEntityAudit) {
    const state=await functionState(row.signature);
    expect(state).toMatchObject({source:row.old,definition:row.old_definition});
    v18BaselineAcls.set(row.signature,state.acl);
   }
   if(name==='20261117120000_add_comparison_reasons_v17.sql')for(const row of functionAudit)baselineAcls.set(row.signature,(await db.query<{acl:string|null}>('select proacl::text acl from pg_proc where oid=$1::regprocedure',['public.'+row.signature])).rows[0].acl);
   if(name.startsWith('20261119110000')) for(const row of actionAdviceAudit) {
    expect(await functionState(row.signature)).toEqual({source:row.old,definition:row.old_definition,acl:row.acl});
   }
   await db.exec(await readFile('supabase/migrations/'+name,'utf8'));
   if(name.startsWith('20261119110000')) for(const row of actionAdviceAudit) {
    v20Results.set(row.signature,await functionState(row.signature));
   }
   if(name.startsWith('20261119100000')) for(const row of localEntityAudit) {
    v18Results.set(row.signature,await functionState(row.signature));
   }
   if(name.startsWith('20261117120000')) for(const row of functionAudit) v17Results.set(row.signature,await functionState(row.signature));
  }
  ({bound,report}=freshFixture(version));const m=bound.manifest,q=bound.request;
  const owner=m.user_id,caseId=m.case_id,job=m.job_id,identity=q.business_identity;
  await db.query('insert into users(id,clerk_user_id,email,credit_balance) values($1,$2,$3,1)',[owner,'keyword-synthetic','keyword@example.invalid']);
  await db.query(`insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
   values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb)`,[caseId,owner,m.business.site_url,identity.normalized_domain,identity.business_name,json(identity),identity.operating_model.value,m.business.primary_service,json(m.target_market)]);
  await rpc('save_v22_business_scope',[owner,caseId,0,json(m.business)]);
  await db.query(`insert into analysis_jobs(id,case_id,job_type,status,current_stage,idempotency_key,created_at,deadline_at) values($1,$2,'prospect_report','queued','queued','keyword-synthetic',now()-interval '10 seconds',now()+interval '20 minutes')`,[job,caseId]);
  await db.query(`insert into workflow_charges(id,user_id,case_id,workflow_kind,idempotency_key,analysis_job_id,discovery_job_id) values($1,$2,$3,'prospect','keyword-synthetic',$1,$1)`,[job,owner,caseId]);
  await db.query(`insert into credit_ledger(user_id,case_id,workflow_charge_id,analysis_job_id,kind,delta,balance_after,idempotency_key) values($1,$2,$3,$3,'prospect_debit',-1,0,'keyword-synthetic')`,[owner,caseId,job]);
  // Real intake stores the legacy identity; v14 converts only the generation input.
  const legacyIdentity={business_name:identity.business_name,site_url:identity.site_url,normalized_domain:identity.normalized_domain,
   public_gbp_url:identity.public_gbp_url,operating_model:'service_area',primary_location:structuredClone(m.target_market)};
  const envelope={schema_version:'v22_analysis_request_envelope_v1',analyze_request:{case_id:caseId,report_type:'prospect',business_identity:legacyIdentity,primary_service:m.business.primary_service,target_market:m.target_market,queries:m.keyword_queries,competitors:q.evidence_input.context.competitors,first_party_snapshots:[]},competitor_discovery:{local_synthetic:true}};
  await rpc('begin_v22_acquisition_preparation',[owner,caseId,job,'keyword-synthetic',m.business.id,canonicalJsonText(envelope)]);
  const token=randomUUID();expect((await rpc('claim_v22_acquisition_preparation',[job,1,token,3])).outcome).toBe('claimed');
  const {input_checksum,...canonical}=m;
  const body={p_user_id:owner,p_case_id:caseId,p_job_id:job,p_manifest:m,p_manifest_canonical:canonicalJsonText(canonical),p_recipe:bound.recipe,p_generation_canonical:canonicalJsonText(q),p_public_source_canonicals:Object.fromEntries(q.evidence_input.sources.map((s:any)=>[s.kind,canonicalJsonText(s.payload)])),p_previous_canonical:null,p_run_generation:1};
  expect((await rpc('freeze_v22_acquisition_preparation',[token,json({cost_schema_version:1,cost_ledger_revision:3}),json(body)])).manifest_id).toBe(m.id);
 },30000);
 afterAll(async()=>{await db.close();});
 it('completes real freeze, hydrates the exact input and stores the complete report with valid candidates',async()=>{
  const m=bound.manifest;
  expect(await rpc('hydrate_v22_capability_generation_input',[json(m),json(bound.recipe)])).toEqual(bound.request);
  await rpc('validate_v22_candidate_pool',[json(report)]);
  // Fresno's Python wire payload sent a JSON number with a decimal point.
  // JSON.stringify on a parsed fixture would silently erase that representation.
  const reviewCount=report.gbp_comparison.rows[1].metrics.reviews_90d.value;
  const wire=version===18?reportWithWireReviewCount(report,`${reviewCount}.0`):json(report);
  if(version===18) expect((await db.query<{count_text:string}>(`
    select $1::jsonb#>>'{gbp_comparison,rows,1,metrics,reviews_90d,value}' count_text
  `,[wire])).rows[0].count_text).toBe(`${reviewCount}.0`);
  const stored=await rpc('store_v22_capability_report',[m.user_id,m.case_id,m.job_id,wire,canonicalJsonText(report),1]);
  expect(stored.schema_version).toBe(version===20?'2.2.15':version===18?'2.2.13':'2.2.12');expect(stored.payload).toEqual(report);
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
 it('rejects the keyword module on historical versions, preserves their path and restricts grants',async()=>{
  await expect(rpc('validate_v22_keyword_visibility',[json({...report,schema_version:'2.2.8'})])).rejects.toThrow('CAPABILITY_KEYWORDS_INVALID');
  await rpc('validate_v22_keyword_visibility',[json({schema_version:'2.2.8'})]);
  expect((await db.query(`select has_function_privilege('anon','public.validate_v22_keyword_visibility(jsonb)','execute') anon,
   has_function_privilege('authenticated','public.validate_v22_keyword_visibility(jsonb)','execute') authenticated,
   has_function_privilege('service_role','public.validate_v22_keyword_visibility(jsonb)','execute') service`)).rows[0]).toEqual({anon:false,authenticated:false,service:true});
 });

 it('validates GBP values against saved sources and rejects altered sample metrics',async()=>{
  await rpc('validate_v22_gbp_comparison',[json(report)]);
  for(const mutation of ['rating','review_count','reviews_90d','latest_review','denominator','customer','source','sampled_at','time']){
   const bad=structuredClone(report),metric=bad.gbp_comparison.rows[1].metrics;
   if(mutation==='rating')metric.rating.value=1;
   if(mutation==='review_count')metric.review_count.value=123456;
   if(mutation==='reviews_90d')metric.reviews_90d.value=29;
   if(mutation==='latest_review')metric.latest_review.value='2000-01-01T00:00:00Z';
   if(mutation==='denominator')metric.visible_replies.denominator=29;
   if(mutation==='customer')bad.gbp_comparison.rows[0].metrics.reviews_90d={...metric.reviews_90d};
   if(mutation==='sampled_at')metric.rating.sampled_at='2000-01-01T00:00:00Z';
   if(mutation==='source')metric.rating.source_refs=['not-a-source'];
   if(mutation==='time'){bad.gbp_comparison.differences[0].status='observed';bad.gbp_comparison.differences[0].competitor_indices=[1];}
   await expect(rpc('validate_v22_gbp_comparison',[json(bad)])).rejects.toThrow('CAPABILITY_GBP_COMPARISON');
  }
  await expect(rpc('validate_v22_gbp_comparison',[json({...report,schema_version:'2.2.9'})])).rejects.toThrow('CAPABILITY_GBP_COMPARISON');
  await rpc('validate_v22_gbp_comparison',[json({schema_version:'2.2.9'})]);
 });
 it('keeps all fifteen baseline function ACLs and restricts the new validator',async()=>{
  const acl=(await db.query("select proacl::text acl from pg_proc where oid='public.validate_v22_landing_comparison(jsonb)'::regprocedure")).rows[0];
  expect(acl).toEqual({acl:'{postgres=X/postgres,service_role=X/postgres}'});
  const migration=await readFile('supabase/migrations/20261117120000_add_comparison_reasons_v17.sql','utf8');
  expect((migration.match(/P1_04_BASELINE_MISMATCH_/g)||[]).length).toBe(15);
  expect((migration.match(/P1_04_ACL_CHANGED/g)||[]).length).toBe(15);
 });
 it('matches all fifteen target function hashes and retains their production ACLs',async()=>{
  for(const row of functionAudit){
   expect(v17Results.get(row.signature)).toEqual({source:row.after_prosrc_md5,definition:row.after_definition_md5,acl:baselineAcls.get(row.signature)});
  }
 });
 it('validates exact reason copy, order, inference and both sides of the basis',async()=>{
  await rpc('validate_v22_possible_reasons',[json(report)]);
  expect(report.possible_reasons.items.map((x:any)=>x.metric)).toEqual(['rating','review_count']);
  for(const kind of ['copy','basis','index','classification','order','status','extra']){
   const bad=structuredClone(report),v=bad.possible_reasons;
   if(kind==='copy')v.items[0].customer_text+=' promised improvement';
   if(kind==='basis')v.items[0].basis_refs[1]='invented';
   if(kind==='index')v.items[0].competitor_indices=[1,2];
   if(kind==='classification')v.items[0].classification='fact';
   if(kind==='order')v.items.reverse();
   if(kind==='status')v.status='not_assessed';
   if(kind==='extra')v.extra='unverified';
   await expect(rpc('validate_v22_possible_reasons',[json(bad)])).rejects.toThrow('CAPABILITY_REASONS');
  }
  await rpc('validate_v22_possible_reasons',[json({schema_version:'2.2.11'})]);
  await expect(rpc('validate_v22_possible_reasons',[json({...report,schema_version:'2.2.11'})])).rejects.toThrow('CAPABILITY_REASONS_VERSION_INVALID');
  expect((await db.query(`select has_function_privilege('anon','public.validate_v22_possible_reasons(jsonb)','execute') anon,has_function_privilege('authenticated','public.validate_v22_possible_reasons(jsonb)','execute') authenticated,has_function_privilege('service_role','public.validate_v22_possible_reasons(jsonb)','execute') service`)).rows[0]).toEqual({anon:false,authenticated:false,service:true});
 });

 if(version===18) {
  it('rejects a fractional count, a numeric string, or a different integral count',async()=>{
   const actual=Number(report.gbp_comparison.rows[1].metrics.reviews_90d.value);
   for(const wrong of [`${actual}.5`,json(String(actual)),String(actual-1)]){
    await expect(rpc('validate_v22_gbp_comparison',[reportWithWireReviewCount(report,wrong)]))
      .rejects.toThrow('CAPABILITY_GBP_COMPARISON_VALUE_INVALID');
   }
  });
  it('applies the GBP numeric fix without changing validator permissions',async()=>{
   expect(await functionState('validate_v22_gbp_comparison(jsonb)')).toEqual({
    source:'fbb49257bd7342006707fbb41737f4b2',
    definition:'49f1317c82b800f3135b79a98e48263a',
    acl:'{postgres=X/postgres,service_role=X/postgres}',
   });
  });
  it('matches all 16 target definitions and keeps existing ACLs',async()=>{
   for(const row of localEntityAudit) expect(v18Results.get(row.signature)).toEqual({
    source:row.target,definition:row.target_definition,acl:v18BaselineAcls.get(row.signature),
   });
   expect((await functionState('validate_v22_local_entity_coverage(jsonb)')).acl).toBe('{postgres=X/postgres,service_role=X/postgres}');
  });
  it('validates coverage and rejects wrong source, city, tier, archive status and old versions',async()=>{
   await rpc('validate_v22_local_entity_coverage',[json(report)]);
   for(const kind of ['city','source','quote','rank','scope','legacy','absent']){
    const bad=structuredClone(report),coverage=bad.local_entity_coverage;
    if(kind==='city')coverage.target_city='Elsewhere';
    if(kind==='source')coverage.evidence[0].snapshot_id=randomUUID();
    if(kind==='quote')coverage.evidence[0].quote='Unsourced content';
    if(kind==='rank')coverage.status='not_detected';
    if(kind==='scope')coverage.archive_headings_only=true;
    if(kind==='legacy')bad.schema_version='2.2.12';
    if(kind==='absent')delete bad.local_entity_coverage;
    await expect(rpc('validate_v22_local_entity_coverage',[json(bad)])).rejects.toThrow('CAPABILITY_LOCAL_ENTITY');
   }
  });
 }

 if(version===20) {
  it('validates frozen example text, evidence and historical version isolation',async()=>{
   await rpc('validate_v22_action_advice',[json(v20ExampleReport)]);
   const wrong=structuredClone(v20ExampleReport);
   wrong.action_advice.find(item=>item.example)!.example!.text='Call a competing business.';
   await expect(rpc('validate_v22_action_advice',[json(wrong)])).rejects.toThrow('CAPABILITY_ACTION_ADVICE_INVALID');
   await expect(rpc('validate_v22_action_advice',[json({...v20ExampleReport,schema_version:'2.2.14'})])).rejects.toThrow('CAPABILITY_ACTION_ADVICE_INVALID');
   await rpc('validate_v22_action_advice',[json({schema_version:'2.2.14'})]);
  });
  it('matches all v20 targets and preserves the old ACLs',async()=>{
   for(const row of actionAdviceAudit) expect(v20Results.get(row.signature)).toEqual({
    source:row.target,definition:row.target_definition,acl:row.acl,
   });
   expect((await functionState('validate_v22_action_advice(jsonb)')).acl)
    .toBe('{postgres=X/postgres,service_role=X/postgres}');
  });
 }

});
