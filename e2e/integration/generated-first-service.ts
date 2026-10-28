/** Test-only Python → actual SQL → client delivery bridge. No network listener. */
import {spawn} from "node:child_process";
import {randomUUID} from "node:crypto";
import {readdir,readFile} from "node:fs/promises";
import {createInterface} from "node:readline";
import {backendRuntime} from "./backend-runtime";
import {PGlite} from "@electric-sql/pglite";
import {createCapabilityDatabaseJourney} from "./capability-database";
import {validateCapabilityReport} from "../../src/lib/report-capability/validate";
import type {AnalysisInputManifest} from "../../src/lib/report-capability/generated/types";

const allowed=new Set(["prepare_v22_capability_analysis_input","resolve_v22_capability_analysis_input","complete_v22_capability_analysis"]);
type SavedSource={snapshot_id:string;binding_id:string;source_type:string;schema_version:string;normalized_payload:unknown;health_reasons:string[];
  external_resource_id:string;coverage_start:string;coverage_end:string;fetched_at:string;expires_at:string;payload_checksum:string};
export type Seed={manifest:AnalysisInputManifest;private_payloads:Record<string,string>;request:{public_input:{business_identity:Record<string,unknown>;evidence_input:{context:{target_market:unknown;queries:string[]};sources:{kind:string;binding:{snapshot_id:string};payload:unknown}[]}};first_party_input:{snapshots:SavedSource[]}}};

export async function seedDatabase(db:PGlite,{manifest:m,request:r,private_payloads}:Seed,entryOnly=false){
  const owner=m.user_id,caseId=m.case_id,job=m.job_id,connection=randomUUID(),identity=r.public_input.business_identity;
  await db.query("insert into users(id,clerk_user_id,email) values($1,$2,$3)",[owner,owner,`${owner}@example.invalid`]);
  await db.query("select register_v22_clerk_user($1,decode(repeat('01',32),'hex'),$2,null)",[owner,`${owner}@example.invalid`]);
  await db.query(`insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
    values($1,$2,$3,$4,$8,$5,$9,$6,$7)`,[caseId,owner,m.business.site_url,new URL(m.business.site_url).hostname,
      JSON.stringify(identity),m.business.primary_service,JSON.stringify(r.public_input.evidence_input.context.target_market),identity.business_name,identity.operating_model]);
  await db.query(`insert into google_connections(id,user_id,google_subject,granted_scopes,access_token_ciphertext,access_token_iv,access_token_auth_tag,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,encryption_key_version,token_expires_at)
    values($1,$2,$3,array['openid','email','profile','https://www.googleapis.com/auth/webmasters.readonly','https://www.googleapis.com/auth/analytics.readonly'],decode('01','hex'),decode('02','hex'),decode('03','hex'),decode('04','hex'),decode('05','hex'),decode('06','hex'),'test-key',now()+interval '1 hour')`,[connection,owner,owner]);
  for(const s of m.snapshots){
    const privateSource=r.first_party_input.snapshots.find(x=>x.snapshot_id===s.snapshot_id);
    const publicSource=r.public_input.evidence_input.sources.find(x=>x.binding.snapshot_id===s.snapshot_id);
    if(entryOnly&&!privateSource)continue;
    const type=s.source_kind==='public_gbp'?'gbp':s.source_kind;
    if(privateSource)await db.query(`insert into case_source_bindings(id,case_id,connection_id,source_type,external_resource_id,external_resource_name,identity_match_status,health_status,confirmed_by_user_id,confirmed_at)
      values($1,$2,$3,$4,$5,'Test resource','matched','healthy',$6,now())`,[s.binding_id,caseId,connection,type,privateSource.external_resource_id,owner]);
    await db.query(`insert into data_snapshots(id,case_id,binding_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context,health_reasons)
      values($1,$2,$3,$4,$5,$6,$7,'report_generation','healthy',$8,$9,$10,$11,$12,$13)`,[s.snapshot_id,caseId,s.binding_id,type,s.schema_version,s.fetched_at,s.expires_at,
      privateSource?private_payloads[s.snapshot_id]:JSON.stringify(publicSource!.payload),s.payload_checksum,privateSource?.coverage_start??null,privateSource?.coverage_end??null,
      JSON.stringify(privateSource?{external_resource_id:privateSource.external_resource_id}:{}),JSON.stringify(privateSource?.health_reasons??[])]);
  }
  if(entryOnly)return;
  await db.query("select save_v22_business_scope($1,$2,0,$3)",[owner,caseId,JSON.stringify(m.business)]);
  const args=[owner,caseId,job,job,m.business.id,...['gsc','ga4'].map(kind=>m.snapshots.find(s=>s.source_kind===kind)!.snapshot_id)];
  await db.query("select start_v22_first_service_preparation($1,$2,$3,$4,$5,$6,$7)",args);
  await db.query("select start_v22_first_service_preparation($1,$2,$3,$4,$5,$6,$7)",args);
}

