// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {CapabilityReportDocument} from '@/components/report/CapabilityReportDocument';
import {CapabilitySharedReport} from '@/components/report/CapabilitySharedReport';
import {landingDelivery} from './fixtures/landing-delivery';
import {projectCapabilityReport} from './projection';
import {validateCapabilityReport} from './validate';
import old from './fixtures/gbp-v15/report.json';
afterEach(cleanup);
it('requires the v16 module and accepts historical v15 without it',()=>{
 const {report}=landingDelivery();expect(validateCapabilityReport(report).ok).toBe(true);
 expect(validateCapabilityReport(old).ok).toBe(true);
 expect(validateCapabilityReport({...old,landing_page_comparison:report.landing_page_comparison}).ok).toBe(false);
 for(const kind of ['source','unknown','count','city','inference','comparison']){
  const bad=structuredClone(report),module=bad.landing_page_comparison!;
  if(kind==='city')module.target_city='Another city';
  if(kind==='source')module.rows[0].metrics.credentials.evidence[0].path='/payload/other';
  if(kind==='unknown')module.rows[0].metrics.case_study.count=0;
  if(kind==='count')module.rows[0].eligible_html_count=99;
  if(kind==='inference')module.comparisons[0].classification='fact' as never;
  if(kind==='comparison')module.comparisons[0].reason='no_supported_difference';
  expect(validateCapabilityReport(bad).ok).toBe(false);
 }
});
it('renders the same bounded observations on client and shared views without technical evidence',()=>{
 const {report,delivery}=landingDelivery(),before=JSON.stringify(report);
 for(const shared of [false,true]){
  render(shared?<CapabilitySharedReport delivery={delivery} token="synthetic"/>:<CapabilityReportDocument document={projectCapabilityReport(report)}/>);
  const section=screen.getByRole('region',{name:'Landing page comparison'});
  expect(section.textContent).toContain('not full-site totals');
  expect(section.textContent).toContain('Website credential claims');
  expect(section.textContent).toContain('Not checked:');
  expect(section.textContent).not.toMatch(/\/payload\/|snapshot_id|sampled_at|landing_content_rules|v22_public\.|latitude|longitude| · en · mobile/);
  cleanup();
 }
 render(<CapabilityReportDocument document={projectCapabilityReport(report)} technicalDetails/>);
 expect(screen.getByText('Inspect landing page comparison sources')).toBeTruthy();
 expect(screen.getByRole('region',{name:'Landing page comparison'}).textContent).toContain('/payload/');
 expect(JSON.stringify(report)).toBe(before);
});
it('strips technical metadata from client projection even for advisor input',()=>{
 const {report}=landingDelivery(),client=projectCapabilityReport(report,undefined,true);
 expect(JSON.stringify(client.landingPageComparison)).not.toMatch(/snapshot_id|\/payload\/|extraction_version|sampled_at/);
 expect(report.gbp_comparison).toBeTruthy();
});
