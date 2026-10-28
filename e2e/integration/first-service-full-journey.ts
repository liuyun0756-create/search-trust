/** Test-only entry → real Python workers → same SQL report → delivery. */
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {seedDatabase,type Seed} from './generated-first-service';
import {createFirstServiceEntryJourney} from './first-service-entry-database';
import {createCapabilityDatabaseJourney} from './capability-database';
import {validateCapabilityReport} from '../../src/lib/report-capability/validate';

const scalar=new Set(['claim_v22_first_service_discovery_dispatch','claim_v22_first_service_discovery_run',
  'record_v22_first_service_discovery','claim_v22_first_service_preparation','heartbeat_v22_first_service_preparation',
  'begin_v22_first_service_collection','freeze_v22_first_service_preparation','get_v22_capability_dispatch',
  'resolve_v22_capability_analysis_input']);
const rows=new Set(['list_v22_first_service_preparation_work','complete_v22_capability_analysis']);

export async function createFirstServiceFullJourney(clean=false,loss:'none'|'freeze'|'handoff'|'collection'='none'){
  const db=new PGlite(),backend=path.resolve('../SearchTrust-RD');
  const child=spawn(path.join(backend,'.venv/bin/python'),['tests/support/first_service_entry_bridge.py'],{
    cwd:backend,stdio:['pipe','pipe','pipe'],env:{NODE_ENV:'test',PATH:process.env.PATH,PYTHONUNBUFFERED:'1',PYTHONDONTWRITEBYTECODE:'1'}});
  let stderr='';child.stderr.on('data',chunk=>{stderr+=chunk.toString();});
  const exit=new Promise<number|null>((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});void exit.catch(()=>{});
  const lines=createInterface({input:child.stdout})[Symbol.asyncIterator]();
  const timer=setTimeout(()=>child.kill(),90000),sqlErrors:string[]=[];
  const send=(value:unknown)=>child.stdin.write(JSON.stringify(value)+'\n');
  let lossInjected=false,delivery:Awaited<ReturnType<typeof createCapabilityDatabaseJourney>>|undefined;
  const next=async()=>{const line=await lines.next();if(line.done)throw Error(`Backend stopped: ${stderr}\n${sqlErrors.join('\n')}`);return JSON.parse(line.value);};
  const advance=async(kind:string)=>{
    while(true){
      const message=await next();if(message.kind===kind)return message;
      if(message.kind==='expire_test_lease'&&loss==='collection'){
        await db.query("update capability_first_service_runs set lease_until=now()-interval '1 second' where job_id=$1",[message.job]);
        send({kind:'lease_expired'});continue;
      }
      if(message.kind!=='rpc'||!scalar.has(message.rpc)&&!rows.has(message.rpc))throw Error(`Unsupported bridge message: ${message.rpc}`);
      const args=Object.entries(message.args as Record<string,unknown>);
      if(args.some(([k])=>!/^p_[a-z][a-z0-9_]*$/.test(k)))throw Error('Invalid RPC parameter');
      try{
        const call=`${message.rpc}(${args.map(([k],i)=>`${k}=>$${i+1}`).join(',')})`;
        // Do not parse/re-serialize sealed source JSON. PostgreSQL numeric 1.0
        // must survive the JS controller unchanged for Python checksum checks.
        const body=await db.transaction(async tx=>{await tx.exec('set local role service_role');return(await tx.query<{body:string}>(
          scalar.has(message.rpc)?`select ${call}::text body`:`select coalesce(jsonb_agg(t),'[]')::text body from ${call} t`,
          args.map(([,v])=>v&&typeof v==='object'?JSON.stringify(v):v))).rows[0].body;});
        if(loss==='freeze'&&!lossInjected&&message.rpc==='freeze_v22_first_service_preparation'){
          lossInjected=true;send({status:503,body_text:JSON.stringify({code:'08006',message:'Injected acknowledgement loss after freeze commit'})});
        }else send({status:200,body_text:body||'null'});
      }catch(error){sqlErrors.push(`${message.rpc}: ${(error as Error).message}`);send({status:400,body_text:JSON.stringify({code:(error as {code?:string}).code??'XX000',message:(error as Error).message})});}
    }
  };
  const close=async()=>{clearTimeout(timer);child.stdin.end();if(child.exitCode===null)child.kill();await exit.catch(()=>{});await db.close();};
  try{
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    const migrations=(await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort();
    for(const file of migrations)await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
    send({clean,loss});const source=await advance('seed') as Seed;
    await seedDatabase(db,source,true);
    const owner=source.manifest.user_id,caseId=source.manifest.case_id;
    const entry=await createFirstServiceEntryJourney({db,owner,caseId,migrations:migrations.length,planning:true});
    return {owner,caseId,siteUrl:source.manifest.business.site_url,queries:source.request.public_input.evidence_input.context.queries,entry,close,
      dispatch:async(req:Request)=>['/first-service','/planning-settings'].some(s=>new URL(req.url).pathname.endsWith(s))?entry.dispatch(req):delivery?delivery.dispatch(req):new Response(null,{status:404}),
      discover:async()=>{const view=await entry.repository.read(owner,caseId);send({kind:'discover',workflow:view.workflow!.id});await advance('discovered');},
      run:async()=>{
        send({kind:'run'});const result=await advance('result');child.stdin.end();
        if(await exit!==0)throw Error(`Worker failed: ${stderr}`);clearTimeout(timer);
        if(sqlErrors.length)throw Error(sqlErrors.join('\n'));
        const checked=validateCapabilityReport(result.report);if(!checked.ok)throw Error('Generated report contract invalid');
        const m=checked.report.input_manifest;
        delivery=await createCapabilityDatabaseJourney(0,{db,owner,caseId,job:m.job_id,workflow:m.job_id,report:checked.report,migrations:migrations.length});
        const jobs=(await db.query<{created_at:Date;deadline_at:Date}>('select created_at,deadline_at from analysis_jobs where id=$1',[m.job_id])).rows;
        return {delivery,result,jobs};
      }};
  }catch(error){await close();throw error;}
}
