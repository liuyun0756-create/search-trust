import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {canonicalDigest,canonicalJsonText} from '../verified-analysis-v22/digest';
import {database,enrolled,legacy,rpc} from './test-support/acquisition-binding.mjs';
import original from '../report-capability/fixtures/customer-reviews-v22/bound.json';
import originalReport from '../report-capability/fixtures/customer-reviews-v22/report.json';

const customerReviewsMigration = '20261124100000_bind_customer_gbp_reviews_v22.sql';
const reassessmentMigration = '20261125100000_enable_v22_identity_reassessment.sql';
const patchedFunctions = [
  'check_v22_acquisition_preparation_binding',
  'commit_v22_public_reassessment',
  'get_v22_acquisition_identity_pin',
  'prepare_v22_public_reassessment',
  'v22_a3_manifest_shape',
  'validate_v22_gbp_comparison',
  'validate_v22_possible_reasons',
];
const newFunctions = [
  'resolve_v22_report_recipe(jsonb,boolean)',
  'validate_v22_gbp_comparison(jsonb,boolean)',
  'validate_v22_possible_reasons(jsonb,boolean)',
  'validate_v22_reassessment_report(jsonb,boolean)',
];

async function functionState(instance: Awaited<ReturnType<typeof database>>) {
  return (await instance.query(`
    select oid::regprocedure::text as signature, md5(prosrc) as body_md5, md5(pg_get_functiondef(oid)) as definition_md5,
      proacl::text as acl
    from pg_proc where pronamespace='public'::regnamespace and proname=any($1::text[]) order by signature
  `, [patchedFunctions])).rows;
}

async function expectOriginalGbpValidator(instance: Awaited<ReturnType<typeof database>>) {
  const source = await instance.query<{md5:string}>(`
    select md5(prosrc) from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure`);
  expect(source.rows[0].md5).toBe('0c8ef85809288363c25b47bc8ae303d5');
}

let db: Awaited<ReturnType<typeof database>>;
beforeAll(async () => { db = await database(); }, 30_000);
afterAll(async () => { await db?.close(); });

async function traceRecipeLookups() {
  const definition = (await db.query<{definition:string}>(`
    select pg_get_functiondef('public.resolve_v22_report_recipe(jsonb,boolean)'::regprocedure) as definition
  `)).rows[0].definition;
  const entry = '\nbegin\n';
  expect(definition).toContain(entry);
  await db.exec(definition.replace(entry, `
begin
 raise notice 'test_recipe_lookup' using detail = json_build_object(
   'id',p_manifest->>'id','allowPreview',p_allow_preview)::text;
`));
  const calls: {id:string;allowPreview:boolean}[] = [];
  return {
    options: {
      onNotice(notice: {message?:string;detail?:string}) {
        if (notice.message === 'test_recipe_lookup' && notice.detail) calls.push(JSON.parse(notice.detail));
      },
    },
    take: () => calls.splice(0),
  };
}

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

