import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sample from "../report-capability/contracts/fixtures/first_service-0.json";
import { canonicalDigest, canonicalJsonText } from "../verified-analysis-v22/digest";

let db: PGlite;
const json = JSON.stringify;
// Minimal SQL-boundary sources, not captured customer data or a live generator run.
async function fixture(sourceState?: string, saveScope = true) {
  const report = structuredClone(sample), m = report.input_manifest;
  const owner = randomUUID(), caseId = randomUUID(), job = randomUUID(), connection = randomUUID();
  const fetched = new Date(Date.now()-86400000).toISOString(), evaluated = new Date(Date.now()-1000).toISOString();
  const expires = new Date(Date.now()+86400000).toISOString();
  Object.assign(m,{id:randomUUID(),user_id:owner,case_id:caseId,job_id:job,evaluated_at:evaluated});
  Object.assign(m.business,{id:randomUUID(),user_id:owner,case_id:caseId,confirmed_at:fetched});
  const identity = {site_url:m.business.site_url,public_gbp_url:"https://www.google.com/maps?cid=123",business_name:"Clinic"};
  await db.query("insert into users(id,clerk_user_id,email) values($1,$2,$3)",[owner,owner,`${owner}@example.invalid`]);
  await db.query("select register_v22_clerk_user($1,decode(repeat('01',32),'hex'),$2,null)",[owner,`${owner}@example.invalid`]);
  await db.query(`insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
    values($1,$2,$3,'clinic.example.invalid','Clinic',$4,'storefront',$5,$6)`,[caseId,owner,m.business.site_url,json(identity),m.business.primary_service,json({display_name:m.business.target_market})]);
  await db.query(`insert into google_connections(id,user_id,google_subject,granted_scopes,access_token_ciphertext,access_token_iv,access_token_auth_tag,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,encryption_key_version,token_expires_at)
    values($1,$2,$3,array['openid','email','profile','https://www.googleapis.com/auth/webmasters.readonly','https://www.googleapis.com/auth/analytics.readonly'],decode('01','hex'),decode('02','hex'),decode('03','hex'),decode('04','hex'),decode('05','hex'),decode('06','hex'),'test-key',now()+interval '1 hour')`,[connection,owner,owner]);
  for(const s of m.snapshots) {
    Object.assign(s,{snapshot_id:randomUUID(),case_id:caseId,fetched_at:fetched,expires_at:expires});
    const privateSource=['gsc','ga4'].includes(s.source_kind), type=s.source_kind==='public_gbp'?'gbp':s.source_kind;
    s.binding_id=privateSource?randomUUID():null;
    if(s.binding_id) await db.query(`insert into case_source_bindings(id,case_id,connection_id,source_type,external_resource_id,external_resource_name,identity_match_status,health_status,confirmed_by_user_id,confirmed_at)
      values($1,$2,$3,$4,$5,'Test resource','matched','healthy',$6,now())`,[s.binding_id,caseId,connection,type,`${type}-resource`,owner]);
    const payload={schema_version:s.schema_version,resource_id:`${type}-resource`,identity_match_status:'matched',health_status:'healthy',completed_at:fetched};
    s.payload_checksum=canonicalDigest(payload);
    await db.query(`insert into data_snapshots(id,case_id,binding_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context)
      values($1,$2,$3,$4,$5,$6,$7,'report_generation',$12,$8,$9,$10,$10,$11)`,[s.snapshot_id,caseId,s.binding_id,type,s.schema_version,
        privateSource&&sourceState==='future'?new Date(Date.now()+3600000).toISOString():fetched,
        privateSource&&sourceState==='expired'?new Date(Date.now()-1000).toISOString():expires,
        json(payload),s.payload_checksum,privateSource&&sourceState!=='missing coverage'?fetched.slice(0,10):null,
        json({external_resource_id:privateSource&&sourceState==='wrong resource'?'wrong':`${type}-resource`}),
        privateSource&&sourceState==='unhealthy'?'unhealthy':'healthy']);
  }
  const saveBusiness=()=>db.query("select save_v22_business_scope($1,$2,0,$3)",[owner,caseId,json(m.business)]);
  if(saveScope)await saveBusiness();
  m.input_checksum=canonicalDigest(Object.fromEntries(Object.entries(m).filter(([key])=>key!=="input_checksum")));
  report.id=job; report.generated_at=new Date().toISOString();report.evidence[0].snapshot_id=m.snapshots[0].snapshot_id;
  report.evidence[0].observed_at=fetched;report.findings[0].observed_at=fetched;
  const args=[owner,caseId,job,job,m.business.id,m.snapshots[4].snapshot_id,m.snapshots[5].snapshot_id];
  const start=(values=args)=>db.query<{value:Record<string,unknown>}>("select start_v22_first_service_preparation($1,$2,$3,$4,$5,$6,$7) value",values).then(r=>r.rows[0].value);
  const balance=()=>db.query<{credit_balance:number}>("select credit_balance from users where id=$1",[owner]).then(r=>r.rows[0].credit_balance);
  const freeze=(body=m)=>db.query("select * from freeze_v22_analysis_manifest($1,$2,$3,$4,$5)",[owner,caseId,job,json(body),canonicalJsonText(Object.fromEntries(Object.entries(body).filter(([key])=>key!=="input_checksum")))]);
  const complete=()=>db.query("select * from complete_v22_capability_analysis($1,$2,$3,$4,$5,1)",[owner,caseId,job,json(report),canonicalJsonText(report)]);
  const context={target_market:{display_name:m.business.target_market},competitors:m.business.competitor_sites.map(website_url=>({website_url})),
    queries:['repair service','local repair','urgent repair']};
  const collection={schema_version:'v22_first_service_collection_v1',collection_request:{case_id:caseId,business_identity:identity,
    primary_service:m.business.primary_service,...context,generation_limits:{competitor_count:m.business.competitor_sites.length}},
    competitor_discovery:{discovery_id:randomUUID() as string,candidate_digest:'sha256:'+'1'.repeat(64),market_snapshot_id:randomUUID(),market_snapshot_checksum:'sha256:'+'2'.repeat(64)}};
  const begin=(request=collection)=>db.query<{value:Record<string,unknown>}>('select begin_v22_first_service_collection($1,$2,$3,$4,$5,$6) value',[
    owner,caseId,job,job,m.business.id,canonicalJsonText(request)]).then(r=>r.rows[0].value);
  const claim=(token=randomUUID(),generation=1,maxAttempts=3)=>db.query<{value:Record<string,unknown>}>('select claim_v22_first_service_preparation($1,$2,$3,$4) value',[
    job,generation,token,maxAttempts]).then(r=>r.rows[0].value);
  const pulse=(token:string,generation=1)=>db.query<{value:boolean}>('select heartbeat_v22_first_service_preparation($1,$2,$3,$4) value',[
    job,generation,token,json({cost_ledger_revision:1})]).then(r=>r.rows[0].value);
  const prepare=async(wrongIdentity=false,token?:string)=>{
    const rows=(await db.query<{id:string;normalized_payload:Record<string,unknown>}>('select id,normalized_payload from data_snapshots where case_id=$1',[caseId])).rows;
    const payload=(id:string)=>rows.find(r=>r.id===id)!.normalized_payload;
    const sources=m.snapshots.slice(0,4).map(s=>({kind:s.source_kind,binding:{snapshot_id:s.snapshot_id,case_id:caseId,
      source_type:s.source_kind==='public_gbp'?'gbp':s.source_kind,schema_version:s.schema_version,payload_checksum:s.payload_checksum,
      fetched_at:s.fetched_at,expires_at:s.expires_at,health_status:'healthy',identity_match_status:'matched'},payload:payload(s.snapshot_id)}));
    const privateSources=m.snapshots.slice(4).map(s=>({snapshot_id:s.snapshot_id,case_id:caseId,binding_id:s.binding_id,source_type:s.source_kind,
      schema_version:s.schema_version,fetched_at:s.fetched_at,expires_at:s.expires_at,identity_match_status:'matched',health_status:'healthy',health_reasons:[],
      normalized_payload:payload(s.snapshot_id),raw_payload:null,payload_checksum:s.payload_checksum,external_resource_id:`${s.source_kind}-resource`,
      coverage_start:fetched.slice(0,10),coverage_end:fetched.slice(0,10)}));
    const body={public_input:{business_identity:wrongIdentity?{...identity,business_name:'Other business'}:identity,evidence_input:{sources,
      context}},
      first_party_input:{case_id:caseId,parent_report_id:null,evaluated_at:m.evaluated_at,snapshots:privateSources}};
    const recipe={schema_version:'v22_generation_recipe_v1',request:structuredClone(body)};
    for(const s of recipe.request.public_input.evidence_input.sources)delete (s as Partial<typeof s>).payload;
    for(const s of recipe.request.first_party_input.snapshots){delete (s as Partial<typeof s>).normalized_payload;delete (s as Partial<typeof s>).raw_payload;}
    m.generation_input_checksum=canonicalDigest(body);
    m.input_checksum=canonicalDigest(Object.fromEntries(Object.entries(m).filter(([key])=>key!=="input_checksum")));
    if(token)return db.query('select freeze_v22_first_service_preparation($1,$2,$3)',[token,json({cost_ledger_revision:2}),json({
      p_user_id:owner,p_case_id:caseId,p_job_id:job,p_run_generation:1,p_manifest:m,
      p_manifest_canonical:canonicalJsonText(Object.fromEntries(Object.entries(m).filter(([key])=>key!=="input_checksum"))),
      p_recipe:recipe,p_generation_canonical:canonicalJsonText(body),p_public_source_canonicals:Object.fromEntries(sources.map(s=>[s.kind,canonicalJsonText(s.payload)])),p_previous_canonical:null})]);
    return db.query('select * from prepare_v22_capability_analysis_input($1,$2,$3,$4,$5,$6,$7,$8,null,1)',[
      owner,caseId,job,json(m),canonicalJsonText(Object.fromEntries(Object.entries(m).filter(([key])=>key!=="input_checksum"))),
      json(recipe),canonicalJsonText(body),json(Object.fromEntries(sources.map(s=>[s.kind,canonicalJsonText(s.payload)])))]);
  };
  const discoveryId=collection.competitor_discovery.discovery_id;
  const discoveryRequest={case_id:caseId,business_identity:identity,primary_service:m.business.primary_service,
    target_market:context.target_market,queries:context.queries};
  const discoveryResult={...collection.competitor_discovery,case_id:caseId,input_digest:'sha256:'+'3'.repeat(64),
    candidates:m.business.competitor_sites.map(website_url=>({website_url})),ready_for_confirmation:true,
    created_at:evaluated,expires_at:expires};
  const reserveArgs=[owner,caseId,job,discoveryId,job,json(discoveryRequest),m.snapshots[4].snapshot_id,m.snapshots[5].snapshot_id];
  const reserve=(values=reserveArgs)=>db.query<{value:Record<string,unknown>}>(
    'select reserve_v22_first_service_discovery($1,$2,$3,$4,$5,$6,$7,$8) value',values).then(r=>r.rows[0].value);
  const discovered=(result=discoveryResult)=>db.query('select record_v22_first_service_discovery($1,$2,$3,$4)',[owner,caseId,job,json(result)]);
  const failDiscovery=(reason='DISCOVERY_FAILED')=>db.query<{value:boolean}>(
    'select fail_v22_first_service_discovery($1,$2,$3,$4,$5) value',[owner,caseId,job,discoveryId,reason]).then(r=>r.rows[0].value);
  return {owner,caseId,job,connection,report,m,identity,args,start,balance,freeze,complete,prepare,collection,begin,claim,pulse,
    saveBusiness,reserveArgs,reserve,discoveryRequest,discoveryResult,discovered,failDiscovery};
}

