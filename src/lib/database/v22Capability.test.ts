import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import first from "../report-capability/contracts/fixtures/first_service-0.json";
import firstOne from "../report-capability/contracts/fixtures/first_service-1.json";
import firstTwo from "../report-capability/contracts/fixtures/first_service-2.json";
import firstThree from "../report-capability/contracts/fixtures/first_service-3.json";
import acquired from "../report-capability/contracts/fixtures/acquisition-0.json";
import { canonicalDigest, canonicalJsonText } from "../verified-analysis-v22/digest";
import { validateCapabilityReport } from "../report-capability/validate";
import { parseVersionedTaskStatus } from "../analysis-v22/versioned-status";
import {defaultPlanningSettings} from "../planning-settings/contracts";

let db: PGlite;
const tables = ["case_business_scope_versions", "analysis_input_manifests", "analysis_manifest_snapshots", "capability_report_versions", "report_content_revisions"];
const json = JSON.stringify;

async function fixture(options: { acquisition?: boolean; expired?: boolean; expiresInMs?: number; unhealthy?: boolean; materials?: boolean; missingDebit?: boolean; actionCount?: 0 | 1 | 2 | 3; skipPublicSnapshots?: boolean } = {}) {
  const report = structuredClone(options.acquisition ? acquired : [first, firstOne, firstTwo, firstThree][options.actionCount ?? (options.materials ? 1 : 0)]);
  const m = report.input_manifest;
  const owner = randomUUID(), caseId = randomUUID(), job = randomUUID(), connection = randomUUID();
  const evaluated = new Date(Date.now() - 1000).toISOString();
  const fetched = new Date(Date.now() - 86400000).toISOString();
  const expires = new Date(Date.now() + (options.expired ? -3600000 : options.expiresInMs ?? 86400000)).toISOString();
  Object.assign(m, { id: randomUUID(), job_id: job, user_id: owner, case_id: caseId, evaluated_at: evaluated });
  Object.assign(m.business, { id: randomUUID(), user_id: owner, case_id: caseId, confirmed_at: fetched });
  report.id = job; report.generated_at = new Date().toISOString();
  await db.query("insert into public.users(id,clerk_user_id,email) values($1,$2,$3)", [owner, `clerk-${owner}`, `${owner}@example.invalid`]);
  await db.query("select public.register_v22_clerk_user($1,decode(repeat('01',32),'hex'),$2,null)", [`clerk-${owner}`, `${owner}@example.invalid`]);
  await db.query(`insert into public.client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
    values($1,$2,'https://clinic.example.invalid/emergency','clinic.example.invalid','Clinic','{}','storefront','Emergency dental care','{}')`, [caseId, owner]);
  await db.query(`insert into public.google_connections(id,user_id,google_subject,granted_scopes,access_token_ciphertext,access_token_iv,access_token_auth_tag,refresh_token_ciphertext,refresh_token_iv,refresh_token_auth_tag,encryption_key_version,token_expires_at)
    values($1,$2,$3,array['scope:test'],decode('01','hex'),decode('02','hex'),decode('03','hex'),decode('04','hex'),decode('05','hex'),decode('06','hex'),'test-key',now()+interval '1 hour')`, [connection, owner, owner]);
  for (const s of m.snapshots) {
    Object.assign(s, { snapshot_id: randomUUID(), case_id: caseId, fetched_at: fetched, expires_at: expires });
    const privateSource = s.source_kind === "gsc" || s.source_kind === "ga4";
    s.binding_id = privateSource ? randomUUID() : null;
    const source = s.source_kind === "public_gbp" ? "gbp" : s.source_kind;
    if (s.binding_id) await db.query(`insert into public.case_source_bindings(id,case_id,connection_id,source_type,external_resource_id,external_resource_name,identity_match_status,health_status,confirmed_by_user_id,confirmed_at)
      values($1,$2,$3,$4,$5,'Synthetic resource','matched','healthy',$6,now())`, [s.binding_id, caseId, connection, source, `${source}-resource`, owner]);
    const payload = { schema_version: s.schema_version, resource_id: `${source}-resource`, identity_match_status: "matched", health_status: "healthy", completed_at: fetched };
    s.payload_checksum = canonicalDigest(payload);
    if (!options.skipPublicSnapshots || privateSource) await db.query(`insert into public.data_snapshots(id,case_id,binding_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum,coverage_start,coverage_end,provider_request_context)
      values($1,$2,$3,$4,$5,$6,$7,'report_generation',$8,$9::jsonb,$10,$11,$12,$13::jsonb)`, [s.snapshot_id, caseId, s.binding_id, source, s.schema_version, fetched, expires, options.unhealthy ? "unhealthy" : "healthy", json(payload), s.payload_checksum,
        privateSource ? fetched.slice(0,10) : null, privateSource ? fetched.slice(0,10) : null, json({ external_resource_id: `${source}-resource` })]);
  }
  report.evidence[0].snapshot_id = m.snapshots[0].snapshot_id;
  report.evidence[0].observed_at = fetched; report.findings[0].observed_at = fetched;
  m.input_checksum = canonicalDigest(Object.fromEntries(Object.entries(m).filter(([key]) => key !== "input_checksum")));
  await db.query(`select public.save_v22_business_scope($1,$2,0,$3::jsonb)`, [owner, caseId, json(m.business)]);
  await db.query(`insert into public.analysis_jobs(id,case_id,job_type,current_stage,idempotency_key) values($1,$2,$3,'queued',$4)`, [job, caseId, options.acquisition ? "prospect_report" : "verified_report", job]);
  // Fixture represents an existing reserved one-credit task. P1 freeze must not debit again.
  await db.query("update public.users set credit_balance=credit_balance-1 where id=$1", [owner]);
  await db.query(`insert into public.workflow_charges(id,user_id,case_id,workflow_kind,idempotency_key,analysis_job_id,discovery_job_id)
    values($1,$2,$3,$4,$6,$1,$5)`, [job, owner, caseId, options.acquisition ? "prospect" : "verified", options.acquisition ? randomUUID() : null, job]);
  if (!options.missingDebit) await db.query(`insert into public.credit_ledger(user_id,case_id,workflow_charge_id,analysis_job_id,kind,delta,balance_after,idempotency_key)
    values($1,$2,$3,$3,$4,-1,4,$5)`, [owner, caseId, job, options.acquisition ? "prospect_debit" : "verified_debit", `debit-${job}`]);
  const freeze = (body = m, user = owner) => db.query<{ payload: typeof m }>(`select * from public.freeze_v22_analysis_manifest($1,$2,$3,$4::jsonb,$5)`,
    [user, caseId, job, json(body), canonicalJsonText(Object.fromEntries(Object.entries(body).filter(([key]) => key !== "input_checksum")))]);
  const store = () => db.query(`select * from public.store_v22_capability_report($1,$2,$3,$4::jsonb,$5)`, [owner, caseId, job, json(report), canonicalJsonText(report)]);
  const complete = (body = report, generation = 1, user = owner) => db.query<{ report_id: string; idempotent: boolean; payload_checksum: string }>(
    `select * from public.complete_v22_capability_analysis($1,$2,$3,$4::jsonb,$5,$6)`, [user, caseId, job, json(body), canonicalJsonText(body), generation]);
  const completed = (user = owner) => db.query<{ payload: unknown }>(
    `select * from public.get_v22_completed_capability_report($1,$2,$3)`, [user, caseId, job]);
  const revision = { schema_version: "v22_delivery_revision_v1", report_id: job, user_id: owner, case_id: caseId, expected_revision: 0,
    source_checksum: canonicalDigest(report), status: "approved", title: report.title, summary: report.summary, client_note: null,
    actions: report.actions.map(({ finding_ids: _findings, dependencies: _dependencies, ...action }) => structuredClone(action)) };
  const save = (body = revision, user = owner) => db.query(`select * from public.save_v22_report_content_revision($1,$2,$3,$4::jsonb)`, [user, caseId, job, json(body)]);
  return { owner, caseId, job, connection, m, report, freeze, store, revision, save, complete, completed };
}

// SQL-boundary fixtures intentionally contain minimal synthetic source objects;
// application-shaped generation/worker integration is tested in the backend.
async function recipeFixture(acquisition = true, alternatePrivateHeaders = false, expiresInMs?: number, missingDebit = false) {
  const f = await fixture({ acquisition, skipPublicSnapshots: true, expiresInMs, missingDebit });
  const sources = f.m.snapshots.slice(0,4).map((s) => {
    const type = s.source_kind === "public_gbp" ? "gbp" : s.source_kind;
    return { kind: s.source_kind, binding: { snapshot_id: s.snapshot_id, case_id: f.caseId, source_type: type, schema_version: s.schema_version,
      payload_checksum: s.payload_checksum, fetched_at: s.fetched_at, expires_at: s.expires_at, health_status: "healthy", identity_match_status: "matched" },
      payload: { schema_version: s.schema_version, resource_id: `${type}-resource`, identity_match_status: "matched", health_status: "healthy", completed_at: s.fetched_at } };
  });
  const pub = { evidence_input: { context: { purpose: "SQL boundary fixture" }, sources } };
  const firstParty = f.m.snapshots.slice(4).map((s) => ({ snapshot_id: s.snapshot_id, case_id: f.caseId, binding_id: s.binding_id,
    source_type: s.source_kind, schema_version: s.schema_version, fetched_at: s.fetched_at, expires_at: s.expires_at, identity_match_status: "matched", health_status: "healthy", health_reasons: [],
    normalized_payload: { schema_version: s.schema_version, resource_id: `${s.source_kind}-resource`, identity_match_status: "matched", health_status: "healthy", completed_at: s.fetched_at },
    raw_payload: null, payload_checksum: s.payload_checksum, external_resource_id: `${s.source_kind}-resource`, coverage_start: s.fetched_at.slice(0,10), coverage_end: s.fetched_at.slice(0,10) }));
  if (alternatePrivateHeaders) {
    firstParty.reverse();
    for (const source of firstParty) for (const field of ["fetched_at", "expires_at"] as const) source[field] = source[field].replace(/\.(\d{3})Z$/, (_match, ms: string) => `.${ms}000Z`);
  }
  const body = acquisition ? pub : { public_input: pub, first_party_input: { case_id: f.caseId, parent_report_id: null, evaluated_at: f.m.evaluated_at, snapshots: firstParty } };
  const recipe = { schema_version: "v22_generation_recipe_v1", request: structuredClone(body) };
  const stripped = acquisition ? recipe.request as typeof pub : (recipe.request as { public_input: typeof pub }).public_input;
  for (const s of stripped.evidence_input.sources) delete (s as Partial<typeof s>).payload;
  if (!acquisition) for (const snapshot of (recipe.request as { first_party_input: { snapshots: Array<Partial<typeof firstParty[number]>> } }).first_party_input.snapshots) {
    delete snapshot.normalized_payload; delete snapshot.raw_payload;
  }
  f.m.generation_input_checksum = canonicalDigest(body);
  f.m.input_checksum = canonicalDigest(Object.fromEntries(Object.entries(f.m).filter(([key]) => key !== "input_checksum")));
  const canonicals = Object.fromEntries(sources.map((s) => [s.kind, canonicalJsonText(s.payload)]));
  const prepare = (r = recipe, user = f.owner) => db.query(`select * from public.prepare_v22_capability_analysis_input($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7,$8::jsonb,null,1)`,
    [user,f.caseId,f.job,json(f.m),canonicalJsonText(Object.fromEntries(Object.entries(f.m).filter(([key]) => key !== "input_checksum"))),json(r),canonicalJsonText(body),json(canonicals)]);
  const resolve = (generation=1) => db.query<{ value: { request: unknown; completed_report: unknown } }>(`select public.resolve_v22_capability_analysis_input($1,$2,$3,$4,$5) as value`, [f.job,f.caseId,f.m.id,f.m.input_checksum,generation]);
  return { ...f, body, recipe, prepare, resolve };
}

async function preparationFixture(missingDebit = false) {
  const f = await recipeFixture(true, false, undefined, missingDebit);
  const business = f.m.business;
  const request = { schema_version: "v22_analysis_request_envelope_v1", analyze_request: {
    case_id: f.caseId, report_type: "prospect", business_identity: { site_url: business.site_url },
    primary_service: business.primary_service, target_market: { display_name: business.target_market },
    competitors: business.competitor_sites.map((website_url) => ({ website_url })),
    queries: ["service one", "service two", "service three"], first_party_snapshots: [],
  }, competitor_discovery: { discovery_id: randomUUID() } };
  for (const target of [f.body, f.recipe.request]) Object.assign(target, {
    business_identity: request.analyze_request.business_identity,
    evidence_input: { ...(target as { evidence_input: object }).evidence_input, context: {
      queries: request.analyze_request.queries, target_market: request.analyze_request.target_market,
      competitors: request.analyze_request.competitors,
    } },
  });
  f.m.generation_input_checksum = canonicalDigest(f.body);
  f.m.input_checksum = canonicalDigest(Object.fromEntries(Object.entries(f.m).filter(([key]) => key !== "input_checksum")));
  const begin = (body = request, user = f.owner, businessId = business.id, key = f.job) => db.query<{value:Record<string, unknown>}>(
    "select public.begin_v22_acquisition_preparation($1,$2,$3,$4,$5,$6) as value",
    [user, f.caseId, f.job, key, businessId, canonicalJsonText(body)]);
  return { ...f, request, begin };
}

