// Local test support only: real full-chain PostgreSQL, no provider or production IO.
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {canonicalDigest,canonicalJsonText} from '../../verified-analysis-v22/digest.ts';
export const fix='20261113090000_bind_converted_acquisition_identity.sql';
export async function database(includeFix=true){
 const db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 for(const file of (await readdir('supabase/migrations')).sort())if(includeFix||file!==fix)await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 return db;
}
export async function rpc(db,name,body){
 if(!/^[a-z0-9_]+$/.test(name)||Object.keys(body).some(k=>!/^p_[a-z0-9_]+$/.test(k)))throw Error('invalid test RPC');
 const args=Object.entries(body);return (await db.query(`select to_jsonb(public.${name}(${args.map(([k],i)=>`${k}=>$${i+1}`).join(',')})) value`,args.map(([,v])=>v!==null&&typeof v==='object'?JSON.stringify(v):v))).rows[0]?.value;
}
export function legacy(identity,market){return {business_name:identity.business_name,site_url:identity.site_url,normalized_domain:identity.normalized_domain,public_gbp_url:identity.public_gbp_url,operating_model:'service_area',primary_location:structuredClone(market)};}
export async function fixture(ruleset='v22_capability_public_v14'){
 const b=JSON.parse(await readFile('src/lib/report-capability/fixtures/keywords-v14/bound.json','utf8'));
 const delta=Date.now()-1000-Date.parse(b.manifest.evaluated_at);
 function shift(v){if(Array.isArray(v))return v.map(shift);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,shift(x)]));return typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)?new Date(Date.parse(v)+delta).toISOString():v;}
 const value=shift(b),m=value.manifest,q=value.request,market=q.evidence_input.context.target_market;
 const old=legacy(q.business_identity,market);value.convertedIdentity=structuredClone(q.business_identity);
 if(ruleset==='v22_capability_public_v12'){
  q.schema_version='public_findings_input_v1';q.business_identity=old;m.schema_version='v22_analysis_input_v1';
  for(const k of ['identity_version_id','identity_checksum','target_market','evidence_as_of','keyword_queries'])delete m[k];
 }else if(ruleset==='v22_capability_public_v13'){m.schema_version='v22_analysis_input_v3';delete m.keyword_queries;}
 m.ruleset_version=ruleset;
 const serp=q.evidence_input.sources.find(s=>s.kind==='serp');
 for(const s of q.evidence_input.sources){
  if(s.kind==='competitor')s.payload.market_snapshot_checksum=canonicalDigest(serp.payload);
  if(s.kind==='public_gbp')s.payload.subject_reference_checksum=canonicalDigest(q.evidence_input.context.customer_public_gbp);
  s.binding.payload_checksum=canonicalDigest(s.payload);
 }
 for(const ref of m.snapshots)ref.payload_checksum=q.evidence_input.sources.find(s=>s.kind===ref.source_kind).binding.payload_checksum;
 if(m.identity_checksum)m.identity_checksum=canonicalDigest(q.business_identity);
 m.generation_input_checksum=canonicalDigest(q);const {input_checksum,...content}=m;m.input_checksum=canonicalDigest(content);
 value.recipe.request=structuredClone(q);for(const s of value.recipe.request.evidence_input.sources){delete s.payload;if(s.shared_snapshot)delete s.shared_snapshot.snapshot;}
 return {...value,old};
}
export async function seed(db,{owner,caseId,identity,service,market}){
 await db.query('insert into users(id,clerk_user_id,email,credit_balance) values($1,$2,$3,3)',[owner,'sql-binding-'+owner,'binding@example.invalid']);
 await db.query(`insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
 values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb)`,[caseId,owner,identity.site_url,identity.normalized_domain,identity.business_name,JSON.stringify(identity),identity.operating_model,service,JSON.stringify(market)]);
}
export async function enrolled(db,b){
 const m=b.manifest,q=b.request,owner=m.user_id,caseId=m.case_id,job=m.job_id;
 await seed(db,{owner,caseId,identity:b.old,service:m.business.primary_service,market:q.evidence_input.context.target_market});
 await rpc(db,'save_v22_business_scope',{p_user_id:owner,p_case_id:caseId,p_expected_revision:0,p_scope:m.business});
 await db.query(`insert into analysis_jobs(id,case_id,job_type,status,current_stage,idempotency_key,created_at,deadline_at)
 values($1,$2,'prospect_report','queued','queued','binding-synthetic',now()-interval '10 seconds',now()+interval '20 minutes')`,[job,caseId]);
 await db.query(`insert into workflow_charges(id,user_id,case_id,workflow_kind,idempotency_key,analysis_job_id,discovery_job_id) values($1,$2,$3,'prospect','binding-synthetic',$1,$1)`,[job,owner,caseId]);
 await db.query(`insert into credit_ledger(user_id,case_id,workflow_charge_id,analysis_job_id,kind,delta,balance_after,idempotency_key) values($1,$2,$3,$3,'prospect_debit',-1,2,'binding-synthetic')`,[owner,caseId,job]);
 const envelope={schema_version:'v22_analysis_request_envelope_v1',analyze_request:{case_id:caseId,report_type:'prospect',business_identity:b.old,primary_service:m.business.primary_service,target_market:q.evidence_input.context.target_market,queries:q.evidence_input.context.queries,competitors:q.evidence_input.context.competitors,first_party_snapshots:[]},competitor_discovery:{local_synthetic:true}};
 await rpc(db,'begin_v22_acquisition_preparation',{p_user_id:owner,p_case_id:caseId,p_job_id:job,p_idempotency_key:'binding-synthetic',p_business_version_id:m.business.id,p_request_canonical:canonicalJsonText(envelope)});
 const token=randomUUID();await rpc(db,'claim_v22_acquisition_preparation',{p_job_id:job,p_run_generation:1,p_lease_token:token,p_max_attempts:3});
 const {input_checksum,...content}=m;
 return {p_lease_token:token,p_cost_counters:{cost_schema_version:1,cost_ledger_revision:3},p_input:{p_user_id:owner,p_case_id:caseId,p_job_id:job,p_manifest:m,p_manifest_canonical:canonicalJsonText(content),p_recipe:b.recipe,p_generation_canonical:canonicalJsonText(q),p_public_source_canonicals:Object.fromEntries(q.evidence_input.sources.map(s=>[s.kind,canonicalJsonText(s.payload)])),p_previous_canonical:null,p_run_generation:1}};
}
