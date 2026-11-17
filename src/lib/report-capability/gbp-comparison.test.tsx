// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {CapabilityReportDocument} from '@/components/report/CapabilityReportDocument';
import {CapabilitySharedReport} from '@/components/report/CapabilitySharedReport';
import {gbpDelivery} from './fixtures/gbp-delivery';
import {projectCapabilityReport} from './projection';
import {validateCapabilityReport} from './validate';
import old from './fixtures/keywords-v14/mixed.json';
afterEach(cleanup);
it('accepts v15 and keeps v14 readable without the new module',()=>{
 const {report}=gbpDelivery();expect(validateCapabilityReport(report).ok).toBe(true);
 expect(validateCapabilityReport(old).ok).toBe(true);
 expect(validateCapabilityReport({...old,gbp_comparison:report.gbp_comparison}).ok).toBe(false);
 for(const kind of ['version','reply','customer','comparison']){
  const bad=structuredClone(report),m=bad.gbp_comparison!;
  if(kind==='version')bad.schema_version='2.2.9';
  if(kind==='reply')m.rows[1]!.metrics.visible_replies.denominator=19;
  if(kind==='customer')m.rows[0].metrics.reviews_90d=m.rows[1]!.metrics.reviews_90d;
  if(kind==='comparison'){m.differences[0]!.status='observed';m.differences[0]!.competitor_indices=[1];}
  expect(validateCapabilityReport(bad).ok).toBe(false);
 }
});
it('renders client, shared and advisor views with explicit sample and unknown labels',()=>{
 const {report,delivery}=gbpDelivery();const before=JSON.stringify(report);
 for(const shared of [false,true]){
  render(shared?<CapabilitySharedReport delivery={delivery} token="synthetic"/>:<CapabilityReportDocument document={projectCapabilityReport(report)}/>);
  const section=screen.getByRole('region',{name:'Google Business Profile comparison'});
  expect(section.textContent).toContain('At least 30');expect(section.textContent).toContain('20/30 sampled reviews');
  expect(section.textContent).toContain('Not checked: customer review samples were not collected.');
  expect(section.textContent).not.toMatch(/source_refs|\/payload\/|req_|rv_|latitude|longitude|provider_| · en · mobile|v22_public\./);
  cleanup();
 }
 render(<CapabilityReportDocument document={projectCapabilityReport(report)} technicalDetails/>);
 expect(screen.getByText('Inspect profile comparison sources')).toBeTruthy();
 expect(screen.getByRole('region',{name:'Google Business Profile comparison'}).textContent).toContain('/payload/');
 expect(JSON.stringify(report)).toBe(before);
});
it('client projection excludes every technical field without mutating the input',()=>{
 const {report}=gbpDelivery(),before=JSON.stringify(report);
 expect(JSON.stringify(projectCapabilityReport(report,undefined,true).gbpComparison)).not.toMatch(/source_refs|req_|rv_|\/payload\/|sampled_at|latitude|longitude/);
 expect(JSON.stringify(report)).toBe(before);
});
