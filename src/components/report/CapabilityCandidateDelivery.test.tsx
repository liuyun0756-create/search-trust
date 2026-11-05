import React from 'react';
import {readFileSync} from 'node:fs';
import type {CapabilityReport,DeliveryRevision} from '@/lib/report-capability/generated/types';
import {validateCapabilityReport,validateDeliveryRevision} from '@/lib/report-capability/validate';
import {renderToStaticMarkup} from 'react-dom/server';
import {renderToBuffer} from '@react-pdf/renderer';
import {describe,it,expect} from 'vitest';
import {candidateReviewFixture} from '@/lib/report-capability/fixtures/candidate-review';
import {initialCapabilityRevision} from '@/lib/report-capability/revision';
import {replaceCandidate,technicalOmissionConfirmation} from '@/lib/report-capability/candidate-editing';
import {buildApprovedCapabilityDelivery} from '@/lib/report-capability/delivery';
import {CapabilityReportDocument} from './CapabilityReportDocument';
import {CapabilitySharedReport} from './CapabilitySharedReport';
import {CapabilityReportPDFDocument} from './pdf/CapabilityReportPDFDocument';
function renderedText(node:unknown):string{if(!node||typeof node!=='object')return '';const n=node as {type?:string;value?:string;children?:unknown[]};return n.type==='TEXT_INSTANCE'?n.value??'':n.children?.map(renderedText).join('\n')??'';}
describe('replaced candidate approved delivery',()=>{
 it('uses incoming steps/materials on the webpage, share and actual PDF, without exposing the pool',async()=>{
  const report=candidateReviewFixture(),content=replaceCandidate(report,initialCapabilityRevision(report),'ac-synthetic-3',0)!;
  content.technical_omission_confirmation=technicalOmissionConfirmation(report,content);content.status='approved';
  const delivery=buildApprovedCapabilityDelivery(report,{id:'e2000000-0000-4000-8000-000000000009',report_id:report.id,user_id:report.input_manifest.user_id,case_id:report.input_manifest.case_id,revision:1,status:'approved',approved_at:'2026-11-05T00:00:00Z',content});
  const texts=[renderToStaticMarkup(<CapabilityReportDocument document={delivery.document}/>),renderToStaticMarkup(<CapabilitySharedReport delivery={delivery} token="test-token"/>)];
  let pdfText='';const pdf=await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{onRender:(result:unknown)=>{pdfText=renderedText((result as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);}}));
  expect(pdf.subarray(0,4).toString()).toBe('%PDF');texts.push(pdfText);
  for(const text of texts){expect(text).toContain('Synthetic CTA review 3');expect(text).toContain('Contact option brief 3');expect(text).toContain('Advisor-selected action');expect(text).not.toContain('Synthetic CTA review 4');expect(text).not.toContain('Other candidates');expect(text).not.toContain('original position null');expect(text).not.toContain('ac-synthetic-3');expect(text).not.toContain(delivery.reportId);expect(text).not.toContain(delivery.revisionId);expect(text).not.toContain(delivery.contentChecksum);}
  expect(delivery.document.actions).toHaveLength(3);
 });
});


it.runIf(Boolean(process.env.P1_07_SEAMLESS_APPROVED))('real Seamless browser-approved revision renders its name-correction action and own material in webpage, share and complete PDF',async()=>{
 const report=JSON.parse(readFileSync(process.env.P1_07_SEAMLESS_REPORT!,'utf8')) as CapabilityReport;
 const saved=JSON.parse(readFileSync(process.env.P1_07_SEAMLESS_APPROVED!,'utf8'));
 const content=saved.content as DeliveryRevision;
 expect(validateCapabilityReport(report).ok).toBe(true);expect(validateDeliveryRevision(content,report)).toBe(true);
 const finding=report.findings.find(f=>f.rule_id==='v22_public.gbp_name_alignment')!;
 expect(finding.confidence).toBe('low');
 const candidate=report.action_candidates!.find(a=>a.finding_ids.includes(finding.id))!;
 expect(content.client_action_ids).toContain(candidate.id);expect(content.actions).toHaveLength(2);
 const delivery=buildApprovedCapabilityDelivery(report,{id:'e2000000-0000-4000-8000-000000000009',report_id:report.id,user_id:report.input_manifest.user_id,case_id:report.input_manifest.case_id,revision:saved.revision,status:'approved',approved_at:'2026-11-05T00:00:00Z',content});
 expect(delivery).toEqual(saved.delivery);
 const texts=[renderToStaticMarkup(<CapabilityReportDocument document={delivery.document}/>),renderToStaticMarkup(<CapabilitySharedReport delivery={delivery} token="local-test"/>)];
 let pdfText='';await renderToBuffer(React.cloneElement(CapabilityReportPDFDocument({delivery}),{onRender:(result:unknown)=>{pdfText=renderedText((result as {_INTERNAL__LAYOUT__DATA_:unknown})._INTERNAL__LAYOUT__DATA_);}}));texts.push(pdfText);
 for(const text of texts){expect(text).toContain(candidate.title);expect(text).toContain('The eligible website business name does not align');expect(text).toContain('Confirm the authoritative value');expect(text).toContain('Advisor-selected action');expect(text).not.toContain('Other candidates');expect(text).not.toContain('Comparable search recheck');expect(text).not.toContain(candidate.id);}
});
