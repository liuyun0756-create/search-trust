// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {CapabilityReportDocument} from '@/components/report/CapabilityReportDocument';
import {CapabilitySharedReport} from '@/components/report/CapabilitySharedReport';
import {reasonsDelivery} from './fixtures/reasons-delivery';
import {projectCapabilityReport} from './projection';
import {validateCapabilityReport} from './validate';
import old from './fixtures/landing-v16/report.json';
import {expectedPossibleReasons,possibleReasonsView} from './possible-reasons';
afterEach(cleanup);
it('accepts v17, rejects fabricated copy, basis, order and historical module injection',()=>{
 const {report}=reasonsDelivery();expect(validateCapabilityReport(report).ok).toBe(true);expect(validateCapabilityReport(old).ok).toBe(true);
 for(const kind of ['copy','basis','index','classification','order','status']){
  const bad=structuredClone(report),v=bad.possible_reasons!;
  if(kind==='copy')v.items[0]!.customer_text+=' effect promise';
  if(kind==='basis')v.items[0]!.basis_refs[1]='invented';
  if(kind==='index')v.items[0]!.competitor_indices=[1,2];
  if(kind==='classification')v.items[0]!.classification='fact' as never;
  if(kind==='order')v.items.reverse();
  if(kind==='status')v.status='not_assessed';
  expect(validateCapabilityReport(bad).ok).toBe(false);
 }
 expect(validateCapabilityReport({...old,possible_reasons:report.possible_reasons}).ok).toBe(false);
});
it('renders matching inference copy in customer and shared views without technical fields',()=>{
 const {report,delivery}=reasonsDelivery(),before=JSON.stringify(report);
 for(const shared of [false,true]){
  render(shared?<CapabilitySharedReport delivery={delivery} token="synthetic"/>:<CapabilityReportDocument document={projectCapabilityReport(report)}/>);
  const section=screen.getByRole('region',{name:'Possible contributing factors'});
  expect(section.textContent).toContain('may be one contributing factor');expect(section.textContent).toContain('ranking causation');
  expect(section.textContent).not.toMatch(/\/payload\/|\/gbp_comparison\/|snapshot_id|v22_|rank_source|latitude|longitude| · en · mobile/);cleanup();
 }
 render(<CapabilityReportDocument document={projectCapabilityReport(report)} technicalDetails/>);
 expect(screen.getByRole('region',{name:'Possible contributing factors'}).textContent).toContain('/payload/');
 expect(JSON.stringify(report)).toBe(before);
});
it('shows Not assessed without eligible differences and strips advisor-only evidence',()=>{
 const {report}=reasonsDelivery();const raw=structuredClone(report);raw.gbp_comparison!.differences.forEach(d=>d.status='not_checked');
 const value=expectedPossibleReasons(raw);expect(value).toMatchObject({status:'not_assessed',items:[]});
 const doc=projectCapabilityReport(report);doc.possibleReasons=possibleReasonsView(value,true);
 render(<CapabilityReportDocument document={doc}/>);expect(screen.getByRole('region',{name:'Possible contributing factors'}).textContent).toContain('Not assessed');
 expect(JSON.stringify(projectCapabilityReport(report,undefined,true).possibleReasons)).not.toMatch(/\/payload\/|basis_refs|competitor_indices/);
});
