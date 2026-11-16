import {afterAll,beforeAll,expect,it} from 'vitest';
import {database,enrolled,fixture,rpc} from './test-support/acquisition-binding.mjs';
let db:any,b:any,body:any;
beforeAll(async()=>{db=await database();b=await fixture();body=await enrolled(db,b);},30000);
afterAll(async()=>{await db?.close();});
function args(){return {p_user_id:b.manifest.user_id,p_case_id:b.manifest.case_id,p_job_id:b.manifest.job_id,p_run_generation:1,p_lease_token:body.p_lease_token,p_kind:'acquisition'};}
it('reads bounded task, manifest and boot metadata inside a read-only transaction without renewing the lease',async()=>{
 const snapshot=async()=> (await db.query('select row_to_json(j) job,row_to_json(r) run from analysis_jobs j join capability_acquisition_runs r on r.job_id=j.id where j.id=$1',[b.manifest.job_id])).rows;
 const before=await snapshot();await db.exec('begin read only');
 const state=await rpc(db,'inspect_v22_capability_preparation',args());await db.exec('commit');
 expect(state).toMatchObject({job_id:b.manifest.job_id,run_generation:1,manifest_exists:false,lease_owned:true});
 expect(state.database_started_at).toBeTypeOf('string');expect(await snapshot()).toEqual(before);
 expect(JSON.stringify(state).length).toBeLessThan(1000);
});
it('checks user, case, generation, kind and lease ownership',async()=>{
 for(const change of [{p_user_id:'ffffffff-ffff-4fff-8fff-ffffffffffff'},{p_case_id:'ffffffff-ffff-4fff-8fff-ffffffffffff'},{p_run_generation:2},{p_kind:'other'}])expect(await rpc(db,'inspect_v22_capability_preparation',{...args(),...change})).toBeNull();
 expect((await rpc(db,'inspect_v22_capability_preparation',{...args(),p_lease_token:'ffffffff-ffff-4fff-8fff-ffffffffffff'})).lease_owned).toBe(false);
});
it('is executable only by service_role, not public browser roles',async()=>{
 const sig='public.inspect_v22_capability_preparation(uuid,uuid,uuid,integer,uuid,text)';
 for(const role of ['anon','authenticated'])expect((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') allowed',[role,sig])).rows[0].allowed).toBe(false);
 expect((await db.query('select has_function_privilege(\'service_role\',$1,\'EXECUTE\') allowed',[sig])).rows[0].allowed).toBe(true);
});
it('a real committed freeze is observed without returning payload content',async()=>{
 await rpc(db,'freeze_v22_acquisition_preparation',body);
 expect((await rpc(db,'inspect_v22_capability_preparation',args())).manifest_exists).toBe(true);
});
it.each(['V22_CAPABILITY_FREEZE_TOO_LARGE','V22_CAPABILITY_FREEZE_DATABASE_RESTARTED'])('the existing terminal path refunds %s exactly once',async code=>{
 const other=await database();try{
  const sample=await fixture(),input=await enrolled(other,sample),m=sample.manifest;
  const balance=(await other.query<{b:number}>('select credit_balance b from users where id=$1',[m.user_id])).rows[0].b;
  const revision=(await other.query<{r:number}>('select state_revision r from analysis_jobs where id=$1',[m.job_id])).rows[0].r;
  const now=new Date().toISOString();
  const event={p_job_id:m.job_id,p_case_id:m.case_id,p_revision:revision+1,p_status:'failed',p_current_stage:'failed',p_progress:0,p_attempt_count:1,p_error_code:code,p_user_message:'Sources could not be prepared safely.',p_cost_counters:input.p_cost_counters,p_heartbeat_at:now,p_completed_at:now,p_run_generation:1,p_deadline_at:(await other.query<{d:string}>('select deadline_at::text d from analysis_jobs where id=$1',[m.job_id])).rows[0].d};
  await rpc(other,'apply_analysis_job_event',event);await rpc(other,'apply_analysis_job_event',event);
  expect((await other.query<{b:number}>('select credit_balance b from users where id=$1',[m.user_id])).rows[0].b).toBe(balance+1);
  expect((await other.query("select delta from credit_ledger where analysis_job_id=$1 and kind='technical_failure_credit'",[m.job_id])).rows).toEqual([{delta:1}]);
  expect((await other.query<{state:string}>('select state from workflow_charges where analysis_job_id=$1',[m.job_id])).rows[0].state).toBe('compensated');
 }finally{await other.close();}
});
