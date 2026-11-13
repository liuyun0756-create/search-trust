import {afterAll,beforeAll,expect,it,vi} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import type {SupabaseClient} from '@supabase/supabase-js';
import {NextRequest} from 'next/server';
import {defaultPlanningSettings} from '../planning-settings/contracts';
import {createProspectWorkflowHandlers} from '../prospect-workflow-v22/handlers';
import {SupabaseProspectWorkflowRepository} from '../prospect-workflow-v22/repository';

vi.mock('server-only',()=>({}));
const fix='20261113100000_stop_keyword_conflict_retries.sql';
const owner='11111111-1111-4111-8111-111111111111',caseId='22222222-2222-4222-8222-222222222222';
const workflow='33333333-3333-4333-8333-333333333333',discovery='44444444-4444-4444-8444-444444444444';
const market={display_name:'Austin, TX',country_code:'US',region:'TX',city:'Austin',postal_code:null,latitude:null,longitude:null};
const identity={business_name:'Local test',site_url:'https://example.com/',normalized_domain:'example.com',operating_model:'storefront',primary_location:market,public_gbp_url:null};
const queries=['plumber Austin','best plumber Austin','plumber near me'];
const scope={primary_service:'Plumbing',target_market:market};
const args=[owner,caseId,workflow,discovery,'keyword-conflict-workflow','keyword-conflict-task',1,JSON.stringify(queries),JSON.stringify(scope)];
const target='start_v22_prospect_discovery_with_keywords';
let db:PGlite;
const call=(revision=1)=>db.query(`select * from public.${target}($1,$2,$3,$4,$5,$6,$7,$8,$9)`,args.map((v,i)=>i===6?revision:v));

beforeAll(async()=>{
 db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role bypassrls;');
 for(const file of (await readdir('supabase/migrations')).sort())if(file!==fix)await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
 await db.query("insert into users(id,clerk_user_id,email,credit_balance) values($1,'keyword-conflict','local@example.invalid',3)",[owner]);
 await db.query(`insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
 values($1,$2,$3,$4,$5,$6::jsonb,'storefront','Plumbing',$7::jsonb)`,[caseId,owner,identity.site_url,identity.normalized_domain,identity.business_name,JSON.stringify(identity),JSON.stringify(market)]);
 const settings={...defaultPlanningSettings(),schema_version:'v22_planning_settings_v2',target_keywords:queries.map(query=>({query,origin:'seo',suggestion_refs:[]})),keyword_scope:scope,keyword_confirmation:null};
 await db.query('select save_v22_case_planning_settings($1,$2,0,$3::jsonb)',[owner,caseId,JSON.stringify(defaultPlanningSettings())]);
 await db.query('select save_v22_case_planning_settings($1,$2,1,$3::jsonb)',[owner,caseId,JSON.stringify(settings)]);
},30000);
afterAll(async()=>{await db?.close();});

it('changes only the stale revision SQLSTATE, preserving the function body, ACL and every other function',async()=>{
 await expect(call()).rejects.toMatchObject({code:'40001',message:'PLANNING_SETTINGS_CONFLICT'});
 const inventory=()=>db.query<{name:string;definition:string;acl:string|null}>("select oid::regprocedure::text name,pg_get_functiondef(oid) definition,proacl::text acl from pg_proc where pronamespace='public'::regnamespace and prokind='f' order by oid::regprocedure::text");
 const before=(await inventory()).rows;
 await db.exec(await readFile('supabase/migrations/'+fix,'utf8'));
 const after=(await inventory()).rows,changed=after.filter((row,i)=>JSON.stringify(row)!==JSON.stringify(before[i]));
 expect(changed).toHaveLength(1);expect(changed[0].name).toContain(target+'(');
 const old=before.find(r=>r.name===changed[0].name)!;
 expect(changed[0].definition).toBe(old.definition.replace("raise exception 'PLANNING_SETTINGS_CONFLICT' using errcode='40001'","raise exception 'PLANNING_SETTINGS_CONFLICT'"));
 expect(changed[0].acl).toBe(old.acl);
 await expect(call()).rejects.toMatchObject({code:'P0001',message:'PLANNING_SETTINGS_CONFLICT'});
 expect((await db.query('select credit_balance from users where id=$1',[owner])).rows[0]).toEqual({credit_balance:3});
 for(const table of ['workflow_charges','credit_ledger','prospect_discovery_tasks','prospect_target_keyword_bindings'])expect((await db.query(`select count(*)::int n from ${table}`)).rows[0]).toEqual({n:0});
});

