// @vitest-environment jsdom
import React from 'react';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,within} from '@testing-library/react';
import {candidateReviewFixture} from '@/lib/report-capability/fixtures/candidate-review';
import {initialCapabilityRevision} from '@/lib/report-capability/revision';
import {deliveryOrderConstraints} from '@/lib/report-capability/order';
import {validateDeliveryRevision} from '@/lib/report-capability/validate';
import {CapabilityDeliveryEditor} from './CapabilityDeliveryEditor';
import type {DeliveryRevision} from '@/lib/report-capability/generated/types';
afterEach(cleanup);
function setup(scenario='five'){
 const report=candidateReviewFixture(scenario),initial=initialCapabilityRevision(report);
 const onSave=vi.fn(async(content:DeliveryRevision)=>{expect(validateDeliveryRevision(content,report)).toBe(true);return {ok:true as const,revision:content.expected_revision+1,content};});
 render(<CapabilityDeliveryEditor initial={initial} onSave={onSave} candidateReport={report} orderConstraints={deliveryOrderConstraints(report)}/>);
 return {report,initial,onSave};
}
function compare(title:string,slot=0){const card=screen.getByRole('article',{name:title});fireEvent.change(within(card).getByRole('combobox'),{target:{value:String(slot)}});fireEvent.click(within(card).getByText('Compare replacement'));}
function confirm(){fireEvent.click(screen.getByText('Confirm replacement'));}
describe('v12 candidate review',()=>{
 it('compares equal slots, warns, records confirmation, retains edits on swap back',async()=>{
  const {onSave}=setup();
  fireEvent.change(screen.getAllByLabelText('Action title')[0],{target:{value:'Keep my technical wording'}});
  compare('Synthetic CTA review 3');expect(screen.getByRole('dialog')).toBeTruthy();expect(screen.getByText('Before')).toBeTruthy();confirm();
  expect(screen.getByText('Technical issue will be omitted')).toBeTruthy();fireEvent.click(screen.getByText('Cancel'));
  expect(screen.getAllByLabelText<HTMLInputElement>('Action title')[0].value).toBe('Keep my technical wording');
  compare('Synthetic CTA review 3');confirm();fireEvent.click(screen.getByText('Acknowledge and continue'));
  expect(screen.getAllByLabelText('Action title')).toHaveLength(3);
  fireEvent.click(screen.getByText('Save draft'));await vi.waitFor(()=>expect(onSave).toHaveBeenCalledTimes(1));
  expect(onSave.mock.calls[0][0].technical_omission_confirmation?.confirmed).toBe(true);
  compare('Response and indexing check');confirm();
  expect(screen.getAllByLabelText<HTMLInputElement>('Action title')[0].value).toBe('Keep my technical wording');
  fireEvent.click(screen.getByText('Save draft'));await vi.waitFor(()=>expect(onSave).toHaveBeenCalledTimes(2));
  expect(onSave.mock.calls[1][0].technical_omission_confirmation).toBeUndefined();
 });
 it('weak candidate defaults hidden and explicit inclusion is saved; dependencies stay hard',async()=>{
  const {onSave}=setup();expect(screen.getByText('Advisor only · verification needed')).toBeTruthy();
  compare('Synthetic CTA review 4',2);confirm();
  const include=screen.getByLabelText<HTMLInputElement>('Include action 3 in client report');expect(include.checked).toBe(false);
  fireEvent.click(include);fireEvent.click(screen.getByText('Save draft'));await vi.waitFor(()=>expect(onSave).toHaveBeenCalled());
  expect(onSave.mock.calls[0][0].client_action_ids).toContain('ac-synthetic-4');
  cleanup();setup('dependencies');const candidate=screen.getByRole('article',{name:'Synthetic CTA review 3'});
  expect(within(candidate).getByText('Compare replacement').hasAttribute('disabled')).toBe(true);
  fireEvent.click(screen.getByLabelText('Include action 1 in client report'));expect(screen.getByText('Keep every prerequisite selected and visible before its dependent action.')).toBeTruthy();
  expect(screen.getByLabelText<HTMLInputElement>('Include action 1 in client report').checked).toBe(true);
 });
 it('restores the current wording and selection separately from order; changed omission needs fresh confirmation',()=>{
  setup();compare('Synthetic CTA review 3');confirm();fireEvent.click(screen.getByText('Acknowledge and continue'));
  fireEvent.click(screen.getByLabelText('Move action 1 down'));expect(screen.getByText('Technical issue will be omitted')).toBeTruthy();fireEvent.click(screen.getByText('Acknowledge and continue'));
  fireEvent.click(screen.getByText('Restore system order'));fireEvent.click(screen.getByText('Acknowledge and continue'));
  expect(screen.getAllByLabelText<HTMLInputElement>('Action title').map(e=>e.value)).toEqual(['Synthetic CTA review 1','Synthetic CTA review 2','Synthetic CTA review 3']);
  fireEvent.change(screen.getAllByLabelText('Action title')[0],{target:{value:'Latest retained wording'}});
  fireEvent.click(screen.getByText('Restore system selection'));confirm();
  expect(screen.getAllByLabelText<HTMLInputElement>('Action title').map(e=>e.value)).toEqual(['Response and indexing check','Latest retained wording','Synthetic CTA review 2']);
 });
 it('zero-slot report never offers addition or replacement',()=>{setup('empty');expect(screen.queryByText('Compare replacement')).toBeNull();expect(screen.queryByLabelText('Action title')).toBeNull();});
});
