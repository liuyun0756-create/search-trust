import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe,it,expect } from "vitest";
import manifest from "./runtime-contracts/manifest.json";
import request from "./runtime-contracts/request.json";
import completed from "./runtime-contracts/completed.json";
import { validateCapabilityTaskEnvelope,validateCompletedCapabilityTask } from "./runtime";

describe("separate capability worker transport",()=>{
  it("matches the backend-owned runtime artifacts without changing old API contracts",()=>{
    for(const [name,checksum] of Object.entries(manifest.files)) {
      const raw=readFileSync(new URL(`./runtime-contracts/${name}`,import.meta.url));
      expect(`sha256:${createHash("sha256").update(raw).digest("hex")}`).toBe(checksum);
    }
    expect(validateCapabilityTaskEnvelope(request)).toBe(true);
    expect(validateCompletedCapabilityTask(completed)).toBe(true);
  });
  it.each(["job","time","schema","private-body","counter"])("rejects %s in the completion reference",(change)=>{
    const value=structuredClone(completed) as Record<string,unknown>;
    if(change==="job")value.job_id="00000000-0000-0000-0000-000000009999";
    if(change==="time")value.updated_at="2026-10-19T00:00:00Z";
    if(change==="schema")value.schema_version="v22_job_status_v1";
    if(change==="private-body")value.report={input_manifest:{user_id:"private"}};
    if(change==="counter")value.cost_counters={provider_attempts_total:1};
    expect(validateCompletedCapabilityTask(value)).toBe(false);
  });
  it("does not accept source payloads or activation flags in a queued envelope",()=>{
    expect(validateCapabilityTaskEnvelope({...request,enabled:true})).toBe(false);
    expect(validateCapabilityTaskEnvelope({...request,capability_request:{...request.capability_request,snapshots:[]}})).toBe(false);
  });
});
