import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { CaseLocation } from "../cases/contracts";
import { SupabaseCaseRepository } from "../cases/repository";

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

const base: CaseLocation = { display_name: "Fresno, CA", country_code: "US", region: "California", city: "Fresno", postal_code: null, latitude: null, longitude: null };
const cases = [
  { location: { ...base, latitude: 36.8151976, longitude: -119.8921305 }, key: "geo:36.815198:-119.892131" },
  { location: { ...base, latitude: -36.8151975, longitude: 119.8921305 }, key: "geo:-36.815198:119.892131" },
  { location: { ...base, latitude: 36.8151975, longitude: -119.8921304 }, key: "geo:36.815198:-119.892130" },
  { location: base, key: "place:us|california|fresno||fresno, ca" },
];
const quote = (value: unknown) => `'${(typeof value === "string" ? value : JSON.stringify(value)).replaceAll("'", "''")}'`;
function scenario(location: CaseLocation, key: string, v2: boolean) {
  const owner = randomUUID(), id = randomUUID();
  const identity = { business_name: "Example", site_url: "https://example.invalid/", normalized_domain: "example.invalid",
    ...(v2 ? { schema_version: "business_identity_v2", operating_model: { value: "hybrid", state: "resolved" }, operating_location: {} }
      : { operating_model: "hybrid" }),
    primary_location: v2 ? { ...base, city: "Wrong primary city" } : location };
  const market = v2 ? location : { ...base, city: "Wrong target city" };
  return { identity, market, sql: `
    insert into users(id,clerk_user_id,email) values('${owner}','${owner}','${owner}@example.invalid');
    insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
      values('${id}','${owner}','https://example.invalid/','example.invalid','Example',${quote(identity)}::jsonb,'hybrid','Repair',${quote(market)}::jsonb);
    do $test$ begin
      if (select location_key from client_cases where id='${id}') is distinct from ${quote(key)} then
        raise exception 'GENERATED_KEY_MISMATCH'; end if;
      if public.v22_case_location_key(${quote(location)}::jsonb) is distinct from ${quote(key)} then
        raise exception 'RPC_KEY_MISMATCH'; end if;
    end $test$;
    update client_cases set ${v2 ? `target_market=${quote(base)}::jsonb` : `business_identity=jsonb_set(business_identity,'{primary_location}',${quote(base)}::jsonb)`} where id='${id}';
    do $test$ begin
      if (select location_key from client_cases where id='${id}') is distinct from 'place:us|california|fresno||fresno, ca' then
        raise exception 'UPDATED_KEY_MISMATCH'; end if;
    end $test$;` };
}

it.each(cases)("repository RPC and migrated generated column agree: $key", async ({ location, key }) => {
  const repository = new SupabaseCaseRepository({ rpc: async (name: string, args: {location: unknown}) => {
    expect(name).toBe("v22_case_location_key");
    const result = await db.transaction(async tx => {
      await tx.exec("set local role service_role");
      return tx.query<{key: string}>("select public.v22_case_location_key($1::jsonb) key", [JSON.stringify(args.location)]);
    });
    return {data: result.rows[0].key, error: null};
  } } as unknown as SupabaseClient);
  for (const v2 of [false, true]) {
    const data = scenario(location, key, v2);
    expect(await repository.computeLocationKey(data.identity, data.market)).toBe(key);
    await db.exec(data.sql);
  }
});

const localContainer = process.env.P1_HOTFIX_LOCAL_PG_CONTAINER;
it.skipIf(!localContainer)("native local PostgreSQL applies all migrations and verifies create/update keys (requires local Docker PostgreSQL)", async () => {
  const database = `case_key_test_${randomUUID().replaceAll("-", "")}`;
  const run = (sql: string, databaseName = database) => new Promise<void>((resolve, reject) => {
    const child = spawn("docker", ["exec", "-i", localContainer!, "psql", "-X", "-U", "postgres", "-d", databaseName, "-v", "ON_ERROR_STOP=1"]);
    let error = "";
    child.stdout.resume();
    child.stderr.on("data", chunk => { error += chunk; });
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve() : reject(new Error(error)));
    child.stdin.end(sql);
  });
  await run(`create database ${database};`, "postgres");
  try {
    await run(migrations);
    for (const {location, key} of cases) {
      for (const v2 of [false, true]) await run(scenario(location, key, v2).sql);
    }
  } finally { await run(`drop database ${database};`, "postgres"); }
}, 60_000);