it('validates the pinned review sample and commits a v22 identity reassessment without a credit or ledger change', async () => {
  const trace = await traceRecipeLookups();
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
  const frozen = (await db.query<{value:unknown}>(`
    select to_jsonb(public.freeze_v22_acquisition_preparation(
      p_lease_token=>$1::uuid,p_cost_counters=>$2::jsonb,p_input=>$3::jsonb
    )) as value`,[body.p_lease_token,JSON.stringify(body.p_cost_counters),JSON.stringify(body.p_input)],trace.options)).rows[0].value;
  expect(frozen).toMatchObject({manifest_id:m.id});
  const freezeCalls = trace.take();
  expect(freezeCalls).toEqual(freezeCalls.map(()=>({id:m.id,allowPreview:false})));
  expect(await rpc(db,'resolve_v22_report_recipe',{p_manifest:m,p_allow_preview:false})).toEqual(bound.recipe);
  expect(await rpc(db,'hydrate_v22_capability_generation_input',{p_manifest:m,p_recipe:bound.recipe})).toEqual(q);
  for (const key of ['reviews_90d','latest_review','visible_replies']) {
    const forged = structuredClone(report);
    const metric = forged.gbp_comparison.rows[0].metrics[key];
    metric.value = key==='latest_review'?'2026-01-01T00:00:00+00:00':99;
    await expect(db.query('select public.validate_v22_gbp_comparison($1::jsonb)',[JSON.stringify(forged)])).rejects.toThrow('CAPABILITY_CUSTOMER_REVIEWS_VALUE_INVALID');
  }
  const sampling = structuredClone(report);
  sampling.gbp_comparison.customer_sampling.page_count = 4;
  await expect(db.query('select public.validate_v22_gbp_comparison($1::jsonb)',[JSON.stringify(sampling)]))
    .rejects.toThrow('CAPABILITY_CUSTOMER_REVIEWS_VALUE_INVALID');
  const stored = await db.query(`select to_jsonb(public.store_v22_capability_report($1,$2,$3,$4::jsonb,$5)) value`,
    [owner,caseId,m.job_id,JSON.stringify(report),canonicalJsonText(report)],trace.options);
  expect(stored.rows[0]).toMatchObject({value:{schema_version:'2.2.17',payload:report}});
  const storeCalls = trace.take();
  expect(storeCalls.length).toBeGreaterThan(0);
  expect(storeCalls).toEqual(storeCalls.map(()=>({id:m.id,allowPreview:false})));
  await db.query('select * from public.complete_v22_capability_analysis($1,$2,$3,$4::jsonb,$5,1)',
    [owner,caseId,m.job_id,JSON.stringify(report),canonicalJsonText(report)]);

  const credits = async () => (await db.query(`
    select u.credit_balance, count(l.id)::int as ledger_count, coalesce(sum(l.delta),0)::int as ledger_total,
      count(l.id) filter (where l.kind='prospect_debit')::int as prospect_debits
    from public.users u left join public.credit_ledger l on l.user_id=u.id
    where u.id=$1 group by u.id
  `,[owner])).rows[0];
  const before = await credits();
  expect(before).toMatchObject({ledger_count:1,ledger_total:-1,prospect_debits:1});

  const requestId = randomUUID();
  const reportId = randomUUID();
  const evaluatedAt = new Date().toISOString();
  const base = {p_user_id:owner,p_case_id:caseId,p_report_id:m.job_id,p_request_id:requestId};
  const unsigned = {...m,id:randomUUID(),job_id:reportId,identity_version_id:randomUUID(),
    execution_type:'public_reassessment',evaluated_at:evaluatedAt,
    base_report_ref:{report_id:m.job_id,case_id:caseId,report_type:'prospect',version:report.version,payload_checksum:canonicalDigest(report)}};
  delete unsigned.input_checksum;
  const reassessed = {...report,id:reportId,version:report.version+1,generated_at:evaluatedAt,
    settlement_policy:'no_charge_public_reassessment',input_manifest:{...unsigned,input_checksum:canonicalDigest(unsigned)}};
  const preview = {
    selection:{branch_ref:`cid:${identity.selected_branch_ref}`,operating_model:null,customers_can_visit:false,reason:'Keep the saved branch'},
    report:reassessed,report_checksum:canonicalDigest(reassessed),identity,recipe:bound.recipe,
    difference:{before:report.contact_checks,after:report.contact_checks,removed_action_ids:[],added_action_ids:[],
      removed_actions:[],added_actions:[],copy_migrated:false,requires_approval:true,evidence_as_of:m.evidence_as_of,evaluated_at:evaluatedAt},
    expected_identity_revision:0,expected_delivery_revision:0,
  };
  const prepare = (proposed = preview) => rpc(db,'prepare_v22_public_reassessment',
    {...base,p_preview:proposed,p_canonical:canonicalJsonText(proposed)});
  const recipe = (manifest:unknown, allowPreview:boolean) => rpc(db,'resolve_v22_report_recipe',
    {p_manifest:manifest,p_allow_preview:allowPreview});
  expect(await recipe(reassessed.input_manifest,true)).toEqual(bound.recipe);
  await expect(recipe(reassessed.input_manifest,false)).rejects.toThrow('CAPABILITY_GBP_COMPARISON_BINDING_INVALID');
  const unlinked = {...unsigned,base_report_ref:{...unsigned.base_report_ref,payload_checksum:'sha256:'+'f'.repeat(64)}};
  await expect(recipe({...unlinked,input_checksum:canonicalDigest(unlinked)},true))
    .rejects.toThrow('CAPABILITY_GBP_COMPARISON_BINDING_INVALID');

  await db.query('select public.validate_v22_possible_reasons($1::jsonb,$2::boolean)',
    [canonicalJsonText(reassessed),true]);
  const alteredReason = structuredClone(reassessed);
  alteredReason.possible_reasons.items[0].customer_text = 'Altered frozen evidence';
  await expect(prepare({...preview,report:alteredReason,report_checksum:canonicalDigest(alteredReason)}))
    .rejects.toThrow('CAPABILITY_REASONS_BINDING_INVALID');
  await expect(prepare({...preview,selection:{...preview.selection,branch_ref:'place_id:fixture-customer-place'}}))
    .rejects.toThrow('IDENTITY_SOURCE_CONFLICT');
  for (const [corrupt, rejection] of [
    [`update public.capability_generation_recipes set generation_input_checksum='sha256:'||repeat('f',64) where manifest_id=$1`,
     'CAPABILITY_GBP_COMPARISON_BINDING_INVALID'],
    [`update public.capability_generation_recipes set recipe=jsonb_set(recipe,'{request,business_identity,business_name}','"Other fixture business"') where manifest_id=$1`,
     'IDENTITY_SOURCE_CONFLICT'],
    [`update public.analysis_input_manifests set input_checksum='sha256:'||repeat('f',64) where id=$1`,
     'CAPABILITY_GBP_COMPARISON_BINDING_INVALID'],
  ]) {
    await db.exec('begin');
    try {
      // Simulate invalid historical storage in the isolated test database only.
      await db.exec('set local session_replication_role=replica');
      await db.query(corrupt,[m.id]);
      await db.exec('set local session_replication_role=origin');
      await expect(prepare()).rejects.toThrow(rejection);
    } finally {
      await db.exec('rollback');
    }
  }
  const prepared = await db.query<{value:unknown}>(`
    select public.prepare_v22_public_reassessment($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::jsonb,$6) as value
  `,[owner,caseId,m.job_id,requestId,JSON.stringify(preview),canonicalJsonText(preview)],trace.options);
  expect(prepared.rows[0].value).toMatchObject({state:'preview',request_id:requestId});
  const previewCalls = trace.take();
  expect(previewCalls.length).toBeGreaterThanOrEqual(2);
  expect(previewCalls).toEqual(previewCalls.map(()=>({id:unsigned.id,allowPreview:true})));
  expect(await credits()).toEqual(before);

  for (const forgedReview of [false,true]) {
    const request = randomUUID(), job = randomUUID(), identityId = randomUUID();
    const manifest = {...unsigned,id:randomUUID(),job_id:job,identity_version_id:identityId};
    if (forgedReview) {
      manifest.base_report_ref = {...manifest.base_report_ref,payload_checksum:'sha256:'+'f'.repeat(64)};
    } else {
      delete manifest.execution_type;
      delete manifest.base_report_ref;
    }
    const signed = {...manifest,input_checksum:canonicalDigest(manifest)};
    await db.exec('begin');
    try {
      await db.query(`
        insert into public.analysis_jobs(id,case_id,job_type,current_stage,idempotency_key)
        values($1,$2,'prospect_report','queued',$3)
      `,[job,caseId,forgedReview ? `public-reassessment:${request}` : job]);
      if (forgedReview) {
        // Even a matching preview, job, and same-transaction identity cannot
        // authorize a manifest that does not bind the frozen base checksum.
        const forgedReport = {...reassessed,id:job,input_manifest:signed};
        const forgedPreview = {...preview,report:forgedReport,report_checksum:canonicalDigest(forgedReport)};
        await db.query(`
          insert into public.capability_reassessment_requests
            (id,user_id,case_id,base_report_id,preview,preview_checksum,expected_identity_revision,expected_delivery_revision)
          values($1,$2,$3,$4,$5::jsonb,$6,0,0)
        `,[request,owner,caseId,m.job_id,JSON.stringify(forgedPreview),canonicalDigest(forgedPreview)]);
        await db.query(`
          insert into public.case_business_identity_versions(id,user_id,case_id,revision,base_report_id,identity,identity_checksum)
          values($1,$2,$3,1,$4,$5::jsonb,$6)
        `,[identityId,owner,caseId,m.job_id,JSON.stringify(identity),m.identity_checksum]);
      }
      await expect(db.query(`
        insert into public.analysis_input_manifests(id,user_id,case_id,job_id,business_version_id,mode,input_checksum,payload)
        values($1,$2,$3,$4,$5,'acquisition',$6,$7::jsonb)
      `,[signed.id,owner,caseId,job,m.business.id,signed.input_checksum,JSON.stringify(signed)])).rejects.toMatchObject({
        message:'CAPABILITY_PREPARATION_CONFLICT',where:expect.stringContaining('check_v22_acquisition_preparation_binding'),
      });
    } finally {
      await db.exec('rollback');
    }
  }

  // Prove commit validates using the new recipe before any new report is saved.
  const commit = () => db.query<{value:unknown}>(`
    select public.commit_v22_public_reassessment($1::uuid,$2::uuid,$3::uuid,$4::uuid) as value
  `,[owner,caseId,m.job_id,requestId],trace.options);
  await db.exec('begin');
  try {
    await db.exec(`
      create function public.test_corrupt_new_recipe() returns trigger language plpgsql as $$
      begin
        new.recipe=jsonb_set(new.recipe,'{request,business_identity,business_name}','"Other fixture business"');
        return new;
      end $$;
      create trigger zz_test_corrupt_new_recipe before insert on public.capability_generation_recipes
        for each row execute function public.test_corrupt_new_recipe();
    `);
    await expect(commit()).rejects.toMatchObject({
      message:'CAPABILITY_GBP_COMPARISON_BINDING_INVALID',where:expect.stringContaining('validate_v22_gbp_comparison'),
    });
  } finally {
    await db.exec('rollback');
  }
  trace.take();
  expect(await credits()).toEqual(before);
  const committed = await commit();
  expect(committed.rows[0].value).toMatchObject({state:'committed',report:{id:reportId}});
  const commitCalls = trace.take();
  // Sample binding plus the direct and nested GBP validators.
  expect(commitCalls).toHaveLength(3);
  expect(commitCalls).toEqual(commitCalls.map(()=>({id:unsigned.id,allowPreview:false})));
  expect(await credits()).toEqual(before);
  const saved = await rpc(db,'get_v22_identity_workspace',{p_user_id:owner,p_case_id:caseId,p_report_id:reportId});
  expect(saved.report).toEqual(reassessed);
  expect(saved.request.evidence_input).toEqual(q.evidence_input);
  expect(await recipe(reassessed.input_manifest,false)).toEqual(bound.recipe);
  expect(await db.query('select id from public.credit_ledger where analysis_job_id=$1',[reportId])).toMatchObject({rows:[]});
},30_000);