export async function createGeneratedFirstServiceJourney(clean:boolean,loseCompletion=false){
  const script="tests/support/first_service_delivery_bridge.py",backend=backendRuntime(script);
  const db=new PGlite();
  const child=spawn(backend.python,[script],{
    cwd:backend.root,stdio:["pipe","pipe","pipe"],env:{NODE_ENV:"test",PATH:process.env.PATH,PYTHONUNBUFFERED:"1",PYTHONDONTWRITEBYTECODE:"1"}});
  let stderr="";child.stderr.on("data",data=>{stderr+=data.toString();});
  const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();
  const exit=new Promise<number|null>((resolve,reject)=>{child.once("error",reject);child.once("close",resolve);});
  // Attach immediately so spawn errors cannot become unhandled rejections.
  void exit.catch(()=>{});
  const timeout=setTimeout(()=>child.kill(),60000);
  const send=(value:unknown)=>child.stdin.write(JSON.stringify(value)+"\n");
  const sqlErrors:string[]=[];
  const next=async()=>{const line=await lines.next();if(line.done)throw Error(`Backend bridge stopped: ${stderr}\n${sqlErrors.join('\n')}`);return JSON.parse(line.value);};
  try{
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    const migrations=(await readdir("supabase/migrations")).filter(n=>n.endsWith(".sql")).sort();
    for(const file of migrations)await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));
    send({clean,lose_completion:loseCompletion});
    const seed=await next();if(seed.kind!=="seed")throw Error("Missing source seed");
    await seedDatabase(db,seed);send({kind:"ready"});
    let lossInjected=false,result;
    while(true){
      const message=await next();
      if(message.kind==='result'){result=message;break;}
      if(message.kind!=="rpc"||!allowed.has(message.rpc))throw Error("Unsupported bridge RPC");
      const args=Object.entries(message.args);
      if(args.some(([key])=>!/^p_[a-z][a-z0-9_]*$/.test(key)))throw Error("Invalid bridge argument");
      try{
        const resolve=message.rpc==='resolve_v22_capability_analysis_input';
        const call=`${message.rpc}(${args.map(([key],i)=>`${key}=>$${i+1}`).join(',')})`;
        const rows=await db.transaction(async tx=>{await tx.exec("set local role service_role");return (await tx.query<Record<string,unknown>>(
          resolve?`select ${call}::text as body`:`select * from ${call}`,args.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v))).rows;});
        if(loseCompletion&&!lossInjected&&message.rpc==='complete_v22_capability_analysis'){
          lossInjected=true;send({status:503,body:{code:'08006',message:'Injected response loss after commit'}});
        }else send(resolve?{status:200,body_text:rows[0].body}:{status:200,body:rows});
      }catch(e){sqlErrors.push(`${message.rpc}: ${(e as Error).message}`);send({status:400,body:{code:(e as {code?:string}).code??'XX000',message:(e as Error).message}});}
    }
    child.stdin.end();if(await exit!==0)throw Error(`Backend failed: ${stderr}`);
    if(sqlErrors.length)throw Error(sqlErrors.join('\n'));
    const checked=validateCapabilityReport(result.report);if(!checked.ok)throw Error('Generated report rejected by frontend contract');
    const m=checked.report.input_manifest;
    const journey=await createCapabilityDatabaseJourney(0,{db,owner:m.user_id,caseId:m.case_id,job:m.job_id,workflow:m.job_id,report:checked.report,migrations:migrations.length});
    return {...journey,backendCalls:result.calls as string[],recoveredCompletion:result.recovered_completion as boolean};
  }catch(e){await db.close();throw e;}
  finally{clearTimeout(timeout);child.stdin.end();if(child.exitCode===null)child.kill();await exit.catch(()=>{});}
}
