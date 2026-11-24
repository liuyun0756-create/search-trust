// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import {renderToBuffer} from '@react-pdf/renderer';
import {CapabilityReportDocument} from '@/components/report/CapabilityReportDocument';
import {CapabilitySharedReport} from '@/components/report/CapabilitySharedReport';
import {CapabilityReportPDFDocument} from '@/components/report/pdf/CapabilityReportPDFDocument';
import {buildApprovedCapabilityDelivery} from './delivery';
import {initialCapabilityRevision} from './revision';
import {projectCapabilityReport} from './projection';
import {validateCapabilityReport} from './validate';
import raw from './fixtures/customer-reviews-v22/report.json';

const technical = /customer_sampling|page_count|sort_verified|source_refs|\/payload\/|sha256:|provider_id|latitude|longitude|req_/;
afterEach(cleanup);

function fixture() {
  const checked = validateCapabilityReport(raw);
  if (!checked.ok) throw new Error(`V22 report failed validation: ${JSON.stringify(checked)}`);
  const {report} = checked;
  const content = initialCapabilityRevision(report);
  content.status = 'approved';
  const delivery = buildApprovedCapabilityDelivery(report,{
    id:'00000000-0000-4000-8000-000000009999',report_id:report.id,user_id:report.input_manifest.user_id,
    case_id:report.input_manifest.case_id,revision:1,status:'approved',approved_at:report.generated_at,content,
  });
  return {report,delivery};
}

it('renders saved customer review metrics on the web and share views without technical references',()=>{
  const {report,delivery} = fixture();
  for (const shared of [false,true]) {
    render(shared ? <CapabilitySharedReport delivery={delivery} token="synthetic"/> :
      <CapabilityReportDocument document={projectCapabilityReport(report)}/>);
    const section = screen.getByRole('region',{name:'Google Business Profile comparison'});
    expect(section.textContent).toContain('20/30 sampled reviews');
    expect(section.textContent).toContain('2026-08-20');
    expect(section.textContent).not.toMatch(technical);
    expect(screen.getByText(/Your profile had 2 reviews in its sampled 90-day window/)).toBeTruthy();
    cleanup();
  }
  render(<CapabilityReportDocument document={projectCapabilityReport(report)} technicalDetails/>);
  const advisor = screen.getByRole('region',{name:'Google Business Profile comparison'});
  expect(advisor.textContent).toContain('/payload/review_sample');
  expect(advisor.textContent).toMatch(/page_count[\s\S]*3/);
  expect(advisor.textContent).toContain('sample_cap');
});

function layoutText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const entry = node as {type?:string;value?:string;children?:unknown[]};
  return entry.type === 'TEXT_INSTANCE' ? entry.value ?? '' : entry.children?.map(layoutText).join('\n') ?? '';
}

it('shows sampled customer counts and reply denominator in PDF without consultant metadata',async()=>{
  const {report,delivery} = fixture();
  delivery.document.gbpComparison = projectCapabilityReport(report).gbpComparison;
  let text = '';
  const bytes = await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{
    onRender:(data:unknown)=>{text=layoutText((data as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);},
  }));
  expect(bytes.subarray(0,4).toString()).toBe('%PDF');
  expect(text).toContain('20/30 sampled reviews');
  expect(text).toContain('2026-08-20');
  expect(text).not.toMatch(technical);
});