describe.sequential("P1 isolated capability persistence", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
    for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }, 30000);
  afterAll(async () => { await db.close(); });

  async function implementationFixture(options: {acquisition?: boolean; uncompleted?: boolean; draft?: boolean} = {}) {
    const f = await fixture({actionCount: 1, acquisition: options.acquisition});
    await f.freeze(); await f.store(); if (!options.uncompleted) await f.complete();
    if (options.draft) f.revision.status = "draft";
    const delivery = (await f.save()).rows[0] as {id: string; revision: number};
    const entry = {action_id: f.report.actions[0]?.id ?? "none", scope: "The approved service page", implemented_on: new Date(Date.now() - 86400000).toISOString().slice(0, 10), timezone: "UTC", note: null, responsible: null};
    const root = randomUUID();
    function payload(entries: unknown[] = [entry], expected = 0) {
      const content = {schema_version: "v22_implementation_record_v1", id: root, user_id: f.owner, case_id: f.caseId, report_id: f.job,
        report_checksum: canonicalDigest(f.report), delivery_revision_id: delivery.id, delivery_revision: delivery.revision,
        revision: expected + 1, recorded_at: new Date().toISOString(), entries};
      return {...content, checksum: canonicalDigest(content)};
    }
    const save = (body = payload(), expected = 0, owner: string = f.owner, caseId: string = f.caseId, reportId: string = f.job, revisionId: string = delivery.id) => db.query<{value: ReturnType<typeof payload>}>(
      "select public.save_v22_implementation_record($1,$2,$3,$4,$5,$6::jsonb,$7) value", [owner, caseId, reportId, revisionId, expected, json(body), canonicalJsonText(Object.fromEntries(Object.entries(body).filter(([key]) => key !== "checksum")))]);
    const read = (owner: string = f.owner, caseId: string = f.caseId, reportId: string = f.job, revisionId: string = delivery.id) => db.query<{payload: ReturnType<typeof payload>}>(
      "select * from public.get_v22_implementation_records($1,$2,$3,$4)", [owner, caseId, reportId, revisionId]);
    return {...f, entry, delivery, payload, saveImplementation: save, readImplementation: read};
  }
  it("saves free implementation snapshots, corrects dates without mutation, and recovers a lost acknowledgement", async () => {
    const f = await implementationFixture(), firstPayload = f.payload();
    const ledgerBefore = (await db.query("select * from public.credit_ledger where user_id=$1", [f.owner])).rows;
    expect((await f.readImplementation()).rows).toEqual([]);
    const saved = (await f.saveImplementation(firstPayload)).rows[0].value;
    expect(saved).toEqual(firstPayload);
    expect((await f.saveImplementation(f.payload())).rows[0].value).toEqual(saved);
    const corrected = {...f.entry, implemented_on: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), note: "Corrected the go-live date"};
    await f.saveImplementation(f.payload([corrected], 1), 1);
    const history = (await f.readImplementation()).rows.map(row => row.payload);
    expect(history.map(row => row.revision)).toEqual([2, 1]);
    expect(history[0].entries[0]).toEqual(corrected); expect(history[1]).toEqual(saved);
    expect((await db.query("select * from public.credit_ledger where user_id=$1", [f.owner])).rows).toEqual(ledgerBefore);
    expect((await db.query("select credit_balance from public.users where id=$1", [f.owner])).rows[0]).toEqual({credit_balance: 4});
    await expect(db.query("update public.capability_implementation_records set revision=9 where id=$1", [saved.id])).rejects.toThrow("CAPABILITY_VERSION_IMMUTABLE");
    await expect(db.query("delete from public.capability_implementation_records where id=$1", [saved.id])).rejects.toThrow("CAPABILITY_VERSION_IMMUTABLE");
  });
  it("rejects a stale competing correction, retains pinned approved history, and supports removing an incorrect mark", async () => {
    const f = await implementationFixture(); await f.saveImplementation();
    await expect(f.saveImplementation(f.payload([{...f.entry, scope: "Other change"}]))).rejects.toThrow("IMPLEMENTATION_CONFLICT");
    await f.saveImplementation(f.payload([], 1), 1);
    const newer = {...f.revision, expected_revision: 1, status: "draft"}; await f.save(newer);
    expect((await f.readImplementation()).rows.map(row => row.payload.entries.length)).toEqual([0, 1]);
    expect((await db.query("select count(*)::integer n from public.analysis_jobs where case_id=$1", [f.caseId])).rows[0]).toEqual({n: 1});
  });
  it.each(["owner", "case", "report", "revision"])("denies %s substitution for reads and saves", async key => {
    const f = await implementationFixture();
    const args: [string, string, string, string] = [f.owner, f.caseId, f.job, f.delivery.id];
    args[["owner", "case", "report", "revision"].indexOf(key)] = randomUUID();
    await expect(f.readImplementation(...args)).rejects.toThrow("IMPLEMENTATION_SOURCE_NOT_FOUND");
    await expect(f.saveImplementation(f.payload(), 0, ...args)).rejects.toThrow("IMPLEMENTATION_SOURCE_NOT_FOUND");
  });
  it.each(["prospect", "uncompleted", "draft"])("rejects %s as an implementation source", async kind => {
    const f = await implementationFixture({acquisition: kind === "prospect", uncompleted: kind === "uncompleted", draft: kind === "draft"});
    await expect(f.readImplementation()).rejects.toThrow("IMPLEMENTATION_SOURCE_NOT_FOUND");
    await expect(f.saveImplementation()).rejects.toThrow("IMPLEMENTATION_SOURCE_NOT_FOUND");
  });
  it.each(["future", "calendar", "timezone", "action", "duplicate", "extra", "empty-scope", "oversize", "false-note"])("rejects invalid implementation %s at the SQL boundary", async kind => {
    const f = await implementationFixture();
    const e = {...f.entry, ...(kind === "future" ? {implemented_on: "2999-01-01"} : kind === "calendar" ? {implemented_on: "2026-02-30"} : kind === "timezone" ? {timezone: "not/a/zone"}
      : kind === "action" ? {action_id: "foreign-action"} : kind === "extra" ? {page_verified: true} : kind === "empty-scope" ? {scope: " "} : kind === "oversize" ? {scope: "x".repeat(2001)} : kind === "false-note" ? {note: false} : {})};
    await expect(f.saveImplementation(f.payload(kind === "duplicate" ? [e, e] : [e]))).rejects.toThrow("IMPLEMENTATION_INVALID");
    expect((await f.readImplementation()).rows).toEqual([]);
  });
  it("denies direct writes and client reads; only service-role RPCs can record work", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      expect((await db.query<{allowed: boolean}>("select has_table_privilege($1,'public.capability_implementation_records','INSERT') allowed", [role])).rows[0].allowed).toBe(false);
      if (role !== "service_role") expect((await db.query<{allowed: boolean}>("select has_table_privilege($1,'public.capability_implementation_records','SELECT') allowed", [role])).rows[0].allowed).toBe(false);
      expect((await db.query<{allowed: boolean}>("select has_function_privilege($1,'public.v22_implementation_source(uuid,uuid,uuid,uuid)','EXECUTE') allowed", [role])).rows[0].allowed).toBe(false);
    }
  });

  async function sharedMarketFixture(shared?: {snapshot_id:string;source_job_id:string;input_digest:string;snapshot_checksum:string;created_at:string;expires_at:string;snapshot:Record<string,unknown>;schema_version:string}) {
    const f=await recipeFixture();
    if(!("evidence_input" in f.body))throw new Error("Expected acquisition fixture");
    const body=f.body;
    const src=body.evidence_input.sources[1];
    const payload={...src.payload,job_id:randomUUID(),started_at:src.binding.fetched_at};
    shared??={schema_version:"competitor_shared_market_v1",snapshot_id:randomUUID(),source_job_id:payload.job_id,
      input_digest:"sha256:"+"a".repeat(64),snapshot_checksum:canonicalDigest(payload),
      created_at:src.binding.fetched_at,expires_at:src.binding.expires_at,snapshot:payload};
    const bindingId=(await db.query<{value:string}>("select v22_case_market_binding_id($1,$2) value",[f.caseId,shared.snapshot_id])).rows[0].value;
    Object.assign(src,{payload:shared.snapshot,shared_snapshot:structuredClone(shared)});
    Object.assign(src.binding,{snapshot_id:bindingId,payload_checksum:shared.snapshot_checksum,fetched_at:shared.snapshot.completed_at,expires_at:shared.expires_at});
    Object.assign(f.m.snapshots[1],{snapshot_id:bindingId,payload_checksum:shared.snapshot_checksum,fetched_at:shared.snapshot.completed_at,expires_at:shared.expires_at});
    const prepare=async()=>{
      const recipe={schema_version:"v22_generation_recipe_v1",request:structuredClone(body)};
      for(const s of recipe.request.evidence_input.sources){
        delete (s as Partial<typeof s>).payload;
        const header=(s as unknown as {shared_snapshot?:Record<string,unknown>}).shared_snapshot;
        if(header)delete header.snapshot;
      }
      f.m.generation_input_checksum=canonicalDigest(f.body);
      f.m.input_checksum=canonicalDigest(Object.fromEntries(Object.entries(f.m).filter(([key])=>key!=="input_checksum")));
      return db.query("select * from prepare_v22_capability_analysis_input($1,$2,$3,$4::jsonb,$5,$6::jsonb,$7,$8::jsonb,null,1)",
        [f.owner,f.caseId,f.job,json(f.m),canonicalJsonText(Object.fromEntries(Object.entries(f.m).filter(([key])=>key!=="input_checksum"))),
          json(recipe),canonicalJsonText(body),json(Object.fromEntries(body.evidence_input.sources.map(s=>[s.kind,canonicalJsonText(s.payload)])))]);
    };
    return {...f,shared,src,bindingId,prepare};
  }

  it("matches the Python case binding identity vector",async()=>{
    expect((await db.query<{value:string}>("select v22_case_market_binding_id($1,$2) value",["00000000-0000-0000-0000-000000000001","00000000-0000-0000-0000-000000000002"])).rows[0].value)
      .toBe("65d722a8-874d-3176-9ec7-1e9269194fe5");
  });

  it("persists one shared source under two owners with isolated Case references and unchanged source times",async()=>{
    const first=await sharedMarketFixture(); await first.prepare();
    const second=await sharedMarketFixture(first.shared); await second.prepare(); await second.prepare();
    expect(first.owner).not.toBe(second.owner);expect(first.bindingId).not.toBe(second.bindingId);
    const origins=(await db.query("select source_id from capability_shared_market_origins where source_id=$1",[first.shared.snapshot_id])).rows;
    expect(origins).toHaveLength(1);
    for(const f of [first,second]){
      const hydrated=(await f.resolve()).rows[0].value.request as {evidence_input:{sources:Array<Record<string,unknown>>}};
      expect(hydrated.evidence_input.sources[1]).toMatchObject({payload:first.shared.snapshot,shared_snapshot:first.shared,
        binding:{snapshot_id:f.bindingId,case_id:f.caseId,expires_at:first.shared.expires_at,fetched_at:first.shared.snapshot.completed_at}});
      expect((await db.query("select delta from credit_ledger where workflow_charge_id=$1",[f.job])).rows).toEqual([{delta:-1}]);
      await expect(db.query("select resolve_v22_capability_analysis_input($1,$2,$3,$4,1)",[f.job,randomUUID(),f.m.id,f.m.input_checksum])).rejects.toThrow();
    }
    expect((await db.query("select snapshot_id from capability_case_market_bindings where source_id=$1",[first.shared.snapshot_id])).rows).toHaveLength(2);
  });

  it.each(["expiry","payload","source-job","digest","binding","private-kind","recipe"])("rejects changed shared origin or forged binding and rolls back: %s",async(kind)=>{
    const first=await sharedMarketFixture();await first.prepare();
    const shared=structuredClone(first.shared);
    if(kind==="expiry")shared.expires_at=new Date(Date.parse(shared.expires_at)+60000).toISOString();
    if(kind==="source-job")shared.source_job_id=randomUUID();
    if(kind==="digest")shared.input_digest="sha256:"+"b".repeat(64);
    if(kind==="payload"){
      shared.snapshot.resource_id="different-observation";
      shared.snapshot_checksum=canonicalDigest(shared.snapshot);
    }
    const second=await sharedMarketFixture(shared);
    if(kind==="binding")second.src.binding.snapshot_id=first.bindingId;
    if(kind==="private-kind")second.src.kind="gsc";
    if(kind==="recipe")second.m.business.id=randomUUID(); // Failure after registering the source binding.
    await expect(second.prepare()).rejects.toThrow();
    expect((await db.query("select snapshot_id from capability_case_market_bindings where case_id=$1",[second.caseId])).rows).toHaveLength(0);
    expect((await db.query("select id from data_snapshots where id=$1",[second.bindingId])).rows).toHaveLength(0);
    expect((await db.query("select delta from credit_ledger where workflow_charge_id=$1",[second.job])).rows).toEqual([{delta:-1}]);
  });

  it("does not leave a newly registered global origin after the core transaction fails",async()=>{
    const f=await sharedMarketFixture();f.m.business.id=randomUUID();
    await expect(f.prepare()).rejects.toThrow();
    expect((await db.query("select source_id from capability_shared_market_origins where source_id=$1",[f.shared.snapshot_id])).rows).toHaveLength(0);
  });

  it("keeps shared registry immutable and denies direct client/server table access or bypassing the wrapper",async()=>{
    const f=await sharedMarketFixture();await f.prepare();
    await expect(db.query("update capability_shared_market_origins set expires_at=expires_at+interval '1 day' where source_id=$1",[f.shared.snapshot_id])).rejects.toThrow();
    await expect(db.query("delete from capability_case_market_bindings where snapshot_id=$1",[f.bindingId])).rejects.toThrow();
    for(const role of ["anon","authenticated","service_role"]){
      for(const table of ["capability_shared_market_origins","capability_case_market_bindings"]){
        expect((await db.query<{value:boolean}>("select has_table_privilege($1,$2,'select') value",[role,table])).rows[0].value).toBe(false);
      }
      expect((await db.query<{value:boolean}>("select has_function_privilege($1,'prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)','execute') value",[role])).rows[0].value).toBe(false);
    }
  });

  async function intakeFixture() {
    const owner=randomUUID(), caseId=randomUUID(), job=randomUUID(), workflow=randomUUID(), discovery=randomUUID();
    await db.query("select public.register_v22_clerk_user($1,decode(repeat('01',32),'hex'),$2,null)",[ `clerk-${owner}`,`${owner}@example.invalid`]);
    const registered=await db.query<{id:string}>("select id from users where clerk_user_id=$1",[`clerk-${owner}`]);
    const user=registered.rows[0].id;
    await db.query(`insert into client_cases(id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market)
      values($1,$2,'https://clinic.example.invalid/','clinic.example.invalid','Clinic','{}','storefront','Emergency care','{}')`,[caseId,user]);
    await db.query("select * from start_v22_prospect_discovery($1,$2,$3,$4,$5,$6)",[user,caseId,workflow,discovery,`workflow:${workflow}`,`discover:${discovery}`]);
    const request={schema_version:"v22_analysis_request_envelope_v1",analyze_request:{case_id:caseId,report_type:"prospect",
      business_identity:{site_url:"https://clinic.example.invalid/"},primary_service:"Emergency care",target_market:{display_name:"Austin"},
      competitors:[{website_url:"https://competitor.example.invalid/"}],queries:["emergency care Austin"],first_party_snapshots:[],parent_report:null},
      competitor_discovery:{discovery_id:discovery}};
    const start=(body=request, override: {user?:string; discovery?:string; key?:string; previous?:string}={})=>db.query<{value:Record<string,unknown>}>(
      "select start_v22_acquisition_intake($1,$2,$3,$4,$5,$6,$7,$8) value",
      [override.user??user,caseId,workflow,job,override.key??`analyze:${job}`,override.discovery??discovery,canonicalJsonText(body),override.previous??null]);
    const status=(id=user)=>db.query<{value:Record<string,unknown>|null}>("select get_v22_acquisition_status($1,$2) value",[id,job]);
    return {user,caseId,job,workflow,discovery,request,start,status};
  }

  it("saves planning settings for the owner, recovers a lost save and freezes without another credit",async()=>{
    const f=await intakeFixture(),settings={...defaultPlanningSettings(),priority:"contact_path",target_pages:["https://clinic.example.invalid/emergency/"]};
    const save=(revision:number,value=settings,user=f.user)=>db.query<{value:{revision:number;settings:unknown}}>("select save_v22_case_planning_settings($1,$2,$3,$4) value",[user,f.caseId,revision,json(value)]);
    const first=(await save(0)).rows[0].value;expect(first.revision).toBe(1);expect(first.settings).toEqual(settings);
    expect((await save(0)).rows[0].value).toEqual(first);
    await expect(save(0,{...settings,priority:"business_identity"})).rejects.toThrow("PLANNING_SETTINGS_CONFLICT");
    await expect(save(1,settings,randomUUID())).rejects.toThrow("PLANNING_CASE_NOT_FOUND");
    const start=(revision:number)=>db.query("select start_v22_acquisition_intake_with_planning($1,$2,$3,$4,$5,$6,$7,null,$8)",
      [f.user,f.caseId,f.workflow,f.job,`analyze:${f.job}`,f.discovery,canonicalJsonText(f.request),revision]);
    await expect(start(0)).rejects.toThrow("PLANNING_SETTINGS_CONFLICT");
    expect((await db.query("select * from case_business_scope_versions where case_id=$1",[f.caseId])).rows).toHaveLength(0);
    await start(1);
    const scope=(await db.query<{scope:Record<string,unknown>}>("select scope from case_business_scope_versions where case_id=$1",[f.caseId])).rows[0].scope;
    expect(scope).toMatchObject({priority:"contact_path",target_pages:settings.target_pages,execution_conditions:settings.execution_conditions});
    await save(1,{...settings,priority:"business_identity"});await start(1);
    expect((await db.query<{scope:unknown}>("select scope from case_business_scope_versions where case_id=$1",[f.caseId])).rows).toEqual([{scope}]);
    expect((await db.query("select delta from credit_ledger where workflow_charge_id=$1",[f.workflow])).rows).toEqual([{delta:-1}]);
    await expect(db.query("update case_planning_settings set settings='{}' where case_id=$1",[f.caseId])).rejects.toThrow("CAPABILITY_VERSION_IMMUTABLE");
  });

  it.each(["foreign","credentials","fragment","missing","extra","bad-condition"])("rejects invalid planning %s at the SQL boundary",async mutation=>{
    const f=await intakeFixture(),settings:Record<string,unknown>={...defaultPlanningSettings(),target_pages:["https://clinic.example.invalid/emergency/"]};
    if(mutation==="foreign")settings.target_pages=["https://other.example.invalid/"];
    if(mutation==="credentials")settings.target_pages=["https://user@clinic.example.invalid/"];
    if(mutation==="fragment")settings.target_pages=["https://clinic.example.invalid/#details"];
    if(mutation==="missing")delete settings.priority;
    if(mutation==="extra")settings.untrusted="x";
    if(mutation==="bad-condition")settings.execution_conditions={capacity:"unlimited",publishing_access:"unknown"};
    await expect(db.query("select save_v22_case_planning_settings($1,$2,0,$3)",[f.user,f.caseId,json(settings)])).rejects.toThrow("PLANNING_SETTINGS_INVALID");
  });

  it("keeps planning tables and helpers inaccessible to client roles",async()=>{
    for(const role of ["anon","authenticated"]){
      expect((await db.query<{value:boolean}>("select has_table_privilege($1,'case_planning_settings','select') value",[role])).rows[0].value).toBe(false);
      for(const signature of ["get_v22_case_planning_settings(uuid,uuid)","save_v22_case_planning_settings(uuid,uuid,integer,jsonb)","apply_v22_case_planning(uuid,uuid,jsonb)","confirm_v22_first_service_entry_with_planning(uuid,uuid,uuid,uuid,uuid,uuid,text,integer)"])
        expect((await db.query<{value:boolean}>("select has_function_privilege($1,$2,'execute') value",[role,signature])).rows[0].value).toBe(false);
    }
  });

  it("enforces new delivery prerequisites inside SQL, without retroactively changing old revisions",async()=>{
    const f=await fixture({actionCount:3});
    // Minimal SQL-boundary trace. Actual generator and semantic replay are
    // independently exercised with source-shaped fixtures in both languages.
    f.report.actions[1]!.dependencies=[];f.report.actions[2]!.dependencies=[];
    Object.assign(f.report,{prioritization:{rules_version:"v22_business_priority_v2",candidates:f.report.actions.map((a,i)=>({input:{action_id:a.id},prerequisite:i===0?"access_indexing":"none"}))}});
    f.revision.source_checksum=canonicalDigest(f.report);
    await f.freeze();await f.complete();
    const reverse={...f.revision,actions:[...f.revision.actions].reverse()};
    await expect(f.save(reverse)).rejects.toThrow("CAPABILITY_ORDER_INVALID");
    // Independent work may move after the fixed prerequisite boundary.
    const allowed={...f.revision,actions:[f.revision.actions[0],f.revision.actions[2],f.revision.actions[1]]};
    await expect(f.save(allowed)).resolves.toBeTruthy();
    expect((await db.query("select revision from report_content_revisions where report_id=$1",[f.job])).rows).toEqual([{revision:1}]);
  });

  it("atomically enrolls the paid discovery workflow and replays without another scope or debit",async()=>{
    const f=await intakeFixture();
    const first=(await f.start()).rows[0].value;
    expect(first).toMatchObject({request:f.request,status:"queued",run_generation:1});
    const before=(await f.status()).rows[0].value;
    expect(before).toMatchObject({job_id:f.job,status:"queued",stage:"queued",report:null,error:null});
    expect(parseVersionedTaskStatus(before,f.job,f.caseId).ok).toBe(true);
    expect((await f.start()).rows[0].value).toEqual(first);
    expect((await f.status()).rows[0].value).toEqual(before);
    expect((await f.status(randomUUID())).rows[0].value).toBeNull();
    const scope=(await db.query<{scope:Record<string,unknown>}>("select scope from case_business_scope_versions where case_id=$1",[f.caseId])).rows;
    expect(scope).toHaveLength(1);
    expect(scope[0].scope).toMatchObject({confirmation_source:"seo_confirmation",target_pages:[],priority:null,primary_service:"Emergency care"});
    expect((await db.query("select delta from credit_ledger where workflow_charge_id=$1",[f.workflow])).rows).toEqual([{delta:-1}]);
    await db.query("select claim_v22_acquisition_preparation($1,1,$2,3)",[f.job,randomUUID()]);
    const running=(await f.status()).rows[0].value;
    expect(running).toMatchObject({status:"running",stage:"collecting_site"});
    expect(parseVersionedTaskStatus(running,f.job,f.caseId).ok).toBe(true);
  });

  it.each(['UTC','Asia/Shanghai','America/Los_Angeles'])('uses UTC scope confirmation at acquisition intake in %s',async zone=>{
    const previous=(await db.query<{TimeZone:string}>('show timezone')).rows[0].TimeZone;
    try{
      await db.query("select set_config('TimeZone',$1,false)",[zone]);
      const f=await intakeFixture();await f.start();
      const read=async()=>(await db.query<{scope:{confirmed_at:string};valid:boolean}>(
        "select scope,(scope->>'confirmed_at')::timestamptz<=now() valid from case_business_scope_versions where case_id=$1",[f.caseId])).rows[0];
      const first=await read();expect(first.valid).toBe(true);
      expect(first.scope.confirmed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/);
      await f.start();expect(await read()).toEqual(first);
    }finally{await db.query("select set_config('TimeZone',$1,false)",[previous]);}
  });

  it.each(["owner","discovery","schema","private","previous"])("rolls back new scope and task on rejected intake: %s",async(kind)=>{
    const f=await intakeFixture(); const body=structuredClone(f.request);
    if(kind==="schema")body.schema_version="invalid";
    if(kind==="private")Object.assign(body.analyze_request,{first_party_snapshots:[{}]});
    await expect(f.start(body,{...(kind==="owner"?{user:randomUUID()}:{}),...(kind==="discovery"?{discovery:randomUUID()}:{}),...(kind==="previous"?{previous:randomUUID()}: {})})).rejects.toThrow();
    expect((await db.query("select id from analysis_jobs where id=$1",[f.job])).rows).toEqual([]);
    expect((await db.query("select id from case_business_scope_versions where case_id=$1",[f.caseId])).rows).toEqual([]);
    expect((await db.query("select state,analysis_job_id from workflow_charges where id=$1",[f.workflow])).rows).toEqual([{state:"reserved",analysis_job_id:null}]);
    expect((await db.query("select delta from credit_ledger where workflow_charge_id=$1",[f.workflow])).rows).toEqual([{delta:-1}]);
  });

  it.each(["query","key","discovery","previous"])("rejects changed enrolled intake without another debit: %s",async(kind)=>{
    const f=await intakeFixture(); await f.start(); const body=structuredClone(f.request);
    if(kind==="query")body.analyze_request.queries=["different question"];
    if(kind==="discovery")body.competitor_discovery.discovery_id=randomUUID();
    await expect(f.start(body,{...(kind==="key"?{key:"another-intent"}:{}),...(kind==="previous"?{previous:randomUUID()}: {})})).rejects.toThrow();
    expect((await db.query("select delta from credit_ledger where workflow_charge_id=$1",[f.workflow])).rows).toEqual([{delta:-1}]);
  });

  it("does not adopt a legacy-bound job",async()=>{
    const f=await intakeFixture();
    await db.query("select * from bind_v22_prospect_analysis($1,$2,$3,$4,$5,null)",[f.user,f.caseId,f.workflow,f.job,`analyze:${f.job}`]);
    await expect(f.start()).rejects.toThrow("CAPABILITY_INTAKE_CONFLICT");
    expect((await f.status()).rows[0].value).toBeNull();
  });

  it("reads failed preparation safely and replays without starting again or refunding twice",async()=>{
    const f=await intakeFixture(); await f.start();
    await db.query("update analysis_jobs set deadline_at=now()-interval '1 second',created_at=now()-interval '21 minutes' where id=$1",[f.job]);
    await db.query("select * from expire_v22_prepared_capability_jobs(100)");
    expect((await f.status()).rows[0].value).toMatchObject({status:"failed",stage:"failed",report:null,error:{error_code:"ANALYSIS_FAILED",retryable:false}});
    expect(parseVersionedTaskStatus((await f.status()).rows[0].value,f.job,f.caseId).ok).toBe(true);
    expect((await f.start()).rows[0].value).toMatchObject({status:"failed"});
    await db.query("select * from expire_v22_prepared_capability_jobs(100)");
    expect((await db.query("select delta from credit_ledger where workflow_charge_id=$1 order by delta",[f.workflow])).rows).toEqual([{delta:-1},{delta:1}]);
  });

  it("keeps intake and preparation status service-only",async()=>{
    for(const signature of ["lookup_v22_acquisition_intake(uuid,uuid,uuid,uuid,text,uuid,jsonb,uuid)","start_v22_acquisition_intake(uuid,uuid,uuid,uuid,text,uuid,text,uuid)","get_v22_acquisition_status(uuid,uuid)"]) {
      for(const role of ["anon","authenticated","service_role"]) {
        expect((await db.query<{allowed:boolean}>("select has_function_privilege($1,$2,'execute') allowed",[role,signature])).rows[0].allowed).toBe(role==="service_role");
      }
    }
  });

  async function queuedPreparation() {
    const f = await preparationFixture(); await f.begin();
    const token = randomUUID();
    const claim = (lease = token, generation = 1, maximum = 3) => db.query<{value:Record<string,unknown>}>(
      "select claim_v22_acquisition_preparation($1,$2,$3,$4) value", [f.job,generation,lease,maximum]);
    const pulse = (lease = token, generation = 1) => db.query<{value:boolean}>(
      "select heartbeat_v22_acquisition_preparation($1,$2,$3,$4::jsonb) value", [f.job,generation,lease,json({cost_schema_version:1,cost_ledger_revision:2})]);
    const freeze = (lease = token) => db.query<{value:unknown}>(
      "select freeze_v22_acquisition_preparation($1,$2::jsonb,$3::jsonb) value", [lease,json({cost_schema_version:1,cost_ledger_revision:3}),json({
        p_user_id:f.owner,p_case_id:f.caseId,p_job_id:f.job,p_manifest:f.m,
        p_manifest_canonical:canonicalJsonText(Object.fromEntries(Object.entries(f.m).filter(([key])=>key!=="input_checksum"))),
        p_recipe:f.recipe,p_generation_canonical:canonicalJsonText(f.body),
        p_public_source_canonicals:Object.fromEntries((f.body as {evidence_input:{sources:Array<{kind:string,payload:unknown}>}}).evidence_input.sources.map(s=>[s.kind,canonicalJsonText(s.payload)])),
        p_previous_canonical:null,p_run_generation:1,
      })]);
    return {...f,token,claim,pulse,freeze};
  }

  it("persists owner-readable preparation milestones under the same lease without changing the credit or deadline", async () => {
    const f = await queuedPreparation(); await f.claim();
    const before = (await db.query<{deadline_at:string;progress:number;state_revision:number}>("select deadline_at,progress,state_revision from analysis_jobs where id=$1",[f.job])).rows[0];
    const advance = (stage:string, lease=f.token, generation=1) => db.query<{value:boolean}>(
      "select advance_v22_acquisition_stage($1,$2,$3,$4) value", [f.job,generation,lease,stage]);
    expect((await advance("collecting_site",randomUUID())).rows[0].value).toBe(false);
    expect((await advance("collecting_site",f.token,2)).rows[0].value).toBe(false);
    expect((await advance("completed")).rows[0].value).toBe(false);
    await db.exec("set role service_role");
    try { expect((await advance("collecting_market")).rows[0].value).toBe(true); } finally { await db.exec("reset role"); }
    for (const stage of ["collecting_market","collecting_site","collecting_competitors","building_evidence"]) {
      expect((await advance(stage)).rows[0].value).toBe(true);
      const status = (await db.query<{value:Record<string,unknown>}>("select get_v22_acquisition_status($1,$2) value",[f.owner,f.job])).rows[0].value;
      expect(status.stage).toBe(stage);
      expect(status.progress).toBe(before.progress);
      if (stage === "collecting_competitors") expect(status.message).toContain("competitors");
    }
    const after = (await db.query<{deadline_at:string;state_revision:number}>("select deadline_at,state_revision from analysis_jobs where id=$1",[f.job])).rows[0];
    expect(after.deadline_at).toEqual(before.deadline_at);
    expect(after.state_revision).toBeGreaterThan(before.state_revision);
    expect((await db.query("select delta from credit_ledger where workflow_charge_id=$1",[f.job])).rows).toEqual([{delta:-1}]);
    expect((await db.query<{value:unknown}>("select get_v22_acquisition_status($1,$2) value",[randomUUID(),f.job])).rows[0].value).toBeNull();
    await f.freeze();
    expect((await advance("collecting_site")).rows[0].value).toBe(false);
    await f.complete();
    expect((await advance("collecting_site")).rows[0].value).toBe(false);
  });

  it("rejects expired preparation milestone writers and restricts the function to the worker role", async () => {
    const f = await queuedPreparation(); await f.claim();
    await db.query("update capability_acquisition_runs set lease_until=now()-interval '1 second' where job_id=$1",[f.job]);
    expect((await db.query<{value:boolean}>("select advance_v22_acquisition_stage($1,1,$2,'collecting_site') value",[f.job,f.token])).rows[0].value).toBe(false);
    for (const role of ["anon","authenticated","service_role"]) {
      expect((await db.query<{allowed:boolean}>("select has_function_privilege($1,'public.advance_v22_acquisition_stage(uuid,integer,uuid,text)','execute') allowed",[role])).rows[0].allowed).toBe(role === "service_role");
    }
  });

  it("claims preparation once and preserves the original task, charge and deadline",async()=>{
    const f=await queuedPreparation();
    const original=(await f.begin()).rows[0].value;
    expect((await f.claim()).rows[0].value).toMatchObject({outcome:"claimed",attempt_count:1,request:f.request,
      preparation:{job_id:f.job,created_at:original.created_at,deadline_at:original.deadline_at}});
    expect((await f.claim(randomUUID())).rows[0].value).toEqual({outcome:"busy"});
    expect((await f.pulse()).rows[0].value).toBe(true);
    expect((await db.query<{credit_balance:number}>("select credit_balance from users where id=$1",[f.owner])).rows[0].credit_balance).toBe(4);
  });

  it("fences expired/replaced lease holders, including attempts to bypass the freeze wrapper",async()=>{
    const f=await queuedPreparation(); await f.claim();
    expect((await f.pulse(randomUUID())).rows[0].value).toBe(false);
    await expect(f.prepare()).rejects.toThrow("CAPABILITY_PREPARATION_LEASE_LOST");
    await db.query("update capability_acquisition_runs set lease_until=now()-interval '1 second' where job_id=$1",[f.job]);
    expect((await f.pulse()).rows[0].value).toBe(false);
    await expect(f.freeze()).rejects.toThrow("CAPABILITY_PREPARATION_LEASE_LOST");
    const replacement=randomUUID();
    expect((await f.claim(replacement)).rows[0].value).toMatchObject({outcome:"claimed",attempt_count:2});
    await expect(f.freeze()).rejects.toThrow("CAPABILITY_PREPARATION_LEASE_LOST");
    await f.freeze(replacement);
  });

  it("atomically hands frozen sources, revisions, attempts and costs to formal execution",async()=>{
    const f=await queuedPreparation(); await f.claim(); await f.pulse(); await f.freeze();
    const ready=(await f.claim(randomUUID())).rows[0].value;
    expect(ready).toMatchObject({outcome:"ready",attempt_count:1,preparation:{dispatch:{status:"queued",attempt_count:1,
      cost_counters:{cost_ledger_revision:3},request:{capability_request:{manifest_id:f.m.id}}}}});
    const before=(await db.query<{state_revision:number}>("select state_revision from analysis_jobs where id=$1",[f.job])).rows[0].state_revision;
    expect((await f.pulse()).rows[0].value).toBe(false);
    expect((await db.query<{state_revision:number}>("select state_revision from analysis_jobs where id=$1",[f.job])).rows[0].state_revision).toBe(before);
    await f.complete();
    expect((await f.claim(randomUUID())).rows[0].value).toMatchObject({outcome:"ready",preparation:{dispatch:{status:"succeeded"}}});
    expect((await db.query<{credit_balance:number}>("select credit_balance from users where id=$1",[f.owner])).rows[0].credit_balance).toBe(4);
  });

  it.each(["generation","exhausted","expired","failed"])("does not start ineligible queued preparation: %s",async(kind)=>{
    const f=await queuedPreparation();
    if(kind==="exhausted") await db.query("update analysis_jobs set attempt_count=3 where id=$1",[f.job]);
    if(kind==="expired") await db.query("update analysis_jobs set created_at=now()-interval '2 hour',deadline_at=now()-interval '1 hour' where id=$1",[f.job]);
    if(kind==="failed") await db.query("update analysis_jobs set status='failed',current_stage='failed',completed_at=now(),error_code='TEST_FAILURE' where id=$1",[f.job]);
    expect((await f.claim(f.token,kind==="generation"?2:1)).rows[0].value).toEqual({outcome:"inactive"});
  });

  it("rolls back freeze and handoff metadata together when source validation fails",async()=>{
    const f=await queuedPreparation(); await f.claim();
    const before=(await db.query("select state_revision,cost_counters from analysis_jobs where id=$1",[f.job])).rows;
    f.m.input_checksum="sha256:"+"0".repeat(64);
    await expect(f.freeze()).rejects.toThrow();
    expect((await db.query("select state_revision,cost_counters from analysis_jobs where id=$1",[f.job])).rows).toEqual(before);
    expect((await db.query("select id from analysis_input_manifests where job_id=$1",[f.job])).rows).toEqual([]);
  });

  it("keeps preparation queue control inaccessible to browser roles",async()=>{
    for(const role of ["anon","authenticated"]) for(const fn of [
      "claim_v22_acquisition_preparation(uuid,integer,uuid,integer)",
      "heartbeat_v22_acquisition_preparation(uuid,integer,uuid,jsonb)",
      "freeze_v22_acquisition_preparation(uuid,jsonb,jsonb)",
    ]) expect((await db.query<{ok:boolean}>("select has_function_privilege($1,$2,'EXECUTE') ok",[role,`public.${fn}`])).rows[0].ok).toBe(false);
  });

  it("registers a reserved acquisition once, preserving balance, request and deadline", async () => {
    const f = await preparationFixture();
    const a = (await f.begin()).rows[0].value;
    expect(a).toMatchObject({schema_version:"v22_acquisition_preparation_v1",user_id:f.owner,job_id:f.job,
      case_id:f.caseId,business:f.m.business,request_checksum:canonicalDigest(f.request),dispatch:null,run_generation:1});
    expect((await f.begin()).rows[0].value).toEqual(a);
    expect((await db.query<{count:number}>("select count(*)::integer count from capability_acquisition_preparations where job_id=$1",[f.job])).rows[0].count).toBe(1);
    expect((await db.query<{credit_balance:number}>("select credit_balance from users where id=$1",[f.owner])).rows[0].credit_balance).toBe(4);
    expect((await db.query<{count:number}>("select count(*)::integer count from credit_ledger where workflow_charge_id=$1",[f.job])).rows[0].count).toBe(1);
  });

  it("preparation is owner, business and original-key bound", async () => {
    const f = await preparationFixture();
    await expect(f.begin(f.request,randomUUID())).rejects.toThrow("CAPABILITY_PREPARATION_UNAVAILABLE");
    await expect(f.begin(f.request,f.owner,randomUUID())).rejects.toThrow("CAPABILITY_PREPARATION_INVALID");
    await expect(f.begin(f.request,f.owner,f.m.business.id,randomUUID())).rejects.toThrow("CAPABILITY_PREPARATION_UNAVAILABLE");
    const changed = structuredClone(f.request); changed.analyze_request.primary_service = "Unconfirmed service";
    await expect(f.begin(changed)).rejects.toThrow("CAPABILITY_PREPARATION_INVALID");
  });

  it("rejects changed requests on replay instead of reusing an existing entitlement",async()=>{
    const f=await preparationFixture(); await f.begin();
    const changed=structuredClone(f.request); changed.analyze_request.queries[0]="different query";
    await expect(f.begin(changed)).rejects.toThrow("CAPABILITY_PREPARATION_CONFLICT");
    changed.analyze_request.queries=f.request.analyze_request.queries;
    changed.competitor_discovery.discovery_id=randomUUID();
    await expect(f.begin(changed)).rejects.toThrow("CAPABILITY_PREPARATION_CONFLICT");
  });

  it.each(["missing-debit","already-running","service-mode"])("cannot enroll ineligible preparation: %s",async(kind)=>{
    const f=await preparationFixture(kind==="missing-debit");
    if(kind==="already-running") await db.query("update analysis_jobs set status='running',attempt_count=1 where id=$1",[f.job]);
    if(kind==="service-mode") f.request.analyze_request.report_type="verified_execution";
    await expect(f.begin()).rejects.toThrow();
    expect((await db.query<{count:number}>("select count(*)::integer count from capability_acquisition_preparations where job_id=$1",[f.job])).rows[0].count).toBe(0);
  });

  it("recovers a committed prepare then settled zero-action report without another collection or debit",async()=>{
    const f=await preparationFixture(); await f.begin(); await f.prepare();
    const prepared=(await f.begin()).rows[0].value;
    expect(prepared.dispatch).toMatchObject({status:"queued",completion:null,request:{capability_request:{manifest_id:f.m.id}}});
    await f.complete();
    expect((await f.begin()).rows[0].value.dispatch).toMatchObject({status:"succeeded",completion:{report_reference:{report_id:f.job}}});
    const status=(await db.query<{value:unknown}>("select get_v22_acquisition_status($1,$2) value",[f.owner,f.job])).rows[0].value;
    expect(status).toMatchObject({status:"succeeded",report_reference:{report_id:f.job,case_id:f.caseId}});
    expect(parseVersionedTaskStatus(status,f.job,f.caseId).ok).toBe(true);
    await db.query("update analysis_jobs set created_at=now()-interval '2 hour',deadline_at=now()-interval '1 hour' where id=$1",[f.job]);
    expect((await db.query<{job_id:string}>("select * from expire_v22_prepared_capability_jobs(100)")).rows.map(r=>r.job_id)).not.toContain(f.job);
    expect((await db.query<{credit_balance:number}>("select credit_balance from users where id=$1",[f.owner])).rows[0].credit_balance).toBe(4);
  });

  it("compensates a pre-manifest orphan once but leaves unmarked legacy jobs alone",async()=>{
    const f=await preparationFixture(), legacy=await preparationFixture(); await f.begin();
    await db.query("update analysis_jobs set created_at=now()-interval '2 hour',deadline_at=now()-interval '1 hour' where id=any($1::uuid[])",[[f.job,legacy.job]]);
    const first=(await db.query<{job_id:string}>("select * from expire_v22_prepared_capability_jobs(100)")).rows.map(r=>r.job_id);
    expect(first).toContain(f.job); expect(first).not.toContain(legacy.job);
    expect((await db.query<{job_id:string}>("select * from expire_v22_prepared_capability_jobs(100)")).rows.map(r=>r.job_id)).not.toContain(f.job);
    expect((await db.query<{credit_balance:number}>("select credit_balance from users where id=$1",[f.owner])).rows[0].credit_balance).toBe(5);
    expect((await db.query<{attempt_count:number}>("select attempt_count from analysis_jobs where id=$1",[f.job])).rows[0].attempt_count).toBe(0);
    await expect(f.begin()).rejects.toThrow("CAPABILITY_PREPARATION_UNAVAILABLE");
    await expect(f.prepare()).rejects.toThrow("CAPABILITY_GENERATION_NOT_ACTIVE");
  });

  it("does not expire preparation before its original deadline",async()=>{
    const f=await preparationFixture(); await f.begin();
    expect((await db.query<{job_id:string}>("select * from expire_v22_prepared_capability_jobs(100)")).rows.map(r=>r.job_id)).not.toContain(f.job);
  });

  it("does not register an already-expired task or change its deadline",async()=>{
    const f=await preparationFixture();
    await db.query("update analysis_jobs set created_at=now()-interval '2 hour',deadline_at=now()-interval '1 hour' where id=$1",[f.job]);
    await expect(f.begin()).rejects.toThrow("CAPABILITY_PREPARATION_EXPIRED");
    expect((await db.query<{count:number}>("select count(*)::integer count from capability_acquisition_preparations where job_id=$1",[f.job])).rows[0].count).toBe(0);
  });

  it("an enrolled task cannot accept a legacy report instead of its capability result",async()=>{
    const f=await preparationFixture(); await f.begin();
    await expect(db.query("update analysis_jobs set report_id=$2 where id=$1",[f.job,randomUUID()])).rejects.toThrow("CAPABILITY_PREPARATION_LEGACY_RESULT_FORBIDDEN");
  });

  it("the frozen recipe cannot substitute different queries for the recorded intent",async()=>{
    const f=await preparationFixture(); await f.begin();
    (f.body as unknown as {evidence_input:{context:{queries:string[]}}}).evidence_input.context.queries=["replacement"];
    (f.recipe.request as unknown as {evidence_input:{context:{queries:string[]}}}).evidence_input.context.queries=["replacement"];
    f.m.generation_input_checksum=canonicalDigest(f.body);
    f.m.input_checksum=canonicalDigest(Object.fromEntries(Object.entries(f.m).filter(([key])=>key!=="input_checksum")));
    await expect(f.prepare()).rejects.toThrow("CAPABILITY_PREPARATION_CONFLICT");
    expect((await db.query<{count:number}>("select count(*)::integer count from analysis_input_manifests where job_id=$1",[f.job])).rows[0].count).toBe(0);
  });

  it("preparation records are immutable and inaccessible to browser database roles",async()=>{
    const f=await preparationFixture(); await f.begin();
    await expect(db.query("update capability_acquisition_preparations set request='{}' where job_id=$1",[f.job])).rejects.toThrow();
    for(const role of ["anon","authenticated"]) {
      expect((await db.query<{ok:boolean}>("select has_function_privilege($1,'public.begin_v22_acquisition_preparation(uuid,uuid,uuid,text,uuid,text)','EXECUTE') ok",[role])).rows[0].ok).toBe(false);
      expect((await db.query<{ok:boolean}>("select has_table_privilege($1,'public.capability_acquisition_preparations','SELECT') ok",[role])).rows[0].ok).toBe(false);
    }
  });

  it.each([true, false])("authorizes exact prepared dispatch without further debit (acquisition=%s)", async (acquisition) => {
    const f = await recipeFixture(acquisition);
    const dispatch = () => db.query<{ value: Record<string, unknown> }>(
      "select public.get_v22_capability_dispatch($1,$2,$3,$4) as value", [f.owner,f.caseId,f.job,f.job]);
    await expect(dispatch()).rejects.toThrow("CAPABILITY_DISPATCH_UNAVAILABLE");
    await f.prepare();
    const value = (await dispatch()).rows[0].value;
    expect(value).toMatchObject({ schema_version: "v22_capability_dispatch_v1",user_id:f.owner,job_id:f.job,
      case_id:f.caseId,status:"queued",run_generation:1,completion:null,attempt_count:0,
      request:{schema_version:"v22_capability_request_envelope_v1",capability_request:{case_id:f.caseId,
        manifest_id:f.m.id,input_checksum:f.m.input_checksum,report_type:acquisition?"prospect":"verified_execution"}} });
    expect(JSON.stringify(value)).not.toContain("normalized_payload");
    expect((await dispatch()).rows[0].value).toEqual(value);
    expect((await db.query<{credit_balance:number}>("select credit_balance from users where id=$1",[f.owner])).rows[0].credit_balance).toBe(4);
    expect((await db.query<{count:number}>("select count(*)::integer as count from credit_ledger where workflow_charge_id=$1",[f.job])).rows[0].count).toBe(1);
    for (const args of [[randomUUID(),f.caseId,f.job,f.job],[f.owner,randomUUID(),f.job,f.job],[f.owner,f.caseId,randomUUID(),f.job],[f.owner,f.caseId,f.job,"another-key"]]) {
      await expect(db.query("select public.get_v22_capability_dispatch($1,$2,$3,$4)",args)).rejects.toThrow("CAPABILITY_DISPATCH_UNAVAILABLE");
    }
  });

  it("dispatch refuses expired sources, but returns a settled result after actual source expiry", async () => {
    const f = await recipeFixture(true, false, 2000);
    const settled = await recipeFixture(true, false, 2000);
    await f.prepare();
    await settled.prepare();
    await settled.complete();
    // Let time advance; never weaken immutable snapshot protections for a test.
    await new Promise((resolve) => setTimeout(resolve, 2100));
    const dispatch = () => db.query<{value:{completion:{report_reference:{report_id:string}}}}>(
      "select public.get_v22_capability_dispatch($1,$2,$3,$4) as value",[f.owner,f.caseId,f.job,f.job]);
    await expect(dispatch()).rejects.toThrow("CAPABILITY_SNAPSHOT_INVALID");
    expect((await db.query<{value:{completion:{report_reference:{report_id:string}}}}>(
      "select public.get_v22_capability_dispatch($1,$2,$3,$4) as value",
      [settled.owner,settled.caseId,settled.job,settled.job])).rows[0].value.completion.report_reference.report_id).toBe(settled.job);
  });

  it("dispatch does not extend an expired analysis deadline", async () => {
    const f = await recipeFixture();
    await f.prepare();
    await db.query("update analysis_jobs set created_at=now()-interval '2 hour',deadline_at=now()-interval '1 hour' where id=$1",[f.job]);
    await expect(db.query("select public.get_v22_capability_dispatch($1,$2,$3,$4)",
      [f.owner,f.caseId,f.job,f.job])).rejects.toThrow("CAPABILITY_DISPATCH_EXPIRED");
  });

  it("dispatch is service-only and never revives refunded tasks", async () => {
    const f = await recipeFixture();
    await f.prepare();
    await db.query("select public.finalize_v22_capability_failure($1,$2,$3,$4,1,'TEST_FAILURE','Analysis failed.',1,true)",
      [f.job,f.caseId,f.m.id,f.m.input_checksum]);
    await expect(db.query("select public.get_v22_capability_dispatch($1,$2,$3,$4)",[f.owner,f.caseId,f.job,f.job]))
      .rejects.toThrow("CAPABILITY_DISPATCH_UNAVAILABLE");
    for (const role of ["anon","authenticated"]) {
      expect((await db.query<{allowed:boolean}>("select has_function_privilege($1,'public.get_v22_capability_dispatch(uuid,uuid,uuid,text)','EXECUTE') as allowed",[role])).rows[0].allowed).toBe(false);
    }
    expect((await db.query<{credit_balance:number}>("select credit_balance from users where id=$1",[f.owner])).rows[0].credit_balance).toBe(5);
  });

  it.each([true,false])("expires an undelivered prepared task once even without Redis (acquisition=%s)",async(acquisition)=>{
    const f=await recipeFixture(acquisition);
    await f.prepare();
    await db.query("update analysis_jobs set created_at=now()-interval '2 hour',deadline_at=now()-interval '1 hour' where id=$1",[f.job]);
    const expired=await db.query<{job_id:string}>("select * from expire_v22_prepared_capability_jobs(100)");
    expect(expired.rows.map(r=>r.job_id)).toContain(f.job);
    expect((await db.query<{job_id:string}>("select * from expire_v22_prepared_capability_jobs(100)")).rows.map(r=>r.job_id)).not.toContain(f.job);
    expect((await db.query<{credit_balance:number}>("select credit_balance from users where id=$1",[f.owner])).rows[0].credit_balance).toBe(5);
    expect((await db.query<{count:number}>("select count(*)::integer as count from credit_ledger where workflow_charge_id=$1 and kind='technical_failure_credit'",[f.job])).rows[0].count).toBe(1);
    await expect(f.complete()).rejects.toThrow("CAPABILITY_GENERATION_NOT_ACTIVE");
  });

  it("deadline reconciliation cannot refund a delivered zero-action diagnosis or accept arbitrary batch size",async()=>{
    const f=await recipeFixture();
    await f.prepare();
    await f.complete();
    await db.query("update analysis_jobs set created_at=now()-interval '2 hour',deadline_at=now()-interval '1 hour' where id=$1",[f.job]);
    expect((await db.query<{job_id:string}>("select * from expire_v22_prepared_capability_jobs(100)")).rows.map(r=>r.job_id)).not.toContain(f.job);
    expect((await db.query<{credit_balance:number}>("select credit_balance from users where id=$1",[f.owner])).rows[0].credit_balance).toBe(4);
    await expect(db.query("select * from expire_v22_prepared_capability_jobs(101)")).rejects.toThrow("CAPABILITY_EXPIRY_INVALID");
    for(const role of ["anon","authenticated"])expect((await db.query<{allowed:boolean}>(
      "select has_function_privilege($1,'public.expire_v22_prepared_capability_jobs(integer)','EXECUTE') as allowed",[role])).rows[0].allowed).toBe(false);
  });

  it("restricts tables and write RPCs to the server role", async () => {
    for (const table of tables) {
      const result = await db.query<{ relrowsecurity: boolean }>("select relrowsecurity from pg_class where relname=$1", [table]);
      expect(result.rows[0].relrowsecurity).toBe(true);
      for (const role of ["anon", "authenticated"]) {
        expect((await db.query<{ allowed: boolean }>("select has_table_privilege($1,$2,'SELECT') as allowed", [role, table])).rows[0].allowed).toBe(false);
      }
    }
    expect((await db.query<{ allowed: boolean }>("select has_function_privilege('authenticated','public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)','EXECUTE') as allowed")).rows[0].allowed).toBe(false);
  });
  it.each([false, true])("freezes immutable input and replays the exact basis without another debit (acquisition=%s)", async (acquisition) => {
    const f = await fixture({ acquisition });
    expect(validateCapabilityReport(f.report).ok).toBe(true);
    expect((await f.freeze()).rows[0].payload).toEqual(f.m);
    expect((await f.freeze()).rows[0].payload).toEqual(f.m);
    expect((await db.query<{ credit_balance: number }>("select credit_balance from public.users where id=$1", [f.owner])).rows[0].credit_balance).toBe(4);
    expect((await db.query<{ count: number }>("select count(*)::integer as count from public.credit_ledger where workflow_charge_id=$1", [f.job])).rows[0].count).toBe(1);
    const drift = structuredClone(f.m); drift.ruleset_version = "other";
    await expect(f.freeze(drift)).rejects.toThrow("CAPABILITY_INPUT_CONFLICT");
    await expect(db.query("update public.analysis_input_manifests set input_checksum=$1 where job_id=$2", [`sha256:${"0".repeat(64)}`, f.job])).rejects.toThrow("CAPABILITY_VERSION_IMMUTABLE");
    await expect(db.query("delete from public.analysis_manifest_snapshots where manifest_id=$1", [f.m.id])).rejects.toThrow("CAPABILITY_VERSION_IMMUTABLE");
  });
  it.each(["expired", "unhealthy", "revoked", "cross-user", "forged-checksum", "snapshot-other-case", "missing-ga4"])("rejects %s with no frozen partial input", async (reason) => {
    const f = await fixture({ expired: reason === "expired", unhealthy: reason === "unhealthy" });
    if (reason === "revoked") await db.query(`update public.google_connections set status='revoked',revoked_at=now(),
      access_token_ciphertext=null,access_token_iv=null,access_token_auth_tag=null,
      refresh_token_ciphertext=null,refresh_token_iv=null,refresh_token_auth_tag=null,encryption_key_version=null,token_expires_at=null where id=$1`, [f.connection]);
    if (reason === "forged-checksum") f.m.snapshots[0].payload_checksum = `sha256:${"a".repeat(64)}`;
    if (reason === "snapshot-other-case") f.m.snapshots[0].case_id = randomUUID();
    if (reason === "missing-ga4") f.m.snapshots.pop();
    f.m.input_checksum = canonicalDigest(Object.fromEntries(Object.entries(f.m).filter(([key]) => key !== "input_checksum")));
    await expect(f.freeze(f.m, reason === "cross-user" ? randomUUID() : f.owner)).rejects.toThrow(/CAPABILITY_/);
    expect((await db.query<{ count: number }>("select count(*)::integer as count from public.analysis_input_manifests where job_id=$1", [f.job])).rows[0].count).toBe(0);
  });
  it("supports zero-action report storage, unchanged approval and explicit conflicts", async () => {
    const f = await fixture(); await f.freeze(); await f.store(); await f.store();
    const approved = await f.save(); expect(approved.rows[0]).toMatchObject({ revision: 1, status: "approved" });
    await expect(f.save()).rejects.toThrow("CAPABILITY_REVISION_CONFLICT");
    await expect(f.save({ ...f.revision, expected_revision: 1 }, randomUUID())).rejects.toThrow("CAPABILITY_REPORT_NOT_FOUND");
    await expect(f.save({ ...f.revision, expected_revision: 1, evidence: [] } as typeof f.revision)).rejects.toThrow("CAPABILITY_REVISION_INVALID");
    await expect(db.query("update public.capability_report_versions set payload='{}' where id=$1", [f.job])).rejects.toThrow("CAPABILITY_VERSION_IMMUTABLE");
    expect((await db.query<{ state: string }>("select state from public.workflow_charges where id=$1", [f.job])).rows[0].state).toBe("reserved");
    expect((await db.query<{ payload: unknown }>("select payload from public.capability_report_versions where id=$1", [f.job])).rows[0].payload).toEqual(f.report);
  });
  it("pins client shares to the approved revision, preserving older links through new drafts and approvals",async()=>{
    const f=await fixture({materials:true});await f.freeze();await f.complete();
    const create=(id:string,hash:string,user=f.owner,caseId=f.caseId)=>db.query<{id:string;revision_id:string}>("select * from create_v22_capability_share($1,$2,$3,$4,$5)",[user,caseId,f.job,id,hash]);
    const resolve=(hash:string)=>db.query<{revision_id:string}>("select * from resolve_v22_capability_share($1)",[hash]);
    await expect(create(randomUUID(),"a".repeat(64))).rejects.toThrow("CAPABILITY_APPROVAL_CHANGED");
    const first=(await f.save()).rows[0] as {id:string};
    const hash=f.job.replace(/-/g,"").repeat(2),share=(await create(first.id,hash)).rows[0];
    await expect(create(first.id,"b".repeat(64),randomUUID())).rejects.toThrow("CAPABILITY_REPORT_NOT_FOUND");
    await expect(create(first.id,"b".repeat(64),f.owner,randomUUID())).rejects.toThrow("CAPABILITY_REPORT_NOT_FOUND");
    await f.save({...f.revision,expected_revision:1,status:"draft",summary:"New draft cannot affect an existing client link."});
    await expect(create(first.id,"c".repeat(64))).rejects.toThrow("CAPABILITY_APPROVAL_CHANGED");
    expect((await resolve(hash)).rows[0].revision_id).toBe(first.id);
    const second=(await f.save({...f.revision,expected_revision:2})).rows[0] as {id:string};
    await expect(create(first.id,"d".repeat(64))).rejects.toThrow("CAPABILITY_APPROVAL_CHANGED");
    const hash2=randomUUID().replace(/-/g,"").repeat(2);await create(second.id,hash2);
    expect((await resolve(hash)).rows[0].revision_id).toBe(first.id);
    expect((await resolve(hash2)).rows[0].revision_id).toBe(second.id);
    expect((await db.query("select * from list_v22_capability_shares($1,$2,$3)",[f.owner,f.caseId,f.job])).rows).toHaveLength(2);
    expect((await db.query("select * from list_v22_capability_shares($1,$2,$3)",[randomUUID(),f.caseId,f.job])).rows).toHaveLength(0);
    expect((await db.query<{ok:boolean}>("select revoke_v22_capability_share($1,$2,$3,$4) ok",[randomUUID(),f.caseId,f.job,share.id])).rows[0].ok).toBe(false);
    await db.query("select revoke_v22_capability_share($1,$2,$3,$4)",[f.owner,f.caseId,f.job,share.id]);
    await db.query("select revoke_v22_capability_share($1,$2,$3,$4)",[f.owner,f.caseId,f.job,share.id]);
    expect((await resolve(hash)).rows).toHaveLength(0);
    expect((await resolve(hash2)).rows).toHaveLength(1);
    await expect(db.query("update capability_report_shares set revoked_at=null where id=$1",[share.id])).rejects.toThrow("CAPABILITY_SHARE_IMMUTABLE");
    await expect(db.query("update capability_report_shares set revision_id=$1 where id=$2",[second.id,share.id])).rejects.toThrow("CAPABILITY_SHARE_IMMUTABLE");
    expect((await db.query<{n:number}>("select count(*)::integer n from credit_ledger where workflow_charge_id=$1",[f.job])).rows[0].n).toBe(1);
  });
  it("never resolves expired, uncompleted or unknown share records",async()=>{
    const f=await fixture();await f.freeze();await f.store();
    const saved=(await f.save()).rows[0] as {id:string};
    const hash=f.job.replace(/-/g,"").repeat(2);
    await expect(db.query("select * from create_v22_capability_share($1,$2,$3,$4,$5)",[f.owner,f.caseId,f.job,saved.id,hash])).rejects.toThrow("CAPABILITY_REPORT_NOT_FOUND");
    // Privileged fixture injection represents a historical expired record, not an exposed write path.
    await db.query("insert into capability_report_shares(user_id,case_id,report_id,revision_id,token_hash,created_at,expires_at) values($1,$2,$3,$4,$5,now()-interval '31 days',now()-interval '1 day')",[f.owner,f.caseId,f.job,saved.id,hash]);
    await f.complete();
    expect((await db.query("select * from resolve_v22_capability_share($1)",[hash])).rows).toEqual([]);
    expect((await db.query("select * from resolve_v22_capability_share($1)",["0".repeat(64)])).rows).toEqual([]);
  });
  it("only grants server RPC access to capability sharing, not direct share table mutations",async()=>{
    for(const role of ["anon","authenticated","service_role"]) {
      for(const privilege of ["SELECT","INSERT","UPDATE","DELETE"])expect((await db.query<{ok:boolean}>("select has_table_privilege($1,'public.capability_report_shares',$2) ok",[role,privilege])).rows[0].ok).toBe(false);
      for(const signature of ["create_v22_capability_share(uuid,uuid,uuid,uuid,text)","list_v22_capability_shares(uuid,uuid,uuid)","resolve_v22_capability_share(text)","revoke_v22_capability_share(uuid,uuid,uuid,uuid)"])
        expect((await db.query<{ok:boolean}>("select has_function_privilege($1,$2,'execute') ok",[role,signature])).rows[0].ok).toBe(role==="service_role");
    }
  });
  it("lists only completed owner reports and follows latest delivery state without changing billing or history",async()=>{
    const f=await fixture({materials:true}); await f.freeze();await f.store();
    const list=(owner=f.owner)=>db.query("select * from public.list_v22_completed_capability_reports($1)",[owner]);
    const save=(content=f.revision,owner=f.owner,caseId=f.caseId)=>db.query<{id:string}>("select * from public.save_v22_completed_report_revision($1,$2,$3,$4::jsonb)",[owner,caseId,f.job,json(content)]);
    expect((await list()).rows).toEqual([]);
    await expect(save()).rejects.toThrow("CAPABILITY_REPORT_NOT_FOUND");
    await f.complete();
    expect((await list()).rows).toMatchObject([{id:f.job,user_id:f.owner,case_id:f.caseId,delivery_revision:0,delivery_status:"original",business_name:"Clinic"}]);
    expect((await list(randomUUID())).rows).toEqual([]);
    await expect(save(f.revision,randomUUID())).rejects.toThrow("CAPABILITY_REPORT_NOT_FOUND");
    await expect(save(f.revision,f.owner,randomUUID())).rejects.toThrow("CAPABILITY_REPORT_NOT_FOUND");
    const draft={...f.revision,status:"draft",summary:"Reviewed client wording."};
    expect((await save(draft)).rows[0]).toMatchObject({revision:1,status:"draft",content:draft,approved_at:null});
    await expect(save(draft)).rejects.toThrow("CAPABILITY_REVISION_CONFLICT");
    const approved={...draft,expected_revision:1,status:"approved"};
    const first=(await save(approved)).rows[0];
    expect(first).toMatchObject({revision:2,status:"approved",content:approved});
    expect((await list()).rows[0]).toMatchObject({delivery_revision:2,delivery_status:"approved"});
    await save({...approved,expected_revision:2,status:"draft",summary:"Later draft, not approved."});
    expect((await list()).rows[0]).toMatchObject({delivery_revision:3,delivery_status:"draft"});
    expect((await db.query<{content:unknown}>("select content from report_content_revisions where id=$1",[first.id])).rows[0].content).toEqual(approved);
    expect((await f.completed()).rows[0].payload).toEqual(f.report);
    expect((await db.query<{n:number}>("select count(*)::int n from credit_ledger where workflow_charge_id=$1",[f.job])).rows[0].n).toBe(1);
  });
  it("approves an unchanged zero-action completed diagnosis without refund or filler",async()=>{
    const f=await fixture();await f.freeze();await f.complete();
    const saved=await db.query("select * from public.save_v22_completed_report_revision($1,$2,$3,$4::jsonb)",[f.owner,f.caseId,f.job,json(f.revision)]);
    expect(saved.rows[0]).toMatchObject({revision:1,status:"approved",content:{actions:[]}});
    expect((await db.query<{state:string}>("select state from workflow_charges where id=$1",[f.job])).rows[0].state).toBe("consumed");
    expect((await db.query<{credit_balance:number}>("select credit_balance from users where id=$1",[f.owner])).rows[0].credit_balance).toBe(4);
  });
  it("exposes only completed owner revision RPCs to service role",async()=>{
    for(const signature of ["public.list_v22_completed_capability_reports(uuid)","public.save_v22_completed_report_revision(uuid,uuid,uuid,jsonb)"]) {
      for(const role of ["anon","authenticated","service_role"]) {
        expect((await db.query<{allowed:boolean}>("select has_function_privilege($1,$2,'execute') allowed",[role,signature])).rows[0].allowed).toBe(role==="service_role");
      }
    }
    expect((await db.query<{allowed:boolean}>("select has_function_privilege('service_role','public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)','execute') allowed")).rows[0].allowed).toBe(false);
  });
  it("does not allow a new report to swap its frozen manifest", async () => {
    const f = await fixture(); await f.freeze(); f.report.input_manifest.ruleset_version = "changed";
    await expect(f.store()).rejects.toThrow("CAPABILITY_REPORT_INVALID");
  });
  it("persists edited materials in one approved revision without altering source facts or charging again", async () => {
    const f = await fixture({ materials: true }); await f.freeze(); await f.store();
    f.revision.actions[0].materials[0].body = "SEO reviewed draft: confirm the approved contact route before publication.";
    f.revision.summary = "The SEO reviewed the contact route.";
    const saved = await f.save();
    expect(saved.rows[0]).toMatchObject({ revision: 1, status: "approved", content: f.revision });
    expect((await db.query<{ payload: unknown }>("select payload from public.capability_report_versions where id=$1", [f.job])).rows[0].payload).toEqual(f.report);
    const nextDraft = { ...f.revision, expected_revision: 1, status: "draft" };
    const second = await f.save(nextDraft);
    expect(second.rows[0]).toMatchObject({ revision: 2, status: "draft" });
    expect((await db.query<{ content: unknown }>("select content from public.report_content_revisions where report_id=$1 and revision=1", [f.job])).rows[0].content).toEqual(f.revision);
    expect((await db.query<{ credit_balance: number }>("select credit_balance from public.users where id=$1", [f.owner])).rows[0].credit_balance).toBe(4);
    expect((await db.query<{ count: number }>("select count(*)::integer as count from public.credit_ledger where workflow_charge_id=$1", [f.job])).rows[0].count).toBe(1);
  });
  it.each(["evidence_ids", "readiness", "confirmation_items", "target", "id", "delete", "duplicate"])("rejects material %s changes at the database boundary", async (field) => {
    const f = await fixture({ materials: true }); await f.freeze(); await f.store();
    const changed = structuredClone(f.revision);
    const material = changed.actions[0].materials[0];
    if (field === "delete") changed.actions[0].materials = [];
    else if (field === "duplicate") changed.actions[0].materials.push(structuredClone(material));
    else Object.assign(material, { [field]: field === "evidence_ids" ? ["invented"] : field === "confirmation_items" ? [] : field === "readiness" ? "ready_to_use" : "invented" });
    await expect(f.save(changed)).rejects.toThrow(/CAPABILITY_MATERIAL_/);
    expect((await db.query<{ count: number }>("select count(*)::integer as count from public.report_content_revisions where report_id=$1", [f.job])).rows[0].count).toBe(0);
  });
  it("rejects a late result after the job failed", async () => {
    const f = await fixture(); await f.freeze();
    await db.query("update public.analysis_jobs set status='failed',current_stage='failed',error_code='TEST_FAILURE',completed_at=now() where id=$1", [f.job]);
    await expect(f.store()).rejects.toThrow("CAPABILITY_GENERATION_NOT_ACTIVE");
  });
  it("keeps review disabled until implementation references are supported", async () => {
    const f = await fixture();
    const m = { ...f.m, mode: "review" };
    m.input_checksum = canonicalDigest(Object.fromEntries(Object.entries(m).filter(([key]) => key !== "input_checksum")));
    await expect(f.freeze(m as typeof f.m)).rejects.toThrow("CAPABILITY_MODE_NOT_ENABLED");
  });
  it("removes new version data when its Case is erased", async () => {
    const f = await fixture(); await f.freeze(); await f.store(); await f.save();
    await db.query("delete from public.workflow_charges where id=$1", [f.job]);
    await db.query("delete from public.client_cases where id=$1", [f.caseId]);
    for (const table of tables.filter((t) => t !== "analysis_manifest_snapshots")) {
      expect((await db.query<{ count: number }>(`select count(*)::integer as count from public.${table} where case_id=$1`, [f.caseId])).rows[0].count).toBe(0);
    }
    expect((await db.query<{ count: number }>("select count(*)::integer as count from public.analysis_manifest_snapshots where manifest_id=$1", [f.m.id])).rows[0].count).toBe(0);
  });

  it.each([false, true])("atomically delivers a zero-action diagnosis once without refund (acquisition=%s)", async (acquisition) => {
    const f = await fixture({ acquisition }); await f.freeze();
    expect((await f.completed()).rows).toEqual([]);
    expect((await f.complete()).rows[0]).toEqual({ report_id: f.job, idempotent: false, payload_checksum: canonicalDigest(f.report) });
    expect((await f.complete()).rows[0].idempotent).toBe(true);
    expect((await f.completed()).rows[0].payload).toEqual(f.report);
    expect((await db.query(`select status,report_id,capability_report_id,progress from public.analysis_jobs where id=$1`, [f.job])).rows[0])
      .toMatchObject({ status: "succeeded", report_id: null, capability_report_id: f.job, progress: 100 });
    expect((await db.query(`select state,final_report_id,final_capability_report_id from public.workflow_charges where id=$1`, [f.job])).rows[0])
      .toEqual({ state: "consumed", final_report_id: null, final_capability_report_id: f.job });
    expect((await db.query(`select credit_balance from public.users where id=$1`, [f.owner])).rows[0]).toEqual({ credit_balance: 4 });
    expect((await db.query(`select count(*)::integer as n from public.credit_ledger where workflow_charge_id=$1`, [f.job])).rows[0]).toEqual({ n: 1 });
    expect((await db.query(`select count(*)::integer as n from public.report_content_revisions where report_id=$1`, [f.job])).rows[0]).toEqual({ n: 0 });
  });
  async function persistFinalCosts(f: Awaited<ReturnType<typeof fixture>>, revision = 5,
    overrides: {caseId?: string; kind?: string; status?: string; wrongStart?: boolean} = {}) {
    const counters = {cost_schema_version: 1, cost_ledger_revision: revision,
      job_attempts: 2, job_retry_count: 0, serpapi_attempts: 1};
    await db.transaction(async tx => {
      await tx.exec("set local role service_role");
      await tx.query(`select * from upsert_v22_job_cost_summary($1,$2,$3,$4,2,$5,$6::jsonb,
        (select created_at from analysis_jobs where id=$1) + $7::interval,now())`,
      [f.job, overrides.caseId ?? f.caseId, overrides.kind ?? "verified_report",
        overrides.status ?? "succeeded", revision, json(counters), overrides.wrongStart ? "-1 second" : "0 seconds"]);
    });
    return counters;
  }

  it("synchronizes final capability costs without changing settled report, approval or credits", async () => {
    const f = await fixture(); await f.freeze(); await f.complete(); await f.save();
    const before = (await db.query(`select status,capability_report_id,completed_at,state_revision,
      terminal_effects_revision from analysis_jobs where id=$1`, [f.job])).rows[0];
    const approval = (await db.query("select * from report_content_revisions where report_id=$1", [f.job])).rows;
    const counters = await persistFinalCosts(f);
    expect((await db.query("select cost_counters from analysis_jobs where id=$1", [f.job])).rows[0])
      .toEqual({cost_counters: counters});
    expect((await db.query(`select status,capability_report_id,completed_at,state_revision,
      terminal_effects_revision from analysis_jobs where id=$1`, [f.job])).rows[0]).toEqual(before);
    expect((await f.completed()).rows[0].payload).toEqual(f.report);
    expect((await db.query("select * from report_content_revisions where report_id=$1", [f.job])).rows).toEqual(approval);
    expect((await db.query("select credit_balance from users where id=$1", [f.owner])).rows[0]).toEqual({credit_balance: 4});
    expect((await db.query("select delta from credit_ledger where workflow_charge_id=$1", [f.job])).rows).toEqual([{delta: -1}]);
    await persistFinalCosts(f, 4);
    expect((await db.query("select cost_counters from analysis_jobs where id=$1", [f.job])).rows[0])
      .toEqual({cost_counters: counters});
    const newer = await persistFinalCosts(f, 6);
    expect((await db.query("select cost_counters from analysis_jobs where id=$1", [f.job])).rows[0])
      .toEqual({cost_counters: newer});
  });

  it.each(["case", "kind", "status", "started", "active"])("rejects final cost identity mismatch: %s", async reason => {
    const f = await fixture(); await f.freeze();
    if (reason !== "active") await f.complete();
    const other = reason === "case" ? await fixture() : null;
    const before = (await db.query("select cost_counters,status from analysis_jobs where id=$1", [f.job])).rows;
    await expect(persistFinalCosts(f, 5, {
      caseId: other?.caseId, kind: reason === "kind" ? "prospect_report" : undefined,
      status: reason === "status" ? "failed" : undefined, wrongStart: reason === "started",
    })).rejects.toThrow("COST_SUMMARY_TASK_CONFLICT");
    expect((await db.query("select cost_counters,status from analysis_jobs where id=$1", [f.job])).rows).toEqual(before);
    expect((await db.query("select job_id from job_cost_summaries where job_id=$1", [f.job])).rows).toEqual([]);
  });

  it("keeps terminal cost synchronization internal to the service-only summary path", async () => {
    expect((await db.query(`select has_function_privilege('anon','sync_v22_capability_terminal_costs()','execute') a,
      has_function_privilege('authenticated','sync_v22_capability_terminal_costs()','execute') b,
      has_function_privilege('service_role','sync_v22_capability_terminal_costs()','execute') c`)).rows[0])
      .toEqual({a: false, b: false, c: false});
  });
  it("synchronizes failed task costs without returning a second credit", async () => {
    const f = await fixture(); await f.freeze();
    await db.query("update analysis_jobs set status='failed',current_stage='failed',completed_at=now(),error_code='TEST_FAILURE' where id=$1", [f.job]);
    const before = (await db.query("select kind,delta from credit_ledger where workflow_charge_id=$1 order by delta", [f.job])).rows;
    const counters = await persistFinalCosts(f, 5, {status: "failed"});
    expect((await db.query("select cost_counters from analysis_jobs where id=$1", [f.job])).rows[0]).toEqual({cost_counters: counters});
    expect((await db.query("select kind,delta from credit_ledger where workflow_charge_id=$1 order by delta", [f.job])).rows).toEqual(before);
    expect(before).toEqual([{kind: "verified_debit", delta: -1}, {kind: "technical_failure_credit", delta: 1}]);
  });
  it("keeps a saved candidate private until successful settlement and rejects early success callbacks", async () => {
    const f = await fixture(); await f.freeze(); await f.store();
    expect((await f.completed()).rows).toEqual([]);
    await expect(db.query(`select * from public.apply_analysis_job_event($1,$2,9,'succeeded','completed',100::smallint,1,null,'Done','{}',now(),now(),1,null)`, [f.job, f.caseId]))
      .rejects.toThrow("CAPABILITY_COMPLETION_REQUIRED");
    expect((await f.complete()).rows[0].idempotent).toBe(false);
    expect((await f.completed(randomUUID())).rows).toEqual([]);
  });
  it.each(["user", "generation", "missing-debit", "already-refunded", "payload"])("rejects invalid completion %s without partial delivery", async (reason) => {
    const f = await fixture({ missingDebit: reason === "missing-debit" });
    if (reason === "missing-debit") await expect(f.freeze()).rejects.toThrow("CAPABILITY_WORKFLOW_NOT_RESERVED");
    else await f.freeze();
    if (reason === "already-refunded") await db.query(`update public.analysis_jobs set status='failed',current_stage='failed',completed_at=now(),error_code='TEST_FAILURE' where id=$1`, [f.job]);
    const body = structuredClone(f.report);
    if (reason === "payload") body.input_manifest.ruleset_version = "changed";
    await expect(f.complete(body, reason === "generation" ? 2 : 1, reason === "user" ? randomUUID() : f.owner)).rejects.toThrow(/CAPABILITY_/);
    expect((await f.completed()).rows).toEqual([]);
    expect((await db.query(`select count(*)::integer as n from public.capability_report_versions where id=$1`, [f.job])).rows[0]).toEqual({ n: 0 });
  });
  it("rolls back report storage if the completion transaction fails after inserting it", async () => {
    const f = await fixture(); await f.freeze();
    await db.exec(`create function public.test_reject_capability_completion() returns trigger language plpgsql as $$ begin
      if new.capability_report_id is not null then raise exception 'INJECTED_AFTER_REPORT_STORAGE'; end if; return new; end; $$;
      create trigger zz_test_reject_capability_completion before update on public.analysis_jobs for each row execute function public.test_reject_capability_completion();`);
    try { await expect(f.complete()).rejects.toThrow("INJECTED_AFTER_REPORT_STORAGE"); }
    finally { await db.exec("drop trigger zz_test_reject_capability_completion on public.analysis_jobs; drop function public.test_reject_capability_completion();"); }
    expect((await db.query(`select count(*)::integer as n from public.capability_report_versions where id=$1`, [f.job])).rows[0]).toEqual({ n: 0 });
    expect((await db.query(`select state from public.workflow_charges where id=$1`, [f.job])).rows[0]).toEqual({ state: "reserved" });
    expect((await f.complete()).rows[0].idempotent).toBe(false);
  });
  it("rolls back both report and consumed state if an error occurs after the charge update", async () => {
    const f = await fixture(); await f.freeze();
    await db.exec(`create function public.test_reject_capability_charge() returns trigger language plpgsql as $$ begin
      if new.final_capability_report_id is not null then raise exception 'INJECTED_AFTER_CHARGE_UPDATE'; end if; return new; end; $$;
      create trigger zz_test_reject_capability_charge after update on public.workflow_charges for each row execute function public.test_reject_capability_charge();`);
    try { await expect(f.complete()).rejects.toThrow("INJECTED_AFTER_CHARGE_UPDATE"); }
    finally { await db.exec("drop trigger zz_test_reject_capability_charge on public.workflow_charges; drop function public.test_reject_capability_charge();"); }
    expect((await db.query(`select status,capability_report_id from public.analysis_jobs where id=$1`, [f.job])).rows[0]).toEqual({ status: "queued", capability_report_id: null });
    expect((await db.query(`select state,final_capability_report_id from public.workflow_charges where id=$1`, [f.job])).rows[0]).toEqual({ state: "reserved", final_capability_report_id: null });
    expect((await db.query(`select id from public.capability_report_versions where id=$1`, [f.job])).rows).toEqual([]);
    await db.query(`select * from public.apply_analysis_job_event($1,$2,10,'failed','failed',0::smallint,1,'TECHNICAL_FAILURE','Failed','{}',now(),now(),1,null)`, [f.job, f.caseId]);
    expect((await db.query(`select credit_balance from public.users where id=$1`, [f.owner])).rows[0]).toEqual({ credit_balance: 5 });
    expect((await f.completed()).rows).toEqual([]);
  });
  it("does not regress or refund a completed report after late failures or changed replay", async () => {
    const f = await fixture(); await f.freeze(); await f.complete();
    const late = await db.query(`select * from public.apply_analysis_job_event($1,$2,999,'failed','failed',0::smallint,1,'LATE_FAILURE','Failed','{}',now(),now(),1,null)`, [f.job, f.caseId]);
    expect(late.rows[0]).toMatchObject({ applied: false, terminal_effects_applied: false });
    await expect(db.query(`update public.analysis_jobs set status='failed',current_stage='failed' where id=$1`, [f.job])).rejects.toThrow(/CAPABILITY_/);
    await expect(db.query(`update public.workflow_charges set state='compensated',final_capability_report_id=null where id=$1`, [f.job])).rejects.toThrow(/CAPABILITY_/);
    const changed = structuredClone(f.report); changed.summary = "Different content.";
    await expect(f.complete(changed)).rejects.toThrow("CAPABILITY_REPORT_CONFLICT");
    await expect(f.complete(f.report, 2)).rejects.toThrow(/CAPABILITY_/);
    expect((await f.completed()).rows[0].payload).toEqual(f.report);
  });
  it("refunds a real technical failure once even when a candidate exists; late completion cannot resurrect it", async () => {
    const f = await fixture(); await f.freeze(); await f.store();
    const fail = () => db.query(`select * from public.apply_analysis_job_event($1,$2,5,'failed','failed',0::smallint,1,'TECHNICAL_FAILURE','Failed','{}',now(),now(),1,null)`, [f.job, f.caseId]);
    expect((await fail()).rows[0]).toMatchObject({ applied: true });
    expect((await fail()).rows[0]).toMatchObject({ applied: false });
    await expect(f.complete()).rejects.toThrow(/CAPABILITY_/);
    expect((await f.completed()).rows).toEqual([]);
    expect((await db.query(`select credit_balance from public.users where id=$1`, [f.owner])).rows[0]).toEqual({ credit_balance: 5 });
    expect((await db.query(`select kind,delta from public.credit_ledger where workflow_charge_id=$1 order by delta`, [f.job])).rows)
      .toEqual([{ kind: "verified_debit", delta: -1 }, { kind: "technical_failure_credit", delta: 1 }]);
  });
  it.each([1, 2, 3] as const)("uses the same once-only settlement for %s supported actions", async (actionCount) => {
    const f = await fixture({ actionCount }); await f.freeze();
    expect(validateCapabilityReport(f.report).ok).toBe(true);
    await f.complete(); await f.complete();
    expect((await f.completed()).rows[0].payload).toEqual(f.report);
    expect((await db.query(`select credit_balance from public.users where id=$1`, [f.owner])).rows[0]).toEqual({ credit_balance: 4 });
  });
  it("rejects stale generations but completes the current recovered run using the frozen basis", async () => {
    const f = await fixture(); await f.freeze(); await f.store();
    await db.query(`update public.analysis_jobs set run_generation=2 where id=$1`, [f.job]);
    await expect(f.complete()).rejects.toThrow("CAPABILITY_GENERATION_NOT_ACTIVE");
    expect((await f.complete(f.report, 2)).rows[0].idempotent).toBe(false);
    expect((await f.complete(f.report, 2)).rows[0].idempotent).toBe(true);
    expect((await f.completed()).rows).toHaveLength(1);
  });
  it("restricts completion and completed-report reading to the server role", async () => {
    for (const signature of ["public.complete_v22_capability_analysis(uuid,uuid,uuid,jsonb,text,integer)",
      "public.get_v22_completed_capability_report(uuid,uuid,uuid)"]) {
      for (const role of ["anon", "authenticated", "service_role"]) {
        const result = await db.query<{ allowed: boolean }>("select has_function_privilege($1,$2,'EXECUTE') as allowed", [role, signature]);
        expect(result.rows[0].allowed).toBe(role === "service_role");
      }
    }
  });
  it("requires a completed entitlement before a capability version can become historical input", async () => {
    const f = await fixture({ acquisition: true }); await f.freeze(); await f.store();
    const child = randomUUID(), manifest = randomUUID();
    await db.query(`insert into public.analysis_jobs(id,case_id,job_type,current_stage,idempotency_key) values($1::uuid,$2,'verified_report','queued',$1::text)`, [child, f.caseId]);
    const insert = () => db.query(`insert into public.analysis_input_manifests(id,user_id,case_id,job_id,business_version_id,mode,input_checksum,payload,previous_capability_report_id)
      values($1,$2,$3,$4,$5,'after_acquisition',$6,$7::jsonb,$8)`,
      [manifest, f.owner, f.caseId, child, f.m.business.id, f.m.input_checksum, json(f.m), f.job]);
    // Direct SQL isolates the extra history entitlement guard; full shape/source
    // validation remains in freeze_v22_analysis_manifest and the server models.
    await expect(insert()).rejects.toThrow("CAPABILITY_HISTORY_NOT_COMPLETED");
    await f.complete(); await insert();
  });
  it("allows explicit Case erasure of a completed version after its workflow is removed", async () => {
    const f = await fixture(); await f.freeze(); await f.complete();
    await db.query("delete from public.workflow_charges where id=$1", [f.job]);
    await db.query("delete from public.client_cases where id=$1", [f.caseId]);
    expect((await db.query("select id from public.capability_report_versions where id=$1", [f.job])).rows).toEqual([]);
  });
  it("keeps the completion lock order explicit without claiming a multi-session concurrency test", async () => {
    const definition = (await db.query<{ definition: string }>(`select pg_get_functiondef(
      'public.complete_v22_capability_analysis(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure) as definition`)).rows[0].definition;
    const caseLock = /from public\.client_cases[^;]*for no key update/i.exec(definition);
    const jobLock = /from public\.analysis_jobs[^;]*for update/i.exec(definition);
    const chargeLock = /from public\.workflow_charges[^;]*for update/i.exec(definition);
    expect(caseLock).not.toBeNull(); expect(jobLock).not.toBeNull(); expect(chargeLock).not.toBeNull();
    expect(caseLock!.index).toBeLessThan(jobLock!.index); expect(jobLock!.index).toBeLessThan(chargeLock!.index);
  });
  it.each([true,false])("prepares public sources and a body-free recipe atomically and resolves exact frozen input (public=%s)", async (acquisition) => {
    const f = await recipeFixture(acquisition);
    expect((await f.prepare()).rows[0]).toEqual({ manifest_id: f.m.id, input_checksum: f.m.input_checksum, generation_input_checksum: f.m.generation_input_checksum });
    await f.prepare();
    expect((await f.resolve()).rows[0].value.request).toEqual(f.body);
    expect((await db.query(`select recipe from public.capability_generation_recipes where manifest_id=$1`,[f.m.id])).rows[0]).toEqual({ recipe: f.recipe });
    await expect(db.query(`update public.capability_generation_recipes set recipe='{}' where manifest_id=$1`,[f.m.id])).rejects.toThrow("CAPABILITY_VERSION_IMMUTABLE");
    await expect(f.resolve(2)).rejects.toThrow("CAPABILITY_GENERATION_NOT_ACTIVE");
    expect((await db.query(`select credit_balance from public.users where id=$1`,[f.owner])).rows[0]).toEqual({ credit_balance: 4 });
  });
  it("rolls back newly stored sources and manifest when the recipe does not reconstruct the generation input", async () => {
    const f = await recipeFixture();
    const bad = structuredClone(f.recipe) as typeof f.recipe & { request: { evidence_input: { context: { purpose: string } } } };
    (bad.request as { evidence_input: { context: { purpose: string } } }).evidence_input.context.purpose = "changed";
    await expect(f.prepare(bad)).rejects.toThrow("CAPABILITY_RECIPE_INPUT_MISMATCH");
    expect((await db.query(`select id from public.data_snapshots where case_id=$1`,[f.caseId])).rows).toEqual([]);
    expect((await db.query(`select id from public.analysis_input_manifests where job_id=$1`,[f.job])).rows).toEqual([]);
    expect((await db.query(`select manifest_id from public.capability_generation_recipes where case_id=$1`,[f.caseId])).rows).toEqual([]);
    await f.prepare();
  });
  it("rejects preparation by another owner and does not insert sources", async () => {
    const f = await recipeFixture();
    await expect(f.prepare(f.recipe,randomUUID())).rejects.toThrow("CAPABILITY_CASE_NOT_FOUND");
    expect((await db.query(`select id from public.data_snapshots where case_id=$1`,[f.caseId])).rows).toEqual([]);
  });
  it("rejects revoked authorization for running work, but restores an already settled report without private inputs", async () => {
    const f = await recipeFixture(false); await f.prepare();
    const revoke = (connection: string) => db.query(`update public.google_connections set status='revoked',revoked_at=now(),access_token_ciphertext=null,access_token_iv=null,access_token_auth_tag=null,
      refresh_token_ciphertext=null,refresh_token_iv=null,refresh_token_auth_tag=null,encryption_key_version=null,token_expires_at=null where id=$1`,[connection]);
    await revoke(f.connection);
    await expect(f.resolve()).rejects.toThrow("CAPABILITY_AUTHORIZATION_INVALID");
    // Settled historical reports must not depend on a later OAuth connection.
    const done = await recipeFixture(false); await done.prepare(); await done.complete(); await revoke(done.connection);
    const restored = (await done.resolve()).rows[0].value;
    expect(restored.request).toBeNull(); expect(restored.completed_report).toEqual(done.report);
  });
  it("does not revive a failed/compensated job even when a recipe and candidate remain", async () => {
    const f = await recipeFixture(); await f.prepare(); await f.store();
    await db.query(`select * from public.apply_analysis_job_event($1,$2,10,'failed','failed',0::smallint,1,'TECHNICAL_FAILURE','Failed','{}',now(),now(),1,null)`,[f.job,f.caseId]);
    await expect(f.resolve()).rejects.toThrow("CAPABILITY_GENERATION_NOT_ACTIVE");
  });
  it("preserves normalized timestamp precision and private-source order without duplicating metric payloads", async () => {
    const f = await recipeFixture(false,true); await f.prepare();
    expect((await f.resolve()).rows[0].value.request).toEqual(f.body);
  });
  it("rejects private payloads hidden in recipe headers and restricts recipe storage", async () => {
    const f = await recipeFixture(false);
    const bad = structuredClone(f.recipe);
    (bad.request as { first_party_input: { snapshots: Array<Record<string,unknown>> } }).first_party_input.snapshots[0].raw_payload = { forbidden: true };
    await expect(f.prepare(bad)).rejects.toThrow("CAPABILITY_RECIPE_PRIVATE_PAYLOAD_FORBIDDEN");
    for (const role of ["anon","authenticated","service_role"]) {
      expect((await db.query<{ allowed: boolean }>("select has_table_privilege($1,'public.capability_generation_recipes','INSERT') as allowed",[role])).rows[0].allowed).toBe(false);
    }
    expect((await db.query<{ allowed: boolean }>("select has_function_privilege('service_role','public.hydrate_v22_capability_generation_input(jsonb,jsonb)','EXECUTE') as allowed")).rows[0].allowed).toBe(false);
  });
  it.each([false,true])("makes SQL completion and failure mutually exclusive even after Redis fencing (completed first=%s)", async (completedFirst) => {
    const f = await recipeFixture(); await f.prepare();
    const terminal = (finish: boolean, generation = 1) => db.query<{ value: { status: string; completed_report: unknown } }>(
      `select public.finalize_v22_capability_failure($1,$2,$3,$4,$5,'JOB_DEADLINE_EXCEEDED','Deadline exceeded.',1,$6) as value`,
      [f.job,f.caseId,f.m.id,f.m.input_checksum,generation,finish]);
    expect((await terminal(false)).rows[0].value.status).toBe("active");
    if (completedFirst) {
      await f.complete();
      expect((await terminal(true,2)).rows[0].value).toEqual({ status:"succeeded", completed_report:f.report });
      expect((await f.resolve(2)).rows[0].value.completed_report).toEqual(f.report);
      expect((await db.query(`select credit_balance from public.users where id=$1`,[f.owner])).rows[0]).toEqual({ credit_balance:4 });
    } else {
      expect((await terminal(true)).rows[0].value).toEqual({ status:"failed",completed_report:null });
      expect((await terminal(true,2)).rows[0].value.status).toBe("failed");
      await expect(f.complete()).rejects.toThrow("CAPABILITY_GENERATION_NOT_ACTIVE");
      expect((await db.query(`select credit_balance from public.users where id=$1`,[f.owner])).rows[0]).toEqual({ credit_balance:5 });
      expect((await db.query(`select count(*)::integer as n from public.credit_ledger where workflow_charge_id=$1 and kind='technical_failure_credit'`,[f.job])).rows[0]).toEqual({ n:1 });
    }
  });
});
