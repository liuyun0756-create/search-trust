import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";

let db: PGlite;
let migrations: string;
beforeAll(async () => {
  migrations = (await Promise.all((await readdir("supabase/migrations")).filter(f => f.endsWith(".sql")).sort()
    .map(f => readFile(`supabase/migrations/${f}`, "utf8")))).join("\n");
  db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(migrations);
}, 30_000);
afterAll(async () => { await db?.close(); });

function setupSql(owner: string, caseId: string, charge: string, discovery: string) {
  return `insert into users(id,clerk_user_id,email) values('${owner}','${owner}','${owner}@example.invalid');
    select register_v22_clerk_user('${owner}',decode(repeat('01',32),'hex'),'${owner}@example.invalid',null);
    insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
    values('${caseId}','${owner}','https://example.invalid/','example.invalid','Example','{}','service_area','Repair','{}');
    set role service_role;
    select * from start_v22_prospect_discovery('${owner}','${caseId}','${charge}','${discovery}','prospect:${charge}','discover:${discovery}');
    reset role;
    update prospect_discovery_tasks set created_at=now()-interval '21 minutes' where workflow_charge_id='${charge}';`;
}
async function fixture() {
  const owner=randomUUID(), caseId=randomUUID(), charge=randomUUID(), discovery=randomUUID();
  await db.exec(setupSql(owner,caseId,charge,discovery));
  return {owner,caseId,charge,discovery};
}
const expire = () => db.transaction(async tx => {
  await tx.exec("set local role service_role");
  // Prove the existing cron RPC invokes the new settlement; keep its job-only response.
  return (await tx.query("select * from expire_v22_prepared_capability_jobs(100)")).rows;
});
async function state(f: Awaited<ReturnType<typeof fixture>>) {
  return (await db.query(`select c.state,c.settled_at is not null as settled,u.credit_balance,
    (select count(*)::integer from credit_ledger l where l.workflow_charge_id=c.id and l.kind='technical_failure_credit') refunds
    from workflow_charges c join users u on u.id=c.user_id where c.id=$1`,[f.charge])).rows[0];
}

it("expires unbound Prospect discovery once, with one credit and the canonical immutable ledger key", async () => {
  const f=await fixture();
  expect(await expire()).toEqual([]);
  expect(await state(f)).toEqual({state:"compensated",settled:true,credit_balance:5,refunds:1});
  await expire();
  expect(await state(f)).toEqual({state:"compensated",settled:true,credit_balance:5,refunds:1});
  expect((await db.query("select delta,balance_after,idempotency_key,analysis_job_id from credit_ledger where workflow_charge_id=$1 and kind='technical_failure_credit'",[f.charge])).rows)
    .toEqual([{delta:1,balance_after:5,idempotency_key:`workflow:${f.charge}:technical-failure`,analysis_job_id:null}]);
  await expect(db.query("select * from bind_v22_prospect_analysis($1,$2,$3,$4,$5)",
    [f.owner,f.caseId,f.charge,randomUUID(),"late-analysis"])).rejects.toThrow("PROSPECT_WORKFLOW_NOT_RESERVED");
});

it("does not immediately refund an unexpired discovery or an active follow-up", async () => {
  const f=await fixture();
  await db.query("update prospect_discovery_tasks set created_at=now() where workflow_charge_id=$1",[f.charge]);
  await expire();
  expect(await state(f)).toMatchObject({state:"reserved",credit_balance:4,refunds:0});
  const g=await fixture();
  await db.query("insert into prospect_discovery_tasks(discovery_job_id,workflow_charge_id,idempotency_key) values($1,$2,'followup')",[randomUUID(),g.charge]);
  await expire();
  expect(await state(g)).toMatchObject({state:"reserved",credit_balance:4,refunds:0});
});

it("does not compensate reserved charges with bound analysis, or an unlinked analysis already started", async () => {
  for (const bound of [true,false]) {
    const f=await fixture(), job=randomUUID();
    await db.query("select * from bind_v22_prospect_analysis($1,$2,$3,$4,$5)",[f.owner,f.caseId,f.charge,job,`analysis:${job}`]);
    if (!bound) await db.query("update workflow_charges set analysis_job_id=null where id=$1",[f.charge]);
    await expire();
    expect(await state(f)).toMatchObject({state:"reserved",credit_balance:4,refunds:0});
  }
});

