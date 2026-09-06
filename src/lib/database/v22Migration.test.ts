import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { CaseLocation } from "../cases/contracts";
import { caseLocationKey } from "../cases/normalize";

type IdRow = { id: string };

const migrationDirectory = path.resolve(process.cwd(), "supabase/migrations");
const checksum = `sha256:${"a".repeat(64)}`;

let db: PGlite;
let userA: string;
let userB: string;
let caseA: string;
let caseB: string;
let connectionA: string;
let bindingA: string;
let siteSnapshotA: string;
let gbpSnapshotA: string;
let prospectReportA: string;
let verifiedReportA: string;
let legacyReport: string;

async function insertId(sql: string, params: unknown[] = []): Promise<string> {
  const result = await db.query<IdRow>(sql, params);
  return result.rows[0].id;
}

async function expectSqlError(sql: string, params: unknown[] = [], message?: string) {
  await expect(db.query(sql, params)).rejects.toThrow(message);
}

async function insertUser(suffix: string) {
  return insertId(
    `insert into public.users (clerk_user_id, email)
     values ($1, $2) returning id`,
    [`clerk_${suffix}`, `${suffix}@example.com`],
  );
}

async function insertCase(userId: string, suffix: string) {
  return insertId(
    `insert into public.client_cases (
       user_id, site_url, normalized_domain, business_name,
       business_identity, operating_model, primary_service, target_market
     ) values ($1, $2, $3, $4, '{}'::jsonb, 'storefront', 'SEO', '{}'::jsonb)
     returning id`,
    [userId, `https://${suffix}.example.com`, `${suffix}.example.com`, `Business ${suffix}`],
  );
}

async function insertConnection(userId: string, suffix: string) {
  return insertId(
    `insert into public.google_connections (
       user_id, google_subject, granted_scopes,
       access_token_ciphertext, access_token_iv, access_token_auth_tag,
       refresh_token_ciphertext, refresh_token_iv, refresh_token_auth_tag,
       encryption_key_version, token_expires_at
     ) values (
       $1, $2, array['scope:a'],
       decode('01', 'hex'), decode('02', 'hex'), decode('03', 'hex'),
       decode('04', 'hex'), decode('05', 'hex'), decode('06', 'hex'),
       'key-v1', now() + interval '1 hour'
     ) returning id`,
    [userId, `subject-${suffix}`],
  );
}

async function insertCompleteCase(
  userId: string,
  domain: string,
  suffix: string,
  primaryLocation: CaseLocation,
) {
  const siteUrl = `https://${domain}/`;
  const businessName = `Business ${suffix}`;
  const businessIdentity = {
    business_name: businessName,
    site_url: siteUrl,
    normalized_domain: domain,
    operating_model: "storefront",
    primary_location: primaryLocation,
    public_gbp_url: null,
  };
  return insertId(
    `insert into public.client_cases (
       user_id, site_url, normalized_domain, business_name,
       business_identity, operating_model, primary_service, target_market
     ) values ($1, $2, $3, $4, $5::jsonb, 'storefront', 'SEO', $6::jsonb)
     returning id`,
    [userId, siteUrl, domain, businessName, JSON.stringify(businessIdentity), JSON.stringify(primaryLocation)],
  );
}