it('limits new SQL validators to postgres and service_role',async()=>{
  const rows = await db.query<{roles:string[]}>(`
    select array_agg(distinct coalesce(r.rolname,'PUBLIC') order by coalesce(r.rolname,'PUBLIC')) roles
    from pg_proc p cross join lateral aclexplode(p.proacl) a left join pg_roles r on r.oid=a.grantee
    where p.proname in ('validate_v22_customer_review_metric','validate_v22_customer_review_sample')`);
  expect(rows.rows[0].roles).toEqual(['postgres','service_role']);
  for (const signature of newFunctions) {
    const grants = await db.query<{roles:string[]}>(`
      select array_agg(coalesce(r.rolname,'PUBLIC')) roles
      from pg_proc p cross join lateral aclexplode(p.proacl) a left join pg_roles r on r.oid=a.grantee
      where p.oid=$1::regprocedure`,[signature]);
    expect(grants.rows[0].roles).toEqual(['postgres']);
  }
});

it('restores the baseline when rolling back P1-02 on its own', async () => {
  const preview = await database(true, customerReviewsMigration);
  try {
    const rollback = await readFile(`supabase/rollbacks/${customerReviewsMigration}`,'utf8');
    await preview.exec(rollback);
    await expectOriginalGbpValidator(preview);
  } finally {
    await preview.close();
  }
},30_000);

