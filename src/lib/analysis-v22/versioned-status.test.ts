import { describe, expect, it } from "vitest";
import completed from "../report-capability/runtime-contracts/completed.json";
import { completedReportId, parseVersionedTaskStatus } from "./versioned-status";
const job=completed.job_id,caseId=completed.report_reference.case_id;
describe("versioned task status used by poll and SSE",()=>{
  it("routes a valid new completion even before a legacy report ID is present",()=>{
    const parsed=parseVersionedTaskStatus(completed,job,caseId);
    expect(parsed.ok).toBe(true);
    if(parsed.ok)expect(completedReportId(parsed.value)).toBe(job);
    expect(parseVersionedTaskStatus({...completed,database_report_id:job},job,caseId).ok).toBe(true);
  });
  it.each(["job","case","database-id","private","schema"])("rejects %s mismatch",kind=>{
    const value={...completed} as Record<string,unknown>;
    if(kind==="database-id")value.database_report_id=caseId;
    if(kind==="private")value.report={input_manifest:{}};
    if(kind==="schema")value.schema_version="unknown";
    expect(parseVersionedTaskStatus(value,kind==="job"?caseId:job,kind==="case"?job:caseId).ok).toBe(false);
  });
  it("retains legacy running and failure states",()=>{
    const value={job_id:job,revision:1,run_generation:1,status:"running",stage:"collecting_site",progress:20,
      message:"Collecting sources.",report:null,error:null,created_at:completed.created_at,deadline_at:completed.deadline_at,updated_at:completed.created_at};
    const parsed=parseVersionedTaskStatus(value,job,caseId);
    expect(parsed.ok).toBe(true);
    if(parsed.ok)expect(completedReportId(parsed.value)).toBeNull();
    expect(parseVersionedTaskStatus({...value,status:"succeeded"},job,caseId).ok).toBe(false);
  });
});