it("never refunds consumed charges or duplicates an existing compensation ledger entry", async () => {
  const f=await fixture(), report=randomUUID();
  await db.query(`insert into reports(id,report_id,user_id,page_url,gbp_url,status,access_type)
    values($1,$2,$3,'https://example.invalid/','https://maps.google.com/','paid_full','paid_credit')`,[report,report,f.owner]);
  await db.query("update workflow_charges set state='consumed',settled_at=now(),final_report_id=$1 where id=$2",[report,f.charge]);
  await expire();
  expect(await state(f)).toMatchObject({state:"consumed",credit_balance:4,refunds:0});
  const g=await fixture();
  await db.query(`insert into credit_ledger(user_id,case_id,workflow_charge_id,kind,delta,balance_after,idempotency_key)
    values($1,$2,$3,'technical_failure_credit',1,4,$4)`,[g.owner,g.caseId,g.charge,`workflow:${g.charge}:technical-failure`]);
  await expire();
  expect(await state(g)).toMatchObject({state:"reserved",credit_balance:4,refunds:1});
});

it("rolls back charge and balance together if ledger insertion fails", async () => {
  const f=await fixture();
  await db.exec(`create function test_refund_failure() returns trigger language plpgsql as $$ begin
    if new.workflow_charge_id='${f.charge}' and new.kind='technical_failure_credit' then raise exception 'TEST_LEDGER_FAILURE'; end if;
    return new; end $$;
    create trigger test_refund_failure before insert on credit_ledger for each row execute function test_refund_failure();`);
  try {
    await expect(expire()).rejects.toThrow("TEST_LEDGER_FAILURE");
    expect(await state(f)).toMatchObject({state:"reserved",settled:false,credit_balance:4,refunds:0});
  } finally { await db.exec("drop trigger test_refund_failure on credit_ledger; drop function test_refund_failure();"); }
});

it("restricts settlement to service_role and keeps the existing cron return contract", async () => {
  for (const role of ["anon","authenticated","service_role"]) {
    expect((await db.query("select has_function_privilege($1,'expire_v22_prospect_discovery_charges(integer)','execute') allowed",[role])).rows)
      .toEqual([{allowed:role==="service_role"}]);
  }
  const definition=(await db.query<{definition:string}>("select pg_get_functiondef('expire_v22_prepared_capability_jobs(integer)'::regprocedure) definition")).rows[0].definition;
  expect(definition).toContain("perform public.expire_v22_prospect_discovery_charges(p_limit)");
});

// PGlite serializes sessions, so true row-lock contention is tested separately
// against an explicitly selected LOCAL Docker PostgreSQL, never a remote URL.
const localContainer=process.env.P1_HOTFIX_LOCAL_PG_CONTAINER;
it.skipIf(!localContainer)("two concurrent PostgreSQL reconcilers credit exactly once (requires local Docker PostgreSQL)", async () => {
  const database=`refund_test_${randomUUID().replaceAll('-','')}`;
  const run=(sql:string, dbName=database, onOutput?:(text:string)=>void) => new Promise<string>((resolve,reject)=>{
    const child=spawn('docker',['exec','-i',localContainer!,'psql','-X','-U','postgres','-d',dbName,'-v','ON_ERROR_STOP=1','-At']);
    let output='',error='';
    child.stdout.on('data',chunk=>{output+=chunk;onOutput?.(String(chunk));});
    child.stderr.on('data',chunk=>{error+=chunk;});
    child.on('error',reject);
    child.on('close',code=>code===0?resolve(output):reject(new Error(error)));
    child.stdin.end(sql);
  });
  await run(`create database ${database};`,'postgres');
  try {
    await run(migrations);
    const owner=randomUUID(),caseId=randomUUID(),charge=randomUUID(),discovery=randomUUID();
    await run(setupSql(owner,caseId,charge,discovery));
    let signal!:()=>void;
    const locked=new Promise<void>(resolve=>{signal=resolve;});
    const first=run("begin; set local role service_role; select * from expire_v22_prepared_capability_jobs(100);\n\\echo REFUND_LOCK_HELD\nselect pg_sleep(2); commit;",database,
      output=>{if(output.includes('REFUND_LOCK_HELD'))signal();});
    // Reject rather than hang if the first connection fails before taking the lock.
    await Promise.race([locked,first.then(()=>{throw new Error('Lock barrier missing');})]);
    const second=run("set role service_role; select * from expire_v22_prepared_capability_jobs(100);");
    await Promise.all([first,second]);
    expect((await run(`select state from workflow_charges where id='${charge}';
      select credit_balance from users where id='${owner}';
      select count(*) from credit_ledger where workflow_charge_id='${charge}' and kind='technical_failure_credit';`)).trim())
      .toBe('compensated\n5\n1');
  } finally { await run(`drop database ${database};`,'postgres'); }
},60_000);