it('rejects an out-of-order rollback and restores both baselines when rolled back newest first', async () => {
  const preview = await database();
  const p102 = await database(true, customerReviewsMigration);
  try {
    const [oldRollback, newRollback] = await Promise.all([
      readFile(`supabase/rollbacks/${customerReviewsMigration}`,'utf8'),
      readFile(`supabase/rollbacks/${reassessmentMigration}`,'utf8'),
    ]);
    const latestDefinitions = await functionState(preview);
    const p102Definitions = await functionState(p102);
    expect(p102Definitions).toHaveLength(patchedFunctions.length);
    expect(latestDefinitions).not.toEqual(p102Definitions);

    await expect(preview.exec(oldRollback)).rejects.toThrow('P102_BASELINE_MISMATCH_check_v22_acquisition_preparation_binding');
    await preview.exec('rollback');
    expect(await functionState(preview)).toEqual(latestDefinitions);

    await preview.exec(newRollback);
    expect(await functionState(preview)).toEqual(p102Definitions);
    const removed = await preview.query<{absent:boolean}>(`
      select bool_and(to_regprocedure(signature) is null) as absent from unnest($1::text[]) as signature
    `,[newFunctions]);
    expect(removed.rows[0].absent).toBe(true);
    await preview.exec(oldRollback);
    await expectOriginalGbpValidator(preview);
  } finally {
    await Promise.all([preview.close(), p102.close()]);
  }
},30_000);
