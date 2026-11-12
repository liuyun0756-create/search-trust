import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {canonicalDigest,canonicalJsonText} from '../verified-analysis-v22/digest';
import {defaultPlanningSettings} from '../planning-settings/contracts';
import sample from '../report-capability/fixtures/keywords-v14/bound.json';
let db:PGlite;
const owner=sample.manifest.user_id,caseId=sample.manifest.case_id,scope={primary_service:sample.request.evidence_input.context.primary_service,target_market:sample.request.evidence_input.context.target_market};
const words=[' Mixed CASE Austin ','Emergency plumbing near me','A third exact term'].map(query=>({query:query.trim(),origin:'seo',suggestion_refs:[]}));
const settings=()=>({...defaultPlanningSettings(),schema_version:'v22_planning_settings_v2',target_keywords:structuredClone(words),keyword_scope:scope,keyword_confirmation:null});
const save=(rev:number,s:unknown)=>rpc('save_v22_case_planning_settings',[owner,caseId,rev,JSON.stringify(s)]);
async function rpc(name:string,args:unknown[]){return (await db.query<{v:any}>(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) v`,args)).rows[0]?.v;}
beforeAll(async()=>{
 db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 for(const file of (await readdir('supabase/migrations')).sort())await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 const id=sample.request.business_identity;
 await db.query('insert into users(id,clerk_user_id,email,credit_balance) values($1,$2,$3,10)',[owner,'keywords-phase2','keywords-p2@example.invalid']);
 await db.query(`insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
  values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb)`,[caseId,owner,id.site_url,id.normalized_domain,id.business_name,JSON.stringify(id),id.operating_model.value,scope.primary_service,JSON.stringify(scope.target_market)]);
},30000);
afterAll(async()=>{await db.close();});
it('reads v1 unchanged and appends v2 with server confirmation, CAS and lost-save idempotency',async()=>{
 expect((await save(0,defaultPlanningSettings())).revision).toBe(1);
 const saved=await save(1,settings());expect(saved.revision).toBe(2);
 expect(saved.settings.target_keywords).toEqual(words);
 expect(saved.settings.keyword_confirmation.confirmed_by).toBe(owner);
 expect(Date.parse(saved.settings.keyword_confirmation.confirmed_at)).toBeGreaterThan(0);
 expect(await save(1,settings())).toEqual(saved);
 await expect(save(0,settings())).rejects.toThrow('PLANNING_SETTINGS_CONFLICT');
 expect((await db.query('select revision,settings from case_planning_settings order by revision')).rows).toHaveLength(2);
 await expect(db.exec('update case_planning_settings set revision=3')).rejects.toThrow();
});
it('rejects invalid counts, blank, casefold duplicates and overlong words without a revision',async()=>{
 for(const queries of [['a','b'],['a','b','c','d','e','f'],['','b','c'],['A','a','c'],['Straße','STRASSE','c'],['a'.repeat(301),'b','c']]){
  const value=settings();value.target_keywords=queries.map(query=>({query,origin:'seo',suggestion_refs:[]}));
  await expect(save(2,value)).rejects.toThrow('PLANNING_SETTINGS_INVALID');
 }
 expect((await rpc('get_v22_case_planning_settings',[owner,caseId])).revision).toBe(2);
});
it('atomically binds the exact confirmed words/revision before reserving, and never charges a stale save',async()=>{
 const workflow=randomUUID(),discovery=randomUUID(),queries=words.map(k=>k.query);
 const args=[owner,caseId,workflow,discovery,'keyword-workflow','keyword-task',2,canonicalJsonText(queries),JSON.stringify(scope)];
 const before=(await db.query('select credit_balance from users where id=$1',[owner])).rows[0];
 await expect(rpc('start_v22_prospect_discovery_with_keywords',[...args.slice(0,6),1,...args.slice(7)])).rejects.toThrow('PLANNING_SETTINGS_CONFLICT');
 expect((await db.query('select credit_balance from users where id=$1',[owner])).rows[0]).toEqual(before);
 const started=await rpc('start_v22_prospect_discovery_with_keywords',args);expect(started.credit_balance).toBe(9);
 expect((await rpc('start_v22_prospect_discovery_with_keywords',args)).idempotent).toBe(true);
 const binding={schema_version:'v22_target_keyword_binding_v1',queries,queries_digest:canonicalDigest(queries),planning_revision:2};
 expect((await db.query<{binding:unknown}>('select binding from prospect_target_keyword_bindings where discovery_job_id=$1',[discovery])).rows[0].binding).toEqual(binding);
 const body={analyze_request:{queries,...scope},target_keywords:binding};
 await rpc('assert_v22_discovery_target_keywords',[owner,caseId,workflow,discovery,JSON.stringify(body)]);
 // Changing optional planning settings is allowed, changing any query is rejected.
 const later={...settings(),priority:'contact_path'};await save(2,later);
 await rpc('assert_v22_discovery_target_keywords',[owner,caseId,workflow,discovery,JSON.stringify(body)]);
 const changed=structuredClone(body);changed.analyze_request.queries=[...queries].reverse();
 await expect(rpc('assert_v22_discovery_target_keywords',[owner,caseId,workflow,discovery,JSON.stringify(changed)])).rejects.toThrow('TARGET_KEYWORDS_DISCOVERY_CONFLICT');
 await expect(rpc('assert_v22_discovery_target_keywords',[randomUUID(),caseId,workflow,discovery,JSON.stringify(body)])).rejects.toThrow('TARGET_KEYWORDS_DISCOVERY_CONFLICT');
 const newWords=settings();newWords.target_keywords[0].query='Different term';await save(3,newWords);
 await expect(rpc('assert_v22_discovery_target_keywords',[owner,caseId,workflow,discovery,JSON.stringify(body)])).rejects.toThrow('TARGET_KEYWORDS_DISCOVERY_CONFLICT');
 await expect(db.exec('delete from prospect_target_keyword_bindings')).rejects.toThrow();
 expect((await db.query('select count(*)::integer n from credit_ledger')).rows[0]).toEqual({n:1});
});
it('preserves historical enrollment and restricts mutation to trusted RPCs',async()=>{
 await rpc('assert_v22_discovery_target_keywords',[owner,caseId,randomUUID(),randomUUID(),JSON.stringify({analyze_request:{queries:['old','unchanged','request']}})]);
 const name='public.start_v22_prospect_discovery_with_keywords(uuid,uuid,uuid,uuid,text,text,integer,text,jsonb)';
 expect((await db.query('select has_function_privilege(\'anon\',$1,\'execute\') a,has_function_privilege(\'authenticated\',$1,\'execute\') b,has_function_privilege(\'service_role\',$1,\'execute\') c',[name])).rows[0]).toEqual({a:false,b:false,c:true});
 expect((await db.query("select has_table_privilege('service_role','public.prospect_target_keyword_bindings','insert') can_insert")).rows[0]).toEqual({can_insert:false});
});

it('enrolls and recovers the actual v2 envelope through planning/intake/begin RPCs without new collection',async()=>{
 const saved=await save(4,settings());const rev=saved.revision;
 const workflow=randomUUID(),discovery=randomUUID(),job=randomUUID(),queries=words.map(k=>k.query);
 await rpc('start_v22_prospect_discovery_with_keywords',[owner,caseId,workflow,discovery,'keyword-full-flow','keyword-full-task',rev,canonicalJsonText(queries),JSON.stringify(scope)]);
 const binding={schema_version:'v22_target_keyword_binding_v1',queries,queries_digest:canonicalDigest(queries),planning_revision:rev};
 const body={schema_version:'v22_analysis_request_envelope_v2',target_keywords:binding,
  analyze_request:{case_id:caseId,report_type:'prospect',business_identity:sample.request.business_identity,...scope,queries,
   competitors:sample.request.evidence_input.context.competitors,first_party_snapshots:[],parent_report:null},
  competitor_discovery:{discovery_id:discovery,candidate_digest:'sha256:'+'a'.repeat(64),market_snapshot_id:randomUUID(),market_snapshot_checksum:'sha256:'+'b'.repeat(64)}};
 const args=[owner,caseId,workflow,job,'keyword-full-analysis',discovery,canonicalJsonText(body),null,rev];
 const first=await rpc('start_v22_acquisition_intake_with_planning',args);expect(first.request).toEqual(body);expect(first.status).toBe('queued');
 const repeated=await rpc('start_v22_acquisition_intake_with_planning',args);expect(repeated).toEqual(first);
 const prep=(await db.query<{request:unknown}>('select request from capability_acquisition_preparations where job_id=$1',[job])).rows[0];expect(prep.request).toEqual(body);
 const bad=structuredClone(body);bad.analyze_request.queries=[...queries].reverse();
 await expect(rpc('start_v22_acquisition_intake_with_planning',[...args.slice(0,6),canonicalJsonText(bad),null,rev])).rejects.toThrow('CAPABILITY_INTAKE_CONFLICT');
 expect((await db.query('select count(*)::integer n from analysis_jobs where id=$1',[job])).rows[0]).toEqual({n:1});
 expect((await db.query('select count(*)::integer n from credit_ledger where workflow_charge_id=$1',[workflow])).rows[0]).toEqual({n:1});
});
