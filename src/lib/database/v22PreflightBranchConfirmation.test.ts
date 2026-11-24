import {randomUUID} from "node:crypto";
import {afterAll,beforeAll,expect,it} from "vitest";
import {database,fixture,rpc,seed} from "./test-support/acquisition-binding.mjs";

let db: Awaited<ReturnType<typeof database>>;
beforeAll(async () => {db = await database();}, 30000);
afterAll(async () => {await db?.close();});

it("checks ownership and evidence age before append, and keeps branch pins immutable", async () => {
  const f = await fixture("v22_capability_public_v13");
  const owner = f.manifest.user_id, caseId = f.manifest.case_id, other = randomUUID(), otherCase = randomUUID();
  const business = {identity:f.old, service:f.manifest.business.primary_service,market:f.request.evidence_input.context.target_market};
  await seed(db,{...business, owner,caseId});
  await seed(db,{...business, owner:other,caseId:otherCase});
  const now=Date.now();
  const evidence = {preflight_id:randomUUID(),observed_at:new Date(now-60000).toISOString(),
    expires_at:new Date(now+60000).toISOString(),domain:f.old.normalized_domain,public_gbp_url:"https://www.google.com/maps?cid=42",
    branch_ref:"42",entity_keys:{cid:"42"},gbp_address:"12 Example St"};
  const args={p_user_id:owner,p_case_id:caseId,p_request_id:randomUUID(),p_evidence:evidence,p_reason:"Saved profile reviewed",
    p_operating_mode:null,p_customers_can_visit:false};
  await expect(rpc(db,"save_v22_preflight_branch_confirmation",{...args,p_user_id:other})).rejects.toThrow("GBP_BRANCH_UNAVAILABLE");
  await expect(rpc(db,"save_v22_preflight_branch_confirmation",{...args,p_case_id:otherCase})).rejects.toThrow("GBP_BRANCH_UNAVAILABLE");
  await expect(rpc(db,"save_v22_preflight_branch_confirmation",{...args,p_evidence:{...evidence,domain:"other.example"}})).rejects.toThrow("GBP_BRANCH_INVALID");
  await expect(rpc(db,"save_v22_preflight_branch_confirmation",{...args,p_evidence:{...evidence,expires_at:evidence.observed_at}}))
    .rejects.toThrow("GBP_BRANCH_EVIDENCE_EXPIRED");
  const saved=await rpc(db,"save_v22_preflight_branch_confirmation",args);
  expect(await rpc(db,"save_v22_preflight_branch_confirmation",args)).toEqual(saved);
  const reserve={p_user_id:owner,p_case_id:caseId,p_workflow_id:randomUUID(),p_discovery_job_id:randomUUID(),
    p_workflow_idempotency_key:"test-branch-workflow",p_task_idempotency_key:"test-branch-task",p_confirmation_id:saved.id,
    p_public_gbp_url:evidence.public_gbp_url,p_planning_revision:null,p_queries_canonical:null,p_keyword_scope:null};
  await expect(rpc(db,"start_v22_prospect_discovery_with_branch",{...reserve,p_user_id:other,p_case_id:otherCase}))
    .rejects.toThrow("GBP_BRANCH_UNAVAILABLE");
  await expect(rpc(db,"start_v22_prospect_discovery_with_branch",{...reserve,p_public_gbp_url:"https://www.google.com/maps?cid=43"}))
    .rejects.toThrow("GBP_BRANCH_CONFLICT");
  expect(await rpc(db,"start_v22_prospect_discovery_with_branch",reserve)).toMatchObject({credit_balance:2});
  expect(await rpc(db,"start_v22_prospect_discovery_with_branch",reserve)).toMatchObject({credit_balance:2,idempotent:true});
  const latest=await rpc(db,"save_v22_preflight_branch_confirmation",{...args,p_request_id:randomUUID()});
  await expect(rpc(db,"start_v22_prospect_discovery_with_branch",{...reserve,p_confirmation_id:latest.id}))
    .rejects.toThrow("GBP_BRANCH_CONFLICT");
  const acl=await db.query<{read:boolean}>("select has_function_privilege('authenticated','public.get_v22_acquisition_preflight_branch_pin(uuid,uuid,uuid)','execute') as read");
  expect(acl.rows[0].read).toBe(false);
},20000);
