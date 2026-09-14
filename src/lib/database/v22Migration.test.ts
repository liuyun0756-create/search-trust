import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
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
  describe("verified credit payment contract", () => {
    async function fixture() {
      const suffix = randomUUID();
      const owner = await insertUser(suffix);
      const caseId = await insertCase(owner, suffix);
      await db.query(`update public.users set audit_credits=0 where id=$1`, [owner]);
      const orderId = await insertId(`insert into public.orders
        (user_id,case_id,purchase_kind,credits_purchased,amount,currency,status)
        values ($1,$2,'case_verified_credit',1,1900,'USD','pending') returning id`, [owner,caseId]);
      const args = [orderId, `pay_${suffix}`, `clerk_${suffix}`, caseId, 1900, "USD"];
      const fulfill = (params: unknown[] = args) => db.query(`select * from public.fulfill_v22_verified_credit_payment($1,$2,$3,$4,$5,$6)`, params);
      const refund = (params: unknown[] = args) => db.query(`select * from public.refund_v22_verified_credit_payment($1,$2,$3,$4,$5,$6)`, params);
      return {owner,caseId,orderId,args,fulfill,refund};
    }

    it("requires exactly one $19 USD credit and one pending checkout per Case", async () => {
      const f = await fixture();
      for (const change of ["case_id=null", "credits_purchased=0", "credits_purchased=2", "amount=1899", "currency='EUR'", "purchase_kind='unknown'"]) {
        await expectSqlError(`update public.orders set ${change} where id=$1`, [f.orderId], "check constraint");
      }
      await expectSqlError(`insert into public.orders (user_id,case_id,purchase_kind,credits_purchased,amount,currency,status)
        values ($1,$2,'case_verified_credit',1,1900,'USD','pending')`, [f.owner,f.caseId], "uq_orders_pending_case_verified_credit_checkout");
      await f.fulfill();
      await db.query(`insert into public.orders (user_id,case_id,purchase_kind,credits_purchased,amount,currency,status)
        values ($1,$2,'case_verified_credit',1,1900,'USD','pending')`, [f.owner,f.caseId]);
    });

    it("rejects inserting a Verified credit order with NULL currency", async () => {
      const owner = await insertUser(randomUUID());
      const caseId = await insertCase(owner, randomUUID());
      await expectSqlError(`insert into public.orders
        (user_id,case_id,purchase_kind,credits_purchased,amount,currency,status)
        values ($1,$2,'case_verified_credit',1,1900,null,'pending')`,
        [owner,caseId], "orders_purchase_shape_check");
    });

    it("rejects updating a Verified credit order to NULL currency", async () => {
      const f = await fixture();
      await expectSqlError(`update public.orders set currency=null where id=$1`,
        [f.orderId], "orders_purchase_shape_check");
    });

    it.each(["legacy_credit", "case_prospect_report"])("preserves nullable currency for %s orders", async kind => {
      const owner = await insertUser(randomUUID());
      const caseId = kind === "case_prospect_report" ? await insertCase(owner,randomUUID()) : null;
      const orderId = await insertId(`insert into public.orders
        (user_id,case_id,purchase_kind,credits_purchased,amount,currency,status,payment_id)
        values ($1,$2,$3,$4,1900,null,'pending',$5) returning id`,
        [owner,caseId,kind,kind === "legacy_credit" ? 1 : 0,randomUUID()]);
      expect((await db.query(`select currency from public.orders where id=$1`,[orderId])).rows[0])
        .toEqual({currency:null});
    });

    it("requires a payment ID for completed Verified orders even with another provider reference", async () => {
      const f = await fixture();
      for (const status of ["paid", "refunded"]) await expectSqlError(`update public.orders
        set status=$2,checkout_session_id='checkout_ref',order_id='provider_order' where id=$1`, [f.orderId,status], "orders_payment_reference_check");
      await db.query(`update public.orders set status='failed' where id=$1`, [f.orderId]);
      await f.fulfill();
    });

    it("preserves every legacy and Prospect payment-reference state", async () => {
      const owner = await insertUser(randomUUID());
      for (const kind of ["legacy_credit", "case_prospect_report"]) {
        for (const status of ["pending", "failed", "paid", "refunded"]) {
          for (const reference of [null, "payment_id", "order_id", "checkout_session_id"]) {
            const caseId = kind === "case_prospect_report" ? await insertCase(owner,randomUUID()) : null;
            const statement = `insert into public.orders (user_id,case_id,purchase_kind,credits_purchased,amount,currency,status${reference ? `,${reference}` : ""})
              values ($1,$2,$3,$4,2500,'EUR',$5${reference ? ",$6" : ""})`;
            const args = [owner,caseId,kind,kind === "legacy_credit" ? 2 : 0,status,...(reference ? [randomUUID()] : [])];
            if (reference || (kind === "case_prospect_report" && ["pending","failed"].includes(status))) await db.query(statement,args);
            else await expectSqlError(statement,args,"orders_payment_reference_check");
          }
        }
      }
    });

    it("adds one credit exactly once across confirm and webhook replay without generating", async () => {
      const f = await fixture();
      expect((await f.fulfill()).rows[0]).toEqual({fulfilled:true,idempotent:false,credits_added:1,audit_credits:1});
      expect((await f.fulfill()).rows[0]).toEqual({fulfilled:true,idempotent:true,credits_added:0,audit_credits:1});
      expect((await db.query(`select order_id,kind,delta,balance_after,job_id from public.audit_credit_ledger where order_id=$1`, [f.orderId])).rows)
        .toEqual([{order_id:f.orderId,kind:"purchase_credit",delta:1,balance_after:1,job_id:null}]);
      expect((await db.query(`select id from public.analysis_jobs where case_id=$1`, [f.caseId])).rows).toEqual([]);
    });

    it.each(["fulfill", "refund"] as const)("rejects mismatched %s amount, currency, owner, Case and payment identifiers", async operation => {
      const f = await fixture();
      if (operation === "refund") await f.fulfill();
      const otherCase = await insertCase(f.owner, randomUUID());
      const otherOwner = randomUUID();
      await insertUser(otherOwner);
      for (const [index,value] of [[0,randomUUID()],[1,""],[1,null],[2,`clerk_${otherOwner}`],[2,null],[3,otherCase],[3,null],[4,1899],[4,null],[5,"EUR"],[5,"usd"],[5,null]] as const) {
        const params: unknown[] = [...f.args]; params[index] = value;
        await expect(f[operation](params)).rejects.toThrow("V22_VERIFIED_PAYMENT");
      }
      if (operation === "fulfill") await f.fulfill();
      const wrongPayment = [...f.args]; wrongPayment[1] = "pay_other";
      await expect(f[operation](wrongPayment)).rejects.toThrow("V22_VERIFIED_PAYMENT");
      const prospectOrder = await insertId(`insert into public.orders
        (user_id,case_id,purchase_kind,credits_purchased,amount,currency,status,payment_id)
        values ($1,$2,'case_prospect_report',0,1900,'USD','paid',$3) returning id`, [f.owner,f.caseId,`prospect_${randomUUID()}`]);
      const wrongKind = [...f.args]; wrongKind[0] = prospectOrder;
      await expect(f[operation](wrongKind)).rejects.toThrow("V22_VERIFIED_PAYMENT");
    });

    it("checks the Case still belongs to the order owner", async () => {
      const f = await fixture();
      const outsider = await insertUser(randomUUID());
      await db.query(`update public.client_cases set user_id=$2 where id=$1`, [f.caseId,outsider]);
      await expect(f.fulfill()).rejects.toThrow("V22_VERIFIED_PAYMENT");
      await expect(f.refund()).rejects.toThrow("V22_VERIFIED_PAYMENT");
    });

    it("refunds an unspent credit once and preserves immutable purchase evidence", async () => {
      const f = await fixture(); await f.fulfill();
      expect((await f.refund()).rows[0]).toEqual({refunded:true,idempotent:false,reversal_applied:true,manual_review:false,audit_credits:0});
      expect((await f.refund()).rows[0]).toEqual({refunded:true,idempotent:true,reversal_applied:true,manual_review:false,audit_credits:0});
      await expect(f.fulfill()).rejects.toThrow("V22_VERIFIED_PAYMENT");
      expect((await db.query(`select kind,delta from public.audit_credit_ledger where order_id=$1 order by delta`,[f.orderId])).rows)
        .toEqual([{kind:"payment_refund_debit",delta:-1},{kind:"purchase_credit",delta:1}]);
      await expectSqlError(`update public.audit_credit_ledger set balance_after=10 where order_id=$1`,[f.orderId],"immutable");
      await expectSqlError(`delete from public.audit_credit_ledger where order_id=$1`,[f.orderId],"immutable");
      await expectSqlError(`delete from public.orders where id=$1`,[f.orderId],"foreign key constraint");
    });

    it("records a consumed-credit refund for manual review without negative balance or later replay debit", async () => {
      const f = await fixture(); await f.fulfill();
      await db.query(`select * from public.start_v22_prospect_analysis($1,$2,$3,$4)`,[f.owner,f.caseId,randomUUID(),`spend_${randomUUID()}`]);
      expect((await f.refund()).rows[0]).toEqual({refunded:true,idempotent:false,reversal_applied:false,manual_review:true,audit_credits:0});
      await db.query(`update public.users set audit_credits=1 where id=$1`,[f.owner]);
      expect((await f.refund()).rows[0]).toEqual({refunded:true,idempotent:true,reversal_applied:false,manual_review:true,audit_credits:1});
      expect((await db.query(`select kind,delta from public.audit_credit_ledger where order_id=$1 order by delta`,[f.orderId])).rows)
        .toEqual([{kind:"payment_refund_manual_review",delta:0},{kind:"purchase_credit",delta:1}]);
    });

    it("rejects reuse of another order's payment ID with no partial credit or order change", async () => {
      const first = await fixture(); const second = await fixture(); await first.fulfill();
      const duplicatePayment = [...second.args]; duplicatePayment[1] = first.args[1];
      await expect(second.fulfill(duplicatePayment)).rejects.toThrow("orders_payment_id_key");
      expect((await db.query(`select status,payment_id from public.orders where id=$1`,[second.orderId])).rows[0]).toEqual({status:"pending",payment_id:null});
      expect((await db.query(`select audit_credits from public.users where id=$1`,[second.owner])).rows[0]).toEqual({audit_credits:0});
      expect((await db.query(`select id from public.audit_credit_ledger where order_id=$1`,[second.orderId])).rows).toEqual([]);
    });

    it("rejects refund before fulfillment and corrupt paid orders without a purchase entry", async () => {
      const f = await fixture();
      await expect(f.refund()).rejects.toThrow("V22_VERIFIED_PAYMENT");
      await db.query(`update public.orders set status='paid',payment_id=$2 where id=$1`,[f.orderId,f.args[1]]);
      await expect(f.fulfill()).rejects.toThrow("V22_VERIFIED_PAYMENT");
      await expect(f.refund()).rejects.toThrow("V22_VERIFIED_PAYMENT");
    });

    it("enforces payment ledger deltas, order identity and exact-once entries", async () => {
      const f = await fixture(); await f.fulfill();
      const insert = `insert into public.audit_credit_ledger (user_id,case_id,order_id,kind,delta,balance_after) values ($1,$2,$3,$4,$5,1)`;
      for (const [kind,delta] of [["purchase_credit",0],["payment_refund_debit",1],["payment_refund_manual_review",-1]]) {
        await expectSqlError(insert,[f.owner,f.caseId,f.orderId,kind,delta],"check constraint");
      }
      await expectSqlError(insert,[f.owner,f.caseId,null,"purchase_credit",1],"check constraint");
      await expectSqlError(insert,[f.owner,f.caseId,randomUUID(),"purchase_credit",1],"foreign key constraint");
      await expectSqlError(insert,[f.owner,f.caseId,f.orderId,"purchase_credit",1],"uq_audit_credit_ledger_order_kind");
    });

    it.each(["fulfill", "refund"])("restricts %s to service role with compatible Case/order/user lock order", async operation => {
      const signature = `public.${operation}_v22_verified_credit_payment(uuid,text,text,uuid,integer,text)`;
      for (const role of ["anon","authenticated","service_role"]) expect((await db.query(`select has_function_privilege($1,$2,'EXECUTE') as allowed`,[role,signature])).rows[0]).toEqual({allowed:role === "service_role"});
      // Embedded PGlite serializes sessions: assert the lock contract explicitly.
      const definition = (await db.query<{definition:string}>(`select pg_get_functiondef($1::regprocedure) as definition`,[signature])).rows[0].definition.replace(/--[^\n]*/g, "").replace(/\s+/g," ");
      const caseLock = /from public\.client_cases\b[^;]*for no key update/i.exec(definition);
      const orderLock = /from public\.orders\b[^;]*for update/i.exec(definition);
      const userLock = /from public\.users\b[^;]*for update/i.exec(definition);
      expect(caseLock).not.toBeNull(); expect(orderLock).not.toBeNull(); expect(userLock).not.toBeNull();
      expect(caseLock!.index).toBeLessThan(orderLock!.index); expect(orderLock!.index).toBeLessThan(userLock!.index);
    });
  });

  describe("verified analysis job contract", () => {
    const canonical = (value: unknown): string => {
      if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
      if (value !== null && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
      return JSON.stringify(value);
    };
    const digest = (value: unknown) => `sha256:${createHash("sha256").update(canonical(value)).digest("hex")}`;
    async function fixture(withParentCoverageEvidence = false, publicFault?: "unhealthy"|"reference"|"checksum"|"schema") {
      const owner = await insertUser(randomUUID());
      const caseId = await insertCase(owner, randomUUID());
      const connection = await insertConnection(owner, randomUUID());
      const parentId = randomUUID();
      const url = "https://maps.google.com/?cid=123456789";
      await db.query(`update public.users set audit_credits=5 where id=$1`, [owner]);
      await db.query(`update public.client_cases set business_identity=jsonb_build_object('public_gbp_url',$2::text) where id=$1`, [caseId, url]);
      const snapshots: Record<string, string> = {};
      const bindings: Record<string, string> = {};
      for (const [source, schema] of Object.entries({site: "site_inventory_snapshot_v1", serp: "serp_market_snapshot_v1", competitor: "competitor_collection_snapshot_v1", gsc: "gsc_sync_v1", ga4: "ga4_sync_v1"})) {
        if (source === "gsc" || source === "ga4") bindings[source] = await insertId(`insert into public.case_source_bindings
          (case_id,connection_id,source_type,external_resource_id,external_resource_name,identity_match_status,health_status,confirmed_by_user_id,confirmed_at)
          values ($1,$2,$3,$3,$3,'matched','healthy',$4,now()) returning id`, [caseId,connection,source,owner]);
        snapshots[source] = await insertId(`insert into public.data_snapshots
          (case_id,binding_id,source_type,schema_version,fetched_at,expires_at,coverage_start,coverage_end,sync_trigger,health_status,normalized_payload,payload_checksum,provider_request_context)
          values ($1,$2,$3,$4,now()-interval '1 minute',now()+interval '7 days',current_date-30,current_date-1,'report_generation','healthy',jsonb_build_object('schema_version',$4::text),$5,jsonb_build_object('external_resource_id',$3::text)) returning id`,
          [caseId,bindings[source] ?? null,source,schema,checksum]);
      }
      const parent = JSON.parse(await readFile(path.join(process.cwd(), "src/lib/report-v22/contracts/fixtures/prospect.json"), "utf8"));
      parent.identity.case_id = caseId;
      parent.report_version.report_id = parentId;
      const publicReference = {case_id:caseId,site_url:parent.identity.business.site_url,
        public_gbp_url:url,entity_keys:[{kind:"cid",value:"123456789"}],
        confirmation_source:"user",confirmed_at:"2026-09-13T07:00:00Z"};
      const publicPayload = {schema_version:"customer_public_gbp_snapshot_v1",
        request_target:{public_gbp_url:url,entity_keys:publicReference.entity_keys},
        started_at:"2026-09-13T07:01:00Z",completed_at:"2026-09-13T07:02:00Z",
        expires_at:"2099-09-13T07:02:00Z",provider:"serpapi_public",
        request_record_id:"req_aaaaaaaaaaaaaaaa",response_checksum:checksum,
        collection_status:"succeeded",failure_code:null,
        record:{observed_entity_keys:publicReference.entity_keys,observed_public_gbp_url:url,fields:{}},
        limitations:[],subject_reference_checksum:checksum,
        identity_rule_version:"customer_public_gbp_identity_v1",identity_match_status:"matched",
        identity_reasons:["strong_id_matched"],health_status:"healthy"};
      if (publicFault === "unhealthy") publicPayload.health_status = "unavailable";
      if (publicFault === "schema") publicPayload.schema_version = "customer_public_gbp_snapshot_bad";
      if (publicFault === "reference") publicReference.site_url = "https://wrong.example/";
      const storedSubjectChecksum = publicFault === "checksum" ? `sha256:${"b".repeat(64)}` : checksum;
      const publicGbp = await insertId(`insert into public.data_snapshots
        (case_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,
         normalized_payload,payload_checksum,provider_request_context)
        values ($1,'gbp','customer_public_gbp_snapshot_v1',$2::timestamptz,$3::timestamptz,
          'report_generation',$8,$4::jsonb,$5,
          jsonb_build_object('job_id',$6::uuid,'customer_public_gbp_reference',$7::jsonb,
            'subject_reference_checksum',$9::text)) returning id`,
        [caseId,publicPayload.completed_at,publicPayload.expires_at,JSON.stringify(publicPayload),checksum,
          parentId,JSON.stringify(publicReference),publicPayload.health_status,storedSubjectChecksum]);
      snapshots.gbp = publicGbp;
      for (const evidence of parent.evidence_index) evidence.snapshot_id = evidence.source_type === "gbp" ? publicGbp : snapshots[evidence.source_type];
      for (const coverage of parent.data_coverage.sources) coverage.snapshot_ids = coverage.source_type === "gbp" ? [publicGbp] : snapshots[coverage.source_type] ? [snapshots[coverage.source_type]] : [];
      parent.data_coverage.sources.find((source: {source_type:string}) => source.source_type === "gbp").identity_match_status = "matched";
      if (withParentCoverageEvidence) parent.evidence_index.push({...parent.evidence_index[0],
        evidence_id:"ev_parent_coverage",source_type:"coverage",snapshot_id:snapshots.site});
      await db.query(`insert into public.reports
        (id,report_id,user_id,page_url,gbp_url,status,access_type,case_id,report_type,schema_version,version_number,report_v2_2,snapshot_ids,coverage_state,version_diff,generation_config,ruleset_version,copy_model_version)
        values ($1::uuid,$1::text,$2,'https://example.com',$3,'paid_full','unlocked',$4,'prospect','2.2.0',1,$5,array[$6::uuid,$7::uuid,$8::uuid,$9::uuid],$10,'{}','{}','rules-v1','copy-v1')`,
        [parentId,owner,url,caseId,JSON.stringify(parent),snapshots.site,snapshots.serp,snapshots.competitor,publicGbp,JSON.stringify(parent.data_coverage)]);
      await db.query(`update public.client_cases set latest_report_id=$2 where id=$1`, [caseId,parentId]);
      const jobId = randomUUID();
      const key = `verified:${caseId}:attempt:1`;
      const start = (job = jobId, idem = key, user = owner, hash = digest(parent), previous: string | null = null, expectedParent: string | null = parentId) => db.query<Record<string, unknown>>(
        `select * from public.start_v22_verified_analysis($1,$2,$3,$4,$5,$6,$7)`, [user,caseId,job,idem,hash,expectedParent,previous]);
      const result = () => ({...parent, report_version: {...parent.report_version, report_id:jobId,report_type:"verified_execution",parent_report_id:parentId,version_number:2},
        first_party_performance:{...parent.first_party_performance,gsc:{...parent.first_party_performance.gsc,snapshot_id:snapshots.gsc},ga4:{...parent.first_party_performance.ga4,snapshot_id:snapshots.ga4}}});
      const persist = (payload = result(), generation = 1) => db.query(`select * from public.persist_v22_verified_result($1,$2,$3,$4)`, [jobId,caseId,JSON.stringify(payload),generation]);
      return {owner,caseId,connection,parentId,publicGbp,parent,snapshots,bindings,jobId,key,start,result,persist};
    }

    it("atomically freezes inputs and debits one credit, with stable identity replay", async () => {
      const f = await fixture();
      expect((await f.start()).rows[0]).toMatchObject({job_id:f.jobId,created:true,idempotent:false,parent_report_id:f.parentId,gsc_snapshot_id:f.snapshots.gsc,ga4_snapshot_id:f.snapshots.ga4,public_gbp_snapshot_id:f.publicGbp,audit_credits:4});
      expect((await f.start()).rows[0]).toMatchObject({created:false,idempotent:true,audit_credits:4});
      await expect(f.start(randomUUID())).rejects.toThrow("V22_VERIFIED_IDENTITY_CONFLICT");
      await expect(f.start(f.jobId,f.key,f.owner,checksum)).rejects.toThrow("V22_VERIFIED_IDENTITY_CONFLICT");
      const input = (await db.query<{parent_payload: unknown}>(`select parent_payload from public.verified_analysis_inputs where job_id=$1`, [f.jobId])).rows[0];
      expect(input.parent_payload).toEqual(f.parent);
      await expect(db.query(`update public.verified_analysis_inputs set parent_payload='{}' where job_id=$1`, [f.jobId])).rejects.toThrow("immutable");
    });

    it.each(["mismatched", "missing"])("rejects a %s expected parent before creating any debit or job", async (reason) => {
      const f = await fixture();
      await expect(f.start(f.jobId, f.key, f.owner, digest(f.parent), null, reason === "missing" ? null : randomUUID())).rejects.toThrow("V22_VERIFIED_PARENT_CHANGED");
      for (const table of ["analysis_jobs", "analysis_attempt_charges", "audit_credit_ledger", "verified_analysis_inputs"]) {
        expect((await db.query(`select * from public.${table} where case_id=$1`, [f.caseId])).rows).toHaveLength(0);
      }
      expect((await db.query(`select audit_credits from public.users where id=$1`, [f.owner])).rows[0]).toEqual({ audit_credits: 5 });
    });

    it("rejects an expected parent mismatch on idempotent replay without a second debit", async () => {
      const f = await fixture();
      await f.start();
      await expect(f.start(f.jobId, f.key, f.owner, digest(f.parent), null, randomUUID())).rejects.toThrow("V22_VERIFIED_IDENTITY_CONFLICT");
      expect((await db.query(`select * from public.analysis_jobs where case_id=$1`, [f.caseId])).rows).toHaveLength(1);
      expect((await db.query(`select * from public.audit_credit_ledger where case_id=$1`, [f.caseId])).rows).toHaveLength(1);
      expect((await db.query(`select audit_credits from public.users where id=$1`, [f.owner])).rows[0]).toEqual({ audit_credits: 4 });
    });

    it("locks Google connections in deterministic order before the Case and bindings", async () => {
      // PGlite serializes queries on one embedded PostgreSQL instance; this is an
      // explicit lock-order contract, not a claim to exercise concurrent sessions.
      const definition = (await db.query<{definition:string}>(`select pg_get_functiondef(
        'public.start_v22_verified_analysis(uuid,uuid,uuid,text,text,uuid,uuid)'::regprocedure) as definition`)).rows[0].definition
        .replace(/--[^\n]*/g, "").replace(/\s+/g, " ");
      const connectionLock = /from public\.google_connections\b[^;]*for (?:update|share)/i.exec(definition);
      const caseLock = /from public\.client_cases\b[^;]*for (?:no key )?update/i.exec(definition);
      const bindingLock = /from public\.case_source_bindings\b[^;]*for (?:update|share)/i.exec(definition);
      expect(connectionLock).not.toBeNull(); expect(caseLock).not.toBeNull(); expect(bindingLock).not.toBeNull();
      expect(connectionLock!.index).toBeLessThan(caseLock!.index);
      expect(caseLock!.index).toBeLessThan(bindingLock!.index);
      expect(connectionLock![0]).toMatch(/order by \w+\.id/i);
      expect(definition.slice(caseLock!.index + caseLock![0].length)).not.toMatch(/from public\.google_connections\b[^;]*for (?:update|share)/i);
      expect(definition).toMatch(/V22_VERIFIED_BINDING_CHANGED[^;]*errcode\s*=\s*'40001'/i);
    });

    it.each([
      "start_v22_verified_analysis(uuid,uuid,uuid,text,text,uuid,uuid)",
      "persist_v22_verified_result_strict_generation_v2(uuid,uuid,jsonb,integer)",
    ])("keeps %s Case serialization compatible with compensation FK checks", async signature => {
      // Compensation holds the job while its ledger INSERT requests Case KEY SHARE.
      // A waiter for that job must not hold the conflicting Case FOR UPDATE lock.
      const definition=(await db.query<{definition:string}>(`select pg_get_functiondef($1::regprocedure) as definition`,[`public.${signature}`])).rows[0].definition
        .replace(/--[^\n]*/g, "").replace(/\s+/g, " ");
      const caseLocks=[...definition.matchAll(/from public\.client_cases\b[^;]*for (?:no key )?update/gi)];
      expect(caseLocks).toHaveLength(1);
      expect(caseLocks[0][0]).toMatch(/for no key update$/i);
    });

    it("starts with GSC and GA4 on separate owned connections", async () => {
      const f=await fixture();
      const second=await insertConnection(f.owner,randomUUID());
      await db.query(`update public.case_source_bindings set connection_id=$2 where id=$1`,[f.bindings.ga4,second]);
      expect((await f.start()).rows[0]).toMatchObject({created:true,gsc_snapshot_id:f.snapshots.gsc,ga4_snapshot_id:f.snapshots.ga4,audit_credits:4});
    });

    it.each(["cross-user", "zero-credit", "missing-gsc", "missing-ga4", "expired", "identity", "inactive", "missing-gbp", "no-parent", "previous", "checksum"])("rejects %s without a job, charge or debit", async (reason) => {
      const f = await fixture();
      if (reason === "zero-credit") await db.query(`update public.users set audit_credits=0 where id=$1`, [f.owner]);
      if (reason === "missing-gsc" || reason === "missing-ga4") await db.query(`update public.case_source_bindings set is_active=false,disconnected_at=now() where id=$1`, [f.bindings[reason.slice(8)]]);
      if (reason === "identity") await db.query(`update public.case_source_bindings set identity_match_status='mismatch' where id=$1`, [f.bindings.gsc]);
      if (reason === "inactive") await db.query(`update public.google_connections set status='reauth_required',access_token_ciphertext=null,access_token_iv=null,access_token_auth_tag=null,refresh_token_ciphertext=null,refresh_token_iv=null,refresh_token_auth_tag=null,encryption_key_version=null,token_expires_at=null where id=$1`, [f.connection]);
      if (reason === "missing-gbp") await db.query(`update public.client_cases set business_identity='{}' where id=$1`, [f.caseId]);
      if (reason === "no-parent") await db.query(`update public.client_cases set latest_report_id=null where id=$1`, [f.caseId]);
      if (reason === "expired") {
        // Latest snapshot must be checked, not an older healthy fallback.
        await db.query(`insert into public.data_snapshots (case_id,binding_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum)
          values ($1,$2,'gsc','gsc_sync_v1',now(),now()-interval '1 second','user_sync','healthy','{}',$3)`, [f.caseId,f.bindings.gsc,checksum]);
      }
      await expect(f.start(f.jobId,f.key,reason === "cross-user" ? await insertUser(randomUUID()) : f.owner,reason === "checksum" ? "invalid" : digest(f.parent),reason === "previous" ? randomUUID() : null)).rejects.toThrow("V22_VERIFIED_");
      expect((await db.query(`select id from public.analysis_jobs where case_id=$1`,[f.caseId])).rows).toHaveLength(0);
      expect((await db.query(`select id from public.analysis_attempt_charges where case_id=$1`,[f.caseId])).rows).toHaveLength(0);
      expect((await db.query(`select id from public.audit_credit_ledger where case_id=$1`,[f.caseId])).rows).toHaveLength(0);
      expect((await db.query(`select audit_credits from public.users where id=$1`,[f.owner])).rows[0]).toEqual({audit_credits:reason === "zero-credit" ? 0 : 5});
    });

    it.each(["unhealthy","reference","checksum","schema"] as const)(
      "rejects a %s persisted public GBP source before committing a debit", async publicFault => {
        const f = await fixture(false, publicFault);
        await expect(f.start()).rejects.toThrow("V22_VERIFIED_PUBLIC_GBP_INVALID");
        expect((await db.query(`select id from public.analysis_jobs where case_id=$1`,[f.caseId])).rows).toEqual([]);
        expect((await db.query(`select id from public.audit_credit_ledger where case_id=$1`,[f.caseId])).rows).toEqual([]);
        expect((await db.query(`select audit_credits from public.users where id=$1`,[f.owner])).rows[0])
          .toEqual({audit_credits:5});
      });

    it("resolves frozen inputs with generation fencing even after bindings change", async () => {
      const f = await fixture(); await f.start();
      await db.query(`update public.case_source_bindings set is_active=false,disconnected_at=now() where case_id=$1`,[f.caseId]);
      const resolve = (generation=1) => db.query<{payload:Record<string, any>}>(`select public.resolve_v22_verified_analysis_input($1,$2,$3) as payload`,[f.jobId,f.caseId,generation]);
      const payload = (await resolve()).rows[0].payload;
      expect(Object.keys(payload).sort()).toEqual(["schema_version","job_id","case_id","parent_report","parent_payload_checksum","site_snapshot","serp_snapshot","competitor_snapshot","public_gbp_snapshot","first_party_snapshots"].sort());
      expect(payload).toMatchObject({schema_version:"v22_verified_resolved_input_v1",parent_report:f.parent,parent_payload_checksum:digest(f.parent),site_snapshot:{snapshot_id:f.snapshots.site},serp_snapshot:{snapshot_id:f.snapshots.serp},competitor_snapshot:{snapshot_id:f.snapshots.competitor}});
      expect(payload.first_party_snapshots.map((s:Record<string,unknown>)=>s.snapshot_id)).toEqual([f.snapshots.gsc,f.snapshots.ga4]);
      expect(payload.public_gbp_snapshot).toMatchObject({snapshot_id:f.publicGbp,source_type:"gbp",
        schema_version:"customer_public_gbp_snapshot_v1",reference:{case_id:f.caseId}});
      for (const source of ["site", "serp", "competitor"]) {
        const expected = (await db.query<{ dates: Record<string, unknown> }>(
          `select jsonb_build_object('created_at',created_at,'fetched_at',fetched_at,'expires_at',expires_at) as dates
            from public.data_snapshots where id=$1`, [f.snapshots[source]])).rows[0].dates;
        expect(payload[`${source}_snapshot`]).toMatchObject(expected);
        expect(Object.keys(payload[`${source}_snapshot`]).sort()).toEqual([
          "snapshot_id", "case_id", "source_type", "schema_version", "normalized_payload", "payload_checksum",
          "created_at", "fetched_at", "expires_at",
        ].sort());
      }
      await expect(resolve(2)).rejects.toThrow("V22_VERIFIED_JOB_INVALID");
    });

    it("persists only bound evidence and advances both pointers while retaining the original Prospect", async () => {
      const f = await fixture(); await f.start();
      await expect(f.persist(f.result(),2)).rejects.toThrow("V22_VERIFIED_JOB_INVALID");
      for (const mutate of [
        (p:ReturnType<typeof f.result>) => {p.report_version.parent_report_id=randomUUID();},
        (p:ReturnType<typeof f.result>) => {p.report_version.version_number=3;},
        (p:ReturnType<typeof f.result>) => {p.first_party_performance.gsc.snapshot_id=randomUUID();},
        (p:ReturnType<typeof f.result>) => {p.evidence_index=[...p.evidence_index,{snapshot_id:randomUUID()}];},
      ]) { const p=structuredClone(f.result()); mutate(p); await expect(f.persist(p)).rejects.toThrow("V22_VERIFIED_"); }
      expect((await f.persist()).rows).toEqual([{report_id:f.jobId,idempotent:false}]);
      expect((await f.persist()).rows).toEqual([{report_id:f.jobId,idempotent:true}]);
      expect((await db.query(`select latest_report_id,latest_verified_report_id from public.client_cases where id=$1`,[f.caseId])).rows[0]).toEqual({latest_report_id:f.jobId,latest_verified_report_id:f.jobId});
      const next=await f.start(randomUUID(),`${f.key}:2`);
      expect(next.rows[0].parent_report_id).toBe(f.parentId);
      expect((await db.query(`select report_v2_2 from public.reports where id=$1`,[f.parentId])).rows[0]).toEqual({report_v2_2:f.parent});
      await expect(db.query(`update public.client_cases set latest_verified_report_id=$2 where id=$1`,[f.caseId,f.parentId])).rejects.toThrow("latest_verified_report_id");
    });

    it("atomically persists a Verified report, succeeds its job and consumes its charge", async () => {
      const f=await fixture(); await f.start();
      expect((await f.persist()).rows).toEqual([{report_id:f.jobId,idempotent:false}]);
      expect((await db.query(`select status,current_stage,progress,report_id,error_code,completed_at is not null as completed
        from public.analysis_jobs where id=$1`,[f.jobId])).rows[0]).toEqual({
          status:"succeeded",current_stage:"completed",progress:100,report_id:f.jobId,error_code:null,completed:true,
        });
      expect((await db.query(`select state,settled_at is not null as settled
        from public.analysis_attempt_charges where job_id=$1`,[f.jobId])).rows[0]).toEqual({state:"consumed",settled:true});
      expect((await db.query(`select audit_credits from public.users where id=$1`,[f.owner])).rows[0]).toEqual({audit_credits:4});
      expect((await db.query(`select kind from public.audit_credit_ledger where job_id=$1 order by created_at`,[f.jobId])).rows)
        .toEqual([{kind:"attempt_debit"}]);
      await expect(db.query(`update public.analysis_attempt_charges set state='compensated',settled_at=now()
        where job_id=$1`,[f.jobId])).rejects.toThrow("V22_REPORT_BACKED_JOB_CANNOT_BE_COMPENSATED");
      expect((await f.persist()).rows).toEqual([{report_id:f.jobId,idempotent:true}]);
    });

    it("chooses compensation atomically when deadline settlement wins before report persistence", async () => {
      const f=await fixture(); await f.start();
      const state=(await db.query<{state_revision:number}>(`select state_revision from public.analysis_jobs where id=$1`,[f.jobId])).rows[0];
      const callback=await db.query(`select * from public.apply_analysis_job_event(
        $1,$2,$3,'failed','failed',90::smallint,1,'JOB_DEADLINE_EXCEEDED','deadline','{}',null,now(),1,null)`,
        [f.jobId,f.caseId,state.state_revision+1]);
      expect(callback.rows[0]).toMatchObject({found:true,applied:true,terminal_effects_applied:true});
      await expect(f.persist()).rejects.toThrow("V22_VERIFIED_JOB_INVALID");
      expect((await db.query(`select id from public.reports where id=$1`,[f.jobId])).rows).toEqual([]);
      expect((await db.query(`select status,report_id from public.analysis_jobs where id=$1`,[f.jobId])).rows[0])
        .toEqual({status:"failed",report_id:null});
      expect((await db.query(`select state from public.analysis_attempt_charges where job_id=$1`,[f.jobId])).rows[0])
        .toEqual({state:"compensated"});
      expect((await db.query(`select audit_credits from public.users where id=$1`,[f.owner])).rows[0]).toEqual({audit_credits:5});
      expect((await db.query(`select kind from public.audit_credit_ledger where job_id=$1 order by delta`,[f.jobId])).rows)
        .toEqual([{kind:"attempt_debit"},{kind:"technical_failure_credit"}]);
    });

    it("never refunds after persist commits even when its response is lost and a deadline failure arrives", async () => {
      const f=await fixture(); await f.start();
      await f.persist(); // Simulate a committed RPC whose HTTP response never reached the Worker.
      await db.query(`update public.analysis_jobs set created_at=now()-interval '2 hours',
        deadline_at=now()-interval '1 hour' where id=$1`,[f.jobId]);
      expect((await db.query(`select * from public.expire_v22_stale_verified_jobs(now(),100)`)).rows).toEqual([]);
      const state=(await db.query<{state_revision:number}>(`select state_revision from public.analysis_jobs where id=$1`,[f.jobId])).rows[0];
      const callback=await db.query(`select * from public.apply_analysis_job_event(
        $1,$2,$3,'failed','failed',90::smallint,1,'JOB_DEADLINE_EXCEEDED','deadline','{}',null,now(),1,null)`,
        [f.jobId,f.caseId,state.state_revision+1]);
      expect(callback.rows[0]).toMatchObject({found:true,applied:false,terminal_effects_applied:false});
      expect((await db.query(`select status,report_id from public.analysis_jobs where id=$1`,[f.jobId])).rows[0])
        .toEqual({status:"succeeded",report_id:f.jobId});
      expect((await db.query(`select state from public.analysis_attempt_charges where job_id=$1`,[f.jobId])).rows[0])
        .toEqual({state:"consumed"});
      expect((await db.query(`select audit_credits from public.users where id=$1`,[f.owner])).rows[0]).toEqual({audit_credits:4});
      expect((await db.query(`select kind from public.audit_credit_ledger where job_id=$1 order by created_at`,[f.jobId])).rows)
        .toEqual([{kind:"attempt_debit"}]);
      expect((await f.persist()).rows).toEqual([{report_id:f.jobId,idempotent:true}]);
    });

    it("re-resolves the exact frozen graph after an acknowledged-loss success for idempotent recovery", async () => {
      const f=await fixture(); await f.start();
      const resolve=(generation=1) => db.query<{payload:Record<string,unknown>}>(
        `select public.resolve_v22_verified_analysis_input($1,$2,$3) as payload`,[f.jobId,f.caseId,generation]);
      const before=(await resolve()).rows[0].payload;
      await f.persist(); // Commit succeeded; model the Worker never receiving its HTTP response.
      const after=(await resolve(2)).rows[0].payload;
      expect(after).toEqual(before);
      expect((await f.persist(f.result(),2)).rows).toEqual([{report_id:f.jobId,idempotent:true}]);
      await expect(resolve(0)).rejects.toThrow("V22_VERIFIED_JOB_INVALID");
      await expect(f.persist(f.result(),0)).rejects.toThrow("V22_VERIFIED_JOB_INVALID");
      expect((await db.query(`select status,report_id,run_generation from public.analysis_jobs where id=$1`,[f.jobId])).rows[0])
        .toEqual({status:"succeeded",report_id:f.jobId,run_generation:1});
      expect((await db.query(`select state from public.analysis_attempt_charges where job_id=$1`,[f.jobId])).rows[0])
        .toEqual({state:"consumed"});
      expect((await db.query(`select audit_credits from public.users where id=$1`,[f.owner])).rows[0]).toEqual({audit_credits:4});
    });

    it("rejects lower generations before and after a generation-two success", async () => {
      const f=await fixture(); await f.start();
      await db.query(`update public.analysis_jobs set run_generation=2 where id=$1`,[f.jobId]);
      await expect(db.query(`select public.resolve_v22_verified_analysis_input($1,$2,1)`,[f.jobId,f.caseId]))
        .rejects.toThrow("V22_VERIFIED_JOB_INVALID");
      expect((await db.query<{payload:Record<string,unknown>}>(`select public.resolve_v22_verified_analysis_input($1,$2,2) as payload`,
        [f.jobId,f.caseId])).rows[0].payload).toMatchObject({job_id:f.jobId,case_id:f.caseId});
      await expect(f.persist(f.result(),1)).rejects.toThrow("V22_VERIFIED_JOB_INVALID");
      expect((await f.persist(f.result(),2)).rows).toEqual([{report_id:f.jobId,idempotent:false}]);
      await expect(db.query(`select public.resolve_v22_verified_analysis_input($1,$2,1)`,[f.jobId,f.caseId]))
        .rejects.toThrow("V22_VERIFIED_JOB_INVALID");
      await expect(f.persist(f.result(),1)).rejects.toThrow("V22_VERIFIED_JOB_INVALID");
      expect((await db.query(`select status,run_generation from public.analysis_jobs where id=$1`,[f.jobId])).rows[0])
        .toEqual({status:"succeeded",run_generation:2});
      expect((await db.query(`select state from public.analysis_attempt_charges where job_id=$1`,[f.jobId])).rows[0])
        .toEqual({state:"consumed"});
    });

    it("does not resolve a compensated terminal Verified attempt", async () => {
      const f=await fixture(); await f.start();
      const state=(await db.query<{state_revision:number}>(`select state_revision from public.analysis_jobs where id=$1`,[f.jobId])).rows[0];
      await db.query(`select * from public.apply_analysis_job_event(
        $1,$2,$3,'failed','failed',20::smallint,1,'V22_INTERNAL_ERROR','failed','{}',null,now(),1,null)`,
        [f.jobId,f.caseId,state.state_revision+1]);
      await expect(db.query(`select public.resolve_v22_verified_analysis_input($1,$2,1)`,[f.jobId,f.caseId]))
        .rejects.toThrow("V22_VERIFIED_JOB_INVALID");
      expect((await db.query(`select state from public.analysis_attempt_charges where job_id=$1`,[f.jobId])).rows[0])
        .toEqual({state:"compensated"});
    });

    it("rejects an impossible report-backed replay if its charge was tampered to compensated", async () => {
      const f=await fixture(); await f.start(); await f.persist();
      await db.exec(`alter table public.analysis_attempt_charges disable trigger prevent_v22_report_backed_compensation`);
      try {
        await db.query(`update public.analysis_attempt_charges set state='compensated',settled_at=now() where job_id=$1`,[f.jobId]);
        await expect(db.query(`select public.resolve_v22_verified_analysis_input($1,$2,1)`,[f.jobId,f.caseId]))
          .rejects.toThrow("V22_VERIFIED_JOB_INVALID");
      } finally {
        await db.exec(`alter table public.analysis_attempt_charges enable trigger prevent_v22_report_backed_compensation`);
      }
    });

    it("compensates expired queued jobs exactly once through existing settlement", async () => {
      const f = await fixture(); await f.start();
      await db.query(`update public.analysis_jobs set created_at=now()-interval '2 hours',deadline_at=now()-interval '1 hour' where id=$1`,[f.jobId]);
      const expire = () => db.query(`select * from public.expire_v22_stale_verified_jobs(now(),100)`);
      expect((await expire()).rows).toEqual([{job_id:f.jobId}]);
      expect((await expire()).rows).toEqual([]);
      expect((await db.query(`select audit_credits from public.users where id=$1`,[f.owner])).rows[0]).toEqual({audit_credits:5});
      expect((await db.query(`select state from public.analysis_attempt_charges where job_id=$1`,[f.jobId])).rows[0]).toEqual({state:"compensated"});
      expect((await db.query(`select error_code from public.analysis_jobs where id=$1`,[f.jobId])).rows[0]).toEqual({error_code:"V22_VERIFIED_ENQUEUE_TIMEOUT"});
      expect((await db.query(`select kind from public.audit_credit_ledger where job_id=$1 order by delta`,[f.jobId])).rows).toEqual([{kind:"attempt_debit"},{kind:"technical_failure_credit"}]);
      const retry = await f.start(randomUUID(),`${f.key}:retry`,f.owner,digest(f.parent),f.jobId);
      expect(retry.rows[0]).toMatchObject({created:true,audit_credits:4,parent_report_id:f.parentId});
    });

    it.each(["running","report-backed","terminal"])("does not compensate a %s job", async (state) => {
      const f=await fixture(); await f.start();
      if (state === "report-backed") await f.persist();
      if (state === "running") await db.query(`update public.analysis_jobs set status='running' where id=$1`,[f.jobId]);
      if (state === "terminal") {
        await f.persist();
        await db.query(`select public.apply_analysis_job_event($1,$2,1,'succeeded','completed',100::smallint,1,null,null,'{}',null,now(),1,null)`,[f.jobId,f.caseId]);
        expect((await f.persist()).rows).toEqual([{report_id:f.jobId,idempotent:true}]);
      }
      await db.query(`update public.analysis_jobs set created_at=now()-interval '2 hours',deadline_at=now()-interval '1 hour' where id=$1`,[f.jobId]);
      expect((await db.query(`select * from public.expire_v22_stale_verified_jobs(now(),100)`)).rows).toEqual([]);
      expect((await db.query(`select audit_credits from public.users where id=$1`,[f.owner])).rows[0]).toEqual({audit_credits:4});
    });

    it("rejects mismatched first-party coverage and evidence source identities", async () => {
      const f=await fixture(); await f.start();
      const wrongCoverage=structuredClone(f.result());
      wrongCoverage.data_coverage.sources.find((s:{source_type:string})=>s.source_type === "gsc").snapshot_ids=[f.snapshots.ga4];
      await expect(f.persist(wrongCoverage)).rejects.toThrow("V22_VERIFIED_");
      const wrongEvidence=structuredClone(f.result());
      wrongEvidence.evidence_index.push({...wrongEvidence.evidence_index[0],source_type:"gsc",snapshot_id:f.snapshots.ga4});
      await expect(f.persist(wrongEvidence)).rejects.toThrow("V22_VERIFIED_");
    });

    it.each(["site","serp","competitor","gbp","gsc","ga4"])("rejects an unbound %s coverage snapshot without persisting", async source => {
      const f=await fixture(); await f.start();
      const result=structuredClone(f.result());
      result.data_coverage.sources.find((s:{source_type:string})=>s.source_type === source).snapshot_ids=[randomUUID()];
      await expect(f.persist(result)).rejects.toThrow("V22_VERIFIED_COVERAGE_INVALID");
      expect((await db.query(`select id from public.reports where id=$1`,[f.jobId])).rows).toEqual([]);
      expect((await db.query(`select report_id from public.analysis_jobs where id=$1`,[f.jobId])).rows).toEqual([{report_id:null}]);
    });

    it.each(["site","serp","competitor","gbp","gsc","ga4","both-first-party"])("rejects missing %s coverage", async source => {
      const f=await fixture(); await f.start();
      const result=structuredClone(f.result());
      result.data_coverage.sources=result.data_coverage.sources.filter((s:{source_type:string})=>source === "both-first-party" ? !["gsc","ga4"].includes(s.source_type) : s.source_type !== source);
      await expect(f.persist(result)).rejects.toThrow("V22_VERIFIED_COVERAGE_INVALID");
    });

    it.each([
      ["site","ga4"],["serp","site"],["competitor","serp"],["gbp","site"],["gsc","ga4"],["ga4","gsc"],
      ["coverage","site"],["pagespeed","ga4"],
    ])("rejects %s Evidence relabeled from a %s snapshot", async (source,snapshotSource) => {
      const f=await fixture(); await f.start();
      const result=structuredClone(f.result());
      result.evidence_index.push({...result.evidence_index[0],evidence_id:"ev_forged_source",source_type:source,snapshot_id:f.snapshots[snapshotSource]});
      await expect(f.persist(result)).rejects.toThrow("V22_VERIFIED_EVIDENCE_INVALID");
    });

    it("rejects duplicate source coverage entries", async () => {
      const f=await fixture(); await f.start();
      const result=structuredClone(f.result());
      result.data_coverage.sources.push({...result.data_coverage.sources[0]});
      await expect(f.persist(result)).rejects.toThrow("V22_VERIFIED_COVERAGE_INVALID");
    });

    it("preserves coverage Evidence provenance explicitly frozen in the parent", async () => {
      const f=await fixture(true); await f.start();
      expect((await f.persist()).rows).toEqual([{report_id:f.jobId,idempotent:false}]);
    });

    it("keeps Case deletion possible after frozen Verified inputs are created", async () => {
      const f=await fixture(); await f.start(); await f.persist();
      await db.query(`delete from public.client_cases where id=$1`,[f.caseId]);
      expect((await db.query(`select job_id from public.verified_analysis_inputs where job_id=$1`,[f.jobId])).rows).toEqual([]);
    });

    it("exposes the table and four RPCs only to service_role", async () => {
      expect((await db.query(`select relrowsecurity from pg_class where oid='public.verified_analysis_inputs'::regclass`)).rows[0]).toEqual({relrowsecurity:true});
      for (const signature of ["start_v22_verified_analysis(uuid,uuid,uuid,text,text,uuid,uuid)","resolve_v22_verified_analysis_input(uuid,uuid,integer)","persist_v22_verified_result(uuid,uuid,jsonb,integer)","expire_v22_stale_verified_jobs(timestamptz,integer)"]) {
        for (const role of ["anon","authenticated","service_role"]) expect((await db.query(`select has_function_privilege($1,$2,'EXECUTE') as allowed`,[role,`public.${signature}`])).rows[0]).toEqual({allowed:role === "service_role"});
      }
      for (const role of ["anon","authenticated","service_role"]) expect((await db.query(`select has_table_privilege($1,'public.verified_analysis_inputs','SELECT') as allowed`,[role])).rows[0]).toEqual({allowed:role === "service_role"});
    });

    it("keeps takeover replay helpers service-role only", async () => {
      for (const signature of [
        "is_v22_verified_success_replay(uuid,uuid,integer)",
        "resolve_v22_verified_analysis_input_strict_generation_v2(uuid,uuid,integer)",
        "persist_v22_verified_result_strict_generation_v2(uuid,uuid,jsonb,integer)",
      ]) {
        for (const role of ["anon","authenticated","service_role"]) {
          expect((await db.query(`select has_function_privilege($1,$2,'EXECUTE') as allowed`,
            [role,`public.${signature}`])).rows[0]).toEqual({allowed:role === "service_role"});
        }
      }
    });
  });
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

  it("creates the thirteen server-only v2.2 tables with RLS enabled", async () => {
    const tables = await db.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname, relrowsecurity
       from pg_class
       where relnamespace = 'public'::regnamespace
         and relname = any(array[
           'client_cases', 'google_connections', 'case_source_bindings',
           'data_snapshots', 'analysis_jobs', 'case_report_entitlements',
           'report_shares', 'google_oauth_sessions', 'google_connection_events',
           'google_token_broker_requests', 'analysis_attempt_charges', 'audit_credit_ledger',
           'identity_deletion_receipts'
         ])
       order by relname`,
    );

    expect(tables.rows).toHaveLength(13);
    expect(tables.rows.every((row) => row.relrowsecurity)).toBe(true);

    const browserGrants = await db.query<{ count: number }>(
      `select count(*)::int as count
       from information_schema.table_privileges
       where table_schema = 'public'
         and table_name = any(array[
           'client_cases', 'google_connections', 'case_source_bindings',
           'data_snapshots', 'analysis_jobs', 'case_report_entitlements',
           'report_shares', 'google_oauth_sessions', 'google_connection_events',
           'google_token_broker_requests', 'analysis_attempt_charges', 'audit_credit_ledger',
           'identity_deletion_receipts'
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

  it("isolates GA4 jobs, freezes host scope and commits only valid current-property snapshots", async () => {
    const owner = await insertUser("ga4-sync-owner");
    const outsider = await insertUser("ga4-sync-outsider");
    const caseId = await insertCase(owner, "ga4-sync-case");
    const conn = await insertConnection(owner, "ga4-sync-connection");
    await db.query(`update public.google_connections set granted_scopes=array['openid','email','profile','https://www.googleapis.com/auth/analytics.readonly'] where id=$1`, [conn]);
    const binding = (await db.query<{ id: string }>(`select * from public.select_v22_google_resource($1,$2,$3,'ga4','properties/12345','GA4 Property','accounts/9',null)`, [owner, caseId, conn])).rows[0].id;
    await db.query(`update public.case_source_bindings set identity_match_status='matched' where id=$1`, [binding]);
    type SyncJob = { id: string; status: string; source_type: string; coverage_end: string; lease_id: string; attempt_count: number; snapshot_id: string | null; error_code: string | null; filter_hosts: string[] };
    const request = async (key = randomUUID(), hosts = ["ga4-sync-case.example.com", "www.ga4-sync-case.example.com"], user = owner) =>
      (await db.query<SyncJob>(`select * from public.request_v22_ga4_sync($1,$2,$3,$4,$5)`, [user, caseId, binding, key, hosts])).rows[0];
    const claim = async (id: string) => (await db.query<{ job: SyncJob | null }>(`select public.claim_v22_ga4_sync($1) as job`, [id])).rows[0].job;
    const finish = async (job: SyncJob, override: object = {}) => {
      const offset = (days: number) => new Date(new Date(`${job.coverage_end}T00:00:00Z`).getTime() - days * 86400000).toISOString().slice(0, 10);
      const payload = { schema_version: "ga4_sync_v1", resource_id: "properties/12345", host_filter: job.filter_hosts,
        current: { start_date: offset(89), end_date: offset(0) }, previous: { start_date: offset(179), end_date: offset(90) }, ...override };
      return (await db.query<{ id: string | null }>(`select public.finish_v22_ga4_sync($1,$2,$3::jsonb,$4,'healthy','["GA4_HOST_FILTERED"]'::jsonb) as id`,
        [job.id, job.lease_id, JSON.stringify(payload), checksum])).rows[0].id;
    };
    await expect(request(randomUUID(), ["other.example.com"])).rejects.toThrow("INVALID_HOST_FILTER");
    await expect(request(randomUUID(), ["ga4-sync-case.example.com"], outsider)).rejects.toThrow("SYNC_FORBIDDEN");
    const key = randomUUID();
    const queued = await request(key);
    expect(queued).toMatchObject({ source_type: "ga4", filter_hosts: ["ga4-sync-case.example.com", "www.ga4-sync-case.example.com"] });
    expect((await request(key)).id).toBe(queued.id);
    expect((await db.query<{ job: SyncJob | null }>(`select public.claim_v22_gsc_sync($1) as job`, [queued.id])).rows[0].job).toBeNull();
    expect((await db.query<{ status: string }>(`select status from public.google_sync_jobs where id=$1`, [queued.id])).rows[0].status).toBe("queued");
    const running = (await claim(queued.id))!;
    await expect(finish(running, { host_filter: ["other.example.com"] })).rejects.toThrow("INVALID_SYNC_RESULT");
    expect(await finish(running)).toBe(queued.id);
    const stored = (await db.query<{ source_type: string; raw_payload: unknown; provider_request_context: { host_filter: string[] } }>(`select source_type,raw_payload,provider_request_context from public.data_snapshots where id=$1`, [queued.id])).rows[0];
    expect(stored).toMatchObject({ source_type: "ga4", raw_payload: null, provider_request_context: { host_filter: queued.filter_hosts } });
    const second = await request();
    const oldIdentity = (await claim(second.id))!;
    await db.query(`update public.client_cases set business_name='Changed GA4 business' where id=$1`, [caseId]);
    expect(await finish(oldIdentity)).toBeNull();
    expect((await db.query<{ status: string; error_code: string }>(`select status,error_code from public.google_sync_jobs where id=$1`, [second.id])).rows[0])
      .toEqual({ status: "failed", error_code: "SYNC_BINDING_CHANGED" });
    expect((await db.query<{ count: number }>(`select count(*)::int as count from public.data_snapshots where binding_id=$1 and source_type='ga4'`, [binding])).rows[0].count).toBe(1);
    for (const role of ["anon", "authenticated"]) {
      expect((await db.query<{ allowed: boolean }>(`select has_function_privilege($1,'public.request_v22_ga4_sync(uuid,uuid,uuid,uuid,text[])','EXECUTE') as allowed`, [role])).rows[0].allowed).toBe(false);
      expect((await db.query<{ allowed: boolean }>(`select has_function_privilege($1,'public.finish_v22_ga4_sync(uuid,uuid,jsonb,text,text,jsonb)','EXECUTE') as allowed`, [role])).rows[0].allowed).toBe(false);
    }
  });

  it("fences GBP jobs, stores content for at most 30 days and cleans it without stale downgrades", async () => {
    const owner = await insertUser("gbp-sync-owner");
    const outsider = await insertUser("gbp-sync-outsider");
    const caseId = await insertCase(owner, "gbp-sync-case");
    const conn = await insertConnection(owner, "gbp-sync-connection");
    await db.query(`update public.google_connections set granted_scopes=array['openid','email','profile','https://www.googleapis.com/auth/business.manage'] where id=$1`, [conn]);
    const binding = (await db.query<{ id: string }>(`select * from public.select_v22_google_resource($1,$2,$3,'gbp','locations/12345','Example GBP','accounts/9',null)`, [owner, caseId, conn])).rows[0].id;
    await db.query(`update public.case_source_bindings set identity_match_status='matched' where id=$1`, [binding]);
    type SyncJob = { id: string; status: string; source_type: string; coverage_end: string; lease_id: string; attempt_count: number; snapshot_id: string | null; error_code: string | null; filter_hosts: null };
    const request = async (key = randomUUID(), user = owner) =>
      (await db.query<SyncJob>(`select * from public.request_v22_gbp_sync($1,$2,$3,$4)`, [user, caseId, binding, key])).rows[0];
    const claim = async (id: string) => (await db.query<{ job: SyncJob | null }>(`select public.claim_v22_gbp_sync($1) as job`, [id])).rows[0].job;
    const finish = async (job: SyncJob, override: object = {}) => {
      const offset = (days: number) => new Date(new Date(`${job.coverage_end}T00:00:00Z`).getTime() - days * 86400000).toISOString().slice(0, 10);
      const manifest = {
        schema_version: "gbp_sync_v1", resource_id: "locations/12345",
        current: { start_date: offset(89), end_date: offset(0), has_impressions: true },
        previous: { start_date: offset(179), end_date: offset(90), has_impressions: true },
        keywords: { start_month: offset(179).slice(0, 7), end_month: offset(0).slice(0, 7), pages: 1,
          available: true, threshold_applied: false, truncated: false },
        profile_checks: { voice_of_merchant: true, open: true, title: true, website: true, phone: true,
          primary_category: true, regular_hours: true, address_or_service_area: true },
        limitations: [], ...override,
      };
      const content = { business_information: { name: "locations/12345", title: "Example Business" },
        performance: { multiDailyMetricTimeSeries: [] }, keyword_pages: [{ searchKeywordsCounts: [] }] };
      return (await db.query<{ id: string | null }>(`select public.finish_v22_gbp_sync($1,$2,$3::jsonb,$4::jsonb,$5,'healthy','[]'::jsonb) as id`,
        [job.id, job.lease_id, JSON.stringify(manifest), JSON.stringify(content), checksum])).rows[0].id;
    };

    await expect(request(randomUUID(), outsider)).rejects.toThrow("SYNC_FORBIDDEN");
    const key = randomUUID();
    const queued = await request(key);
    expect(queued).toMatchObject({ source_type: "gbp", filter_hosts: null });
    expect((await request(key)).id).toBe(queued.id);
    expect((await db.query<{ job: SyncJob | null }>(`select public.claim_v22_gsc_sync($1) as job`, [queued.id])).rows[0].job).toBeNull();
    expect((await db.query<{ job: SyncJob | null }>(`select public.claim_v22_ga4_sync($1) as job`, [queued.id])).rows[0].job).toBeNull();
    const running = (await claim(queued.id))!;
    await expect(finish(running, { resource_id: "locations/999" })).rejects.toThrow("INVALID_SYNC_RESULT");
    expect(await finish(running)).toBe(queued.id);
    const stored = (await db.query<{ source_type: string; raw_payload: unknown; normalized_payload: unknown; retention_policy: string;
      expires_at: string; fetched_at: string }>(`select source_type,raw_payload,normalized_payload,retention_policy,expires_at,fetched_at from public.data_snapshots where id=$1`, [queued.id])).rows[0];
    expect(stored).toMatchObject({ source_type: "gbp", retention_policy: "gbp_content_30d" });
    expect(stored.raw_payload).not.toBeNull();
    expect(JSON.stringify(stored.normalized_payload)).not.toContain("Example Business");
    expect(new Date(stored.expires_at).getTime() - new Date(stored.fetched_at).getTime()).toBeLessThanOrEqual(30 * 86400000);
    await expect(db.query(`update public.data_snapshots set raw_payload=null,raw_content_deleted_at=now() where id=$1`, [queued.id])).rejects.toThrow("only one-way expired GBP raw content cleanup");

    const cleaned = (await db.query<{ count: number }>(`select public.cleanup_v22_expired_gbp_content(now()+interval '31 days',100)::int as count`)).rows[0].count;
    expect(cleaned).toBe(1);
    expect((await db.query<{ raw_payload: unknown; raw_content_deleted_at: string | null }>(`select raw_payload,raw_content_deleted_at from public.data_snapshots where id=$1`, [queued.id])).rows[0])
      .toMatchObject({ raw_payload: null });
    expect((await db.query<{ health_status: string }>(`select health_status from public.case_source_bindings where id=$1`, [binding])).rows[0].health_status).toBe("expired");

    const fresh = await request();
    expect(await finish((await claim(fresh.id))!)).toBe(fresh.id);
    expect((await db.query<{ health_status: string }>(`select health_status from public.case_source_bindings where id=$1`, [binding])).rows[0].health_status).toBe("healthy");
    expect((await db.query<{ count: number }>(`select public.cleanup_v22_expired_gbp_content(now(),100)::int as count`)).rows[0].count).toBe(0);
    expect((await db.query<{ health_status: string }>(`select health_status from public.case_source_bindings where id=$1`, [binding])).rows[0].health_status).toBe("healthy");

    for (const role of ["anon", "authenticated"]) {
      expect((await db.query<{ allowed: boolean }>(`select has_function_privilege($1,'public.request_v22_gbp_sync(uuid,uuid,uuid,uuid)','EXECUTE') as allowed`, [role])).rows[0].allowed).toBe(false);
      expect((await db.query<{ allowed: boolean }>(`select has_function_privilege($1,'public.finish_v22_gbp_sync(uuid,uuid,jsonb,jsonb,text,text,jsonb)','EXECUTE') as allowed`, [role])).rows[0].allowed).toBe(false);
      expect((await db.query<{ allowed: boolean }>(`select has_function_privilege($1,'public.cleanup_v22_expired_gbp_content(timestamptz,integer)','EXECUTE') as allowed`, [role])).rows[0].allowed).toBe(false);
    }
  });

  it("resolves only current Case-bound first-party Findings inputs for service_role", async () => {
    const owner = await insertUser("first-party-findings-owner");
    const caseId = await insertCase(owner, "first-party-findings-case");
    const connection = await insertConnection(owner, "first-party-findings-connection");
    const binding = async (source: string, resource: string) => insertId(
      `insert into public.case_source_bindings (
         case_id, connection_id, source_type, external_resource_id, external_resource_name,
         identity_match_status, health_status, confirmed_by_user_id, confirmed_at
       ) values ($1,$2,$3,$4,$4,'matched','healthy',$5,now()) returning id`,
      [caseId, connection, source, resource, owner],
    );
    const gscBinding = await binding("gsc", "sc-domain:first-party-findings-case.example.com");
    const ga4Binding = await binding("ga4", "properties/12345");
    const gbpBinding = await binding("gbp", "locations/12345");
    const snapshot = async (
      source: string, schema: string, resource: string, bindingId: string,
      gbp = false, fetchedOffset = "-1 second",
    ) => insertId(
      `insert into public.data_snapshots (
         case_id,binding_id,source_type,schema_version,coverage_start,coverage_end,
         expires_at,fetched_at,sync_trigger,health_status,health_reasons,normalized_payload,raw_payload,
         payload_checksum,provider_request_context,retention_policy
       ) values (
         $1,$2,$3,$4,current_date-179,current_date-3,now()+$11::interval+$5::interval,now()+$11::interval,
         'user_sync','healthy','[]'::jsonb,$6::jsonb,$7::jsonb,$8,
         jsonb_build_object('external_resource_id',$9::text),$10
       ) returning id`,
      [caseId, bindingId, source, schema, gbp ? "30 days" : "7 days",
        JSON.stringify({ schema_version: schema, resource_id: resource }),
        gbp ? JSON.stringify({ private: "temporary-content" }) : null,
        checksum, resource, gbp ? "gbp_content_30d" : "standard", fetchedOffset],
    );
    const gsc = await snapshot("gsc", "gsc_sync_v1", "sc-domain:first-party-findings-case.example.com", gscBinding);
    const ga4 = await snapshot("ga4", "ga4_sync_v1", "properties/12345", ga4Binding);
    const gbp = await snapshot("gbp", "gbp_sync_v1", "locations/12345", gbpBinding, true);
    const site = await insertId(
      `insert into public.data_snapshots (case_id,source_type,schema_version,sync_trigger,health_status,
         normalized_payload,payload_checksum) values ($1,'site','site_inventory_snapshot_v1','report_generation',
         'healthy','{}'::jsonb,$2) returning id`, [caseId, checksum],
    );
    const parent = await insertId(
      `insert into public.reports (
         report_id,user_id,page_url,gbp_url,status,access_type,case_id,report_type,schema_version,
         version_number,report_v2_2,snapshot_ids,coverage_state,version_diff,generation_config,
         ruleset_version,copy_model_version
       ) values ($1,$2,'https://first-party-findings-case.example.com','','paid_full','unlocked',$3,
         'prospect','2.2.0',1,'{}'::jsonb,array[$4::uuid],'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,
         'rules-v1','copy-v1') returning id`,
      [`first-party-parent-${randomUUID()}`, owner, caseId, site],
    );
    await db.query(`update public.client_cases set latest_report_id=$2 where id=$1`, [caseId, parent]);
    const resolve = (gbpId: string | null = null) => db.query<{ payload: {
      case_id: string; parent_report_id: string; snapshots: Array<Record<string, unknown>>;
    } }>(
      `select public.resolve_v22_first_party_findings_input($1,$2,$3,$4,$5,now()) as payload`,
      [caseId, parent, gsc, ga4, gbpId],
    );
    const core = (await resolve()).rows[0].payload;
    expect(core.case_id).toBe(caseId);
    expect(core.parent_report_id).toBe(parent);
    expect(core.snapshots.map((item) => item.source_type)).toEqual(["gsc", "ga4"]);
    expect(core.snapshots.every((item) => item.raw_payload === null)).toBe(true);
    const full = (await resolve(gbp)).rows[0].payload;
    expect(full.snapshots.map((item) => item.source_type)).toEqual(["gsc", "ga4", "gbp"]);
    expect(full.snapshots[2].raw_payload).toEqual({ private: "temporary-content" });
    await expectSqlError(
      `select public.resolve_v22_first_party_findings_input($1,$2,$3,$4,null,now())`,
      [caseId, parent, ga4, gsc], "FIRST_PARTY_BINDING_INVALID",
    );
    await expectSqlError(
      `select public.resolve_v22_first_party_findings_input($1,$2,$3,$4,null,now()+interval '8 days')`,
      [caseId, parent, gsc, ga4], "FIRST_PARTY_SNAPSHOT_EXPIRED",
    );
    for (const role of ["anon", "authenticated"]) {
      expect((await db.query<{ allowed: boolean }>(
        `select has_function_privilege($1,'public.resolve_v22_first_party_findings_input(uuid,uuid,uuid,uuid,uuid,timestamptz)','EXECUTE') as allowed`,
        [role],
      )).rows[0].allowed).toBe(false);
    }
    expect((await db.query<{ allowed: boolean }>(
      `select has_function_privilege('service_role','public.resolve_v22_first_party_findings_input(uuid,uuid,uuid,uuid,uuid,timestamptz)','EXECUTE') as allowed`,
    )).rows[0].allowed).toBe(true);

    const newerGsc = await snapshot(
      "gsc", "gsc_sync_v1", "sc-domain:first-party-findings-case.example.com", gscBinding, false, "0 seconds",
    );
    await expectSqlError(
      `select public.resolve_v22_first_party_findings_input($1,$2,$3,$4,null,now())`,
      [caseId, parent, gsc, ga4], "FIRST_PARTY_BINDING_INVALID",
    );
    expect((await db.query<{ payload: { snapshots: Array<Record<string, unknown>> } }>(
      `select public.resolve_v22_first_party_findings_input($1,$2,$3,$4,null,now()) as payload`,
      [caseId, parent, newerGsc, ga4],
    )).rows[0].payload.snapshots).toHaveLength(2);

    await db.query(
      `update public.case_source_bindings set identity_match_status='needs_confirmation' where id=$1`,
      [gscBinding],
    );
    await expectSqlError(
      `select public.resolve_v22_first_party_findings_input($1,$2,$3,$4,null,now())`,
      [caseId, parent, newerGsc, ga4], "FIRST_PARTY_BINDING_INVALID",
    );
    await db.query(
      `update public.case_source_bindings set identity_match_status='matched' where id=$1`,
      [gscBinding],
    );

    await db.query(
      `update public.client_cases set status='archived',archived_at=now() where id=$1`,
      [caseId],
    );
    await expectSqlError(
      `select public.resolve_v22_first_party_findings_input($1,$2,$3,$4,null,now())`,
      [caseId, parent, newerGsc, ga4], "FIRST_PARTY_CASE_INVALID",
    );
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
       set raw_payload = null, raw_content_deleted_at = now() + interval '31 days'
       where id = $1`,
      [gbpSnapshotA],
    );
    await expectSqlError(
      `update public.data_snapshots set raw_payload = '{}'::jsonb where id = $1`,
      [gbpSnapshotA],
      "only one-way expired GBP raw content cleanup is allowed",
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

  it("stores monotonic service-only job cost summaries without identity replacement", async () => {
    const jobId = randomUUID();
    const startedAt = new Date(Date.now() - 2_000).toISOString();
    const completedAt = new Date().toISOString();
    const counters = {
      cost_schema_version: 1,
      cost_ledger_revision: 2,
      serpapi_attempts: 1,
      estimated_cost_usd_micros: 2500,
    };
    const inserted = await db.query<{
      job_id: string; ledger_revision: bigint; status: string; cost_counters: Record<string, number>;
    }>(
      `select (public.upsert_v22_job_cost_summary(
         $1, $2, 'competitor_discovery', 'succeeded', 1, 2,
         $3::jsonb, $4::timestamptz, $5::timestamptz
       )).*`,
      [jobId, caseA, JSON.stringify(counters), startedAt, completedAt],
    );
    expect(inserted.rows[0].job_id).toBe(jobId);
    expect(Number(inserted.rows[0].ledger_revision)).toBe(2);

    const stale = await db.query<{ ledger_revision: bigint; cost_counters: Record<string, number> }>(
      `select ledger_revision, cost_counters from public.upsert_v22_job_cost_summary(
         $1, $2, 'competitor_discovery', 'succeeded', 1, 1,
         '{"cost_schema_version":1,"cost_ledger_revision":1,"serpapi_attempts":0}'::jsonb,
         $3::timestamptz, $4::timestamptz
       )`,
      [jobId, caseA, startedAt, completedAt],
    );
    expect(Number(stale.rows[0].ledger_revision)).toBe(2);
    expect(stale.rows[0].cost_counters.serpapi_attempts).toBe(1);

    await expectSqlError(
      `select public.upsert_v22_job_cost_summary(
         $1, $2, 'competitor_discovery', 'succeeded', 1, 3,
         '{"cost_schema_version":1,"cost_ledger_revision":3}'::jsonb,
         $3::timestamptz, $4::timestamptz
       )`,
      [jobId, caseB, startedAt, completedAt],
      "COST_SUMMARY_IDENTITY_CONFLICT",
    );
    await expectSqlError(
      `select public.upsert_v22_job_cost_summary(
         $1, $2, 'prospect_report', 'succeeded', 1, 1,
         '{"cost_schema_version":1,"cost_ledger_revision":1,"bad":1.5}'::jsonb,
         $3::timestamptz, $4::timestamptz
       )`,
      [randomUUID(), caseA, startedAt, completedAt],
      "INVALID_COST_SUMMARY",
    );
  });

  it("closes the Case entitlement and returns one general credit after a technical failure", async () => {
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
    const failedJob = randomUUID();
    await db.query(
      `select * from public.start_v22_prospect_analysis($1, $2, $3, 'paid-failed-job')`,
      [owner, paidCase, failedJob],
    );

    await db.query(
      `select * from public.apply_analysis_job_event(
         $1, $2, 1, 'failed', 'failed', 40::smallint, 1,
         'PROVIDER_TIMEOUT', 'Please retry.', '{}'::jsonb, now(), now()
       )`,
      [failedJob, paidCase],
    );
    const returned = await db.query<{ status: string; reserved_job_id: string | null; credits: number; compensation_count: number }>(
      `select status, reserved_job_id,
         (select audit_credits from public.users where id = $2)::int as credits,
         (select count(*) from public.audit_credit_ledger where job_id = $3 and kind = 'technical_failure_credit')::int as compensation_count
       from public.case_report_entitlements where case_id = $1`,
      [paidCase, owner, failedJob],
    );
    expect(returned.rows[0]).toEqual({
      status: "compensated", reserved_job_id: failedJob, credits: 6, compensation_count: 1,
    });

    await db.query(
      `select * from public.apply_analysis_job_event(
         $1, $2, 1, 'failed', 'failed', 40::smallint, 1,
         'PROVIDER_TIMEOUT', 'Please retry.', '{}'::jsonb, now(), now()
       )`,
      [failedJob, paidCase],
    );
    expect((await db.query<{ credits: number }>(
      `select audit_credits::int as credits from public.users where id = $1`, [owner],
    )).rows[0].credits).toBe(6);

    const completedReport = await insertId(
      `insert into public.reports (
         report_id, user_id, page_url, gbp_url, access_type,
         case_id, report_type, schema_version, version_number
       ) values ('paid-completed-report', $1, 'https://paid-case.example.com', '', 'paid_credit', $2, 'prospect', '2.2', 2)
       returning id`,
      [owner, paidCase],
    );
    const completedJob = randomUUID();
    await db.query(
      `select * from public.start_v22_prospect_analysis($1, $2, $3, 'paid-completed-job', $4)`,
      [owner, paidCase, completedJob, failedJob],
    );
    await db.query(`update public.analysis_jobs set report_id = $1 where id = $2`, [completedReport, completedJob]);
    await db.query(
      `select * from public.apply_analysis_job_event(
         $1, $2, 1, 'succeeded', 'completed', 100::smallint, 1,
         null, 'Complete', '{}'::jsonb, now(), now()
       )`,
      [completedJob, paidCase],
    );
    const consumed = await db.query<{ status: string; consumed_report_id: string | null; charge_state: string; credits: number }>(
      `select status, consumed_report_id,
         (select state from public.analysis_attempt_charges where job_id = $2) as charge_state,
         (select audit_credits from public.users where id = $3)::int as credits
       from public.case_report_entitlements where case_id = $1`,
      [paidCase, completedJob, owner],
    );
    expect(consumed.rows[0]).toEqual({
      status: "compensated", consumed_report_id: null, charge_state: "consumed", credits: 5,
    });

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

  it("freezes Google access and atomically records an idempotent Clerk user deletion", async () => {
    const owner = await insertUser("security-delete-owner");
    const outsider = await insertUser("security-delete-outsider");
    const caseId = await insertCase(owner, "security-delete-case");
    const connectionId = await insertConnection(owner, "security-delete-connection");
    const reportId = await insertId(
      `insert into public.reports (
         report_id, user_id, case_id, page_url, gbp_url, access_type
       ) values ('security-delete-report', $1, $2, 'https://delete.example.com', '', 'free_trial')
       returning id`,
      [owner, caseId],
    );
    await db.query(
      `insert into public.report_shares (
         user_id, case_id, report_id, token_hash, view_mode, expires_at
       ) values ($1, $2, $3, $4, 'client', now() + interval '30 days')`,
      [owner, caseId, reportId, "b".repeat(64)],
    );

    const prepared = await db.query<{ user_id: string | null }>(
      `select public.prepare_v22_user_deletion('clerk_security-delete-owner') as user_id`,
    );
    expect(prepared.rows[0].user_id).toBe(owner);
    expect((await db.query<{ status: string; has_token: boolean }>(
      `select status, access_token_ciphertext is not null as has_token
       from public.google_connections where id = $1`,
      [connectionId],
    )).rows[0]).toEqual({ status: "deleting", has_token: true });

    const eventDigest = "11".repeat(32);
    const subjectDigest = "22".repeat(32);
    const completed = await db.query<{ outcome: string }>(
      `select public.complete_v22_user_deletion(
         'clerk_security-delete-owner', decode($1, 'hex'), decode($2, 'hex'),
         '2026-09-10T00:00:00Z'::timestamptz
       ) as outcome`,
      [eventDigest, subjectDigest],
    );
    expect(completed.rows[0].outcome).toBe("deleted");

    const remaining = await db.query<{ count: number }>(
      `select (
         (select count(*) from public.users where id = $1) +
         (select count(*) from public.client_cases where user_id = $1) +
         (select count(*) from public.google_connections where user_id = $1) +
         (select count(*) from public.reports where user_id = $1) +
         (select count(*) from public.report_shares where user_id = $1)
       )::int as count`,
      [owner],
    );
    expect(remaining.rows[0].count).toBe(0);
    expect((await db.query<{ count: number }>(
      `select count(*)::int as count from public.users where id = $1`, [outsider],
    )).rows[0].count).toBe(1);

    const duplicate = await db.query<{ outcome: string }>(
      `select public.complete_v22_user_deletion(
         'clerk_security-delete-owner', decode($1, 'hex'), decode($2, 'hex'),
         '2026-09-10T00:00:00Z'::timestamptz
       ) as outcome`,
      [eventDigest, subjectDigest],
    );
    expect(duplicate.rows[0].outcome).toBe("already_deleted");
    await expectSqlError(
      `select public.complete_v22_user_deletion(
         'clerk_other', decode($1, 'hex'), decode($2, 'hex'),
         '2026-09-10T00:00:00Z'::timestamptz
       )`,
      [eventDigest, "33".repeat(32)],
      "DELETION_EVENT_CONFLICT",
    );

    const lateCreate = await db.query<{ outcome: string }>(
      `select public.register_v22_clerk_user(
         'clerk_security-delete-owner', decode($1, 'hex'),
         'must-not-return@example.com', 'Deleted User'
       ) as outcome`,
      [subjectDigest],
    );
    expect(lateCreate.rows[0].outcome).toBe("blocked_deleted_identity");
    expect((await db.query<{ count: number }>(
      `select count(*)::int as count from public.users where clerk_user_id = 'clerk_security-delete-owner'`,
    )).rows[0].count).toBe(0);

    const receipt = (await db.query<{
      event_bytes: number;
      subject_bytes: number;
      result_code: string;
    }>(
      `select octet_length(event_id_digest)::int as event_bytes,
              octet_length(subject_digest)::int as subject_bytes,
              result_code
       from public.identity_deletion_receipts
       where event_id_digest = decode($1, 'hex')`,
      [eventDigest],
    )).rows[0];
    expect(receipt).toEqual({ event_bytes: 32, subject_bytes: 32, result_code: "deleted" });

    const browserGrants = await db.query<{ count: number }>(
      `select count(*)::int as count
       from information_schema.table_privileges
       where table_schema = 'public'
         and table_name = 'identity_deletion_receipts'
         and grantee in ('anon', 'authenticated')`,
    );
    expect(browserGrants.rows[0].count).toBe(0);
    expect((await db.query<{ allowed: boolean }>(
      `select has_function_privilege(
         'authenticated',
         'public.complete_v22_user_deletion(text,bytea,bytea,timestamptz)',
         'EXECUTE'
       ) as allowed`,
    )).rows[0].allowed).toBe(false);
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
    const publicGbpId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const now = "2026-09-04T08:00:00Z";
    const publicGbpExpires = "2026-09-05T08:00:00Z";
    const publicGbpUrl = "https://maps.google.com/?cid=123456789";

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
    const publicGbpReference = {case_id:caseId,site_url:"https://result.example.com",
      public_gbp_url:publicGbpUrl,entity_keys:[{kind:"cid",value:"123456789"}],
      confirmation_source:"user",confirmed_at:"2026-09-04T07:00:00Z"};
    const publicGbpPayload = {schema_version:"customer_public_gbp_snapshot_v1",
      request_target:{public_gbp_url:publicGbpUrl,entity_keys:publicGbpReference.entity_keys},
      started_at:"2026-09-04T07:30:00Z",completed_at:now,expires_at:publicGbpExpires,
      health_status:"healthy",identity_match_status:"matched",subject_reference_checksum:checksum,
      limitations:[]};
    const reportPayload = {
      identity: {
        case_id: caseId,
        business: { site_url: "https://result.example.com", public_gbp_url: publicGbpUrl },
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
      data_coverage: { sources: [{source_type:"gbp",health_status:"healthy",
        identity_match_status:"matched",snapshot_ids:[publicGbpId]}] },
      evidence_index: [{ snapshot_id: siteId },{snapshot_id:publicGbpId,source_type:"gbp",
        health_status:"healthy",source_locator:{url:publicGbpUrl}}],
      version_diff: { kind: "initial", parent_report_id: null, entries: [] },
    };
    const persistArgs = [
      jobId, caseId,
      siteId, JSON.stringify(sitePayload), checksum,
      serpId, JSON.stringify(serpPayload), checksum, "2026-09-04T09:00:00Z",
      competitorId, JSON.stringify(competitorPayload), checksum,
      publicGbpId, JSON.stringify(publicGbpPayload), checksum, publicGbpExpires,
      JSON.stringify(publicGbpReference),
      JSON.stringify(reportPayload),
    ];
    const persisted = await db.query<{ report_id: string; idempotent: boolean }>(
      `select * from public.persist_v22_prospect_result(
         $1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8, $9,
         $10, $11::jsonb, $12, $13, $14::jsonb, $15, $16, $17::jsonb, $18::jsonb
       )`,
      persistArgs,
    );
    expect(persisted.rows[0]).toEqual({ report_id: jobId, idempotent: false });
    const persistedAgain = await db.query<{ report_id: string; idempotent: boolean }>(
      `select * from public.persist_v22_prospect_result(
         $1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8, $9,
         $10, $11::jsonb, $12, $13, $14::jsonb, $15, $16, $17::jsonb, $18::jsonb
       )`,
      persistArgs,
    );
    expect(persistedAgain.rows[0]).toEqual({ report_id: jobId, idempotent: true });
    const changedReference = [...persistArgs];
    changedReference[16] = JSON.stringify({...publicGbpReference,confirmed_at:"2026-09-04T06:00:00Z"});
    await expect(db.query(
      `select * from public.persist_v22_prospect_result(
         $1, $2, $3, $4::jsonb, $5, $6, $7::jsonb, $8, $9,
         $10, $11::jsonb, $12, $13, $14::jsonb, $15, $16, $17::jsonb, $18::jsonb
       )`, changedReference)).rejects.toThrow("immutable v2.2 public GBP reference conflict");

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
      snapshots: 4,
      report_id: jobId,
      latest_report_id: jobId,
      entitlement_status: "consumed",
    });
  });

  it("restricts both four-source Prospect persistence overloads to service_role", async () => {
    const base = "uuid,uuid,uuid,jsonb,text,uuid,jsonb,text,timestamptz,uuid,jsonb,text,uuid,jsonb,text,timestamptz,jsonb,jsonb";
    for (const signature of [base, `${base},integer`]) {
      for (const role of ["anon","authenticated","service_role"]) {
        expect((await db.query(`select has_function_privilege($1,$2,'EXECUTE') as allowed`,
          [role,`public.persist_v22_prospect_result(${signature})`])).rows[0])
          .toEqual({allowed:role === "service_role"});
      }
    }
  });
});
