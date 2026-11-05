import {describe,it,expect} from 'vitest';
import {candidateReviewFixture} from './fixtures/candidate-review';
import {initialCapabilityRevision} from './revision';
import {replaceCandidate,technicalOmissionConfirmation,normalizeSelection} from './candidate-editing';
import {validateDeliveryRevision} from './validate';
import {projectCapabilityReport} from './projection';
describe('candidate edits',()=>{
 it('keeps report immutable, rejects stale acknowledgement, projects incoming candidate evidence',()=>{
  const report=candidateReviewFixture(),before=JSON.stringify(report),initial=initialCapabilityRevision(report);
  const next=replaceCandidate(report,initial,'ac-synthetic-3',0)!;
  expect(validateDeliveryRevision(next,report)).toBe(false);
  next.technical_omission_confirmation=technicalOmissionConfirmation(report,next);expect(validateDeliveryRevision(next,report)).toBe(true);
  next.status='approved';const projected=projectCapabilityReport(report,next,true);
  expect(projected.actions.map(a=>a.id)).toEqual(['ac-synthetic-3','ac-synthetic-1','ac-synthetic-2']);
  expect(projected.actions[0].whyNow?.candidateSelection).toBe(true);expect(projected.actions[0].whyNow?.systemPosition).toBeNull();
  expect('action_candidates' in projected).toBe(false);
  const stale=structuredClone(next);stale.actions.reverse();stale.client_action_ids=stale.actions.map(a=>a.id) as typeof stale.client_action_ids;expect(validateDeliveryRevision(stale,report)).toBe(false);
  expect(normalizeSelection(next).technical_omission_confirmation).toBeUndefined();expect(JSON.stringify(report)).toBe(before);
 });
 it('keeps weak replacement hidden until explicitly included and rejects unknown or duplicate selections',()=>{
  const report=candidateReviewFixture(),initial=initialCapabilityRevision(report);
  const next=replaceCandidate(report,initial,'ac-synthetic-4',2)!;next.status='approved';
  expect(validateDeliveryRevision(next,report)).toBe(true);expect(projectCapabilityReport(report,next,true).actions).toHaveLength(2);
  expect(replaceCandidate(report,initial,'ac-synthetic-1',0)).toBeNull();expect(replaceCandidate(report,initial,'foreign',0)).toBeNull();
  next.client_action_ids=next.actions.map(a=>a.id) as typeof next.client_action_ids;expect(projectCapabilityReport(report,next,true).actions).toHaveLength(3);
 });
});