async function continuationFixture() {
  const f=await fixture();await f.reserve();
  const initial=f.collection.competitor_discovery.discovery_id;
  const round=async(id:string)=>{
    const dispatch=(await db.query<{v:Record<string,unknown>}>('select claim_v22_first_service_discovery_dispatch($1,$2) v',[f.job,randomUUID()])).rows[0].v;
    const token=randomUUID();
    const claim=(await db.query<{v:Record<string,unknown>}>('select claim_v22_first_service_discovery_run($1,$2,$3) v',[f.job,id,token])).rows[0].v;
    await f.discovered({...f.discoveryResult,discovery_id:id});return {dispatch,claim,token};
  };
  const first=await round(initial);
  const args=()=>[f.owner,f.caseId,f.job,initial,randomUUID(),randomUUID(),'supplement',json(['https://rival.example/']),f.args[5],f.args[6]];
  const next=(a=args())=>db.query<{v:Record<string,unknown>}>('select continue_v22_first_service_discovery($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) v',a).then(r=>r.rows[0].v);
  const state=()=>db.query<{v:Record<string,unknown>}>('select get_v22_first_service_discovery_state($1,$2,$3) v',[f.owner,f.caseId,f.job]).then(r=>r.rows[0].v);
  return {...f,initial,round,first,continuationArgs:args,next,discoveryState:state};
}

