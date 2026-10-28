import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { FirstServiceRepository, type FirstServiceStart } from "./first-service";
vi.mock("server-only",()=>({}));

function fixture() {
  const input:FirstServiceStart={userId:randomUUID(),caseId:randomUUID(),jobId:randomUUID(),idempotencyKey:randomUUID(),businessVersionId:randomUUID(),gscSnapshotId:randomUUID(),ga4SnapshotId:randomUUID()};
  const data={schema_version:'v22_first_service_preparation_v1',mode:'first_service',user_id:input.userId,case_id:input.caseId,job_id:input.jobId,idempotency_key:input.idempotencyKey,
    business_version_id:input.businessVersionId,gsc_snapshot_id:input.gscSnapshotId,ga4_snapshot_id:input.ga4SnapshotId,idempotent:false,credit_balance:4,status:'queued',created_at:'2026-10-21T00:00:00Z',deadline_at:'2026-10-21T00:20:00Z'};
  const rpc=vi.fn().mockResolvedValue({data,error:null});
  return {input,data,rpc,repository:new FirstServiceRepository({rpc} as unknown as SupabaseClient)};
}
describe('first service server enrollment boundary',()=>{
  it('passes explicit identities to the unified workflow and strips future private fields',async()=>{
    const f=fixture();f.rpc.mockResolvedValue({data:{...f.data,private_payload:'do not return'},error:null});
    expect(await f.repository.start(f.input)).toEqual(f.data);
    expect(f.rpc).toHaveBeenCalledExactlyOnceWith('start_v22_first_service_preparation',{
      p_user_id:f.input.userId,p_case_id:f.input.caseId,p_job_id:f.input.jobId,p_idempotency_key:f.input.idempotencyKey,
      p_business_version_id:f.input.businessVersionId,p_gsc_snapshot_id:f.input.gscSnapshotId,p_ga4_snapshot_id:f.input.ga4SnapshotId});
  });
  it.each(['queued','running','failed','succeeded'])('recovers %s without inventing a new attempt',async status=>{
    const f=fixture();f.rpc.mockResolvedValue({data:{...f.data,status,idempotent:true},error:null});
    expect(await f.repository.start(f.input)).toMatchObject({status,idempotent:true});expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(['user_id','case_id','job_id','idempotency_key','business_version_id','gsc_snapshot_id','ga4_snapshot_id','mode','status','deadline_at'])('rejects a mismatched %s receipt',async field=>{
    const f=fixture();f.rpc.mockResolvedValue({data:{...f.data,[field]:'wrong'},error:null});
    await expect(f.repository.start(f.input)).rejects.toMatchObject({code:'FIRST_SERVICE_UNAVAILABLE'});
  });
  it.each([{code:'40001',message:'private SQL',expected:'FIRST_SERVICE_CONFLICT'},
    {code:'P0001',message:'INSUFFICIENT_CREDITS',expected:'INSUFFICIENT_CREDITS'},
    {code:'503',message:'private token',expected:'FIRST_SERVICE_UNAVAILABLE'}])('maps $expected without retry or diagnostics',async error=>{
    const f=fixture();f.rpc.mockResolvedValue({data:null,error});
    await expect(f.repository.start(f.input)).rejects.toMatchObject({code:error.expected});expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it('validates identifiers, source uniqueness and idempotency before RPC',async()=>{
    const f=fixture();
    for(const patch of [{userId:'someone'}, {idempotencyKey:'x'}, {ga4SnapshotId:f.input.gscSnapshotId}]) {
      await expect(f.repository.start({...f.input,...patch})).rejects.toMatchObject({code:'FIRST_SERVICE_INVALID'});
    }
    expect(f.rpc).not.toHaveBeenCalled();
  });
});
