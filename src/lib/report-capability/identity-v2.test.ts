import {describe,it,expect} from 'vitest';
import report from './fixtures/identity-v2/report.json';
import identity from './fixtures/identity-v2/identity.json';
import {validateCapabilityReport,validateAnalysisManifest} from './validate';
import {canonicalDigest} from '../verified-analysis-v22/digest';
import {clientActionIds} from './action-visibility';

describe('P1-05 versioned identity contract',()=>{
 it('reads actual generated v13 with v3 manifest and frozen candidate semantics',()=>{
  const parsed=validateCapabilityReport(report);expect(parsed.ok).toBe(true);
  if(!parsed.ok)throw new Error('invalid fixture');
  expect(report.input_manifest.identity_checksum).toBe(canonicalDigest(identity));
  expect(report.schema_version).toBe('2.2.8');
  expect(clientActionIds(parsed.report).length).toBeLessThanOrEqual(3);
 });
 it.each(['identity_checksum','identity_version_id','target_market','evidence_as_of'])('requires v3 %s',key=>{
  const m=structuredClone(report.input_manifest);Reflect.deleteProperty(m,key);
  const {input_checksum:_,...content}=m;m.input_checksum=canonicalDigest(content);
  expect(validateAnalysisManifest(m)).toBe(false);
 });
 it('rejects mixed report and identity versions and keeps operating place separate',()=>{
  expect(validateCapabilityReport({...report,schema_version:'2.2.7'}).ok).toBe(false);
  expect(Object.hasOwn(identity,'primary_location')).toBe(false);
  expect(identity.operating_model.value).toBe('service_area');
  expect(report.contact_checks.find(c=>c.field==='address')).toMatchObject({status:'not_assessed',result:'none'});
 });
});
