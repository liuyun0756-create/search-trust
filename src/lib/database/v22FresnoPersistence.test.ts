import { PGlite } from '@electric-sql/pglite';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// Real frozen input and RPC transport JSON are private and stay outside Git.
// The regular comparison suite covers the decimal wire format in all clones.
const fixtureDir = process.env.SEARCHTRUST_FRESNO_V18_FIXTURE_DIR;

it.skipIf(!fixtureDir)('stores the exact Fresno v18 report from the rejected persistence request', async () => {
  const exported = await readFile(join(fixtureDir!, 'frozen-export.json'), 'utf8');
  const persisted = await readFile(join(fixtureDir!, 'replay-persistence.json'), 'utf8');
  const { rows: [frozen] } = JSON.parse(exported);
  const { manifest, recipe } = frozen;
  const { user_id: owner, case_id: caseId, job_id: job } = manifest;
  const identity = recipe.request.business_identity;
  const json = JSON.stringify;
  const db = new PGlite();

  try {
    await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
    for (const file of (await readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort()) {
      await db.exec(await readFile(join('supabase/migrations', file), 'utf8'));
    }

    await db.query(
      "insert into users(id,clerk_user_id,email,credit_balance) values($1,'local-fresno','fresno@example.invalid',0)",
      [owner],
    );
    await db.query(`insert into client_cases(
      id,user_id,site_url,normalized_domain,business_name,business_identity,operating_model,primary_service,target_market
    ) values($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb)`, [
      caseId, owner, identity.site_url, identity.normalized_domain, identity.business_name,
      json(identity), identity.operating_model.value, manifest.business.primary_service, json(manifest.target_market),
    ]);
    await db.query(`insert into case_business_scope_versions(id,user_id,case_id,revision,scope)
      values($1,$2,$3,$4,$5::jsonb)`,
      [manifest.business.id, owner, caseId, manifest.business.revision, json(manifest.business)],
    );
    await db.query(`insert into analysis_jobs(id,case_id,job_type,status,current_stage,idempotency_key,deadline_at)
      values($1,$2,'prospect_report','running','persisting','local-fresno',now()+interval '20 minutes')`, [job, caseId]);
    await db.query(`insert into workflow_charges(id,user_id,case_id,workflow_kind,idempotency_key,analysis_job_id,discovery_job_id)
      values($1,$2,$3,'prospect','local-fresno',$1,$1)`, [job, owner, caseId]);
    await db.query(`insert into analysis_input_manifests(id,user_id,case_id,job_id,business_version_id,mode,input_checksum,payload)
      values($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`, [
      manifest.id, owner, caseId, job, manifest.business.id, manifest.mode, manifest.input_checksum, json(manifest),
    ]);
    await db.query(`insert into data_snapshots(
      id,case_id,source_type,schema_version,fetched_at,expires_at,sync_trigger,health_status,normalized_payload,payload_checksum
    ) select (s->>'snapshot_id')::uuid,$2,
        case when s->>'source_kind'='public_gbp' then 'gbp' else s->>'source_kind' end,
        s->>'schema_version',(s->>'fetched_at')::timestamptz,(s->>'expires_at')::timestamptz,
        'report_generation','healthy',s->'normalized_payload',s->>'payload_checksum'
      from jsonb_array_elements($1::jsonb#>'{rows,0,snapshots}') s`, [exported, caseId]);
    await db.query(`insert into analysis_manifest_snapshots(manifest_id,snapshot_id,source_kind)
      select $1,(s->>'snapshot_id')::uuid,s->>'source_kind'
      from jsonb_array_elements($2::jsonb#>'{rows,0,snapshots}') s`, [manifest.id, exported]);
    await db.query(`insert into capability_generation_recipes(manifest_id,user_id,case_id,generation_input_checksum,recipe)
      values($1,$2,$3,$4,$5::jsonb)`, [manifest.id, owner, caseId, manifest.generation_input_checksum, json(recipe)]);

    // Keep the original JSON transport text. JavaScript would turn 16.0 into 16.
    expect((await db.query<{ value: string }>(`select
      $1::jsonb#>>'{p_payload,gbp_comparison,rows,1,metrics,reviews_90d,value}' value`, [persisted])).rows[0]?.value)
      .toBe('16.0');
    const inserted = await db.query<{ schema_version: string; payload_checksum: string; same_payload: boolean }>(`
      select r.schema_version,r.payload_checksum,r.payload is not distinct from $1::jsonb->'p_payload' as same_payload
      from public.store_v22_capability_report($2,$3,$4,$1::jsonb->'p_payload',$1::jsonb->>'p_canonical_content',1) r
    `, [persisted, owner, caseId, job]);
    const digest = createHash('sha256').update(JSON.parse(persisted).p_canonical_content).digest('hex');
    expect(inserted.rows).toEqual([{
      schema_version: '2.2.13', payload_checksum: `sha256:${digest}`, same_payload: true,
    }]);
  } finally {
    await db.close();
  }
}, 30_000);
