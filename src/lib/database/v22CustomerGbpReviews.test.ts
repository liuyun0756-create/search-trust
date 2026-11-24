import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {canonicalDigest,canonicalJsonText} from '../verified-analysis-v22/digest';
import {database,enrolled,legacy,rpc} from './test-support/acquisition-binding.mjs';
import original from '../report-capability/fixtures/customer-reviews-v22/bound.json';
import originalReport from '../report-capability/fixtures/customer-reviews-v22/report.json';

let db: Awaited<ReturnType<typeof database>>;
beforeAll(async () => { db = await database(); }, 30_000);
afterAll(async () => { await db?.close(); });

function freshCopy() {
  const delta = Date.now() - 60_000 - Date.parse(original.manifest.evaluated_at);
  function shift(value: any): any {
    if (Array.isArray(value)) return value.map(shift);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key,item]) => [key,shift(item)]));
    }
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(value)) return value;
    const iso = new Date(Date.parse(value) + delta).toISOString();
    return value.endsWith('+00:00') ? iso.replace('Z','+00:00') : iso;
  }
  const bound = shift(original), report = shift(originalReport), {manifest,request} = bound;
  const serp = request.evidence_input.sources.find((source: any) => source.kind === 'serp');
  for (const source of request.evidence_input.sources) {
    if (source.kind === 'competitor') source.payload.market_snapshot_checksum = canonicalDigest(serp.payload);
    if (source.kind === 'public_gbp') source.payload.subject_reference_checksum = canonicalDigest(request.evidence_input.context.customer_public_gbp);
    source.binding.payload_checksum = canonicalDigest(source.payload);
    manifest.snapshots.find((ref: any) => ref.source_kind === source.kind).payload_checksum = source.binding.payload_checksum;
  }
  bound.old = legacy(request.business_identity,request.evidence_input.context.target_market);
  return {bound,report,serp};
}

it('freezes and stores reviews from the pinned branch and rejects falsified customer metrics', async () => {
  const {bound,report,serp} = freshCopy();
  const {manifest:m,request:q} = bound;
  const owner = m.user_id, caseId = m.case_id;
  const confirmationId = m.identity_inheritance.source_identity_version_id;
  const reason = 'The owner confirmed the selected listing';
  const identity = q.business_identity;
  const observed = m.evaluated_at;
  const pinEvidence = {
    domain:identity.normalized_domain, branch_ref:identity.selected_branch_ref,
    entity_keys:{cid:identity.selected_branch_ref}, public_gbp_url:identity.public_gbp_url,
    observed_at:observed, expires_at:new Date(Date.now()+300_000).toISOString(),
  };
  // The existing immutable binding is installed before opening intake, exactly as when the workflow reserves payment.
  const body = await enrolled(db,bound,async () => {
    const confirmedAt = m.identity_inheritance.confirmed_at;
    const checksum = canonicalDigest({evidence:pinEvidence,reason,operating_mode:null,customers_can_visit:false});
    await db.query(`
      insert into case_gbp_branch_confirmations
        (id,user_id,case_id,revision,request_id,evidence,reason,customers_can_visit,confirmed_at,confirmation_checksum)
      values($1,$2,$3,1,$1,$4::jsonb,$5,false,$6,$7)`,
    [confirmationId,owner,caseId,JSON.stringify(pinEvidence),reason,confirmedAt,checksum]);
    await db.query('insert into prospect_gbp_branch_bindings values ($1,$2,$3,$4)',[m.job_id,owner,caseId,confirmationId]);
    Object.assign(m.identity_inheritance,{
      source_identity_checksum:checksum,source_revision:1,
      confirmed_at:confirmedAt.replace(/\.(\d{3})Z$/,(_match:string, ms:string)=>`.${ms}000Z`),
    });
    m.generation_input_checksum = canonicalDigest(q);
    const {input_checksum:_,...unsigned} = m;
    m.input_checksum = canonicalDigest(unsigned);
    bound.recipe.request = structuredClone(q);
    for (const source of bound.recipe.request.evidence_input.sources) {
      delete source.payload;
      if (source.shared_snapshot) delete source.shared_snapshot.snapshot;
    }
    report.input_manifest = structuredClone(m);
    report.generated_at = m.evaluated_at;
    report.keyword_visibility.sample.payload_checksum = serp.binding.payload_checksum;
    const counts = report.gbp_comparison.rows.map((row:any) => row.metrics.reviews_90d.value);
    const date = (index:number) => report.gbp_comparison.rows[index].metrics.latest_review.value.slice(0,10);
    report.possible_reasons.items.find((item:any)=>item.metric==='recent_review_activity').customer_text =
      `Sample competitors had ${counts.slice(1).map((n:number)=>'at least '+n).join(', ')} reviews in their 90-day windows and sample latest dates of ${counts.slice(1).map((_:number,i:number)=>date(i+1)).join(', ')}. Your profile had ${counts[0]} reviews in its sampled 90-day window and a sample latest date of ${date(0)}. This difference may be one contributing factor. These observations do not establish ranking causation.`;
  });
  const frozen = await rpc(db,'freeze_v22_acquisition_preparation',body);
  expect(frozen).toMatchObject({manifest_id:m.id});
  expect(await rpc(db,'hydrate_v22_capability_generation_input',{p_manifest:m,p_recipe:bound.recipe})).toEqual(q);
  for (const key of ['reviews_90d','latest_review','visible_replies']) {
    const forged = structuredClone(report);
    const metric = forged.gbp_comparison.rows[0].metrics[key];
    metric.value = key==='latest_review'?'2026-01-01T00:00:00+00:00':99;
    await expect(db.query('select public.validate_v22_gbp_comparison($1::jsonb)',[JSON.stringify(forged)])).rejects.toThrow('CAPABILITY_CUSTOMER_REVIEWS_VALUE_INVALID');
  }
  const stored = await db.query(`select to_jsonb(public.store_v22_capability_report($1,$2,$3,$4::jsonb,$5)) value`,
    [owner,caseId,m.job_id,JSON.stringify(report),canonicalJsonText(report)]);
  expect(stored.rows[0]).toMatchObject({value:{schema_version:'2.2.17',payload:report}});
},30_000);

it('limits new SQL validators to postgres and service_role',async()=>{
  const rows = await db.query<{roles:string[]}>(`
    select array_agg(distinct coalesce(r.rolname,'PUBLIC') order by coalesce(r.rolname,'PUBLIC')) roles
    from pg_proc p cross join lateral aclexplode(p.proacl) a left join pg_roles r on r.oid=a.grantee
    where p.proname in ('validate_v22_customer_review_metric','validate_v22_customer_review_sample')`);
  expect(rows.rows[0].roles).toEqual(['postgres','service_role']);

});

it('restores the production prosrc baseline with the rollback before any v22 report exists', async () => {
  const preview = await database();
  try {
    const rollback = await readFile('supabase/rollbacks/20261124100000_bind_customer_gbp_reviews_v22.sql','utf8');
    await preview.exec(rollback);
    const source = await preview.query<{md5:string}>(`
      select md5(prosrc) from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure`);
    expect(source.rows[0].md5).toBe('0c8ef85809288363c25b47bc8ae303d5');
  } finally {
    await preview.close();
  }
},30_000);
