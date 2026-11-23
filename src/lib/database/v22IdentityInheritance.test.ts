import {randomUUID} from 'node:crypto';
import {afterAll, beforeAll, expect, it} from 'vitest';
import {canonicalDigest, canonicalJsonText} from '../verified-analysis-v22/digest';
import sample from '../report-capability/fixtures/identity-inheritance-v21/report.json';
import {validateCapabilityReport} from '../report-capability/validate';
import {database, enrolled, fixture, rpc} from './test-support/acquisition-binding.mjs';

let db: Awaited<ReturnType<typeof database>>;
beforeAll(async () => { db = await database(); }, 30000);
afterAll(async () => { await db?.close(); });

it('validates a generated v21 report against its frozen content profile', () => {
  expect(validateCapabilityReport(sample)).toMatchObject({ok: true});
  const tampered = structuredClone(sample);
  tampered.input_manifest.identity_inheritance.base_ruleset = 'v22_capability_public_v20';
  const {input_checksum: _, ...unsigned} = tampered.input_manifest;
  tampered.input_manifest.input_checksum = canonicalDigest(unsigned);
  expect(validateCapabilityReport(tampered)).toMatchObject({ok: false});
});

it('pins only once and freezes the v21 manifest and recipe with an immutable identity source', async () => {
  const input = await fixture('v22_capability_public_v13');
  const m = input.manifest;
  const request = input.request;
  const owner = m.user_id;
  const caseId = m.case_id;
  const historicalId = randomUUID();
  const historicalManifestId = randomUUID();
  const originalId = randomUUID();
  const confirmedAt = new Date(Date.parse(m.evaluated_at) - 60000).toISOString();
  const identity = structuredClone(request.business_identity);
  identity.operating_model = {
    ...identity.operating_model, state: 'resolved', value: 'hybrid', source: 'explicit_confirmation',
    confirmation_ref: {value: 'hybrid', confirmed_by: owner, confirmed_at: confirmedAt,
      evidence_checksum: canonicalDigest({historical: true}), reason: 'Owner verified the location and service area'},
  };
  const originalChecksum = canonicalDigest(identity);

  async function saveIdentity(id: string, revision: number) {
    await db.query(`insert into public.case_business_identity_versions
      (id,user_id,case_id,revision,base_report_id,identity,identity_checksum)
      values($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [id,owner,caseId,revision,historicalId,JSON.stringify(identity),originalChecksum]);
  }

  request.business_identity = identity;
  m.schema_version = 'v22_analysis_input_v11';
  m.ruleset_version = 'v22_capability_public_v21';
  m.identity_checksum = originalChecksum;
  m.identity_inheritance = {
    base_ruleset: 'v22_capability_public_v13', source_identity_version_id: originalId,
    source_identity_checksum: originalChecksum, source_revision: 1, confirmed_at: confirmedAt,
    branch: 'retained', operating_model: 'retained', visits: 'not_previously_confirmed',
  };
  m.generation_input_checksum = canonicalDigest(request);
  const {input_checksum: _, ...unsigned} = m;
  m.input_checksum = canonicalDigest(unsigned);
  input.recipe.request.business_identity = identity;

  const body = await enrolled(db, input, async () => {
    await db.exec('begin');
    const historical = {...m, id: historicalManifestId, job_id: historicalId,
      ruleset_version: 'v22_capability_public_v13', schema_version: 'v22_analysis_input_v3'};
    delete historical.identity_inheritance;
    const {input_checksum: _historicalChecksum, ...historicalUnsigned} = historical;
    historical.input_checksum = canonicalDigest(historicalUnsigned);
    await db.query(`insert into public.analysis_jobs
      (id,case_id,job_type,status,current_stage,idempotency_key,progress,completed_at,capability_report_id)
      values($1,$2,'prospect_report','succeeded','completed','prior-identity-synthetic',100,now(),$1)`, [historicalId,caseId]);
    await db.query(`insert into public.analysis_input_manifests
      (id,user_id,case_id,job_id,business_version_id,mode,input_checksum,payload)
      values($1,$2,$3,$4,$5,'acquisition',$6,$7::jsonb)`,
    [historicalManifestId,owner,caseId,historicalId,m.business.id,historical.input_checksum,JSON.stringify(historical)]);
    const historicalReport = {...sample, id: historicalId, schema_version: '2.2.8', input_manifest: historical};
    await db.query(`insert into public.capability_report_versions
      (id,manifest_id,user_id,case_id,schema_version,payload_checksum,payload)
      values($1,$2,$3,$4,'2.2.8',$5,$6::jsonb)`,
    [historicalId,historicalManifestId,owner,caseId,canonicalDigest(historicalReport),JSON.stringify(historicalReport)]);
    await saveIdentity(originalId, 1);
    await db.exec('commit');
  });

  const selectors = {p_user_id: owner, p_case_id: caseId, p_job_id: m.job_id};
  expect(await rpc(db,'get_v22_acquisition_identity_pin',selectors)).toMatchObject({id: originalId,revision: 1});
  expect(await rpc(db,'get_v22_acquisition_identity_pin',{...selectors,p_user_id: randomUUID()})).toBeNull();
  expect(await rpc(db,'get_v22_acquisition_identity_pin',{...selectors,p_case_id: randomUUID()})).toBeNull();
  await db.exec('set role authenticated');
  try {
    await expect(rpc(db,'get_v22_acquisition_identity_pin',selectors)).rejects.toThrow('permission denied');
  } finally {
    await db.exec('reset role');
  }

  const laterId = randomUUID();
  await saveIdentity(laterId, 2);
  const saved = (await db.query<{request: unknown}>('select request from public.capability_acquisition_preparations where job_id=$1',[m.job_id])).rows[0];
  await rpc(db,'begin_v22_acquisition_preparation',{...selectors,p_idempotency_key:'binding-synthetic',
    p_business_version_id:m.business.id,p_request_canonical:canonicalJsonText(saved.request)});
  expect(await rpc(db,'get_v22_acquisition_identity_pin',selectors)).toMatchObject({id: originalId,revision: 1});

  const forged = structuredClone(body);
  const forgedManifest = forged.p_input.p_manifest;
  forgedManifest.identity_inheritance.source_identity_version_id = laterId;
  forgedManifest.identity_inheritance.source_revision = 2;
  const {input_checksum: _forgedChecksum, ...forgedUnsigned} = forgedManifest;
  forgedManifest.input_checksum = canonicalDigest(forgedUnsigned);
  forged.p_input.p_manifest_canonical = canonicalJsonText(forgedUnsigned);
  await expect(rpc(db,'freeze_v22_acquisition_preparation',forged)).rejects.toThrow('CAPABILITY_PREPARATION_CONFLICT');

  expect(await rpc(db,'freeze_v22_acquisition_preparation',body)).toMatchObject({manifest_id: m.id});
  expect(await rpc(db,'hydrate_v22_capability_generation_input',{p_manifest:m,p_recipe:input.recipe})).toEqual(request);
  const report = {...sample,id:m.job_id,input_manifest:m,generated_at:m.evaluated_at};
  const storeArguments = [owner,caseId,m.job_id,JSON.stringify(report),canonicalJsonText(report)];
  const committed = await db.query(`select to_jsonb(public.store_v22_capability_report($1,$2,$3,$4::jsonb,$5)) value`,storeArguments);
  expect(committed.rows[0]).toBeDefined();
  expect((await db.query('select schema_version from public.capability_report_versions where id=$1',[m.job_id])).rows).toEqual([{schema_version:'2.2.16'}]);
}, 30000);
