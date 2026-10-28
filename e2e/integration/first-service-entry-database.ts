/** Isolated SQL + real entry repository/handler. No real auth or provider requests. */
import {randomUUID} from "node:crypto";
import {readdir,readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {createClient} from "@supabase/supabase-js";
import {NextRequest} from "next/server";
import {FirstServiceEntryRepository} from "../../src/lib/first-service-setup/entry-server";
import {createFirstServiceEntryHandlers} from "../../src/lib/first-service-setup/entry-handler";
import {canonicalDigest} from "../../src/lib/verified-analysis-v22/digest";
import {E2E_BUSINESS,E2E_MARKET,discoveryStatusFixture} from "../fixtures/preflight";
import {PlanningSettingsRepository} from "../../src/lib/planning-settings/repository";
import {createPlanningSettingsHandlers} from "../../src/lib/planning-settings/handler";
import type {PlanningSettings} from "../../src/lib/planning-settings/contracts";

export async function createFirstServiceEntryJourney(prepared?:{db:PGlite;owner:string;caseId:string;migrations:number;planning?:boolean}) {
  const db=prepared?.db??new PGlite(),owner=prepared?.owner??randomUUID(),caseId=prepared?.caseId??randomUUID(),connection=randomUUID();
  try {
    let migrationCount=prepared?.migrations??0;
    if(!prepared){
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    const migrations=(await readdir("supabase/migrations")).filter(n=>n.endsWith(".sql")).sort();
    for(const file of migrations)await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));
    migrationCount=migrations.length;
    await db.query("insert into users(id,clerk_user_id,email) values($1,$2,$3)",[owner,owner,`${owner}@example.invalid`]);
    await db.query("select register_v22_clerk_user($1,decode(repeat('01',32),'hex'),$2,null)",[owner,`${owner}@example.invalid`]);
    await db.query(`insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
      values($1,$2,$3,$4,$5,$6,'service_area','Emergency plumbing',$7)`,[caseId,owner,E2E_BUSINESS.site_url,E2E_BUSINESS.normalized_domain,E2E_BUSINESS.business_name,JSON.stringify(E2E_BUSINESS),JSON.stringify(E2E_MARKET)]);
    await db.query(`insert into google_connections(id,user_id,google_subject,granted_scopes,access_token_ciphertext,access_token_iv,access_token_auth_tag,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,encryption_key_version,token_expires_at)
      values($1,$2,$3,array['openid','email','profile','https://www.googleapis.com/auth/webmasters.readonly','https://www.googleapis.com/auth/analytics.readonly'],decode('01','hex'),decode('02','hex'),decode('03','hex'),decode('04','hex'),decode('05','hex'),decode('06','hex'),'test-key',now()+interval '1 hour')`,[connection,owner,owner]);
    for(const source of ['gsc','ga4']) {
      const binding=randomUUID(),payload={schema_version:`${source}_sync_v1`,health_status:'healthy'};
      await db.query(`insert into case_source_bindings(id,case_id,connection_id,source_type,external_resource_id,external_resource_name,identity_match_status,health_status,confirmed_by_user_id,confirmed_at)
        values($1,$2,$3,$4,$5,'Test resource','matched','healthy',$6,now())`,[binding,caseId,connection,source,`${source}-resource`,owner]);
      await db.query(`insert into data_snapshots(id,case_id,binding_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context)
        values($1,$2,$3,$4,$5,now()-interval '1 minute',now()+interval '1 day','report_generation','healthy',$6,$7,current_date-30,current_date-1,$8)`,
        [randomUUID(),caseId,binding,source,`${source}_sync_v1`,JSON.stringify(payload),canonicalDigest(payload),JSON.stringify({external_resource_id:`${source}-resource`})]);
    }
    }
    let loseNext:string|null=null;const sqlErrors:string[]=[];
    const allowed=new Set(['get_v22_first_service_workspace','reserve_v22_first_service_discovery','continue_v22_first_service_discovery','confirm_v22_first_service_entry',
      'get_v22_case_planning_settings','save_v22_case_planning_settings','confirm_v22_first_service_entry_with_planning']);
    const sqlTransport:typeof fetch=async(input,init)=>{
      const req=new Request(input,init),url=new URL(req.url),rpc=url.pathname.split('/rpc/')[1];
      if(url.origin!=="http://127.0.0.1:1"||!allowed.has(rpc)||req.method!=="POST")throw Error('External or unsupported request');
      const args=Object.entries(await req.json() as Record<string,unknown>);
      if(args.some(([k])=>!/^p_[a-z][a-z0-9_]*$/.test(k)))throw Error('Invalid test parameter');
      try {
        const value=await db.transaction(async tx=>{await tx.exec('set local role service_role');return (await tx.query<{v:unknown}>(`select ${rpc}(${args.map(([k],i)=>`${k}=>$${i+1}`).join(',')}) v`,args.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v))).rows[0].v;});
        if(loseNext===rpc){loseNext=null;return Response.json({code:'08006',message:'Injected response loss'},{status:503});}
        return Response.json(value);
      }catch(e){sqlErrors.push(`${rpc}: ${(e as Error).message}`);return Response.json({code:(e as {code?:string}).code??'XX000',message:(e as Error).message},{status:400});}
    };
    const transport:typeof fetch=async(input,init)=>{try{return await sqlTransport(input,init);}catch(e){sqlErrors.push(`transport: ${(e as Error).message}`);throw e;}};
    const client=createClient('http://127.0.0.1:1','local-test-only',{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:transport}});
    const repository=new FirstServiceEntryRepository(client,prepared?.planning??false);
    const planningRepository=new PlanningSettingsRepository(client);
    const planningHandlers=createPlanningSettingsHandlers({enabled:()=>prepared?.planning??false,user:async()=>({userId:owner}),repository:()=>planningRepository});
    const handlers=createFirstServiceEntryHandlers({enabled:()=>true,intakeEnabled:()=>true,user:async()=>({userId:owner}),repository:()=>({
      read:repository.read.bind(repository),execute:async(...args:Parameters<typeof repository.execute>)=>{
        try{return await repository.execute(...args);}catch(e){sqlErrors.push(`entry: ${(e as {code?:string}).code}: ${(e as Error).message}`);throw e;}
      }})});
    return {owner,caseId,repository,sqlErrors,migrations:migrationCount,close:()=>db.close(),
      loseResponse:(rpc:string)=>{loseNext=rpc;},
      updatePlanning:(revision:number,settings:PlanningSettings)=>planningRepository.save(owner,caseId,revision,settings),
      dispatch:async(request:Request)=>new URL(request.url).pathname.endsWith('/planning-settings')
        ?planningHandlers[request.method==='PUT'?'PUT':'GET'](request,{params:Promise.resolve({id:caseId})})
        :handlers[request.method==='POST'?'POST':'GET'](new NextRequest(request),{params:Promise.resolve({id:caseId})}),
      inspect:async()=>({balance:(await db.query<{credit_balance:number}>('select credit_balance from users where id=$1',[owner])).rows[0].credit_balance,
        ledger:(await db.query('select kind,delta from credit_ledger where user_id=$1',[owner])).rows,
        collections:(await db.query<{request_canonical:string}>('select request_canonical from capability_first_service_collections where case_id=$1',[caseId])).rows,
        jobs:(await db.query('select id,status from analysis_jobs where case_id=$1',[caseId])).rows}),
      discover:async()=>{
        const view=await repository.read(owner,caseId),w=view.workflow!;
        await db.query('select claim_v22_first_service_discovery_dispatch($1,$2)',[w.id,randomUUID()]);
        await db.query('select claim_v22_first_service_discovery_run($1,$2,$3)',[w.id,w.discoveryId,randomUUID()]);
        const result={...discoveryStatusFixture('succeeded').result!,case_id:caseId,discovery_id:w.discoveryId,
          created_at:new Date(Date.now()-1000).toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()};
        await db.query('select record_v22_first_service_discovery($1,$2,$3,$4)',[owner,caseId,w.id,JSON.stringify(result)]);
      }};
  }catch(e){await db.close();throw e;}
}
