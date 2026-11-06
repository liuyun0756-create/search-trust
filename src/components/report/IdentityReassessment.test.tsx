import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {renderToBuffer} from '@react-pdf/renderer';
import {describe,it,expect} from 'vitest';
import sample from '@/lib/identity-review/fixtures/synthetic.json';
import type {CapabilityReport} from '@/lib/report-capability/generated/types';
import {initialCapabilityRevision} from '@/lib/report-capability/revision';
import {buildApprovedCapabilityDelivery} from '@/lib/report-capability/delivery';
import {CapabilityReportDocument} from './CapabilityReportDocument';
import {CapabilitySharedReport} from './CapabilitySharedReport';
import {CapabilityReportPDFDocument} from './pdf/CapabilityReportPDFDocument';
import {addressSummary} from './IdentityConfirmation';
function renderedText(node:unknown):string{if(!node||typeof node!=='object')return '';const n=node as {type?:string;value?:string;children?:unknown[]};return n.type==='TEXT_INSTANCE'?n.value??'':n.children?.map(renderedText).join('\n')??'';}
describe('new approved identity report projections',()=>{
 it.each(['meeting_point','hybrid'] as const)('keeps %s result consistent on web, share and rendered PDF',async mode=>{
  const report=sample.variants[mode].report as unknown as CapabilityReport,before=JSON.stringify(sample.base);
  const content={...initialCapabilityRevision(report),status:'approved' as const};
  const delivery=buildApprovedCapabilityDelivery(report,{id:'11111111-1111-4111-8111-111111111111',report_id:report.id,user_id:report.input_manifest.user_id,case_id:report.input_manifest.case_id,revision:1,status:'approved',approved_at:'2026-11-05T00:00:00Z',content});
  const web=renderToStaticMarkup(<CapabilityReportDocument document={delivery.document}/>),share=renderToStaticMarkup(<CapabilitySharedReport delivery={delivery} token="local-test"/>);
  for(const html of [web,share]){expect(html).toContain('Reassessed from saved observations');expect(html).not.toContain('Identity confirmation');expect(html).not.toContain('v22_capability_public_v13');}
  let text='';const pdf=await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{onRender:(v:unknown)=>{text=renderedText((v as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);}}));
  expect(pdf.subarray(0,4).toString()).toBe('%PDF');expect(text).toContain('Reassessed from saved observations');expect(text).not.toContain('v22_capability_public_v13');
  expect(addressSummary(report.contact_checks!,mode)).toContain(mode==='meeting_point'?'not applicable':'Not checked');
  expect(JSON.stringify(sample.base)).toBe(before);
 },20000);
});
