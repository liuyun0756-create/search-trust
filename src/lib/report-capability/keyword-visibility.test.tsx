// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen,within} from '@testing-library/react';
import {CapabilityReportDocument} from '@/components/report/CapabilityReportDocument';
import {CapabilitySharedReport} from '@/components/report/CapabilitySharedReport';
import {keywordDelivery} from './fixtures/keyword-delivery';
import {projectCapabilityReport} from './projection';
import {validateCapabilityReport} from './validate';
import {FIRST_PAGE_ABSENT} from './keyword-visibility';
import oldV13 from './fixtures/identity-v2/report.json';
afterEach(cleanup);

it('validates v14 bindings and rejects changed counts, queries and historical metadata',()=>{
 const {report}=keywordDelivery();expect(validateCapabilityReport(report).ok).toBe(true);
 for(const mutation of ['count','query','version','snapshot']){
  const bad=structuredClone(report);
  if(mutation==='count')bad.keyword_visibility!.organic.checked_keywords=0;
  if(mutation==='query')bad.keyword_visibility!.rows[0].query='not collected';
  if(mutation==='version')bad.schema_version='2.2.8';
  if(mutation==='snapshot')bad.keyword_visibility!.sample.snapshot_id='00000000-0000-0000-0000-000000000999';
  expect(validateCapabilityReport(bad).ok).toBe(false);
 }
 expect(validateCapabilityReport(oldV13).ok).toBe(true);
 expect(validateCapabilityReport({...oldV13,keyword_visibility:report.keyword_visibility}).ok).toBe(false);
});

it('client projection strips Maps, sampling, evidence paths, IDs and ratios without mutating the report',()=>{
 const {report}=keywordDelivery(),before=JSON.stringify(report);
 const module=projectCapabilityReport(report,undefined,true).keywordVisibility!;
 const encoded=JSON.stringify(module);
 expect(module.rows).toHaveLength(3);expect(module.organic.coverage).toBe('2/3 keywords checked');
 for(const forbidden of ['latitude','longitude','provider_position','snapshot_id','/payload/','ratio','maps','selected_branch_ref'])expect(encoded).not.toContain(forbidden);
 expect(JSON.stringify(report)).toBe(before);
});

it('preserves legacy Maps findings and summary while hiding only the new module reference',()=>{
 const {report}=keywordDelivery();
 const legacyMaps=report.findings.filter(f=>f.target.includes(' · maps · '));
 expect(legacyMaps.length).toBeGreaterThan(0);
 expect(report.summary).toContain('Maps');
 const client=projectCapabilityReport(report,undefined,true);
 expect(client.summary).toBe(report.summary);
 expect(client.findings.filter(f=>legacyMaps.some(old=>old.id===f.id))).toEqual(legacyMaps);
 expect(client.keywordVisibility!.rows.every(row=>!Object.hasOwn(row,'maps'))).toBe(true);
 render(<CapabilityReportDocument document={client}/>);
 expect(screen.getByText(report.summary)).toBeTruthy();
 expect(within(screen.getByRole('region',{name:'Findings'})).getAllByText(/ · Maps$/).length).toBeGreaterThan(0);
 expect(screen.queryByText('Google Maps reference · advisor only')).toBeNull();
});

it('renders all three first-page states and only the grade plus K/N for clients',()=>{
 const {report}=keywordDelivery();
 // Even an owner preview can use the customer renderer safely.
 render(<CapabilityReportDocument document={projectCapabilityReport(report)}/>);
 const section=screen.getByRole('region',{name:'Target keyword visibility'});
 expect(within(section).getAllByText('Observed position: 2')).toHaveLength(2);
 expect(within(section).getByText(FIRST_PAGE_ABSENT)).toBeTruthy();
 expect(within(section).getAllByText('Not checked in this sample.')).toHaveLength(2);
 expect(section.textContent).toContain('Medium visibility in the checked sample.');
 expect(section.textContent).not.toMatch(/0\.5|Google Maps reference|provider_position|latitude|\/payload\//);
});

it('advisor view alone shows Google Maps and complete sampling diagnostics',()=>{
 const {report}=keywordDelivery();render(<CapabilityReportDocument document={projectCapabilityReport(report)} technicalDetails/>);
 const section=screen.getByRole('region',{name:'Target keyword visibility'});
 expect(section.textContent).toContain('Google Maps reference');
 expect(section.textContent).toContain('provider_position');expect(section.textContent).toContain('latitude');
 expect(section.textContent).toContain('/payload/');expect(section.textContent).toContain('"ratio": 0.5');
});

it('share renderer retains first-page wording and never includes advisor keyword details',()=>{
 const {delivery}=keywordDelivery();render(<CapabilitySharedReport delivery={delivery} token={'z'.repeat(43)}/>);
 const section=screen.getByRole('region',{name:'Target keyword visibility'});
 expect(section.textContent).toContain(FIRST_PAGE_ABSENT);
 expect(section.textContent).not.toMatch(/Google Maps reference|ratio|provider_position|latitude|\/payload\//);
});
