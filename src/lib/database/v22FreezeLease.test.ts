import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const version = "20261112090000_extend_freeze_preparation_lease.sql";
const migration = await readFile(`supabase/migrations/${version}`, "utf8");
const rollback = await readFile(`supabase/rollbacks/${version}`, "utf8");

// Real historical freeze, heartbeat and fence functions run against local fixture
// tables. Only the calculation helper is stubbed, to simulate elapsed time without
// sleeping 100 seconds or collecting data. The full migration-chain test separately
// covers installation in the complete application schema.
describe.each(["acquisition", "first_service"] as const)("%s freeze lease", kind => {
  let db: PGlite;
  const runs = `capability_${kind}_runs`;
  const preparations = kind === "acquisition" ? "capability_acquisition_preparations" : "capability_first_service_collections";
  const freeze = `freeze_v22_${kind}_preparation`;
  const heartbeat = `heartbeat_v22_${kind}_preparation`;

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table client_cases(id uuid primary key,user_id uuid,status text default 'active');
      create table analysis_jobs(id uuid primary key,case_id uuid,run_generation int,status text,current_stage text,
        report_id uuid,deadline_at timestamptz,heartbeat_at timestamptz,state_revision bigint default 0,
        cost_counters jsonb default '{}',user_message text);
      create table analysis_input_manifests(job_id uuid primary key);
      create table capability_acquisition_preparations(job_id uuid primary key,user_id uuid,case_id uuid);
      create table capability_first_service_collections(job_id uuid primary key,user_id uuid,case_id uuid);
      create table capability_acquisition_runs(job_id uuid primary key,run_generation int,lease_token uuid,lease_until timestamptz);
      create table capability_first_service_runs(job_id uuid primary key,run_generation int,lease_token uuid,lease_until timestamptz);`);
    for (const file of ["20261021110000_queue_v22_acquisition_preparation.sql", "20261021180000_queue_v22_first_service_collection.sql"]) {
      const source = await readFile(`supabase/migrations/${file}`, "utf8");
      for (const fn of source.matchAll(/create function public\.(?:claim_v22_\w+_preparation|heartbeat_v22_\w+_preparation|freeze_v22_\w+_preparation|fence_v22_\w+_manifest)\([\s\S]*?\$\$;/g)) {
        await db.exec(fn[0]);
      }
    }
    await db.exec(`create trigger test_acquisition_fence before insert on analysis_input_manifests
      for each row execute function fence_v22_acquisition_manifest();
      create trigger test_first_service_fence before insert on analysis_input_manifests
      for each row execute function fence_v22_first_service_manifest();
      revoke all on function ${freeze}(uuid,jsonb,jsonb) from public;
      grant execute on function ${freeze}(uuid,jsonb,jsonb) to service_role;
      create function prepare_v22_capability_analysis_input(p_user_id uuid,p_case_id uuid,p_job_id uuid,
        p_manifest jsonb,p_manifest_canonical text,p_recipe jsonb,p_generation_canonical text,
        p_public_source_canonicals jsonb,p_previous_canonical text,p_run_generation integer)
      returns table(manifest_id uuid,input_checksum text,generation_input_checksum text)
      language plpgsql as $$
      begin
        update ${runs} set lease_until=lease_until-make_interval(secs=>current_setting('test.freeze_elapsed')::int)
          where job_id=p_job_id;
        insert into analysis_input_manifests(job_id) values(p_job_id);
        if current_setting('test.freeze_rollback')='yes' then raise exception 'TEST_FREEZE_ROLLBACK'; end if;
        return query select p_job_id,'test-input'::text,'test-generation'::text;
      end $$;`);
  }, 30_000);
  afterAll(async () => { await db?.close(); });
  beforeEach(async () => {
    await db.exec(rollback);
    await db.exec(migration);
    await db.exec("select set_config('test.freeze_elapsed','0',false),set_config('test.freeze_rollback','no',false);");
  });

  async function fixture(deadlineSeconds = 600) {
    const f = {job: randomUUID(), owner: randomUUID(), caseId: randomUUID(), token: randomUUID()};
    await db.query("insert into client_cases(id,user_id) values($1,$2)", [f.caseId, f.owner]);
    await db.query(`insert into analysis_jobs(id,case_id,run_generation,status,deadline_at,heartbeat_at)
      values($1,$2,1,'running',clock_timestamp()+make_interval(secs=>$3),clock_timestamp())`, [f.job, f.caseId, deadlineSeconds]);
    await db.query(`insert into ${preparations}(job_id,user_id,case_id) values($1,$2,$3)`, [f.job, f.owner, f.caseId]);
    await db.query(`insert into ${runs}(job_id,run_generation,lease_token,lease_until)
      values($1,1,$2,clock_timestamp()+interval '90 seconds')`, [f.job, f.token]);
    return f;
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  const invoke = (f: Fixture, token = f.token) => db.transaction(async tx => {
    await tx.exec("set local role service_role");
    return tx.query(`select ${freeze}($1,'{}'::jsonb,$2::jsonb) as result`, [token, JSON.stringify({
      p_job_id: f.job, p_user_id: f.owner, p_case_id: f.caseId, p_run_generation: 1,
      p_manifest: {}, p_manifest_canonical: "{}", p_recipe: {}, p_generation_canonical: "{}", p_public_source_canonicals: {},
    })]);
  });
  const lease = async (f: Fixture) => (await db.query<{until:string}>(`select lease_until::text as until from ${runs} where job_id=$1`, [f.job])).rows[0].until;

  it("fails before the fix but succeeds after the fix at an equivalent 100 seconds elapsed", async () => {
    const f = await fixture();
    await db.exec("select set_config('test.freeze_elapsed','100',false)");
    await db.exec(rollback);
    await expect(invoke(f)).rejects.toThrow("CAPABILITY_PREPARATION_LEASE_LOST");
    expect((await db.query("select * from analysis_input_manifests where job_id=$1", [f.job])).rows).toEqual([]);
    await db.exec(migration);
    expect((await invoke(f)).rows[0]).toMatchObject({result: {manifest_id: f.job}});
    expect((await db.query<{remaining:number}>(`select extract(epoch from lease_until-clock_timestamp())::float8 remaining from ${runs} where job_id=$1`, [f.job])).rows[0].remaining).toBeGreaterThan(90);
  });

  it("rolls back the extension and heartbeat to the exact original 90-second lease on failure", async () => {
    const f = await fixture();
    const before = await lease(f);
    await db.exec("select set_config('test.freeze_rollback','yes',false)");
    await expect(invoke(f)).rejects.toThrow("TEST_FREEZE_ROLLBACK");
    expect(await lease(f)).toBe(before);
    expect((await db.query("select * from analysis_input_manifests where job_id=$1", [f.job])).rows).toEqual([]);
    expect((await db.query("select status from analysis_jobs where id=$1", [f.job])).rows).toEqual([{status:"running"}]);
  });

  it("caps the extended lease at the original job deadline", async () => {
    const f = await fixture(120);
    await invoke(f);
    expect((await db.query(`select r.lease_until=j.deadline_at as capped from ${runs} r join analysis_jobs j on j.id=r.job_id where j.id=$1`, [f.job])).rows).toEqual([{capped:true}]);
  });

  it.each(["wrong-token", "taken-over", "expired"])("still rejects a %s lease", async reason => {
    const f = await fixture();
    if (reason === "taken-over") await db.query(`update ${runs} set lease_token=$2,run_generation=2 where job_id=$1`, [f.job, randomUUID()]);
    if (reason === "expired") await db.query(`update ${runs} set lease_until=clock_timestamp()-interval '1 second' where job_id=$1`, [f.job]);
    const before = await lease(f);
    await expect(invoke(f, reason === "wrong-token" ? randomUUID() : f.token)).rejects.toThrow("CAPABILITY_PREPARATION_LEASE_LOST");
    expect(await lease(f)).toBe(before);
  });

  it("rejects a zero-row extension even after heartbeat succeeded", async () => {
    const f = await fixture();
    await db.exec(`create function test_skip_extension() returns trigger language plpgsql as $$ begin
      if new.lease_until>old.lease_until+interval '100 seconds' then return null; end if;
      return new; end $$;
      create trigger test_skip_extension before update on ${runs} for each row execute function test_skip_extension();`);
    try { await expect(invoke(f)).rejects.toThrow("CAPABILITY_PREPARATION_LEASE_LOST"); }
    finally { await db.exec(`drop trigger test_skip_extension on ${runs}; drop function test_skip_extension();`); }
  });

  it("keeps normal heartbeat at 90 seconds, controls unchanged, and rollback restores the exact definition", async () => {
    const f = await fixture();
    const definitions = async () => (await db.query<{name:string;definition:string;acl:string}>(`select proname as name,pg_get_functiondef(oid) definition,proacl::text acl
      from pg_proc where pronamespace='public'::regnamespace and (proname like 'claim_v22_%_preparation' or proname like 'heartbeat_v22_%_preparation' or proname like 'fence_v22_%_manifest' or proname like 'freeze_v22_%_preparation') order by proname`)).rows;
    await db.exec(rollback);
    const before = await definitions();
    await db.exec(migration);
    await db.exec(migration);
    const after = await definitions();
    expect(after.filter(r=>!r.name.startsWith("freeze_"))).toEqual(before.filter(r=>!r.name.startsWith("freeze_")));
    expect(after.map(r=>({name:r.name,acl:r.acl}))).toEqual(before.map(r=>({name:r.name,acl:r.acl})));
    await db.query(`select ${heartbeat}($1,1,$2,'{}')`, [f.job, f.token]);
    const remaining = (await db.query<{remaining:number}>(`select extract(epoch from lease_until-clock_timestamp())::float8 remaining from ${runs} where job_id=$1`, [f.job])).rows[0].remaining;
    expect(remaining).toBeGreaterThan(85);
    expect(remaining).toBeLessThanOrEqual(90);
    await db.exec(rollback);
    expect(await definitions()).toEqual(before);
  });
});