describe.sequential("first service isolated reservation and input binding",()=>{
  async function entryFixture() {
    const f=await fixture(undefined,false);await f.reserve();
    const candidates=f.discoveryResult.candidates.map((c,i)=>({...c,competitor_id:`competitor-${i+1}`,business_name:`Rival ${i+1}`,public_gbp_url:null}));
    await f.discovered({...f.discoveryResult,candidates});
    const body={...f.collection,collection_request:{...f.collection.collection_request,
      competitors:candidates.map(c=>({...c,confirmation_source:'user'}))}};
    const args=[f.owner,f.caseId,f.job,f.collection.competitor_discovery.discovery_id,f.args[5],f.args[6],canonicalJsonText(body)];
    const confirm=(values=args)=>db.query('select confirm_v22_first_service_entry($1,$2,$3,$4,$5,$6,$7)',values);
    const read=(user=f.owner)=>db.query<{v:Record<string,unknown>}>('select get_v22_first_service_workspace($1,$2) v',[user,f.caseId]).then(r=>r.rows[0].v);
    return {...f,body,entryArgs:args,confirm,read};
  }
  it('reads first-service preparation without a charge or private source payload',async()=>{
    const f=await fixture(undefined,false);
    const result=(await db.query<{v:Record<string,unknown>}>('select get_v22_first_service_workspace($1,$2) v',[f.owner,f.caseId])).rows[0].v;
    expect(result).toMatchObject({credit_balance:5,workflow:null,other_work:false,sources:{gsc:{ready:true},ga4:{ready:true}}});
    expect(JSON.stringify(result)).not.toContain('normalized_payload');
    expect(await f.balance()).toBe(5);
  });
  it('atomically confirms candidates into the original credit and replays without another scope or task',async()=>{
    const f=await entryFixture();await f.confirm();await f.confirm();
    expect(await f.balance()).toBe(4);
    expect(await f.read()).toMatchObject({workflow:{workflow_id:f.job,phase:'analyzing'},other_work:false});
    expect((await db.query('select id from analysis_jobs where case_id=$1',[f.caseId])).rows).toHaveLength(1);
    expect((await db.query('select id from case_business_scope_versions where case_id=$1',[f.caseId])).rows).toHaveLength(1);
    expect((await db.query('select kind,delta from credit_ledger where workflow_charge_id=$1',[f.job])).rows).toEqual([{kind:'verified_debit',delta:-1}]);
    const forged=structuredClone(f.body);forged.collection_request.competitors[0].business_name='Changed';
    await expect(f.confirm([...f.entryArgs.slice(0,6),canonicalJsonText(forged)])).rejects.toThrow('FIRST_SERVICE_CONTINUATION_CONFLICT');
  });
  it.each(['UTC','Asia/Shanghai','America/Los_Angeles'])('writes immutable manifest-compatible confirmation time in %s',async zone=>{
    const previous=(await db.query<{TimeZone:string}>('show timezone')).rows[0].TimeZone;
    try{
      await db.query("select set_config('TimeZone',$1,false)",[zone]);
      const f=await entryFixture();await f.confirm();
      const read=async()=>(await db.query<{scope:{confirmed_at:string};valid:boolean}>(
        "select scope,(scope->>'confirmed_at')::timestamptz<=now() valid from case_business_scope_versions where case_id=$1",[f.caseId])).rows[0];
      const first=await read();expect(first.valid).toBe(true);
      expect(first.scope.confirmed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
      await f.confirm();expect(await read()).toEqual(first);expect(await f.balance()).toBe(4);
    }finally{await db.query("select set_config('TimeZone',$1,false)",[previous]);}
  });
  it('recovers registered collection only inside its original lease, attempt and deadline limits',async()=>{
    const f=await entryFixture();
    const pending=async()=> (await db.query<{job_id:string;run_generation:number}>('select * from list_v22_first_service_preparation_work(25,3)')).rows.filter(r=>r.job_id===f.job);
    expect(await pending()).toEqual([]);await f.confirm();
    expect(await pending()).toEqual([{job_id:f.job,run_generation:1}]);
    await f.claim(randomUUID());expect(await pending()).toEqual([]);
    await db.query("update capability_first_service_runs set lease_until=now()-interval '1 second' where job_id=$1",[f.job]);
    expect(await pending()).toHaveLength(1);
    await db.query('update analysis_jobs set attempt_count=3 where id=$1',[f.job]);expect(await pending()).toEqual([]);
    await db.query("update analysis_jobs set attempt_count=2,created_at=now()-interval '1 hour',deadline_at=now()-interval '1 second' where id=$1",[f.job]);expect(await pending()).toEqual([]);
    expect(await f.balance()).toBe(4);
  });
  it('restricts recovery polling to service role and validates bounds',async()=>{
    for(const role of ['anon','authenticated']){
      await db.exec(`set role ${role}`);await expect(db.query('select * from list_v22_first_service_preparation_work(25,3)')).rejects.toThrow(/permission denied/);await db.exec('reset role');
    }
    await expect(db.query('select * from list_v22_first_service_preparation_work(101,3)')).rejects.toThrow('FIRST_SERVICE_PREPARATION_INVALID');
    await expect(db.query('select * from list_v22_first_service_preparation_work(25,0)')).rejects.toThrow('FIRST_SERVICE_PREPARATION_INVALID');
    await db.exec('set role service_role');await db.query('select * from list_v22_first_service_preparation_work(25,3)');await db.exec('reset role');
  });
  it('rolls back scope and job enrollment when collection binding fails',async()=>{
    const f=await entryFixture(),bad=structuredClone(f.body);bad.collection_request.queries=['wrong','queries','here'];
    await expect(f.confirm([...f.entryArgs.slice(0,6),canonicalJsonText(bad)])).rejects.toThrow('FIRST_SERVICE_COLLECTION_DISCOVERY_CONFLICT');
    expect((await db.query('select id from analysis_jobs where case_id=$1',[f.caseId])).rows).toHaveLength(0);
    expect((await db.query('select id from case_business_scope_versions where case_id=$1',[f.caseId])).rows).toHaveLength(0);
    expect(await f.read()).toMatchObject({workflow:{phase:'awaiting_confirmation',analysis_job_id:null}});
    await f.confirm();expect(await f.balance()).toBe(4);
  });
  it('refuses stale confirmation, invented candidates and foreign ownership without changes',async()=>{
    const f=await entryFixture();
    await expect(f.read(randomUUID())).rejects.toThrow('FIRST_SERVICE_CASE_NOT_FOUND');
    await expect(f.confirm([randomUUID(),...f.entryArgs.slice(1)])).rejects.toThrow('FIRST_SERVICE_CASE_NOT_FOUND');
    const stale=[...f.entryArgs];stale[3]=randomUUID();await expect(f.confirm(stale)).rejects.toThrow('FIRST_SERVICE_CONTINUATION_CONFLICT');
    const invented=structuredClone(f.body);invented.collection_request.competitors[0].website_url='https://not-observed.example/';
    await expect(f.confirm([...f.entryArgs.slice(0,6),canonicalJsonText(invented)])).rejects.toThrow('FIRST_SERVICE_DISCOVERY_SELECTION_INVALID');
    expect((await db.query('select id from analysis_jobs where case_id=$1',[f.caseId])).rows).toHaveLength(0);
  });
  it('rechecks snapshot freshness and authorization before enrollment',async()=>{
    const f=await entryFixture();
    const expired=randomUUID();
    await db.query(`insert into data_snapshots(id,case_id,binding_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context)
      select $1,case_id,binding_id,source_type,schema_version,now()-interval '2 seconds',now()-interval '1 second',sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context from data_snapshots where id=$2`,[expired,f.args[5]]);
    f.entryArgs[4]=expired;
    expect(await f.read()).toMatchObject({sources:{gsc:{ready:false}}});
    await expect(f.confirm()).rejects.toThrow('FIRST_SERVICE_SNAPSHOT_INVALID');
    expect((await db.query('select id from case_business_scope_versions where case_id=$1',[f.caseId])).rows).toHaveLength(0);
    expect(await f.balance()).toBe(4);
  });
  it('keeps entry read and confirmation unavailable to browser database roles',async()=>{
    const f=await entryFixture();
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      try {await expect(f.read()).rejects.toThrow('permission denied');await expect(f.confirm()).rejects.toThrow('permission denied');}
      finally {await db.exec('reset role');}
    }
    await db.exec('set role service_role');try{await f.confirm();}finally{await db.exec('reset role');}
  });
  it('continues one reservation, fences old tasks, replays the initial intent and generates one zero-action report',async()=>{
    const f=await continuationFixture(),a=f.continuationArgs(),id=a[4] as string;
    expect(await f.next(a)).toMatchObject({idempotent:false,current_discovery_job_id:id});
    expect(await f.next(a)).toMatchObject({idempotent:true,current_discovery_job_id:id});
    expect(await f.reserve()).toMatchObject({idempotent:true,discovery_job_id:f.initial,current_discovery_job_id:id});
    expect((await f.discoveryState()).remaining_attempts).toBe(2);
    await expect(f.discovered()).rejects.toThrow('FIRST_SERVICE_DISCOVERY_RESULT_INVALID');
    await expect(f.failDiscovery()).rejects.toThrow('FIRST_SERVICE_DISCOVERY_UNAVAILABLE');
    expect((await db.query<{v:boolean}>('select heartbeat_v22_first_service_discovery($1,$2) v',[f.job,f.first.token])).rows[0].v).toBe(false);
    expect((await db.query<{v:unknown}>('select claim_v22_first_service_discovery_run($1,$2,$3) v',[f.job,f.initial,randomUUID()])).rows[0].v).toEqual({outcome:'closed'});
    await expect(f.next([...a.slice(0,5),randomUUID(),...a.slice(6)])).rejects.toThrow('FIRST_SERVICE_CONTINUATION_CONFLICT');
    const round=await f.round(id);expect(round.dispatch).toMatchObject({outcome:'dispatch',attempts:1,cost_ledger_job_id:f.initial});
    expect(round.claim).toMatchObject({attempts:2,cost_ledger_job_id:f.initial});
    f.collection.competitor_discovery.discovery_id=id;
    await f.start();await f.prepare();await f.complete();
    expect(await f.balance()).toBe(4);expect(await f.discoveryState()).toMatchObject({phase:'completed',current_discovery_job_id:id});
    const extra=f.continuationArgs();extra[3]=id;await expect(f.next(extra)).rejects.toThrow('FIRST_SERVICE_DISCOVERY_CLOSED');
    expect((await db.query('select kind,delta from credit_ledger where workflow_charge_id=$1',[f.job])).rows).toEqual([{kind:'verified_debit',delta:-1}]);
  });

  it('refreshes only expired results, keeps supplements and preserves the total execution allowance',async()=>{
    const f=await continuationFixture(),a=f.continuationArgs();a[6]='refresh';a[7]='[]';
    await expect(f.next(a)).rejects.toThrow('FIRST_SERVICE_REFRESH_NOT_REQUIRED');
    await db.query("update capability_first_service_discoveries set result=result||jsonb_build_object('expires_at',now()-interval '1 second') where workflow_id=$1",[f.job]);
    expect(await f.discoveryState()).toMatchObject({phase:'refresh_required'});
    await f.next(a);await f.round(a[4] as string);
    const b=f.continuationArgs();b[3]=a[4];await f.next(b);await f.round(b[4] as string);
    expect(await f.discoveryState()).toMatchObject({remaining_attempts:0,current_discovery_job_id:b[4]});
    const c=f.continuationArgs();c[3]=b[4];c[7]=json(['https://another.example/']);
    await expect(f.next(c)).rejects.toThrow('FIRST_SERVICE_DISCOVERY_BUDGET_EXHAUSTED');
    expect(await f.next(a)).toMatchObject({idempotent:true,discovery_job_id:a[4],current_discovery_job_id:b[4]});
    expect(await f.balance()).toBe(4);
  });

  it('rejects altered replay, foreign ownership and changed business without changing history or balance',async()=>{
    const f=await continuationFixture(),a=f.continuationArgs();
    const wrong=[...a];wrong[0]=randomUUID();await expect(f.next(wrong)).rejects.toThrow('FIRST_SERVICE_CASE_NOT_FOUND');
    await f.next(a);const changed=[...a];changed[7]=json(['https://another.example/']);
    await expect(f.next(changed)).rejects.toThrow('FIRST_SERVICE_CONTINUATION_CONFLICT');
    const altered=[...f.reserveArgs];altered[5]=json({...f.discoveryRequest,queries:['different','more','search']});
    await expect(f.reserve(altered)).rejects.toThrow('FIRST_SERVICE_DISCOVERY_CONFLICT');
    await expect(db.query("update capability_first_service_discovery_continuations set mode='refresh' where workflow_id=$1",[f.job])).rejects.toThrow('FIRST_SERVICE_DISCOVERY_HISTORY_IMMUTABLE');
    await f.round(a[4] as string);await db.query("update client_cases set primary_service='Different' where id=$1",[f.caseId]);
    const b=f.continuationArgs();b[3]=a[4];b[7]=json(['https://another.example/']);
    await expect(f.next(b)).rejects.toThrow('FIRST_SERVICE_DISCOVERY_CONTEXT_CHANGED');expect(await f.balance()).toBe(4);
  });

  it('requires a saved result before continuation and does not refund because a user waits',async()=>{
    const f=await continuationFixture(),a=f.continuationArgs();await f.next(a);
    const b=f.continuationArgs();b[3]=a[4];await expect(f.next(b)).rejects.toThrow('FIRST_SERVICE_DISCOVERY_IN_PROGRESS');
    await f.round(a[4] as string);
    await db.query("update capability_first_service_discoveries set created_at=now()-interval '21 minutes',deadline_at=now()-interval '1 minute' where workflow_id=$1",[f.job]);
    await db.query('select * from expire_v22_first_service_discoveries(100)');expect(await f.balance()).toBe(4);
  });

  it('compensates only the current failed round once and blocks any further new round',async()=>{
    const f=await continuationFixture(),a=f.continuationArgs();await f.next(a);
    const fail=()=>db.query('select fail_v22_first_service_discovery($1,$2,$3,$4,$5)',[f.owner,f.caseId,f.job,a[4],'DISCOVERY_FAILED']);
    await expect(f.failDiscovery()).rejects.toThrow('FIRST_SERVICE_DISCOVERY_UNAVAILABLE');
    await fail();await fail();expect(await f.balance()).toBe(5);
    expect(await f.discoveryState()).toMatchObject({phase:'failed'});
    const b=f.continuationArgs();b[3]=a[4];await expect(f.next(b)).rejects.toThrow('FIRST_SERVICE_DISCOVERY_CLOSED');
    expect((await db.query('select kind,delta from credit_ledger where workflow_charge_id=$1 order by delta',[f.job])).rows)
      .toEqual([{kind:'verified_debit',delta:-1},{kind:'technical_failure_credit',delta:1}]);
  });

  it('pins refreshed private sources while retaining the original reservation for exact replay',async()=>{
    const f=await continuationFixture(),a=f.continuationArgs(),fresh=randomUUID();
    await db.query(`insert into data_snapshots(id,case_id,binding_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context)
      select $1,case_id,binding_id,source_type,schema_version,now()-interval '1 second',now()+interval '1 day',sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context from data_snapshots where id=$2`,[fresh,f.args[5]]);
    await expect(f.next(a)).rejects.toThrow('FIRST_SERVICE_SNAPSHOT_NOT_CURRENT');
    a[8]=fresh;await f.next(a);expect(await f.reserve()).toMatchObject({current_discovery_job_id:a[4]});
    expect((await db.query<{gsc_snapshot_id:string}>('select gsc_snapshot_id from capability_first_service_discoveries where workflow_id=$1',[f.job])).rows[0].gsc_snapshot_id).toBe(fresh);
    expect((await db.query<{id:string}>("select previous_snapshot->>'gsc_snapshot_id' id from capability_first_service_discovery_continuations where workflow_id=$1",[f.job])).rows[0].id).toBe(f.args[5]);
    await f.round(a[4] as string);await db.query("update google_connections set granted_scopes='{}' where id=$1",[f.connection]);
    const b=f.continuationArgs();b[3]=a[4];b[7]=json(['https://another.example/']);b[8]=fresh;
    await expect(f.next(b)).rejects.toThrow(/FIRST_SERVICE_/);expect(await f.balance()).toBe(4);
  });

  it('keeps continuation and current-state RPCs service-only with no direct history writes',async()=>{
    const f=await continuationFixture(),a=f.continuationArgs();
    for(const role of ['anon','authenticated'])for(const [sql,args]of [
      ['select continue_v22_first_service_discovery($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',a],
      ['select get_v22_first_service_discovery_state($1,$2,$3)',[f.owner,f.caseId,f.job]],
      ['select claim_v22_first_service_discovery_dispatch_base($1,$2)',[f.job,randomUUID()]],
    ] as [string,unknown[]][])
      await expect(db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query(sql,args);})).rejects.toThrow(/permission denied/);
    await expect(db.transaction(async tx=>{await tx.exec('set local role service_role');await tx.query('delete from capability_first_service_discovery_continuations where workflow_id=$1',[f.job]);})).rejects.toThrow(/permission denied/);
    await db.transaction(async tx=>{await tx.exec('set local role service_role');await tx.query('select continue_v22_first_service_discovery($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',a);});
    expect(await f.balance()).toBe(4);
  });
  it('dispatches once, fences active and stale discovery leases, and caps attempts without another debit',async()=>{
    const f=await fixture(undefined,false);await f.reserve();
    const discovery=f.collection.competitor_discovery.discovery_id;
    const dispatch=(token=randomUUID())=>db.query<{v:Record<string,unknown>}>('select claim_v22_first_service_discovery_dispatch($1,$2) v',[f.job,token]).then(r=>r.rows[0].v);
    const claim=(token:string,id=discovery)=>db.query<{v:Record<string,unknown>}>('select claim_v22_first_service_discovery_run($1,$2,$3) v',[f.job,id,token]).then(r=>r.rows[0].v);
    const pulse=(token:string,release=false)=>db.query<{v:boolean}>(`select ${release?'release':'heartbeat'}_v22_first_service_discovery($1,$2) v`,[f.job,token]).then(r=>r.rows[0].v);
    const token=randomUUID(), next=randomUUID();
    expect((await db.query<{workflow_id:string}>('select * from list_v22_first_service_discovery_work(100)')).rows.some(r=>r.workflow_id===f.job)).toBe(true);
    const first=await dispatch();expect(first).toMatchObject({outcome:'dispatch',attempts:0,workflow_id:f.job,discovery_job_id:discovery});
    expect(await dispatch()).toMatchObject({outcome:'observe',dispatch_token:first.dispatch_token});
    expect(await claim(token,randomUUID())).toEqual({outcome:'closed'});
    expect(await claim(token)).toMatchObject({outcome:'claimed',attempts:1});
    expect(await claim(next)).toEqual({outcome:'busy'});expect(await pulse(next)).toBe(false);expect(await pulse(token)).toBe(true);
    await db.query("update capability_first_service_discovery_runs set lease_until=now()-interval '1 second' where workflow_id=$1",[f.job]);
    expect(await pulse(token)).toBe(false);expect(await claim(next)).toMatchObject({attempts:2});
    expect(await pulse(token,true)).toBe(false);expect(await pulse(next,true)).toBe(true);
    expect(await claim(token)).toMatchObject({attempts:3});await pulse(token,true);
    expect(await claim(next)).toEqual({outcome:'exhausted'});expect(await f.balance()).toBe(4);
    await db.query("update capability_first_service_discoveries set created_at=now()-interval '21 minutes',deadline_at=now()-interval '1 minute' where workflow_id=$1",[f.job]);
    await db.query('select * from expire_v22_first_service_discoveries(100)');await db.query('select * from expire_v22_first_service_discoveries(100)');
    expect(await f.balance()).toBe(5);expect(await dispatch()).toEqual({outcome:'closed'});expect(await claim(token)).toEqual({outcome:'closed'});
  });

  it('revalidates discovery source authority and denies browser access to dispatch/run RPCs',async()=>{
    const f=await fixture(undefined,false);await f.reserve();
    const token=randomUUID(),discovery=f.collection.competitor_discovery.discovery_id;
    const calls:[string,unknown[]][]=[['list_v22_first_service_discovery_work(25)',[]],
      ['claim_v22_first_service_discovery_dispatch($1,$2)',[f.job,token]],
      ['claim_v22_first_service_discovery_run($1,$2,$3)',[f.job,discovery,token]],
      ['heartbeat_v22_first_service_discovery($1,$2)',[f.job,token]],
      ['release_v22_first_service_discovery($1,$2)',[f.job,token]]];
    for(const role of ['anon','authenticated'])for(const [rpc,args]of calls)
      await expect(db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query(`select ${rpc}`,args);})).rejects.toThrow(/permission denied/);
    await db.transaction(async tx=>{await tx.exec('set local role service_role');await tx.query(`select ${calls[1][0]}`,calls[1][1]);});
    await expect(db.transaction(async tx=>{await tx.exec('set local role service_role');await tx.query('delete from capability_first_service_discovery_runs where workflow_id=$1',[f.job]);})).rejects.toThrow(/permission denied/);
    await db.query("update google_connections set granted_scopes='{}' where id=$1",[f.connection]);
    await expect(db.query(`select ${calls[2][0]}`,calls[2][1])).rejects.toThrow(/FIRST_SERVICE_/);
    expect((await db.query<{attempts:number}>('select attempts from capability_first_service_discovery_runs where workflow_id=$1',[f.job])).rows[0].attempts).toBe(0);
    expect(await f.balance()).toBe(4);
  });

  it('stops discovery execution after a saved result and does not time out human confirmation',async()=>{
    const f=await fixture(undefined,false);await f.reserve();
    const token=randomUUID(),discovery=f.collection.competitor_discovery.discovery_id;
    await db.query('select claim_v22_first_service_discovery_dispatch($1,$2)',[f.job,randomUUID()]);
    await db.query('select claim_v22_first_service_discovery_run($1,$2,$3)',[f.job,discovery,token]);
    await f.discovered();
    expect((await db.query<{v:boolean}>('select heartbeat_v22_first_service_discovery($1,$2) v',[f.job,token])).rows[0].v).toBe(false);
    expect((await db.query<{v:unknown}>('select claim_v22_first_service_discovery_run($1,$2,$3) v',[f.job,discovery,randomUUID()])).rows[0].v).toEqual({outcome:'closed'});
    expect((await db.query<{workflow_id:string}>('select * from list_v22_first_service_discovery_work(100)')).rows.some(r=>r.workflow_id===f.job)).toBe(false);
    await db.query("update capability_first_service_discoveries set created_at=now()-interval '21 minutes',deadline_at=now()-interval '1 minute' where workflow_id=$1",[f.job]);
    await db.query('select * from expire_v22_first_service_discoveries(100)');
    expect(await f.balance()).toBe(4);
  });
  beforeAll(async()=>{db=new PGlite();await db.exec("create role anon;create role authenticated;create role service_role bypassrls;");
    for(const name of (await readdir("supabase/migrations")).sort())await db.exec(await readFile(`supabase/migrations/${name}`,"utf8"));},30000);
  afterAll(async()=>{await db.close();});

  it('reserves a service discovery before there is any business version, analysis job or Prospect report',async()=>{
    const f=await fixture(undefined,false);const receipt=await f.reserve();
    expect(receipt).toMatchObject({schema_version:'v22_first_service_discovery_v1',workflow_id:f.job,charge_state:'reserved',
      awaiting_confirmation:false,analysis_job_id:null,idempotent:false,credit_balance:4});
    expect(await f.reserve()).toEqual({...receipt,idempotent:true});
    for(const table of ['case_business_scope_versions','analysis_jobs','reports'])
      expect((await db.query(`select * from ${table} where case_id=$1`,[f.caseId])).rows).toHaveLength(0);
    expect((await db.query('select kind,delta,analysis_job_id from credit_ledger where workflow_charge_id=$1',[f.job])).rows)
      .toEqual([{kind:'verified_debit',delta:-1,analysis_job_id:null}]);
    await f.discovered();await f.saveBusiness();
    expect(await f.start()).toMatchObject({status:'queued',idempotent:false,credit_balance:4});
    expect(await f.start()).toMatchObject({idempotent:true,credit_balance:4});
    expect(await f.reserve()).toMatchObject({analysis_job_id:f.job,awaiting_confirmation:false,credit_balance:4});
  });

  it('keeps the one discovery debit through collection and a completed zero-action diagnosis',async()=>{
    const f=await fixture();await f.reserve();await f.discovered();await f.start();await f.begin();
    const token=randomUUID();await f.claim(token);await f.prepare(false,token);await f.complete();await f.complete();
    expect(await f.balance()).toBe(4);
    expect((await db.query('select kind,delta from credit_ledger where workflow_charge_id=$1',[f.job])).rows)
      .toEqual([{kind:'verified_debit',delta:-1}]);
    expect((await db.query('select state,final_capability_report_id from workflow_charges where id=$1',[f.job])).rows)
      .toEqual([{state:'consumed',final_capability_report_id:f.job}]);
    expect((await db.query('select * from reports where case_id=$1',[f.caseId])).rows).toHaveLength(0);
    await expect(f.failDiscovery()).rejects.toThrow('FIRST_SERVICE_DISCOVERY_NOT_REFUNDABLE');
  });

  it.each(['expired','unhealthy','wrong resource','future','missing coverage'])('does not debit discovery with %s private evidence',async state=>{
    const f=await fixture(state);await expect(f.reserve()).rejects.toThrow('FIRST_SERVICE_SNAPSHOT_INVALID');
    expect(await f.balance()).toBe(5);
    expect((await db.query('select * from workflow_charges where case_id=$1',[f.caseId])).rows).toHaveLength(0);
  });

  it('rejects insufficient balance and unauthorized or changed discovery inputs without side effects',async()=>{
    const f=await fixture(),other=await fixture();
    const wrongOwner=[...f.reserveArgs];wrongOwner[0]=other.owner;
    await expect(f.reserve(wrongOwner)).rejects.toThrow('FIRST_SERVICE_CASE_NOT_FOUND');
    for(const body of [{...f.discoveryRequest,primary_service:'another service'},
      {...f.discoveryRequest,target_market:{display_name:'elsewhere'}},
      {...f.discoveryRequest,business_identity:{...f.identity,business_name:'Someone else'}}]){
      const args=[...f.reserveArgs];args[5]=json(body);await expect(f.reserve(args)).rejects.toThrow('FIRST_SERVICE_BUSINESS_NOT_READY');
    }
    for(const patch of [{queries:['x','X','z']},{queries:['one']},{report_type:'prospect'},
      {supplemental_website_urls:['https://other.invalid/']}]){
      const args=[...f.reserveArgs];args[5]=json({...f.discoveryRequest,...patch});
      await expect(f.reserve(args)).rejects.toThrow('FIRST_SERVICE_DISCOVERY_INVALID');
    }
    await db.query('update users set credit_balance=0 where id=$1',[f.owner]);
    await expect(f.reserve()).rejects.toThrow('INSUFFICIENT_CREDITS');
    expect((await db.query('select * from workflow_charges where case_id=$1',[f.caseId])).rows).toHaveLength(0);
  });

  it('rejects identity/key/request reuse conflicts and parallel legacy or first-service reservations',async()=>{
    const f=await fixture();await f.reserve();
    for(const index of [2,3,4,6,7]){const args=[...f.reserveArgs];args[index]=randomUUID();
      await expect(f.reserve(args)).rejects.toThrow('FIRST_SERVICE_DISCOVERY_CONFLICT');}
    const changed=[...f.reserveArgs];changed[5]=json({...f.discoveryRequest,queries:['one','two','three']});
    await expect(f.reserve(changed)).rejects.toThrow('FIRST_SERVICE_DISCOVERY_CONFLICT');
    const parallel=[...f.reserveArgs];parallel[2]=randomUUID();parallel[3]=randomUUID();parallel[4]=randomUUID();
    await expect(f.reserve(parallel)).rejects.toThrow('FIRST_SERVICE_WORKFLOW_EXISTS');
    await expect(db.query('select * from reserve_v22_prospect_workflow($1,$2,$3,$4,$5)',[
      f.owner,f.caseId,randomUUID(),randomUUID(),randomUUID()])).rejects.toThrow('FIRST_SERVICE_WORKFLOW_EXISTS');
    const start=[...f.args];start[2]=randomUUID();start[3]=randomUUID();
    await expect(f.start(start)).rejects.toThrow('FIRST_SERVICE_WORKFLOW_EXISTS');
    expect(await f.balance()).toBe(4);
  });

  it('requires a ready unexpired result, selected candidates and unchanged identity before binding',async()=>{
    const f=await fixture();await f.reserve();await expect(f.start()).rejects.toThrow('FIRST_SERVICE_DISCOVERY_NOT_READY');
    await f.discovered({...f.discoveryResult,candidates:[{website_url:'https://another.invalid/'}]});
    await expect(f.start()).rejects.toThrow('FIRST_SERVICE_DISCOVERY_SELECTION_INVALID');
    const empty=await fixture();await empty.reserve();await empty.discovered({...empty.discoveryResult,candidates:[],ready_for_confirmation:false});
    expect(await empty.reserve()).toMatchObject({phase:'needs_competitors',awaiting_confirmation:false,analysis_job_id:null});
    await expect(empty.start()).rejects.toThrow('FIRST_SERVICE_DISCOVERY_NOT_READY');
    const changed=await fixture();await changed.reserve();await changed.discovered();
    await db.query("update client_cases set primary_service='changed' where id=$1",[changed.caseId]);
    await expect(changed.start()).rejects.toThrow('FIRST_SERVICE_DISCOVERY_NOT_READY');
    const expired=await fixture();await expired.reserve();await expired.discovered();
    await db.query("update capability_first_service_discoveries set result=jsonb_set(result,'{expires_at}',to_jsonb((now()-interval '1 minute')::text)) where workflow_id=$1",[expired.job]);
    await expect(expired.start()).rejects.toThrow('FIRST_SERVICE_DISCOVERY_NOT_READY');
    for(const x of [f,empty,changed,expired])expect(await x.balance()).toBe(4);
  });

  it('rechecks private authorization at handoff and rolls back without another debit or lost reservation',async()=>{
    const f=await fixture();await f.reserve();await f.discovered();
    await db.query("update google_connections set granted_scopes='{}' where id=$1",[f.connection]);
    await expect(f.start()).rejects.toThrow('FIRST_SERVICE_AUTHORIZATION_INVALID');
    expect((await db.query('select analysis_job_id,state from workflow_charges where id=$1',[f.job])).rows)
      .toEqual([{analysis_job_id:null,state:'reserved'}]);
    expect((await db.query('select * from analysis_jobs where id=$1',[f.job])).rows).toHaveLength(0);
    expect(await f.balance()).toBe(4);
  });

  it('binds collection to the saved discovery and queries rather than a different valid-looking result',async()=>{
    const f=await fixture();await f.reserve();await f.discovered();await f.start();
    for(const key of ['discovery_id','market_snapshot_id','candidate_digest','market_snapshot_checksum'] as const){
      const changed=structuredClone(f.collection);Object.assign(changed.competitor_discovery,{[key]:key.endsWith('id')?randomUUID():'sha256:'+'9'.repeat(64)});
      await expect(f.begin(changed)).rejects.toThrow('FIRST_SERVICE_COLLECTION_DISCOVERY_CONFLICT');
    }
    const changed=structuredClone(f.collection);changed.collection_request.queries=['one','two','three'];
    await expect(f.begin(changed)).rejects.toThrow('FIRST_SERVICE_COLLECTION_DISCOVERY_CONFLICT');
    await f.begin();expect(await f.balance()).toBe(4);
  });

  it('persists discovery success idempotently and rejects stale, mismatched or malformed results',async()=>{
    const f=await fixture();await f.reserve();
    for(const patch of [{case_id:randomUUID()},{discovery_id:randomUUID()},{candidate_digest:'x'},
      {expires_at:new Date(Date.now()-1000).toISOString()},{candidates:[]},{candidates:[{website_url:'not-a-url'}]}]){
      await expect(f.discovered({...f.discoveryResult,...patch})).rejects.toThrow('FIRST_SERVICE_DISCOVERY_RESULT_INVALID');
    }
    await f.discovered();await f.discovered();
    await expect(f.discovered({...f.discoveryResult,input_digest:'sha256:'+'9'.repeat(64)})).rejects.toThrow('FIRST_SERVICE_DISCOVERY_CONFLICT');
    expect(await f.reserve()).toMatchObject({awaiting_confirmation:true,credit_balance:4});
  });

  it('refunds an established technical failure once and fences its late success and later start',async()=>{
    const f=await fixture();await f.reserve();
    await expect(db.query('select fail_v22_first_service_discovery($1,$2,$3,$4,$5)',[
      f.owner,f.caseId,f.job,randomUUID(),'DISCOVERY_FAILED'])).rejects.toThrow('FIRST_SERVICE_DISCOVERY_UNAVAILABLE');
    await expect(f.failDiscovery('USER_IDLE')).rejects.toThrow('FIRST_SERVICE_DISCOVERY_FAILURE_INVALID');
    await expect(f.failDiscovery('DISCOVERY_DEADLINE_EXCEEDED')).rejects.toThrow('FIRST_SERVICE_DISCOVERY_NOT_EXPIRED');
    expect(await f.failDiscovery()).toBe(true);expect(await f.failDiscovery()).toBe(false);
    await expect(f.discovered()).rejects.toThrow('FIRST_SERVICE_DISCOVERY_CLOSED');
    await expect(f.start()).rejects.toThrow('FIRST_SERVICE_DISCOVERY_NOT_READY');
    expect(await f.reserve()).toMatchObject({charge_state:'compensated',credit_balance:5,idempotent:true});
    expect((await db.query('select kind from credit_ledger where workflow_charge_id=$1 order by delta',[f.job])).rows)
      .toEqual([{kind:'verified_debit'},{kind:'technical_failure_credit'}]);
  });

  it('expires only technical preparation, never user waiting, and starts the analysis clock at confirmation',async()=>{
    const pending=await fixture(),waiting=await fixture();await pending.reserve();await waiting.reserve();await waiting.discovered();
    await db.query("update capability_first_service_discoveries set created_at=now()-interval '1 hour',deadline_at=now()-interval '30 minutes' where workflow_id=any($1)",[[pending.job,waiting.job]]);
    expect((await db.query<{workflow_id:string}>('select * from expire_v22_first_service_discoveries(100)')).rows.map(r=>r.workflow_id)).toContain(pending.job);
    expect((await db.query('select * from expire_v22_first_service_discoveries(100)')).rows).toHaveLength(0);
    expect(await pending.balance()).toBe(5);expect(await waiting.balance()).toBe(4);
    await expect(waiting.failDiscovery()).rejects.toThrow('FIRST_SERVICE_DISCOVERY_NOT_REFUNDABLE');
    const receipt=await waiting.start();expect(Date.parse(receipt.deadline_at as string)-Date.now()).toBeGreaterThan(19*60000);
    await expect(waiting.failDiscovery()).rejects.toThrow('FIRST_SERVICE_DISCOVERY_NOT_REFUNDABLE');
    await db.query("update analysis_jobs set created_at=now()-interval '1 hour',deadline_at=now()-interval '1 second' where id=$1",[waiting.job]);
    await db.query('select * from expire_v22_prepared_capability_jobs(100)');
    expect(await waiting.balance()).toBe(5);expect(await waiting.failDiscovery()).toBe(false);
    expect((await db.query("select * from credit_ledger where workflow_charge_id=$1 and kind='technical_failure_credit'",[waiting.job])).rows).toHaveLength(1);
  });

  it('does not grant discovery mutation or RPC execution to browser roles',async()=>{
    for(const role of ['anon','authenticated']){
      for(const signature of ['reserve_v22_first_service_discovery(uuid,uuid,uuid,uuid,text,jsonb,uuid,uuid)',
        'record_v22_first_service_discovery(uuid,uuid,uuid,jsonb)','fail_v22_first_service_discovery(uuid,uuid,uuid,uuid,text)',
        'expire_v22_first_service_discoveries(integer)'])
        expect((await db.query<{allowed:boolean}>("select has_function_privilege($1,$2,'EXECUTE') allowed",[role,signature])).rows[0].allowed).toBe(false);
      expect((await db.query<{allowed:boolean}>("select has_table_privilege($1,'capability_first_service_discoveries','SELECT,INSERT,UPDATE,DELETE') allowed",[role])).rows[0].allowed).toBe(false);
    }
    expect((await db.query<{allowed:boolean}>("select has_table_privilege('service_role','capability_first_service_discoveries','INSERT,UPDATE,DELETE') allowed")).rows[0].allowed).toBe(false);
  });

  it('can bind the prepaid workflow at zero remaining balance and refresh private evidence before enrollment',async()=>{
    const f=await fixture();await f.reserve();await f.discovered();
    await db.query('update users set credit_balance=0 where id=$1',[f.owner]);
    const fresh=randomUUID();
    await db.query(`insert into data_snapshots(id,case_id,binding_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context)
      select $1,case_id,binding_id,source_type,schema_version,now(),expires_at,sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context from data_snapshots where id=$2`,[fresh,f.m.snapshots[4].snapshot_id]);
    await expect(f.start()).rejects.toThrow('FIRST_SERVICE_SNAPSHOT_NOT_CURRENT');
    const args=[...f.args];args[5]=fresh;
    expect(await f.start(args)).toMatchObject({gsc_snapshot_id:fresh,credit_balance:0});
    expect(await f.start(args)).toMatchObject({idempotent:true,credit_balance:0});
    expect((await db.query('select count(*)::int total from credit_ledger where workflow_charge_id=$1',[f.job])).rows).toEqual([{total:1}]);
  });

  it('executes the discovery and binding boundaries as service_role while keeping helpers private',async()=>{
    const f=await fixture();
    await db.transaction(async tx=>{
      await tx.exec('set local role service_role');
      await tx.query('select reserve_v22_first_service_discovery($1,$2,$3,$4,$5,$6,$7,$8)',f.reserveArgs);
      await tx.query('select record_v22_first_service_discovery($1,$2,$3,$4)',[f.owner,f.caseId,f.job,json(f.discoveryResult)]);
      await tx.query('select start_v22_first_service_preparation($1,$2,$3,$4,$5,$6,$7)',f.args);
    });
    expect(await f.balance()).toBe(4);
    expect((await db.query<{allowed:boolean}>("select has_function_privilege('service_role','check_v22_first_service_discovery_binding(uuid,uuid,uuid,text,uuid)','EXECUTE') allowed")).rows[0].allowed).toBe(false);
  });

  it('rolls back the account change if a discovery identity already belongs to another workflow',async()=>{
    const first=await fixture(),second=await fixture();await first.reserve();
    const args=[...second.reserveArgs];args[3]=first.reserveArgs[3];
    await expect(second.reserve(args)).rejects.toThrow(/unique constraint/);
    expect(await second.balance()).toBe(5);
    expect((await db.query('select * from workflow_charges where case_id=$1',[second.caseId])).rows).toHaveLength(0);
    expect((await db.query("select * from credit_ledger where case_id=$1 and kind='verified_debit'",[second.caseId])).rows).toHaveLength(0);
    expect(await first.balance()).toBe(4);
  });

  it('freezes collection intent and the originally selected private snapshots without another debit',async()=>{
    const f=await fixture();await f.start();const receipt=await f.begin();expect(await f.begin()).toEqual(receipt);
    expect(receipt).toMatchObject({schema_version:'v22_first_service_collection_preparation_v1',job_id:f.job,dispatch:null,
      snapshots:[{snapshot_id:f.m.snapshots[4].snapshot_id},{snapshot_id:f.m.snapshots[5].snapshot_id}]});
    expect(await f.balance()).toBe(4);
    const changed=structuredClone(f.collection);changed.collection_request.queries[0]='changed';
    await expect(f.begin(changed)).rejects.toThrow('FIRST_SERVICE_COLLECTION_CONFLICT');
    expect((await db.query('select * from workflow_charges where case_id=$1',[f.caseId])).rows).toHaveLength(1);
  });

  it('requires enrollment, correct owner and matching scope before reading private sources',async()=>{
    const f=await fixture(),other=await fixture();await expect(f.begin()).rejects.toThrow('FIRST_SERVICE_PREPARATION_UNAVAILABLE');
    await f.start();
    await expect(db.query('select begin_v22_first_service_collection($1,$2,$3,$4,$5,$6)',[
      other.owner,f.caseId,f.job,f.job,f.m.business.id,canonicalJsonText(f.collection)])).rejects.toThrow('FIRST_SERVICE_PREPARATION_UNAVAILABLE');
    for(const key of ['primary_service','case_id'] as const){const changed=structuredClone(f.collection);changed.collection_request[key]=randomUUID();
      await expect(f.begin(changed)).rejects.toThrow('FIRST_SERVICE_COLLECTION_INVALID');}
    const changed=structuredClone(f.collection);changed.collection_request.competitors[0].website_url='https://other.invalid/';
    await expect(f.begin(changed)).rejects.toThrow('FIRST_SERVICE_COLLECTION_INVALID');
    await expect(db.query('select begin_v22_first_service_collection($1,$2,$3,$4,$5,$6)',[
      f.owner,f.caseId,f.job,f.job,f.m.business.id,canonicalJsonText({...f.collection,collection_request:{...f.collection.collection_request,parent_report:{}}})])).rejects.toThrow('FIRST_SERVICE_COLLECTION_INVALID');
  });

  it('rechecks authorization before claim, rolls failed claims back, and never substitutes newer snapshots',async()=>{
    const f=await fixture();await f.start();await f.begin();
    await db.query(`insert into data_snapshots(id,case_id,binding_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context)
      select $1,case_id,binding_id,source_type,schema_version,now(),expires_at,sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context from data_snapshots where id=$2`,[randomUUID(),f.m.snapshots[4].snapshot_id]);
    expect((await f.begin()).snapshots).toEqual(expect.arrayContaining([expect.objectContaining({snapshot_id:f.m.snapshots[4].snapshot_id})]));
    await db.query("update google_connections set granted_scopes='{}' where id=$1",[f.connection]);
    await expect(f.claim()).rejects.toThrow('FIRST_SERVICE_AUTHORIZATION_INVALID');
    expect((await db.query('select attempt_count from analysis_jobs where id=$1',[f.job])).rows).toEqual([{attempt_count:0}]);
    expect((await db.query('select * from capability_first_service_runs where job_id=$1',[f.job])).rows).toHaveLength(0);
  });

  it('leases collection, fences stale workers, freezes atomically, and recovers ready dispatch',async()=>{
    const f=await fixture();await f.start();await f.begin();const token=randomUUID();
    await expect(f.prepare()).rejects.toThrow('CAPABILITY_PREPARATION_LEASE_LOST');
    expect((await f.claim(token)).outcome).toBe('claimed');expect(await f.claim()).toEqual({outcome:'busy'});
    expect(await f.pulse(randomUUID())).toBe(false);expect(await f.pulse(token)).toBe(true);
    await expect(f.prepare(false,randomUUID())).rejects.toThrow('CAPABILITY_PREPARATION_LEASE_LOST');
    expect((await db.query('select * from analysis_input_manifests where job_id=$1',[f.job])).rows).toHaveLength(0);
    await f.prepare(false,token);
    const ready=await f.claim();expect(ready.outcome).toBe('ready');
    expect(ready.preparation).toMatchObject({job_id:f.job,snapshots:[],dispatch:{request:{capability_request:{report_type:'verified_execution'}}}});
    expect((await db.query<{job_id:string}>('select * from list_v22_first_service_preparation_work(25,3)')).rows.some(r=>r.job_id===f.job)).toBe(true);
    expect(await f.pulse(token)).toBe(false);expect(await f.balance()).toBe(4);
    await f.complete();await db.query("update google_connections set granted_scopes='{}' where id=$1",[f.connection]);
    expect((await db.query<{job_id:string}>('select * from list_v22_first_service_preparation_work(25,3)')).rows.some(r=>r.job_id===f.job)).toBe(false);
    expect((await f.claim()).outcome).toBe('ready');expect((await f.begin()).snapshots).toEqual([]);
    expect((await db.query('select * from reports where case_id=$1',[f.caseId])).rows).toHaveLength(0);
  });

  it('takes over an expired lease without accepting the previous token or resetting the deadline',async()=>{
    const f=await fixture();const receipt=await f.start();await f.begin();const old=randomUUID(),next=randomUUID();await f.claim(old);
    await db.query("update capability_first_service_runs set lease_until=now()-interval '1 second' where job_id=$1",[f.job]);
    expect((await f.claim(next)).attempt_count).toBe(2);expect(await f.pulse(old)).toBe(false);
    await expect(f.prepare(false,old)).rejects.toThrow('CAPABILITY_PREPARATION_LEASE_LOST');
    expect((await f.begin()).deadline_at).toBe(receipt.deadline_at);await f.prepare(false,next);
  });

  it('rejects wrong generations and exhausted attempt budgets',async()=>{
    const f=await fixture();await f.start();await f.begin();expect(await f.claim(randomUUID(),2)).toEqual({outcome:'inactive'});
    await f.claim();await db.query("update capability_first_service_runs set lease_until=now()-interval '1 second' where job_id=$1",[f.job]);
    expect(await f.claim(randomUUID(),1,1)).toEqual({outcome:'inactive'});
  });

  it('rejects a changed query recipe and rolls back the frozen manifest',async()=>{
    const f=await fixture();await f.start();await f.begin();const token=randomUUID();await f.claim(token);
    f.collection.collection_request.queries[0]='different intent';
    await expect(f.prepare(false,token)).rejects.toThrow('FIRST_SERVICE_COLLECTION_CONFLICT');
    expect((await db.query('select * from analysis_input_manifests where job_id=$1',[f.job])).rows).toHaveLength(0);
    expect(await f.balance()).toBe(4);
  });

  it('expires claimed collection once and prevents late source freezing',async()=>{
    const f=await fixture();await f.start();await f.begin();const token=randomUUID();await f.claim(token);
    await db.query("update analysis_jobs set created_at=now()-interval '21 minutes',deadline_at=now()-interval '1 minute' where id=$1",[f.job]);
    expect(await f.pulse(token)).toBe(false);expect(await f.claim()).toEqual({outcome:'inactive'});
    await db.query('select * from expire_v22_prepared_capability_jobs(100)');await db.query('select * from expire_v22_prepared_capability_jobs(100)');
    expect(await f.balance()).toBe(5);
    await expect(f.prepare(false,token)).rejects.toThrow('CAPABILITY_PREPARATION_LEASE_LOST');
    expect((await db.query("select delta from credit_ledger where case_id=$1 and delta=1",[f.caseId])).rows).toHaveLength(1);
  });

  it('does not allow browser roles to register, claim or read first-service sources',async()=>{
    const f=await fixture();await f.start();await f.begin();
    for(const role of ['anon','authenticated']){
      await expect(db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query('select * from capability_first_service_collections');})).rejects.toThrow(/permission denied/);
      await expect(db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query('select claim_v22_first_service_preparation($1,1,$2,3)',[f.job,randomUUID()]);})).rejects.toThrow(/permission denied/);
    }
    await expect(db.query("update capability_first_service_collections set request='{}' where job_id=$1",[f.job])).rejects.toThrow();
  });

  it("starts without a Prospect, reserves one unified credit and replays without changing the deadline",async()=>{
    const f=await fixture();const results=await Promise.all([f.start(),f.start()]);
    expect(results.map(r=>r.idempotent)).toEqual([false,true]);expect(results[0].deadline_at).toEqual(results[1].deadline_at);
    expect(results[0]).toMatchObject({mode:'first_service',credit_balance:4,status:'queued'});expect(await f.balance()).toBe(4);
    expect((await db.query("select * from reports where case_id=$1",[f.caseId])).rows).toHaveLength(0);
    expect((await db.query("select * from verified_analysis_inputs where case_id=$1",[f.caseId])).rows).toHaveLength(0);
    expect((await db.query("select * from analysis_attempt_charges where case_id=$1",[f.caseId])).rows).toHaveLength(0);
    expect((await db.query("select kind,delta from credit_ledger where case_id=$1",[f.caseId])).rows).toEqual([{kind:'verified_debit',delta:-1}]);
    await db.query("update google_connections set granted_scopes='{}' where id=$1",[f.connection]);
    expect((await f.start()).idempotent).toBe(true); // Recovery, not renewed execution authority.
    await expect(f.freeze()).rejects.toThrow(/AUTHORIZATION/);
  });

  it.each([
    ['missing scopes',"update google_connections set granted_scopes=array['openid','email','profile'] where id=$1",'connection'],
    ['revoked authorization',"update google_connections set status='reauth_required',access_token_ciphertext=null,access_token_iv=null,access_token_auth_tag=null,refresh_token_ciphertext=null,refresh_token_iv=null,refresh_token_auth_tag=null,encryption_key_version=null,token_expires_at=null where id=$1",'connection'],
    ['unconfirmed binding',"update case_source_bindings set confirmed_at=null,confirmed_by_user_id=null where case_id=$1",'caseId'],
    ['mismatch',"update case_source_bindings set identity_match_status='mismatch' where case_id=$1",'caseId'],
    ['missing profile',"update client_cases set business_identity='{}' where id=$1",'caseId'],
  ] as const)("rejects %s before spending",async(_label,sql,id)=>{
    const f=await fixture();await db.query(sql,[f[id]]);await expect(f.start()).rejects.toThrow(/FIRST_SERVICE/);
    expect(await f.balance()).toBe(5);expect((await db.query("select * from analysis_jobs where case_id=$1",[f.caseId])).rows).toHaveLength(0);
  });

  it.each(['unhealthy','expired','future','missing coverage','wrong resource'])('rejects %s snapshots before spending',async state=>{
    const f=await fixture(state);await expect(f.start()).rejects.toThrow('FIRST_SERVICE_SNAPSHOT_INVALID');expect(await f.balance()).toBe(5);
  });

  it('rejects a different user as resource confirmer',async()=>{
    const f=await fixture(),other=await fixture();
    await expect(db.query('update case_source_bindings set confirmed_by_user_id=$2 where case_id=$1',[f.caseId,other.owner])).rejects.toThrow('binding confirmer must be the case owner');
    expect(await f.balance()).toBe(5);
  });

  it("does not fall back to an older healthy snapshot",async()=>{
    const f=await fixture(), s=f.m.snapshots[4];
    await db.query(`insert into data_snapshots(id,case_id,binding_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum)
      select $1,case_id,binding_id,source_type,schema_version,now(),expires_at,sync_trigger,'unhealthy',normalized_payload,payload_checksum from data_snapshots where id=$2`,[randomUUID(),s.snapshot_id]);
    await expect(f.start()).rejects.toThrow('FIRST_SERVICE_SNAPSHOT_NOT_CURRENT');expect(await f.balance()).toBe(5);
  });

  it("rejects foreign snapshots and owners, stale scope and insufficient balance",async()=>{
    const f=await fixture(), other=await fixture();
    await expect(f.start([other.owner,...f.args.slice(1)])).rejects.toThrow('FIRST_SERVICE_CASE_NOT_FOUND');
    const wrong=[...f.args];wrong[5]=other.m.snapshots[4].snapshot_id;await expect(f.start(wrong)).rejects.toThrow(/FIRST_SERVICE/);
    const scope={...f.m.business,id:randomUUID(),revision:2};await db.query("select save_v22_business_scope($1,$2,1,$3)",[f.owner,f.caseId,json(scope)]);
    await expect(f.start()).rejects.toThrow('FIRST_SERVICE_BUSINESS_NOT_READY');
    const current=[...f.args];current[4]=scope.id;await db.query("update users set credit_balance=0 where id=$1",[f.owner]);
    await expect(f.start(current)).rejects.toThrow('INSUFFICIENT_CREDITS');expect((await db.query("select * from workflow_charges where case_id=$1",[f.caseId])).rows).toHaveLength(0);
  });

  it("rejects changed replay inputs and a second active workflow",async()=>{
    const f=await fixture();await f.start();const changed=[...f.args];changed[5]=randomUUID();
    await expect(f.start(changed)).rejects.toThrow('FIRST_SERVICE_CONFLICT');
    const duplicate=[...f.args];duplicate[2]=duplicate[3]=randomUUID();
    await expect(f.start(duplicate)).rejects.toThrow('FIRST_SERVICE_WORKFLOW_EXISTS');expect(await f.balance()).toBe(4);
  });

  it('does not add a parallel Prospect charge in either direction',async()=>{
    const f=await fixture(), g=await fixture();
    const reserve=(item:typeof f)=>db.query('select * from reserve_v22_prospect_workflow($1,$2,$3,$4,$5)',[item.owner,item.caseId,randomUUID(),randomUUID(),randomUUID()]);
    await f.start();await expect(reserve(f)).rejects.toThrow('FIRST_SERVICE_WORKFLOW_EXISTS');expect(await f.balance()).toBe(4);
    await reserve(g);await expect(g.start()).rejects.toThrow('FIRST_SERVICE_WORKFLOW_EXISTS');expect(await g.balance()).toBe(4);
  });

  it("rolls the debit and task back when enrollment persistence fails",async()=>{
    const f=await fixture();await db.exec(`create function test_fail_service_insert() returns trigger language plpgsql as $$begin raise exception 'TEST_ENROLLMENT_FAILURE';end;$$;
      create trigger test_fail_service_insert before insert on capability_first_service_preparations for each row execute function test_fail_service_insert();`);
    try {await expect(f.start()).rejects.toThrow('TEST_ENROLLMENT_FAILURE');}finally{await db.exec("drop trigger test_fail_service_insert on capability_first_service_preparations;drop function test_fail_service_insert();");}
    expect(await f.balance()).toBe(5);expect((await db.query("select * from analysis_jobs where id=$1",[f.job])).rows).toHaveLength(0);
    expect((await f.start()).idempotent).toBe(false);expect(await f.balance()).toBe(4);
  });

  it("pins private inputs and refuses later source or Case identity substitution",async()=>{
    const f=await fixture();await f.start();
    const replacement=randomUUID();
    await db.query(`insert into data_snapshots(id,case_id,binding_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context)
      select $1,case_id,binding_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context from data_snapshots where id=$2`,[replacement,f.m.snapshots[4].snapshot_id]);
    const m=structuredClone(f.m);m.snapshots[4].snapshot_id=replacement;
    m.input_checksum=canonicalDigest(Object.fromEntries(Object.entries(m).filter(([key])=>key!=="input_checksum")));
    await expect(f.freeze(m)).rejects.toThrow('FIRST_SERVICE_PREPARATION_CONFLICT');
    await db.query("update client_cases set business_identity='{}' where id=$1",[f.caseId]);
    // The existing Case-identity trigger already invalidates the Google binding.
    await expect(f.freeze()).rejects.toThrow('CAPABILITY_AUTHORIZATION_INVALID');
  });

  it("consumes one point for zero-action first diagnosis, without fictitious history or late refund",async()=>{
    const f=await fixture();
    await db.transaction(async tx=>{await tx.exec('set local role service_role');await tx.query('select start_v22_first_service_preparation($1,$2,$3,$4,$5,$6,$7)',f.args);});
    await f.prepare();
    const dispatch=(await db.query<{value:{request:{capability_request:{report_type:string}}}}>('select get_v22_capability_dispatch($1,$2,$3,$4) value',[f.owner,f.caseId,f.job,f.job])).rows[0].value;
    expect(dispatch.request.capability_request.report_type).toBe('verified_execution');
    await f.complete();await f.complete();
    expect((await f.start()).status).toBe('succeeded');expect(await f.balance()).toBe(4);
    expect((await db.query<{payload:typeof sample}>("select payload from get_v22_completed_capability_report($1,$2,$3)",[f.owner,f.caseId,f.job])).rows[0].payload).toMatchObject({actions:[],changes:[],version:1,input_manifest:{mode:'first_service',previous_report:null}});
    await expect(db.query("update workflow_charges set state='compensated',settled_at=now(),final_capability_report_id=null where id=$1",[f.job])).rejects.toThrow();
    const again=[...f.args];again[2]=again[3]=randomUUID();await expect(f.start(again)).rejects.toThrow('FIRST_SERVICE_WORKFLOW_EXISTS');
  });

  it('rejects a collector recipe for another business and rolls its manifest back',async()=>{
    const f=await fixture();await f.start();await expect(f.prepare(true)).rejects.toThrow('FIRST_SERVICE_PREPARATION_CONFLICT');
    expect((await db.query('select * from analysis_input_manifests where job_id=$1',[f.job])).rows).toHaveLength(0);
    expect(await f.balance()).toBe(4);await f.prepare();
  });

  it('rejects zero competitors at scope confirmation, without creating a paid task',async()=>{
    const f=await fixture();const scope={...f.m.business,id:randomUUID(),revision:2,competitor_sites:[]};
    await expect(db.query('select save_v22_business_scope($1,$2,1,$3)',[f.owner,f.caseId,json(scope)])).rejects.toThrow('CAPABILITY_BUSINESS_INVALID');
    expect(await f.balance()).toBe(5);
  });

  it('rechecks permissions after freeze without revoking already completed delivery',async()=>{
    const f=await fixture();await f.start();await f.prepare();
    const resolve=()=>db.query('select resolve_v22_capability_analysis_input($1,$2,$3,$4,1)',[f.job,f.caseId,f.m.id,f.m.input_checksum]);
    await resolve();await db.query("update google_connections set granted_scopes='{}' where id=$1",[f.connection]);
    await expect(resolve()).rejects.toThrow('FIRST_SERVICE_AUTHORIZATION_INVALID');
    await expect(db.query('select get_v22_capability_dispatch($1,$2,$3,$4)',[f.owner,f.caseId,f.job,f.job])).rejects.toThrow('FIRST_SERVICE_AUTHORIZATION_INVALID');
    // An already generated result may have committed before authorization loss;
    // settlement remains separate from eligibility for new external work.
    await f.complete();await expect(resolve()).resolves.toBeDefined();expect(await f.balance()).toBe(4);
  });

  it("expires pre-manifest work and returns exactly one credit, preserving terminal replay",async()=>{
    const f=await fixture();await f.start();await db.query("update analysis_jobs set created_at=now()-interval '21 minutes',deadline_at=now()-interval '1 minute' where id=$1",[f.job]);
    await db.query("select * from expire_v22_prepared_capability_jobs(100)");await db.query("select * from expire_v22_prepared_capability_jobs(100)");
    expect(await f.balance()).toBe(5);expect((await f.start()).status).toBe('failed');
    expect((await db.query("select kind,delta from credit_ledger where case_id=$1 order by delta",[f.caseId])).rows).toEqual([{kind:'verified_debit',delta:-1},{kind:'technical_failure_credit',delta:1}]);
    const retry=[...f.args];retry[2]=retry[3]=randomUUID();expect((await f.start(retry)).idempotent).toBe(false);expect(await f.balance()).toBe(4);
  });

  it("denies anonymous/browser execution and direct service-role mutation",async()=>{
    const f=await fixture();
    for(const role of ['anon','authenticated'])await expect(db.transaction(async tx=>{await tx.exec(`set local role ${role}`);await tx.query("select start_v22_first_service_preparation($1,$2,$3,$4,$5,$6,$7)",f.args);})).rejects.toThrow(/permission denied/);
    await f.start();await expect(db.query("update capability_first_service_preparations set business_identity='{}' where job_id=$1",[f.job])).rejects.toThrow();
    await expect(db.transaction(async tx=>{await tx.exec('set local role service_role');await tx.query("delete from capability_first_service_preparations where job_id=$1",[f.job]);})).rejects.toThrow(/permission denied/);
  });
});
