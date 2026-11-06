import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {renderToBuffer} from '@react-pdf/renderer';
import {isLocalE2ETestMode} from '@/lib/e2e-v22/config';
import {boundedJson} from '@/lib/review-decisions/json';
import {validCommand,type Preview} from '@/lib/identity-review/contracts';
import {initialCapabilityRevision} from '@/lib/report-capability/revision';
import {validateDeliveryRevision} from '@/lib/report-capability/validate';
import {buildApprovedCapabilityDelivery} from '@/lib/report-capability/delivery';
import {CapabilityReportPDFDocument} from '@/components/report/pdf/CapabilityReportPDFDocument';
import {localIdentityArtifact} from '../local';
export const runtime='nodejs';
const sessions=new Map<string,{preview?:Preview;committed?:Preview;revision:number;approved?:unknown}>();
async function offline(scenario:string,command:unknown){
 const root=resolve(process.cwd(),'../SearchTrust-RD');
 return await new Promise<any>((resolveResult,reject)=>{
  const p=spawn(resolve(root,'.venv/bin/python'),[resolve(root,'scripts/run_p1_05_review_preview.py'),scenario],{cwd:process.cwd(),env:{NODE_ENV:process.env.NODE_ENV,PATH:process.env.PATH??'',PYTHONDONTWRITEBYTECODE:'1'},stdio:['pipe','pipe','pipe']});
  let out='';const timer=setTimeout(()=>{p.kill();reject(Error('Local preview timed out'));},60000);
  p.stdout.on('data',b=>{out+=b;if(out.length>3_000_000)p.kill();});p.stderr.resume();p.on('error',reject);p.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(Error('Local preview failed'));try{resolveResult(JSON.parse(out));}catch{reject(Error('Invalid preview'));}});p.stdin.end(JSON.stringify(command));
 });
}
export async function POST(request:Request){
 if(!isLocalE2ETestMode())return new Response(null,{status:404});
 if(request.headers.get('origin')!==new URL(process.env.NEXT_PUBLIC_E2E_BASE_URL!).origin)return new Response(null,{status:403});
 const u=new URL(request.url),scenario=u.searchParams.get('scenario')??'',session=u.searchParams.get('session')??'';
 if(!/^[a-zA-Z0-9-]{1,80}$/.test(session)||!['volcanoes-hiking-guides','pr-plumbing-fresno'].includes(scenario))return Response.json({code:'INVALID'},{status:400});
 const artifact=localIdentityArtifact(scenario),key=scenario+':'+session;
 const state=sessions.get(key)??{revision:0};sessions.set(key,state);
 const raw=await boundedJson(request,1_000_000) as any;
 const reply=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
 if(raw.operation==='approve'||raw.operation==='pdf'){
  if(!state.committed||!validateDeliveryRevision(raw.content,state.committed.report)||raw.content.status!=='approved')return reply({code:'INVALID'},400);
  if(raw.operation==='approve'&&raw.content.expected_revision!==state.revision)return reply({code:'CAPABILITY_CONFLICT',ok:false},409);
  const delivery=buildApprovedCapabilityDelivery(state.committed.report,{id:'e2000000-0000-4000-8000-000000000009',report_id:state.committed.report.id,user_id:artifact.base.input_manifest.user_id,case_id:artifact.base.input_manifest.case_id,revision:raw.operation==='pdf'?state.revision:state.revision+1,status:'approved',approved_at:'2026-11-05T00:00:00Z',content:raw.content});
  if(raw.operation==='pdf'){
   if(!state.approved)return reply({code:'INVALID'},400);
   const buffer=await renderToBuffer(CapabilityReportPDFDocument({delivery}));return new Response(new Uint8Array(buffer),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="identity-preview.pdf"','Cache-Control':'no-store'}});
  }
  state.revision++;state.approved=raw.content;return reply({ok:true,revision:state.revision,content:raw.content,delivery});
 }
 if(!validCommand(raw))return reply({code:'INVALID'},400);
 if(raw.operation==='lookup')return reply({code:'INVALID'},400);
 if(raw.operation==='commit'){
  if(state.committed && state.committed.request_id===raw.request_id)return reply({...state.committed,initial:initialCapabilityRevision(state.committed.report)});
  if(!state.preview||state.preview.request_id!==raw.request_id)return reply({code:'CONFLICT'},409);
  state.committed={...state.preview,state:'committed'};return reply({...state.committed,initial:initialCapabilityRevision(state.committed.report)});
 }
 if(raw.operation==='preview'&&state.committed)return reply({code:'CONFLICT'},409);
 try{
  const result=await offline(scenario,raw);
  if(raw.operation==='preview')state.preview=result;
  return reply(result);
 }catch{return reply({code:'CONFLICT'},409);}
}
