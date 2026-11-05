// @vitest-environment jsdom
import React from 'react';
import {readFileSync} from 'node:fs';
import {afterEach,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,within} from '@testing-library/react';
import {validateCapabilityReport,validateDeliveryRevision} from '@/lib/report-capability/validate';
import {initialCapabilityRevision} from '@/lib/report-capability/revision';
import {deliveryOrderConstraints} from '@/lib/report-capability/order';
import {projectCapabilityReport} from '@/lib/report-capability/projection';
import {CapabilityDeliveryEditor} from './CapabilityDeliveryEditor';
import type {DeliveryRevision} from '@/lib/report-capability/generated/types';
afterEach(cleanup);
it.runIf(Boolean(process.env.P1_07_SEAMLESS_REPORT))('real frozen Seamless name candidate is available, weak, hidden on replacement, explicitly deliverable',async()=>{
 const checked=validateCapabilityReport(JSON.parse(readFileSync(process.env.P1_07_SEAMLESS_REPORT!,'utf8')));if(!checked.ok)throw new Error('Invalid replay');
 const report=checked.report,candidate=report.action_candidates!.find(a=>a.finding_ids.some(id=>report.findings.find(f=>f.id===id)?.rule_id==='v22_public.gbp_name_alignment'))!;
 expect(candidate).toBeTruthy();expect(report.actions.some(a=>a.id===candidate.id)).toBe(false);
 const onSave=vi.fn(async(content:DeliveryRevision)=>{expect(validateDeliveryRevision(content,report)).toBe(true);return {ok:true as const,revision:content.expected_revision+1,content};});
 render(<CapabilityDeliveryEditor candidateReport={report} initial={initialCapabilityRevision(report)} orderConstraints={deliveryOrderConstraints(report)} onSave={onSave}/>);
 const card=screen.getByRole('article',{name:candidate.title});expect(within(card).getByText('Advisor only · verification needed')).toBeTruthy();
 expect(within(card).getByText('Business name correction')).toBeTruthy();expect(card.textContent).not.toMatch(/[\u3400-\u9fff]/);
 fireEvent.click(within(card).getByText('Compare replacement'));fireEvent.click(screen.getByText('Confirm replacement'));
 expect(screen.getAllByLabelText('Action title')).toHaveLength(2);
 const include=screen.getByLabelText<HTMLInputElement>('Include action 1 in client report');expect(include.checked).toBe(false);
 fireEvent.click(include);fireEvent.click(screen.getByLabelText('I have reviewed this content and its unresolved confirmations for client delivery.'));fireEvent.click(screen.getByText('Approve for delivery'));
 await vi.waitFor(()=>expect(onSave).toHaveBeenCalled());const content=onSave.mock.calls[0][0];expect(projectCapabilityReport(report,content,true).actions.map(a=>a.id)).toContain(candidate.id);
});
