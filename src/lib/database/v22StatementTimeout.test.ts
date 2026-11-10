import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("sets only service_role statement_timeout, preserving all other role settings", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role service_role; create role anon; create role authenticated; create role authenticator;
      alter role service_role set lock_timeout='8s';
      alter role authenticator set statement_timeout='8s'; alter role authenticator set lock_timeout='8s';
      alter role anon set statement_timeout='3s'; alter role authenticated set statement_timeout='8s';`);
    const settings = async () => (await db.query<{rolname:string;setconfig:string[]}>(`
      select r.rolname,s.setconfig from pg_db_role_setting s join pg_roles r on r.oid=s.setrole order by r.rolname`)).rows;
    const before = await settings();
    const migration = await readFile("supabase/migrations/20261110130000_set_service_role_statement_timeout.sql", "utf8");
    await db.exec(migration);
    const after = await settings();
    expect(after.filter(r=>r.rolname!=="service_role")).toEqual(before.filter(r=>r.rolname!=="service_role"));
    expect(after.find(r=>r.rolname==="service_role")?.setconfig.sort()).toEqual(["lock_timeout=8s","statement_timeout=60s"]);
    expect(migration).toMatch(/notify pgrst, 'reload config'/i);
  } finally { await db.close(); }
});