describe.sequential("SearchTrust v2.2 Supabase migration", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");

    for (const filename of (await readdir(migrationDirectory)).sort()) {
      if (filename === "20260826000000_add_v2_2_case_data_model.sql") {
        const legacyUser = await insertUser("legacy");
        legacyReport = await insertId(
          `insert into public.reports (
             report_id, user_id, page_url, gbp_url, access_type, report_v2_1
           ) values (
             'legacy-v21', $1, 'https://legacy.example.com', '', 'free_trial', '{"legacy":true}'::jsonb
           ) returning id`,
          [legacyUser],
        );
      }
      const migration = await readFile(path.join(migrationDirectory, filename), "utf8");
      await db.exec(migration);
    }
  }, 30_000);

  afterAll(async () => {
    await db.close();
  });

  it("creates the ten server-only v2.2 tables with RLS enabled", async () => {
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity
       from pg_class
       where relnamespace = 'public'::regnamespace
         and relname = any(array[
           'client_cases', 'google_connections', 'case_source_bindings',
           'data_snapshots', 'analysis_jobs', 'case_report_entitlements',
           'report_shares', 'google_oauth_sessions', 'google_connection_events',
           'google_token_broker_requests'
         ])
       order by relname`,
    );

    expect(tables.rows).toHaveLength(10);
    expect(tables.rows.every((row) => row.relrowsecurity)).toBe(true);

    const browserGrants = await db.query<{ count: number }>(
      `select count(*)::int as count
       from information_schema.table_privileges
       where table_schema = 'public'
         and table_name = any(array[
           'client_cases', 'google_connections', 'case_source_bindings',
           'data_snapshots', 'analysis_jobs', 'case_report_entitlements',
           'report_shares', 'google_oauth_sessions', 'google_connection_events',
           'google_token_broker_requests'
         ])
         and grantee in ('anon', 'authenticated')`,
    );
    expect(browserGrants.rows[0].count).toBe(0);
  });

  it("atomically replaces owned Google resources, rejects stale/cross-user writes and deactivates revoked bindings", async () => {
    const owner = await insertUser("resource-owner");
    const outsider = await insertUser("resource-outsider");
    const caseId = await insertCase(owner, "resource-case");
    const conn = await insertConnection(owner, "resource-connection");
    const otherConn = await insertConnection(outsider, "resource-other");
    const sql = `select * from public.select_v22_google_resource($1,$2,$3,'gsc',$4,$5,null,$6)`;
    const select = (connectionId: string, resource: string, expected: string | null, user = owner) =>
      db.query<{ id: string; identity_match_status: string; health_status: string; confirmed_by_user_id: string }>(sql, [user, caseId, connectionId, resource, resource, expected]);
    await expect(select(conn, "sc-domain:example.com", null)).rejects.toThrow("RESOURCE_FORBIDDEN");
    await db.query(`update public.google_connections set granted_scopes = array['openid','email','profile','https://www.googleapis.com/auth/webmasters.readonly'] where id = $1`, [conn]);
    await expect(select(otherConn, "sc-domain:example.com", null)).rejects.toThrow("RESOURCE_FORBIDDEN");
    await expect(select(conn, "sc-domain:example.com", null, outsider)).rejects.toThrow("RESOURCE_FORBIDDEN");
    const first = (await select(conn, "sc-domain:example.com", null)).rows[0];
    expect(first).toMatchObject({ identity_match_status: "needs_confirmation", health_status: "not_checked", confirmed_by_user_id: owner });
    await expect(select(conn, "https://example.com/", null)).rejects.toThrow("BINDING_CHANGED");
    const second = (await select(conn, "https://example.com/", first.id)).rows[0];
    expect(second.id).not.toBe(first.id);
    expect((await db.query<{ count: number }>(`select count(*)::int as count from public.case_source_bindings where case_id=$1`, [caseId])).rows[0].count).toBe(2);
    expect((await db.query<{ id: string }>(`select id from public.case_source_bindings where case_id=$1 and is_active`, [caseId])).rows).toEqual([{ id: second.id }]);
    // An old tab's disconnect cannot deactivate the replacement.
    await db.query(`select public.disconnect_v22_google_resource($1,$2,$3)`, [owner, caseId, first.id]);
    expect((await db.query<{ id: string }>(`select id from public.case_source_bindings where case_id=$1 and is_active`, [caseId])).rows).toHaveLength(1);
    await expect(db.query(`select public.disconnect_v22_google_resource($1,$2,$3)`, [outsider, caseId, second.id])).rejects.toThrow("RESOURCE_FORBIDDEN");
    await db.query(`update public.google_connections set status='revoked',revoked_at=now(),access_token_ciphertext=null,access_token_iv=null,
      access_token_auth_tag=null,refresh_token_ciphertext=null,refresh_token_iv=null,refresh_token_auth_tag=null,encryption_key_version=null,token_expires_at=null where id=$1`, [conn]);
    expect((await db.query(`select id from public.case_source_bindings where case_id=$1 and is_active`, [caseId])).rows).toHaveLength(0);
    await expect(select(conn, "https://example.com/", null)).rejects.toThrow("RESOURCE_FORBIDDEN");
    const grants = await db.query<{ allowed: boolean }>(`select has_function_privilege('authenticated','public.select_v22_google_resource(uuid,uuid,uuid,text,text,text,text,uuid)','EXECUTE') as allowed`);
    expect(grants.rows[0].allowed).toBe(false);
  });

  it("atomically confirms resource identity, rejects invalid/stale assessments, and invalidates Case edits", async () => {
    const owner = await insertUser("identity-owner");
    const outsider = await insertUser("identity-outsider");
    const caseId = await insertCase(owner, "identity-case");
    const conn = await insertConnection(owner, "identity-connection");
    await db.query(`update public.google_connections set granted_scopes=array['openid','email','profile','https://www.googleapis.com/auth/webmasters.readonly'] where id=$1`, [conn]);
    const revision = (await db.query<{ revision: string }>(`select updated_at::text as revision from public.client_cases where id=$1`, [caseId])).rows[0].revision;
    const assessment = { version: "v22-052.1", status: "matched", confidence: "high", reasons: ["DOMAIN_EXACT"] };
    const sql = `select * from public.select_v22_matched_google_resource($1,$2,$3,'gsc','sc-domain:example.com','Example',null,$4,$5,$6::jsonb,$7)`;
    const select = (expected: string | null, payload: object = assessment, method: string | null = "automatic", stamp: string | null = revision, user = owner) =>
      db.query<{ id: string; identity_match_status: string; identity_match_evidence: Record<string, unknown>; confirmed_by_user_id: string | null; confirmed_at: string | null; health_status: string }>(
        sql, [user, caseId, conn, expected, stamp, JSON.stringify(payload), method]);
    await expect(select(null, assessment, "automatic", revision, outsider)).rejects.toThrow("RESOURCE_FORBIDDEN");
    await expect(select(null, assessment, "automatic", null)).rejects.toThrow("IDENTITY_CHANGED");
    await expect(select(null, assessment, "automatic", "2000-01-01T00:00:00Z")).rejects.toThrow("IDENTITY_CHANGED");
    for (const invalid of [
      { ...assessment, status: "mismatch" }, { ...assessment, confidence: "low" }, {},
      { ...assessment, reasons: "forged" }, { ...assessment, version: "unknown" },
    ]) await expect(select(null, invalid)).rejects.toThrow("INVALID_IDENTITY");
    await expect(select(null, assessment, null)).rejects.toThrow("INVALID_IDENTITY_CONFIRMATION");
    const first = (await select(null)).rows[0];
    expect(first).toMatchObject({ identity_match_status: "matched", confirmed_by_user_id: owner, health_status: "not_checked",
      identity_match_evidence: { version: "v22-052.1", confidence: "high", confirmation_method: "automatic", reasons: ["DOMAIN_EXACT"] } });
    expect(first.confirmed_at).not.toBeNull();
    await expect(select(null)).rejects.toThrow("BINDING_CHANGED");
    // A rejected replacement must neither retire the old selection nor create a new row.
    await expect(select(first.id, { ...assessment, status: "needs_confirmation", confidence: "medium" })).rejects.toThrow("INVALID_IDENTITY_CONFIRMATION");
    expect((await db.query(`select id from public.case_source_bindings where case_id=$1 and is_active`, [caseId])).rows).toEqual([{ id: first.id }]);
    const second = (await select(first.id, { ...assessment, status: "needs_confirmation", confidence: "medium" }, "user_confirmed")).rows[0];
    expect(second).toMatchObject({ identity_match_status: "matched", confirmed_by_user_id: owner,
      identity_match_evidence: { assessment_status: "needs_confirmation", confidence: "medium", confirmation_method: "user_confirmed" } });
    expect(second.id).not.toBe(first.id);
    await db.query(`update public.client_cases set primary_service='Plumbing' where id=$1`, [caseId]);
    expect((await db.query<{ status: string }>(`select identity_match_status as status from public.case_source_bindings where id=$1`, [second.id])).rows[0].status).toBe("matched");
    await db.query(`update public.client_cases set business_name='Changed Name' where id=$1`, [caseId]);
    const invalidated = (await db.query<{ identity_match_evidence: unknown }>(`select identity_match_status,confirmed_by_user_id,confirmed_at,is_active,identity_match_evidence from public.case_source_bindings where id=$1`, [second.id])).rows[0];
    expect(invalidated).toMatchObject({ identity_match_status: "needs_confirmation", confirmed_by_user_id: null, confirmed_at: null, is_active: true,
      identity_match_evidence: { invalidation_reason: "case_identity_changed", previous_confirmation: { user_id: owner } } });
    await db.query(`update public.client_cases set business_name='Changed Again' where id=$1`, [caseId]);
    expect((await db.query(`select identity_match_evidence from public.case_source_bindings where id=$1`, [second.id])).rows[0])
      .toEqual({ identity_match_evidence: invalidated.identity_match_evidence });
    // Historic binding and its confirmation remain intact.
    expect((await db.query(`select confirmed_by_user_id from public.case_source_bindings where id=$1`, [first.id])).rows[0]).toEqual({ confirmed_by_user_id: owner });
    await expect(select(second.id)).rejects.toThrow("IDENTITY_CHANGED");
    for (const role of ["anon", "authenticated"]) {
      const grants = await db.query<{ allowed: boolean }>(`select has_function_privilege($1,'public.select_v22_matched_google_resource(uuid,uuid,uuid,text,text,text,text,uuid,timestamptz,jsonb,text)','EXECUTE') as allowed`, [role]);
      expect(grants.rows[0].allowed).toBe(false);
    }
  });

  it("fences durable GSC sync, retries safely and commits immutable snapshots only for the current identity", async () => {
    const owner = await insertUser("gsc-sync-owner");
    const outsider = await insertUser("gsc-sync-outsider");
    const caseId = await insertCase(owner, "gsc-sync-case");
    const conn = await insertConnection(owner, "gsc-sync-connection");
    await db.query(`update public.google_connections set granted_scopes=array['openid','email','profile','https://www.googleapis.com/auth/webmasters.readonly'] where id=$1`, [conn]);
    const binding = (await db.query<{ id: string }>(`select * from public.select_v22_google_resource($1,$2,$3,'gsc','sc-domain:gsc-sync-case.example.com','GSC',null,null)`, [owner, caseId, conn])).rows[0].id;
    type SyncJob = { id: string; status: string; coverage_end: string; lease_id: string; attempt_count: number; snapshot_id: string | null; error_code: string | null };
    const request = async (key = randomUUID(), user = owner) => (await db.query<SyncJob>(`select * from public.request_v22_gsc_sync($1,$2,$3,$4)`, [user, caseId, binding, key])).rows[0];
    const claim = async (id: string) => (await db.query<{ job: SyncJob | null }>(`select public.claim_v22_gsc_sync($1) as job`, [id])).rows[0].job;
    const load = async (id: string) => (await db.query<SyncJob>(`select * from public.google_sync_jobs where id=$1`, [id])).rows[0];
    const finish = async (job: SyncJob, override: object = {}) => {
      const offset = (days: number) => new Date(new Date(`${job.coverage_end}T00:00:00Z`).getTime() - days * 86400000).toISOString().slice(0, 10);
      const payload = { schema_version: "gsc_sync_v1", resource_id: "sc-domain:gsc-sync-case.example.com",
        current: { start_date: offset(89), end_date: offset(0) }, previous: { start_date: offset(179), end_date: offset(90) }, ...override };
      return (await db.query<{ id: string | null }>(`select public.finish_v22_gsc_sync($1,$2,$3::jsonb,$4,'healthy','["GSC_TOP_ROWS_ONLY"]'::jsonb) as id`,
        [job.id, job.lease_id, JSON.stringify(payload), checksum])).rows[0].id;
    };
    await expect(request()).rejects.toThrow("SYNC_BINDING_CHANGED");
    await db.query(`update public.case_source_bindings set identity_match_status='matched' where id=$1`, [binding]);
    await expect(request(randomUUID(), outsider)).rejects.toThrow("SYNC_FORBIDDEN");
    const key = randomUUID();
    const first = await request(key);
    expect((await request(key)).id).toBe(first.id);
    await expect(request()).rejects.toThrow("SYNC_ALREADY_RUNNING");
    expect(first.status).toBe("queued");
    const run = (await claim(first.id))!;
    expect(run.attempt_count).toBe(1); expect(run.lease_id).toBeTruthy();
    expect(await claim(first.id)).toBeNull();
    await expect(finish(run, { resource_id: "sc-domain:other.example" })).rejects.toThrow("INVALID_SYNC_RESULT");
    expect(await finish(run)).toBe(first.id);
    expect(await finish(run)).toBe(first.id);
    expect((await request(key)).id).toBe(first.id);
    const stored = (await db.query<{ raw_payload: unknown; normalized_payload: unknown; expires_at: string; fetched_at: string; binding_id: string }>(`select * from public.data_snapshots where id=$1`, [first.id])).rows[0];
    expect(stored.raw_payload).toBeNull(); expect(stored.binding_id).toBe(binding);
    expect(new Date(stored.expires_at).getTime() - new Date(stored.fetched_at).getTime()).toBe(7 * 86400000);
    await expect(db.query(`update public.data_snapshots set normalized_payload='{}' where id=$1`, [first.id])).rejects.toThrow("immutable");
    const second = await request();
    const oldLease = (await claim(second.id))!;
    await db.query(`update public.google_sync_jobs set lease_expires_at=now()-interval '1 second' where id=$1`, [second.id]);
    const recovered = (await claim(second.id))!;
    expect(recovered.attempt_count).toBe(2); expect(recovered.lease_id).not.toBe(oldLease.lease_id);
    await expect(finish(oldLease)).rejects.toThrow("SYNC_LEASE_LOST");
    await db.query(`select public.fail_v22_gsc_sync($1,$2,'SYNC_GOOGLE_UNAVAILABLE',true)`, [second.id, oldLease.lease_id]);
    expect((await load(second.id)).status).toBe("running");
    await db.query(`select public.fail_v22_gsc_sync($1,$2,'SYNC_GOOGLE_UNAVAILABLE',true)`, [second.id, recovered.lease_id]);
    expect((await load(second.id)).status).toBe("queued");
    expect(await claim(second.id)).toBeNull(); // retry backoff
    await db.query(`update public.google_sync_jobs set available_at=now()-interval '1 second' where id=$1`, [second.id]);
    const thirdTry = (await claim(second.id))!;
    expect(thirdTry.attempt_count).toBe(3);
    await db.query(`select public.fail_v22_gsc_sync($1,$2,'SYNC_GOOGLE_UNAVAILABLE',true)`, [second.id, thirdTry.lease_id]);
    expect(await load(second.id)).toMatchObject({ status: "failed", error_code: "SYNC_RETRY_EXHAUSTED" });
    expect((await db.query(`select id from public.data_snapshots where binding_id=$1`, [binding])).rows).toEqual([{ id: first.id }]);
    const third = await request();
    const changingCase = (await claim(third.id))!;
    await db.query(`update public.client_cases set business_name='Changed business' where id=$1`, [caseId]);
    expect(await finish(changingCase)).toBeNull();
    expect(await load(third.id)).toMatchObject({ status: "failed", error_code: "SYNC_BINDING_CHANGED" });
    await db.query(`update public.case_source_bindings set identity_match_status='matched',confirmed_at=now(),confirmed_by_user_id=$2 where id=$1`, [binding, owner]);
    const fourth = await request();
    const replaced = (await claim(fourth.id))!;
    await db.query(`select public.select_v22_google_resource($1,$2,$3,'gsc','https://gsc-sync-case.example.com/','Other GSC',null,$4)`, [owner, caseId, conn, binding]);
    expect(await finish(replaced)).toBeNull();
    expect((await db.query(`select normalized_payload from public.data_snapshots where id=$1`, [first.id])).rows[0]).toEqual({ normalized_payload: stored.normalized_payload });
    for (const role of ["anon", "authenticated"]) {
      expect((await db.query<{ allowed: boolean }>(`select has_table_privilege($1,'public.google_sync_jobs','SELECT') as allowed`, [role])).rows[0].allowed).toBe(false);
      expect((await db.query<{ allowed: boolean }>(`select has_function_privilege($1,'public.request_v22_gsc_sync(uuid,uuid,uuid,uuid)','EXECUTE') as allowed`, [role])).rows[0].allowed).toBe(false);
      expect((await db.query<{ allowed: boolean }>(`select has_function_privilege($1,'public.finish_v22_gsc_sync(uuid,uuid,jsonb,text,text,jsonb)','EXECUTE') as allowed`, [role])).rows[0].allowed).toBe(false);
    }
  });

  it("preserves existing v2.1 reports while adding nullable v2.2 fields", async () => {
    const legacy = await db.query<{
      report_v2_1: { legacy: boolean };
      report_v2_2: null;
      case_id: null;
    }>(
      `select report_v2_1, report_v2_2, case_id
       from public.reports where id = $1`,
      [legacyReport],
    );
    expect(legacy.rows[0]).toEqual({
      report_v2_1: { legacy: true },
      report_v2_2: null,
      case_id: null,
    });
  });

  it("enforces the Case API Location key, uniqueness, identity consistency, and site immutability", async () => {
    const owner = await insertUser("case-api-owner");
    const otherOwner = await insertUser("case-api-other");
    const austin: CaseLocation = {
      display_name: "Austin, TX",
      country_code: "US",
      region: "Texas",
      city: "Austin",
      postal_code: "78701",
      latitude: 30.2672,
      longitude: -97.7431,
    };
    const dallas: CaseLocation = {
      display_name: "Dallas, TX",
      country_code: "US",
      region: "Texas",
      city: "Dallas",
      postal_code: null,
      latitude: 32.7767,
      longitude: -96.797,
    };

    const first = await insertCompleteCase(owner, "locations.example.com", "Austin", austin);
    const generated = await db.query<{ location_key: string }>(
      `select location_key from public.client_cases where id = $1`,
      [first],
    );
    expect(generated.rows[0].location_key).toBe(caseLocationKey(austin));

    await expectSqlError(
      `insert into public.client_cases (
         user_id, site_url, normalized_domain, business_name,
         business_identity, operating_model, primary_service, target_market
       ) select user_id, site_url, normalized_domain, business_name,
         business_identity, operating_model, primary_service, target_market
       from public.client_cases where id = $1`,
      [first],
    );

    await db.query(
      `update public.client_cases set status = 'archived', archived_at = now() where id = $1`,
      [first],
    );
    await expectSqlError(
      `insert into public.client_cases (
         user_id, site_url, normalized_domain, business_name,
         business_identity, operating_model, primary_service, target_market
       ) select user_id, site_url, normalized_domain, business_name,
         business_identity, operating_model, primary_service, target_market
       from public.client_cases where id = $1`,
      [first],
    );

    await expect(insertCompleteCase(owner, "locations.example.com", "Dallas", dallas)).resolves.toBeTruthy();
    await expect(insertCompleteCase(otherOwner, "locations.example.com", "Austin other", austin))
      .resolves.toBeTruthy();

    await expectSqlError(
      `update public.client_cases
       set site_url = 'https://changed.example.com/', normalized_domain = 'changed.example.com'
       where id = $1`,
      [first],
      "case site_url and normalized_domain are immutable",
    );

    const inconsistentIdentity = {
      business_name: "Wrong nested name",
      site_url: "https://identity.example.com/",
      normalized_domain: "identity.example.com",
      operating_model: "storefront",
      primary_location: austin,
      public_gbp_url: null,
    };
    await expectSqlError(
      `insert into public.client_cases (
         user_id, site_url, normalized_domain, business_name,
         business_identity, operating_model, primary_service, target_market
       ) values (
         $1, 'https://identity.example.com/', 'identity.example.com', 'Correct top-level name',
         $2::jsonb, 'storefront', 'SEO', $3::jsonb
       )`,
      [owner, JSON.stringify(inconsistentIdentity), JSON.stringify(austin)],
    );
  });

  it("accepts a valid case graph and rejects cross-user bindings", async () => {
    userA = await insertUser("owner-a");
    userB = await insertUser("owner-b");
    caseA = await insertCase(userA, "alpha");
    caseB = await insertCase(userB, "beta");
    connectionA = await insertConnection(userA, "alpha");

    bindingA = await insertId(
      `insert into public.case_source_bindings (
         case_id, connection_id, source_type, external_resource_id, external_resource_name,
         identity_match_status, health_status, confirmed_by_user_id, confirmed_at
       ) values ($1, $2, 'gbp', 'locations/alpha', 'Alpha', 'matched', 'healthy', $3, now())
       returning id`,
      [caseA, connectionA, userA],
    );

    await expectSqlError(
      `insert into public.case_source_bindings (
         case_id, connection_id, source_type, external_resource_id, external_resource_name,
         identity_match_status, health_status
       ) values ($1, $2, 'gbp', 'locations/wrong', 'Wrong', 'matched', 'healthy')`,
      [caseB, connectionA],
      "binding connection must belong to the case owner",
    );

    await expectSqlError(
      `update public.client_cases set status = 'archived' where id = $1`,
      [caseA],
    );
    await db.query(
      `update public.client_cases set status = 'archived', archived_at = now() where id = $1`,
      [caseA],
    );
    await db.query(
      `update public.client_cases set status = 'active', archived_at = null where id = $1`,
      [caseA],
    );
  });

  it("enforces connection token groups and active uniqueness", async () => {
    await expectSqlError(
      `insert into public.google_connections (
         user_id, google_subject, access_token_ciphertext
       ) values ($1, 'partial-token', decode('01', 'hex'))`,
      [userA],
    );

    await expectSqlError(
      `insert into public.google_connections (
         user_id, google_subject,
         access_token_ciphertext, access_token_iv, access_token_auth_tag,
         encryption_key_version
       ) values (
         $1, 'subject-alpha', decode('01', 'hex'), decode('02', 'hex'), decode('03', 'hex'), 'key-v1'
       )`,
      [userA],
    );

    await expectSqlError(
      `insert into public.google_connections (
         user_id, google_subject,
         access_token_ciphertext, access_token_iv, access_token_auth_tag,
         encryption_key_version
       ) values (
         $1, 'access-only', decode('01', 'hex'), decode('02', 'hex'), decode('03', 'hex'), 'key-v1'
       )`,
      [userA],
    );

    await expectSqlError(
      `update public.google_connections
       set refresh_lease_id = gen_random_uuid(), refresh_lease_expires_at = null
       where id = $1`,
      [connectionA],
    );

    await expectSqlError(
      `insert into public.case_source_bindings (
         case_id, connection_id, source_type, external_resource_id, external_resource_name,
         identity_match_status, health_status
       ) values ($1, $2, 'gbp', 'locations/duplicate', 'Duplicate', 'matched', 'healthy')`,
      [caseA, connectionA],
    );
  });

  it("enforces one-time Google OAuth sessions, Case ownership, and safe audit events", async () => {
    const sessionId = await insertId(
      `insert into public.google_oauth_sessions (
         user_id, case_id, state_digest,
         pkce_verifier_ciphertext, pkce_verifier_iv, pkce_verifier_auth_tag,
         encryption_key_version, requested_sources, requested_scopes,
         return_path, expires_at
       ) values (
         $1, $2, decode(repeat('ab', 32), 'hex'),
         decode('01', 'hex'), decode(repeat('02', 12), 'hex'), decode(repeat('03', 16), 'hex'),
         'key-v1', array['gsc'], array['scope:a'], '/cases/example', now() + interval '10 minutes'
       ) returning id`,
      [userA, caseA],
    );
    expect(sessionId).toBeTruthy();

    await expectSqlError(
      `insert into public.google_oauth_sessions (
         user_id, case_id, state_digest,
         pkce_verifier_ciphertext, pkce_verifier_iv, pkce_verifier_auth_tag,
         encryption_key_version, requested_sources, requested_scopes,
         return_path, expires_at
       ) values (
         $1, $2, decode(repeat('cd', 32), 'hex'),
         decode('01', 'hex'), decode(repeat('02', 12), 'hex'), decode(repeat('03', 16), 'hex'),
         'key-v1', array['gsc'], array['scope:a'], '/cases/example', now() + interval '10 minutes'
       )`,
      [userA, caseB],
      "OAuth session Case must belong to its user",
    );

    await expectSqlError(
      `insert into public.google_oauth_sessions (
         user_id, state_digest,
         pkce_verifier_ciphertext, pkce_verifier_iv, pkce_verifier_auth_tag,
         encryption_key_version, requested_sources, requested_scopes,
         return_path, expires_at
       ) values (
         $1, decode(repeat('ef', 32), 'hex'),
         decode('01', 'hex'), decode(repeat('02', 12), 'hex'), decode(repeat('03', 16), 'hex'),
         'key-v1', array['gsc'], array['scope:a'], '//attacker.example', now() + interval '10 minutes'
       )`,
      [userA],
    );

    await db.query(
      `insert into public.google_connection_events (
         user_id, connection_id, case_id, event_type,
         requested_sources, covered_sources, result_code, request_id
       ) values ($1, $2, $3, 'authorization_succeeded', array['gsc'], array['gsc'], 'OK', 'req-1')`,
      [userA, connectionA, caseA],
    );

    await db.query(
      `insert into public.google_token_broker_requests (
         request_id, nonce_digest, connection_id, source_type, requested_at, expires_at
       ) values ('broker-request-1', decode(repeat('aa', 32), 'hex'), $1, 'gsc', now(), now() + interval '1 minute')`,
      [connectionA],
    );
    await expectSqlError(
      `insert into public.google_token_broker_requests (
         request_id, nonce_digest, connection_id, source_type, requested_at, expires_at
       ) values ('broker-request-2', decode(repeat('aa', 32), 'hex'), $1, 'gsc', now(), now() + interval '1 minute')`,
      [connectionA],
    );

    const cleaned = await db.query<{ cleanup_expired_google_oauth_sessions: number }>(
      `select public.cleanup_expired_google_oauth_sessions(now() + interval '2 days')`,
    );
    expect(cleaned.rows[0].cleanup_expired_google_oauth_sessions).toBe(1);
    const brokerCleaned = await db.query<{ cleanup_expired_google_token_broker_requests: number }>(
      `select public.cleanup_expired_google_token_broker_requests(now() + interval '2 days')`,
    );
    expect(brokerCleaned.rows[0].cleanup_expired_google_token_broker_requests).toBe(1);
  });

  it("enforces snapshot ownership, lineage, retention, and immutability", async () => {
    siteSnapshotA = await insertId(
      `insert into public.data_snapshots (
         case_id, source_type, schema_version, sync_trigger, health_status,
         normalized_payload, raw_payload, payload_checksum
       ) values ($1, 'site', '1.0', 'report_generation', 'healthy', '{}'::jsonb, '{}'::jsonb, $2)
       returning id`,
      [caseA, checksum],
    );

    gbpSnapshotA = await insertId(
      `insert into public.data_snapshots (
         case_id, binding_id, source_type, schema_version, sync_trigger, health_status,
         normalized_payload, raw_payload, payload_checksum, retention_policy, expires_at
       ) values (
         $1, $2, 'gbp', '1.0', 'user_sync', 'healthy', '{}'::jsonb, '{"private":"raw"}'::jsonb,
         $3, 'gbp_content_30d', now() + interval '30 days'
       ) returning id`,
      [caseA, bindingA, checksum],
    );

    await expectSqlError(
      `insert into public.data_snapshots (
         case_id, binding_id, source_type, schema_version, sync_trigger, health_status,
         normalized_payload, payload_checksum
       ) values ($1, $2, 'gbp', '1.0', 'retry', 'healthy', '{}'::jsonb, $3)`,
      [caseB, bindingA, checksum],
      "snapshot binding must match snapshot case and source",
    );

    await expectSqlError(
      `insert into public.data_snapshots (
         case_id, source_type, schema_version, sync_trigger, health_status,
         normalized_payload, payload_checksum, supersedes_snapshot_id
       ) values ($1, 'site', '1.0', 'retry', 'healthy', '{}'::jsonb, $2, $3)`,
      [caseB, checksum, siteSnapshotA],
      "superseded snapshot must match snapshot case and source",
    );

    await expectSqlError(
      `insert into public.data_snapshots (
         case_id, binding_id, source_type, schema_version, sync_trigger, health_status,
         normalized_payload, raw_payload, payload_checksum, retention_policy, expires_at
       ) values (
         $1, $2, 'gbp', '1.0', 'retry', 'healthy', '{}'::jsonb, '{}'::jsonb,
         $3, 'gbp_content_30d', now() + interval '31 days'
       )`,
      [caseA, bindingA, checksum],
    );

    await expectSqlError(
      `update public.data_snapshots set normalized_payload = '{"changed":true}'::jsonb where id = $1`,
      [siteSnapshotA],
      "data snapshots are immutable",
    );

    await db.query(
      `update public.data_snapshots
       set raw_payload = null, raw_content_deleted_at = now()
       where id = $1`,
      [gbpSnapshotA],
    );
    await expectSqlError(
      `update public.data_snapshots set raw_payload = '{}'::jsonb where id = $1`,
      [gbpSnapshotA],
      "only one-way GBP raw content cleanup is allowed",
    );
  });

  it("enforces report ownership, snapshots, version lineage, and immutability", async () => {
    prospectReportA = await insertId(
      `insert into public.reports (
         report_id, user_id, page_url, gbp_url, access_type,
         case_id, report_type, schema_version, version_number,
         report_v2_2, snapshot_ids, coverage_state, version_diff, generation_config,
         ruleset_version, copy_model_version
       ) values (
         'v22-prospect-a', $1, 'https://alpha.example.com', '', 'free_trial',
         $2, 'prospect', '2.2', 1,
         '{}'::jsonb, array[$3::uuid], '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
         'rules-v1', 'copy-v1'
       ) returning id`,
      [userA, caseA, siteSnapshotA],
    );

    verifiedReportA = await insertId(
      `insert into public.reports (
         report_id, user_id, page_url, gbp_url, access_type,
         case_id, report_type, schema_version, version_number, parent_report_id,
         report_v2_2, snapshot_ids, coverage_state, version_diff, generation_config,
         ruleset_version, copy_model_version
       ) values (
         'v22-verified-a', $1, 'https://alpha.example.com', '', 'paid_credit',
         $2, 'verified_execution', '2.2', 2, $3,
         '{}'::jsonb, array[$4::uuid], '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
         'rules-v1', 'copy-v1'
       ) returning id`,
      [userA, caseA, prospectReportA, gbpSnapshotA],
    );

    await expectSqlError(
      `insert into public.reports (
         report_id, user_id, page_url, gbp_url, access_type,
         case_id, report_type, schema_version, version_number,
         report_v2_2, snapshot_ids, coverage_state, version_diff, generation_config,
         ruleset_version, copy_model_version
       ) values (
         'v22-cross-user', $1, 'https://beta.example.com', '', 'free_trial',
         $2, 'prospect', '2.2', 1,
         '{}'::jsonb, array[$3::uuid], '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
         'rules-v1', 'copy-v1'
       )`,
      [userB, caseA, siteSnapshotA],
      "report case must belong to the report user",
    );

    await expectSqlError(
      `insert into public.reports (
         report_id, user_id, page_url, gbp_url, access_type,
         case_id, report_type, schema_version, version_number,
         report_v2_2, snapshot_ids, coverage_state, version_diff, generation_config,
         ruleset_version, copy_model_version
       ) values (
         'v22-duplicate-snapshots', $1, 'https://alpha.example.com', '', 'free_trial',
         $2, 'prospect', '2.2', 3,
         '{}'::jsonb, array[$3::uuid, $3::uuid], '{}'::jsonb, '{}'::jsonb, '{}'::jsonb,
         'rules-v1', 'copy-v1'
       )`,
      [userA, caseA, siteSnapshotA],
      "snapshot_ids must not contain duplicates or nulls",
    );

    await expectSqlError(
      `update public.reports set report_v2_2 = '{"changed":true}'::jsonb where id = $1`,
      [prospectReportA],
      "completed v2.2 report payloads are immutable",
    );
    await db.query(`update public.reports set status = 'paid_full' where id = $1`, [prospectReportA]);

    const pendingReport = await insertId(
      `insert into public.reports (
         report_id, user_id, page_url, gbp_url, access_type,
         case_id, report_type, schema_version, version_number
       ) values (
         'v22-pending-a', $1, 'https://alpha.example.com', '', 'free_trial',
         $2, 'prospect', '2.2', 3
       ) returning id`,
      [userA, caseA],
    );
    await db.query(
      `update public.reports set
         report_v2_2 = '{}'::jsonb,
         snapshot_ids = array[$2::uuid],
         coverage_state = '{}'::jsonb,
         version_diff = '{}'::jsonb,
         generation_config = '{}'::jsonb,
         ruleset_version = 'rules-v1',
         copy_model_version = 'copy-v1'
       where id = $1`,
      [pendingReport, siteSnapshotA],
    );
    await expectSqlError(
      `update public.reports set ruleset_version = 'rules-v2' where id = $1`,
      [pendingReport],
      "completed v2.2 report payloads are immutable",
    );

    await db.query(
      `update public.client_cases set latest_report_id = $2 where id = $1`,
      [caseA, verifiedReportA],
    );
    await expectSqlError(
      `update public.client_cases set latest_report_id = $2 where id = $1`,
      [caseB, verifiedReportA],
      "latest_report_id must reference a report owned by the same case and user",
    );

    await expectSqlError(
      `delete from public.reports where id = $1`,
      [prospectReportA],
    );
  });

  it("rotates one unguessable client share and enforces its user, Case, and report boundary", async () => {
    const firstHash = "a".repeat(64);
    const secondHash = "b".repeat(64);
    const first = await db.query<{ rotate_v22_report_share: string }>(
      `select public.rotate_v22_report_share($1, $2, $3, $4, now() + interval '30 days')`,
      [userA, caseA, prospectReportA, firstHash],
    );
    expect(first.rows[0].rotate_v22_report_share).toBeTruthy();

    const second = await db.query<{ rotate_v22_report_share: string }>(
      `select public.rotate_v22_report_share($1, $2, $3, $4, now() + interval '30 days')`,
      [userA, caseA, prospectReportA, secondHash],
    );
    expect(second.rows[0].rotate_v22_report_share).not.toBe(first.rows[0].rotate_v22_report_share);

    const shares = await db.query<{ token_hash: string; revoked_at: string | null; view_mode: string }>(
      `select token_hash, revoked_at, view_mode
       from public.report_shares where report_id = $1 order by created_at`,
      [prospectReportA],
    );
    expect(shares.rows).toHaveLength(2);
    expect(shares.rows[0].revoked_at).not.toBeNull();
    expect(shares.rows[1]).toMatchObject({ token_hash: secondHash, revoked_at: null, view_mode: "client" });

    await expectSqlError(
      `select public.rotate_v22_report_share($1, $2, $3, $4, now() + interval '30 days')`,
      [userB, caseA, prospectReportA, "c".repeat(64)],
      "report share target does not belong to user and case",
    );
    await expectSqlError(
      `select public.rotate_v22_report_share($1, $2, $3, 'predictable', now() + interval '30 days')`,
      [userA, caseA, prospectReportA],
      "invalid report share parameters",
    );
  });

  it("applies job callback revisions atomically and never regresses a terminal state", async () => {
    const jobId = await insertId(
      `insert into public.analysis_jobs (
         case_id, job_type, current_stage, idempotency_key
       ) values ($1, 'prospect_report', 'queued', 'revision-job')
       returning id`,
      [caseA],
    );

    const running = await db.query<{
      found: boolean; applied: boolean; terminal_effects_applied: boolean; state_revision: bigint;
    }>(
      `select * from public.apply_analysis_job_event(
         $1, $2, 2, 'running', 'collecting_site', 10::smallint, 1,
         null, 'Running', '{}'::jsonb, now(), null
       )`,
      [jobId, caseA],
    );
    expect(running.rows[0]).toMatchObject({ found: true, applied: true, terminal_effects_applied: false });

    const stale = await db.query<{ applied: boolean; state_revision: bigint }>(
      `select applied, state_revision from public.apply_analysis_job_event(
         $1, $2, 1, 'queued', 'queued', 0::smallint, 0,
         null, 'Queued', '{}'::jsonb, null, null
       )`,
      [jobId, caseA],
    );
    expect(stale.rows[0].applied).toBe(false);
    expect(Number(stale.rows[0].state_revision)).toBe(2);

    const succeeded = await db.query<{ applied: boolean; terminal_effects_applied: boolean }>(
      `select applied, terminal_effects_applied from public.apply_analysis_job_event(
         $1, $2, 3, 'succeeded', 'completed', 100::smallint, 1,
         null, 'Complete', '{"provider_calls":2}'::jsonb, now(), now()
       )`,
      [jobId, caseA],
    );
    expect(succeeded.rows[0]).toEqual({ applied: true, terminal_effects_applied: true });

    const downgrade = await db.query<{ applied: boolean; state_revision: bigint }>(
      `select applied, state_revision from public.apply_analysis_job_event(
         $1, $2, 4, 'running', 'evaluating', 80::smallint, 2,
         null, 'Running again', '{}'::jsonb, now(), null
       )`,
      [jobId, caseA],
    );
    expect(downgrade.rows[0].applied).toBe(false);
    expect(Number(downgrade.rows[0].state_revision)).toBe(3);

    const persisted = await db.query<{
      status: string; state_revision: bigint; terminal_effects_revision: bigint;
    }>(
      `select status, state_revision, terminal_effects_revision
       from public.analysis_jobs where id = $1`,
      [jobId],
    );
    expect(persisted.rows[0].status).toBe("succeeded");
    expect(Number(persisted.rows[0].state_revision)).toBe(3);
    expect(Number(persisted.rows[0].terminal_effects_revision)).toBe(3);
  });

  it("fulfills one Case entitlement idempotently and returns it after a technical failure", async () => {
    const owner = await insertUser("payment-owner");
    const paidCase = await insertCase(owner, "paid-case");
    const localOrderId = await insertId(
      `insert into public.orders (
         user_id, case_id, purchase_kind, amount, currency, credits_purchased, status
       ) values ($1, $2, 'case_prospect_report', 1900, 'USD', 0, 'pending')
       returning id`,
      [owner, paidCase],
    );

    const first = await db.query<{ fulfilled: boolean; idempotent: boolean; entitlement_status: string }>(
      `select * from public.fulfill_v22_case_payment($1, 'pay_case_1', 'clerk_payment-owner', $2, 1900, 'USD')`,
      [localOrderId, paidCase],
    );
    expect(first.rows[0]).toEqual({ fulfilled: true, idempotent: false, entitlement_status: "available" });

    const duplicate = await db.query<{ fulfilled: boolean; idempotent: boolean }>(
      `select fulfilled, idempotent from public.fulfill_v22_case_payment($1, 'pay_case_1', 'clerk_payment-owner', $2, 1900, 'USD')`,
      [localOrderId, paidCase],
    );
    expect(duplicate.rows[0]).toEqual({ fulfilled: true, idempotent: true });
    const entitlementCount = await db.query<{ count: number }>(
      `select count(*)::int as count from public.case_report_entitlements where case_id = $1`,
      [paidCase],
    );
    expect(entitlementCount.rows[0].count).toBe(1);

    const failedReport = await insertId(
      `insert into public.reports (
         report_id, user_id, page_url, gbp_url, access_type,
         case_id, report_type, schema_version, version_number
       ) values ('paid-failed-report', $1, 'https://paid-case.example.com', '', 'paid_credit', $2, 'prospect', '2.2', 1)
       returning id`,
      [owner, paidCase],
    );
    const failedJob = await insertId(
      `insert into public.analysis_jobs (
         case_id, report_id, job_type, current_stage, idempotency_key
       ) values ($1, $2, 'prospect_report', 'queued', 'paid-failed-job') returning id`,
      [paidCase, failedReport],
    );
    const reserved = await db.query<{ reserved: boolean; idempotent: boolean }>(
      `select * from public.reserve_v22_case_report_entitlement($1, $2, $3)`,
      [owner, paidCase, failedJob],
    );
    expect(reserved.rows[0]).toEqual({ reserved: true, idempotent: false });

    await db.query(
      `select * from public.apply_analysis_job_event(
         $1, $2, 1, 'failed', 'failed', 40::smallint, 1,
         'PROVIDER_TIMEOUT', 'Please retry.', '{}'::jsonb, now(), now()
       )`,
      [failedJob, paidCase],
    );
    const returned = await db.query<{ status: string; reserved_job_id: string | null }>(
      `select status, reserved_job_id from public.case_report_entitlements where case_id = $1`,
      [paidCase],
    );
    expect(returned.rows[0]).toEqual({ status: "available", reserved_job_id: null });

    const completedReport = await insertId(
      `insert into public.reports (
         report_id, user_id, page_url, gbp_url, access_type,
         case_id, report_type, schema_version, version_number
       ) values ('paid-completed-report', $1, 'https://paid-case.example.com', '', 'paid_credit', $2, 'prospect', '2.2', 2)
       returning id`,
      [owner, paidCase],
    );
    const completedJob = await insertId(
      `insert into public.analysis_jobs (
         case_id, report_id, job_type, current_stage, idempotency_key
       ) values ($1, $2, 'prospect_report', 'queued', 'paid-completed-job') returning id`,
      [paidCase, completedReport],
    );
    await db.query(`select * from public.reserve_v22_case_report_entitlement($1, $2, $3)`, [owner, paidCase, completedJob]);
    await db.query(
      `select * from public.apply_analysis_job_event(
         $1, $2, 1, 'succeeded', 'completed', 100::smallint, 1,
         null, 'Complete', '{}'::jsonb, now(), now()
       )`,
      [completedJob, paidCase],
    );
    const consumed = await db.query<{ status: string; consumed_report_id: string }>(
      `select status, consumed_report_id from public.case_report_entitlements where case_id = $1`,
      [paidCase],
    );
    expect(consumed.rows[0]).toEqual({ status: "consumed", consumed_report_id: completedReport });

    await expectSqlError(
      `select * from public.fulfill_v22_case_payment($1, 'pay_case_1', 'clerk_payment-owner', $2, 1900, 'USD')`,
      [localOrderId, caseB],
      "case payment case does not belong to user",
    );
  });

  it("enforces job idempotency and performs the designed deletion cascades", async () => {
    await insertId(
      `insert into public.analysis_jobs (
         case_id, report_id, job_type, status, current_stage, progress,
         idempotency_key, completed_at
       ) values ($1, $2, 'verified_report', 'succeeded', 'complete', 100, 'job-a', now())
       returning id`,
      [caseA, verifiedReportA],
    );

    await expectSqlError(
      `insert into public.analysis_jobs (
         case_id, report_id, job_type, current_stage, idempotency_key
       ) values ($1, $2, 'verified_report', 'queued', 'job-cross')`,
      [caseB, verifiedReportA],
      "analysis job report must belong to the same case",
    );
    await expectSqlError(
      `insert into public.analysis_jobs (
         case_id, job_type, current_stage, idempotency_key
       ) values ($1, 'source_sync', 'queued', 'job-a')`,
      [caseA],
    );

    await expectSqlError(
      `insert into public.analysis_jobs (
         case_id, job_type, status, current_stage, progress, idempotency_key, completed_at
       ) values ($1, 'source_sync', 'succeeded', 'complete', 99, 'bad-success', now())`,
      [caseA],
    );
    await expectSqlError(
      `insert into public.analysis_jobs (
         case_id, job_type, status, current_stage, idempotency_key, completed_at
       ) values ($1, 'source_sync', 'failed', 'complete', 'bad-failure', now())`,
      [caseA],
    );

    await db.query(`delete from public.client_cases where id = $1`, [caseA]);
    const remainingGraph = await db.query<{ count: number }>(
      `select (
         (select count(*) from public.reports where case_id = $1) +
         (select count(*) from public.data_snapshots where case_id = $1) +
         (select count(*) from public.case_source_bindings where case_id = $1) +
         (select count(*) from public.analysis_jobs where case_id = $1)
       )::int as count`,
      [caseA],
    );
    expect(remainingGraph.rows[0].count).toBe(0);
    const preservedConnection = await db.query<{ count: number }>(
      `select count(*)::int as count from public.google_connections where id = $1`,
      [connectionA],
    );
    expect(preservedConnection.rows[0].count).toBe(1);

    const userC = await insertUser("owner-c");
    const caseC = await insertCase(userC, "gamma");
    const connectionC = await insertConnection(userC, "gamma");
    await db.query(
      `insert into public.case_source_bindings (
         case_id, connection_id, source_type, external_resource_id, external_resource_name,
         identity_match_status, health_status
       ) values ($1, $2, 'gsc', 'sites/gamma', 'Gamma', 'matched', 'healthy')`,
      [caseC, connectionC],
    );

    await db.query(`delete from public.users where id = $1`, [userC]);
    const userGraph = await db.query<{ count: number }>(
      `select (
         (select count(*) from public.client_cases where user_id = $1) +
         (select count(*) from public.google_connections where user_id = $1)
       )::int as count`,
      [userC],
    );
    expect(userGraph.rows[0].count).toBe(0);
  });

  it("requires reauthorization and terminal Google connections to clear all token material", async () => {
    await expectSqlError(
      `update public.google_connections set status = 'reauth_required' where id = $1`,
      [connectionA],
      "inactive Google connections must not retain token material",
    );

    await expectSqlError(
      `update public.google_connections set status = 'revoked', revoked_at = now() where id = $1`,
      [connectionA],
      "inactive Google connections must not retain token material",
    );

    await db.query(
      `update public.google_connections set
         status = 'revoked', revoked_at = now(),
         access_token_ciphertext = null, access_token_iv = null, access_token_auth_tag = null,
         refresh_token_ciphertext = null, refresh_token_iv = null, refresh_token_auth_tag = null,
         encryption_key_version = null, token_expires_at = null
       where id = $1`,
      [connectionA],
    );
  });

  it("atomically reserves a paid job and persists its exact snapshot graph before success", async () => {
    const owner = await insertUser("result-owner");
    const caseId = await insertCase(owner, "result");
    const orderId = await insertId(
      `insert into public.orders (
         user_id, case_id, purchase_kind, payment_id, amount, currency,
         credits_purchased, status, paid_at
       ) values ($1, $2, 'case_prospect_report', 'pay_result_1', 1900, 'USD', 0, 'paid', now())
       returning id`,
      [owner, caseId],
    );
    await db.query(
      `insert into public.case_report_entitlements (user_id, case_id, order_id)
       values ($1, $2, $3)`,
      [owner, caseId, orderId],
    );
    const jobId = "77777777-7777-4777-8777-777777777777";
    const siteId = "88888888-8888-4888-8888-888888888888";
    const serpId = "99999999-9999-4999-8999-999999999999";
    const competitorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const now = "2026-09-04T08:00:00Z";

    const started = await db.query<{ job_id: string; created: boolean; idempotent: boolean }>(
      `select * from public.start_v22_prospect_analysis($1, $2, $3, 'analyze:result:1')`,
      [owner, caseId, jobId],
    );
    expect(started.rows[0]).toEqual({ job_id: jobId, created: true, idempotent: false });
    const replay = await db.query<{ job_id: string; created: boolean; idempotent: boolean }>(
      `select * from public.start_v22_prospect_analysis($1, $2, $3, 'analyze:result:1')`,
      [owner, caseId, jobId],
    );
    expect(replay.rows[0]).toEqual({ job_id: jobId, created: false, idempotent: true });

    const sitePayload = { schema_version: "site_inventory_snapshot_v1", completed_at: now, limitations: [] };
    const serpPayload = { schema_version: "serp_market_snapshot_v1", completed_at: now, limitations: [] };
    const competitorPayload = {
      schema_version: "competitor_collection_snapshot_v1",
      job_id: jobId,
      market_snapshot_id: serpId,
      market_snapshot_checksum: checksum,
      completed_at: now,
      limitations: [],
    };
    const reportPayload = {
      identity: {
        case_id: caseId,
        business: { site_url: "https://result.example.com", public_gbp_url: null },
      },
      report_version: {
        report_id: jobId,
        report_type: "prospect",
        schema_version: "2.2.0",
        version_number: 1,
        parent_report_id: null,
        generated_at: now,
        ruleset_version: "rules-v1",
        copy_model_version: "copy-v1",
      },
      data_coverage: { sources: [] },
      evidence_index: [{ snapshot_id: siteId }],
      version_diff: { kind: "initial", parent_report_id: null, entries: [] },
    };
    const persistArgs = [
      jobId, caseId,
      siteId, JSON.stringify(sitePayload), checksum,
      serpId, JSON.stringify(serpPayload), checksum, "2026-09-04T09:00:00Z",
      competitorId, JSON.stringify(competitorPayload), checksum,
      JSON.stringify(reportPayload),
    ];
    const persisted = await db.query<{ report_id: string; idempotent: boolean }>(
      `select * from public.persist_v22_prospect_result(
         $1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8, $9,
         $10, $11::jsonb, $12, $13::jsonb
       )`,
      persistArgs,
    );
    expect(persisted.rows[0]).toEqual({ report_id: jobId, idempotent: false });
    const persistedAgain = await db.query<{ report_id: string; idempotent: boolean }>(
      `select * from public.persist_v22_prospect_result(
         $1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8, $9,
         $10, $11::jsonb, $12, $13::jsonb
       )`,
      persistArgs,
    );
    expect(persistedAgain.rows[0]).toEqual({ report_id: jobId, idempotent: true });

    await db.query(
      `select * from public.apply_analysis_job_event(
         $1, $2, 1, 'succeeded', 'completed', 100::smallint, 1,
         null, 'Complete', '{}'::jsonb, now(), now()
       )`,
      [jobId, caseId],
    );
    const graph = await db.query<{
      snapshots: number; report_id: string; latest_report_id: string; entitlement_status: string;
    }>(
      `select
         (select count(*)::int from public.data_snapshots where case_id = $1) as snapshots,
         (select report_id from public.analysis_jobs where id = $2) as report_id,
         (select latest_report_id from public.client_cases where id = $1) as latest_report_id,
         (select status from public.case_report_entitlements where case_id = $1) as entitlement_status`,
      [caseId, jobId],
    );
    expect(graph.rows[0]).toEqual({
      snapshots: 3,
      report_id: jobId,
      latest_report_id: jobId,
      entitlement_status: "consumed",
    });
  });
});
