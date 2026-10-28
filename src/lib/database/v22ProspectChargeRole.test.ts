import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  for (const file of (await readdir("supabase/migrations")).filter(f => f.endsWith(".sql")).sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
}, 30_000);
afterAll(async () => { await db?.close(); });

it("reserves and replays Prospect discovery as the real service role after review migrations", async () => {
  const owner = randomUUID(), caseId = randomUUID(), workflow = randomUUID(), discovery = randomUUID();
  await db.query("insert into users(id,clerk_user_id,email) values($1,$2,$3)", [owner, owner, `${owner}@example.invalid`]);
  await db.query("select register_v22_clerk_user($1,decode(repeat('01',32),'hex'),$2,null)", [owner, `${owner}@example.invalid`]);
  await db.query(`insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
    values($1,$2,'https://example.invalid/','example.invalid','Example','{}','service_area','Repair','{}')`, [caseId, owner]);
  const reserve = () => db.transaction(async tx => {
    await tx.exec("set local role service_role");
    return (await tx.query<{created: boolean; credit_balance: number}>(
      "select * from start_v22_prospect_discovery($1,$2,$3,$4,$5,$6)",
      [owner, caseId, workflow, discovery, `prospect:${workflow}`, `discover:${discovery}`],
    )).rows[0];
  });
  expect(await reserve()).toMatchObject({ created: true, credit_balance: 4 });
  expect(await reserve()).toMatchObject({ created: false, credit_balance: 4 });
  expect((await db.query("select kind,delta from credit_ledger where workflow_charge_id=$1", [workflow])).rows)
    .toEqual([{ kind: "prospect_debit", delta: -1 }]);
  expect((await db.query("select discovery_job_id from prospect_discovery_tasks where workflow_charge_id=$1", [workflow])).rows)
    .toEqual([{ discovery_job_id: discovery }]);
});

it("keeps internal review requests and trigger execution unavailable to direct callers", async () => {
  expect((await db.query(`select has_table_privilege('service_role','public.capability_review_generation_requests','SELECT') as readable,
    has_function_privilege('service_role','public.guard_v22_review_parallel_charge()','EXECUTE') as callable,
    has_function_privilege('anon','public.start_v22_prospect_discovery(uuid,uuid,uuid,uuid,text,text)','EXECUTE') as public_intake`)).rows)
    .toEqual([{ readable: false, callable: false, public_intake: false }]);
});
