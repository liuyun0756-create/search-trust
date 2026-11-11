import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const migrationPath = "supabase/migrations/20261111110000_increase_service_role_statement_timeout.sql";

it("applies the 180s role setting idempotently without changing other roles, locks or functions", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role service_role; create role anon; create role authenticated; create role authenticator;
      alter role service_role set statement_timeout='60s'; alter role service_role set lock_timeout='8s';
      alter role authenticator set statement_timeout='8s'; alter role authenticator set lock_timeout='8s';
      alter role anon set statement_timeout='3s'; alter role authenticated set statement_timeout='8s';
      create function public.unchanged_business_function() returns int language sql as 'select 1';`);
    const settings = async () => (await db.query<{rolname:string;setconfig:string[]}>(`
      select r.rolname,s.setconfig from pg_db_role_setting s join pg_roles r on r.oid=s.setrole order by r.rolname`)).rows
      .map(row => ({...row, setconfig: [...row.setconfig].sort()}));
    const before = await settings();
    const definition = (await db.query(`select pg_get_functiondef('public.unchanged_business_function()'::regprocedure)`)).rows;
    const migration = await readFile(migrationPath, "utf8");
    await db.exec(migration);
    const after = await settings();
    expect(after.find(r => r.rolname === "service_role")?.setconfig.sort()).toEqual(["lock_timeout=8s", "statement_timeout=180s"]);
    expect(after.filter(r => r.rolname !== "service_role")).toEqual(before.filter(r => r.rolname !== "service_role"));
    await db.exec(migration);
    expect(await settings()).toEqual(after);
    expect((await db.query(`select pg_get_functiondef('public.unchanged_business_function()'::regprocedure)`)).rows).toEqual(definition);
    expect(migration).toMatch(/notify pgrst, 'reload config'/i);
  } finally { await db.close(); }
});

it("rolls back to the previous 60s role setting without resetting lock_timeout", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role service_role; alter role service_role set lock_timeout='8s';");
    await db.exec(await readFile(migrationPath, "utf8"));
    await db.exec("begin; alter role service_role set statement_timeout='60s'; notify pgrst, 'reload config'; commit;");
    expect((await db.query<{setconfig:string[]}>(`select setconfig from pg_db_role_setting
      where setrole='service_role'::regrole`)).rows[0].setconfig.sort()).toEqual(["lock_timeout=8s", "statement_timeout=60s"]);
  } finally { await db.close(); }
});
