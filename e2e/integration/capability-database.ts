/** Test-only local database. Never imported by application code or routes. */
import {randomUUID} from "node:crypto";
import {readdir,readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {createClient} from "@supabase/supabase-js";
import zero from "../../src/lib/report-capability/contracts/fixtures/acquisition-0.json";
import one from "../../src/lib/report-capability/contracts/fixtures/acquisition-1.json";
import {canonicalDigest,canonicalJsonText} from "../../src/lib/verified-analysis-v22/digest";
import {validateCapabilityReport} from "../../src/lib/report-capability/validate";
import {CapabilityRepository} from "../../src/lib/report-capability/repository";
import {CapabilityShareService} from "../../src/lib/report-capability/shares";
import {createCapabilityRevisionHandlers} from "../../src/lib/report-capability/revision-handler";
import {createCapabilityDeliveryHandlers} from "../../src/lib/report-capability/delivery-handler";
import {capabilityPdfResponse} from "../../src/lib/report-capability/pdf";
import {loadCapabilityOwnerDocument} from "../../src/lib/report-capability/owner-document";
import {readShareToken} from "../../src/lib/report-shares/public-request";
import {ReportShareNotFoundError} from "../../src/lib/report-shares/service";
import type {CapabilityReport} from "../../src/lib/report-capability/generated/types";
import {ImplementationRepository} from "../../src/lib/implementation-records/repository";
import {createImplementationHandlers} from "../../src/lib/implementation-records/handler";

export type PreparedJourney = {db:PGlite;owner:string;caseId:string;job:string;workflow:string;report:CapabilityReport;migrations:number};

type Fault={rpc:string;phase:"before"|"after"};
const identifier=(value:string)=>{if(!/^[a-z_][a-z0-9_]*$/.test(value))throw new Error("Unsupported test identifier");return `"${value}"`;};
const allowedRpcs=new Set(["get_v22_completed_capability_report","list_v22_completed_capability_reports","save_v22_completed_report_revision",
  "create_v22_capability_share","list_v22_capability_shares","revoke_v22_capability_share","resolve_v22_capability_share",
  "get_v22_implementation_records","save_v22_implementation_record"]);

export async function createCapabilityDatabaseJourney(actionCount:0|1, prepared?:PreparedJourney) {
  const db=prepared?.db??new PGlite();
  try {
    let setup:PreparedJourney;
    if(prepared) setup=prepared;
    else {
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    const migrations=(await readdir("supabase/migrations")).filter(n=>n.endsWith(".sql")).sort();
    for(const file of migrations)await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));
    const raw=structuredClone(actionCount?one:zero),m=raw.input_manifest;
    const owner=randomUUID(),caseId=randomUUID(),job=randomUUID(),workflow=randomUUID(),discovery=randomUUID();
    const fetched=new Date(Date.now()-86400000).toISOString(),evaluated=new Date(Date.now()-1000).toISOString(),expires=new Date(Date.now()+86400000).toISOString();
    Object.assign(m,{id:randomUUID(),user_id:owner,case_id:caseId,job_id:job,evaluated_at:evaluated});
    Object.assign(m.business,{id:randomUUID(),user_id:owner,case_id:caseId,confirmed_at:fetched});
    raw.id=job;raw.generated_at=new Date().toISOString();
    await db.query("insert into users(id,clerk_user_id,email) values($1,$2,$3)",[owner,`clerk-${owner}`,`${owner}@example.invalid`]);
    await db.query("select register_v22_clerk_user($1,decode(repeat('01',32),'hex'),$2,null)",[`clerk-${owner}`,`${owner}@example.invalid`]);
    await db.query(`insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
      values($1,$2,$3,'clinic.example.invalid','Local test clinic','{}','storefront','Emergency dental care','{}')`,[caseId,owner,m.business.site_url]);
    for(const s of m.snapshots){
      Object.assign(s,{snapshot_id:randomUUID(),case_id:caseId,fetched_at:fetched,expires_at:expires});
      const source=s.source_kind==="public_gbp"?"gbp":s.source_kind;
      const payload={schema_version:s.schema_version,resource_id:`${source}-resource`,identity_match_status:"matched",health_status:"healthy",completed_at:fetched};
      s.payload_checksum=canonicalDigest(payload);
      await db.query(`insert into data_snapshots(id,case_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum)
        values($1,$2,$3,$4,$5,$6,'report_generation','healthy',$7::jsonb,$8)`,[s.snapshot_id,caseId,source,s.schema_version,fetched,expires,JSON.stringify(payload),s.payload_checksum]);
    }
    raw.evidence[0].snapshot_id=m.snapshots[0].snapshot_id;raw.evidence[0].observed_at=fetched;raw.findings[0].observed_at=fetched;
    m.input_checksum=canonicalDigest(Object.fromEntries(Object.entries(m).filter(([k])=>k!=="input_checksum")));
    const checked=validateCapabilityReport(raw);if(!checked.ok)throw new Error("Invalid integration fixture");
    const report=checked.report;
    await db.query("select save_v22_business_scope($1,$2,0,$3::jsonb)",[owner,caseId,JSON.stringify(m.business)]);
    // Use the existing SQL reservation/binding boundary, including its retry path.
    const reserve=()=>db.query("select * from reserve_v22_prospect_workflow($1,$2,$3,$4,$5)",[owner,caseId,workflow,discovery,workflow]);
    await reserve();await reserve();
    await db.query("select * from bind_v22_prospect_analysis($1,$2,$3,$4,$5)",[owner,caseId,workflow,job,job]);
    await db.query("select * from freeze_v22_analysis_manifest($1,$2,$3,$4::jsonb,$5)",[owner,caseId,job,JSON.stringify(m),canonicalJsonText(Object.fromEntries(Object.entries(m).filter(([k])=>k!=="input_checksum")))]);
    setup={db,owner,caseId,job,workflow,report,migrations:migrations.length};
    }
    const {owner,caseId,job,workflow,report}=setup;
    let fault:Fault|null=null;
    const transport:typeof fetch=async(input,init)=>{
      const request=new Request(input,init),url=new URL(request.url),rpc=url.pathname.split("/rpc/")[1];
      if(url.origin!=="http://127.0.0.1:1")throw new Error("External database request blocked");
      const operation=rpc??url.pathname.split("/").at(-1)!;
      const current=fault?.rpc===operation?fault:null;if(current)fault=null;
      if(current?.phase==="before")return Response.json({code:"08006",message:"Injected local failure"},{status:503});
      try {
        const rows=await db.transaction(async tx=>{
          await tx.exec("set local role service_role");
          if(rpc){
            if(!allowedRpcs.has(rpc)||request.method!=="POST")throw new Error("Unsupported test RPC");
            const args=Object.entries(await request.json() as Record<string,unknown>);
            const params=args.map(([,v])=>v&&typeof v==="object"?JSON.stringify(v):v);
            return (await tx.query<Record<string,unknown>>(`select * from public.${identifier(rpc)}(${args.map(([k],i)=>`${identifier(k)} => $${i+1}`).join(",")})`,params)).rows;
          }
          if(operation!=="report_content_revisions"||request.method!=="GET")throw new Error("Unsupported test table");
          const columns=(url.searchParams.get("select")??"").split(",").map(identifier).join(",");
          const filters=[...url.searchParams].filter(([k])=>!["select","order","limit"].includes(k));
          const values=filters.map(([,v])=>{if(!v.startsWith("eq."))throw new Error("Unsupported filter");return v.slice(3);});
          const where=filters.map(([k],i)=>`${identifier(k)}=$${i+1}`).join(" and ");
          const ordered=url.searchParams.get("order");if(ordered&&ordered!=="revision.desc")throw new Error("Unsupported order");
          const limited=url.searchParams.get("limit");if(limited&&!["1","100"].includes(limited))throw new Error("Unsupported limit");
          return (await tx.query<Record<string,unknown>>(`select ${columns} from report_content_revisions where ${where}${ordered?" order by revision desc":""}${limited?` limit ${Number(limited)}`:""}`,values)).rows;
        });
        // Simulate the important ambiguous outcome: transaction committed, response lost.
        if(current?.phase==="after")return Response.json({code:"08006",message:"Injected response loss"},{status:503});
        if(rpc==="revoke_v22_capability_share"||rpc==="save_v22_implementation_record")return Response.json(Object.values(rows[0])[0]);
        if(request.headers.get("accept")?.includes("application/vnd.pgrst.object+json")){
          if(rows.length!==1)return Response.json({code:"PGRST116",message:"Expected one row",details:`The result contains ${rows.length} rows`},{status:406});
          return Response.json(rows[0]);
        }
        return Response.json(rows);
      }catch(error){return Response.json({code:(error as {code?:string}).code??"XX000",message:"Local database operation failed"},{status:400});}
    };
    // Real Supabase query serialization, with only the transport replaced by local SQL.
    const client=createClient("http://127.0.0.1:1","local-test-only",{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:transport}});
    const repository=new CapabilityRepository(client),shares=new CapabilityShareService(client,repository),implementationRepository=new ImplementationRepository(client);
    const settle=()=>db.query("select * from complete_v22_capability_analysis($1,$2,$3,$4::jsonb,$5,1)",[owner,caseId,job,JSON.stringify(report),canonicalJsonText(report)]);
    const inspect=async()=>({
      charge:(await db.query("select state,final_capability_report_id from workflow_charges where id=$1",[workflow])).rows[0],
      ledger:(await db.query("select kind,delta from credit_ledger where workflow_charge_id=$1 order by created_at",[workflow])).rows,
      balance:(await db.query<{credit_balance:number}>("select credit_balance from users where id=$1",[owner])).rows[0].credit_balance,
      reports:(await db.query("select payload from capability_report_versions where id=$1",[job])).rows,
      revisions:(await db.query("select revision,status,content from report_content_revisions where report_id=$1 order by revision",[job])).rows,
      shares:(await db.query("select revision_id,revoked_at from capability_report_shares where report_id=$1",[job])).rows,
      implementationRecords:(await db.query("select payload from capability_implementation_records where report_id=$1 order by revision",[job])).rows,
    });
    const dispatch=async(request:Request,principal:string|null=owner)=>{
      const url=new URL(request.url),context={params:Promise.resolve({id:caseId,reportId:job,shareId:url.pathname.split("/").at(-1)})};
      const getCurrentUser=async()=>principal?{userId:principal}:null;
      const revision=createCapabilityRevisionHandlers({getCurrentUser,isEnabled:()=>true,repository:()=>repository});
      const delivery=createCapabilityDeliveryHandlers({getCurrentUser,isEnabled:()=>true,reports:()=>repository,shares:()=>shares,pdf:capabilityPdfResponse});
      const implementation=createImplementationHandlers({user:getCurrentUser,enabled:()=>true,repository:()=>implementationRepository});
      if(url.pathname==="/_journey/owner"){
        if(!principal)return Response.json({error:"Sign in"},{status:401});
        const doc=await loadCapabilityOwnerDocument(repository,principal,caseId,job,true);
        return Response.json(doc?{...doc,caseId,reportId:job}:{error:"Not found"},{status:doc?200:404});
      }
      if(url.pathname.startsWith(`/api/v2/cases/${caseId}/reports/${job}/`)){
        if(url.pathname.endsWith("/implementation"))return implementation[request.method as "GET"|"PUT"](request,context);
        if(url.pathname.endsWith("/content-revision"))return revision[request.method as "GET"|"PUT"|"POST"](request,context);
        if(url.pathname.endsWith("/client-pdf")&&request.method==="POST")return delivery.pdf(request,context);
        if(url.pathname.endsWith("/client-shares"))return request.method==="GET"?delivery.list(request,context):delivery.create(request,context);
        if(request.method==="DELETE")return delivery.revoke(request,context);
      }
      if(url.pathname==="/api/share/resolve"||url.pathname==="/api/share/pdf"){
        const token=await readShareToken(request);if(!token)return Response.json({error:"Report share not found"},{status:404});
        try{const resolved=await shares.resolve(token);return url.pathname.endsWith("/pdf")?capabilityPdfResponse(resolved.delivery):Response.json({schemaVersion:"2.2.2",...resolved});}
        catch(error){if(error instanceof ReportShareNotFoundError)return Response.json({error:"Report share not found"},{status:404});throw error;}
      }
      return Response.json({error:"Unsupported local test request"},{status:404});
    };
    const settlementFailure=async(enabled:boolean)=>{
      if(enabled)await db.exec(`create function journey_reject_completion() returns trigger language plpgsql as $$ begin raise exception 'INJECTED_SETTLEMENT_FAILURE'; end; $$;
        create trigger journey_reject_completion after insert on capability_report_versions for each row execute function journey_reject_completion();`);
      else await db.exec("drop trigger journey_reject_completion on capability_report_versions; drop function journey_reject_completion();");
    };
    return {owner,caseId,job,report,migrations:setup.migrations,repository,implementationRepository,shares,settle,inspect,dispatch,settlementFailure,
      failNext:(rpc:string,phase:"before"|"after")=>{fault={rpc,phase};},close:()=>db.close()};
  }catch(error){await db.close();throw error;}
}