function request(){return new NextRequest(`http://localhost/api/v2/cases/${caseId}/prospect-workflow`,{method:'POST',headers:{
 'content-type':'application/json','x-searchtrust-workflow-id':workflow,'x-searchtrust-discovery-job-id':discovery,
 'x-searchtrust-workflow-idempotency-key':args[4] as string,'idempotency-key':args[5] as string,'x-searchtrust-keyword-planning-revision':'1'},
 body:JSON.stringify({case_id:caseId,business_identity:identity,...scope,queries,search_language:'en',search_device:'mobile',supplemental_website_urls:[]})});}
async function handlerResponse(rpc:(name:string,body:Record<string,unknown>)=>{single:()=>Promise<unknown>}){
 const submitDiscovery=vi.fn();
 const handlers=createProspectWorkflowHandlers({keywordsEnabled:()=>true,getCurrentUser:async()=>({userId:owner}),
  createRepository:()=>new SupabaseProspectWorkflowRepository({rpc} as unknown as SupabaseClient),submitDiscovery,
  getDiscovery:vi.fn(),retryDiscovery:vi.fn()});
 const response=await handlers.POST(request(),{params:Promise.resolve({id:caseId})});
 expect(response.status).toBe(409);expect(await response.json()).toMatchObject({error:{code:'PLANNING_SETTINGS_CONFLICT'}});
 expect(submitDiscovery).not.toHaveBeenCalled();
}
it('the real repository and handler map P0001 to one 409 with no discovery or retry',async()=>{
 const rpc=vi.fn((_name:string,body:Record<string,unknown>)=>({single:async()=>{
  try{const values=Object.values(body).map(v=>v&&typeof v==='object'?JSON.stringify(v):v);const data=await db.query(`select * from ${target}(${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);return {data:data.rows[0],error:null};}
  catch(error){const e=error as {code:string;message:string};return {data:null,error:{code:e.code,message:e.message}};}
 }}));
 await handlerResponse(rpc);expect(rpc).toHaveBeenCalledTimes(1);
});
it('valid current revision still reserves once and preserves idempotency',async()=>{
 expect((await call(2)).rows[0]).toMatchObject({created:true,idempotent:false,credit_balance:2});
 expect((await call(2)).rows[0]).toMatchObject({created:false,idempotent:true,credit_balance:2});
 expect((await db.query('select count(*)::int n from credit_ledger')).rows[0]).toEqual({n:1});
});
it('rejects a changed migration baseline instead of modifying another function',async()=>{
 await expect(db.exec(await readFile('supabase/migrations/'+fix,'utf8'))).rejects.toThrow('KEYWORD_CONFLICT_BASELINE_MISMATCH');
});

const localPostgrest=process.env.V22_LOCAL_KEYWORD_POSTGREST_URL;
it.skipIf(!localPostgrest)('real PostgREST: one stale request reaches the handler as 409 (requires the isolated Docker script)',async()=>{
 const url=new URL(localPostgrest!);expect(url.hostname).toBe('127.0.0.1');
 const rpc=vi.fn((name:string,body:Record<string,unknown>)=>({single:async()=>{
  const response=await fetch(new URL('/rpc/'+name,url),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(3000)});
  const payload=await response.json();expect(response.status).toBe(400);expect(payload).toMatchObject({code:'P0001',message:'PLANNING_SETTINGS_CONFLICT'});
  return {data:null,error:payload};
 }}));
 await handlerResponse(rpc);expect(rpc).toHaveBeenCalledTimes(1);
});
