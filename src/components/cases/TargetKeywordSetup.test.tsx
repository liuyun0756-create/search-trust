// @vitest-environment jsdom
import React,{useState} from 'react';
import {webcrypto} from 'node:crypto';
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {TargetKeywordSetup} from './TargetKeywordSetup';
import {defaultPlanningSettings} from '@/lib/planning-settings/contracts';
import type {KeywordDraft} from '@/lib/target-keywords/contracts';
import {preflightFixture,E2E_MARKET} from '../../../e2e/fixtures/preflight';
import {E2E_IDS} from '../../../e2e/fixtures/ids';
const scope={primary_service:'Plumbing',target_market:E2E_MARKET};
const fetcher=vi.fn(),done=vi.fn();let revision=0,saved:any;
function Harness(){const [value,setValue]=useState<KeywordDraft|null>(null);return <TargetKeywordSetup caseId={E2E_IDS.caseId} profileUrl={E2E_IDS.gbpUrl} scope={scope} preflight={preflightFixture} value={value}
 onEdit={items=>setValue({items,binding:null,case_id:null})} onConfirm={done} onBack={()=>{}} onRetryCase={()=>{}} caseMessage=""/>;}
beforeEach(()=>{
 revision=0;saved=defaultPlanningSettings();fetcher.mockReset();done.mockReset();vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('fetch',fetcher);
 fetcher.mockImplementation(async(_url:string,init?:RequestInit)=>{
  if(init?.method==='PUT'){
   const body=JSON.parse(String(init.body));saved={...body.settings,keyword_confirmation:{confirmed_by:E2E_IDS.userId,confirmed_at:new Date().toISOString()}};revision++;
  }
  return Response.json({caseId:E2E_IDS.caseId,siteUrl:E2E_IDS.siteUrl,revision,settings:saved});
 });
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it.each([3,5])('edits, orders, trims and explicitly confirms %i exact keywords before proceeding',async count=>{
 render(<Harness/>);await screen.findByLabelText('Target keyword 1');
 expect(screen.getByRole('button',{name:'Confirm target keywords & continue'})).toBeDisabled();
 for(let i=3;i<count;i++)fireEvent.click(screen.getByRole('button',{name:'Add target keyword'}));
 const words=Array.from({length:count},(_,i)=>i===0?'  MiXeD near me  ':`Custom service ${i}`);
 words.forEach((word,i)=>fireEvent.change(screen.getByLabelText(`Target keyword ${i+1}`),{target:{value:word}}));
 fireEvent.click(screen.getByRole('button',{name:'Move keyword 2 up'}));
 fireEvent.click(screen.getByRole('checkbox',{name:'I confirm these exact target keywords and their order.'}));
 fireEvent.click(screen.getByRole('button',{name:'Confirm target keywords & continue'}));
 await waitFor(()=>expect(done).toHaveBeenCalledOnce());
 const expected=[words[1],words[0].trim(),...words.slice(2)];
 expect(done.mock.calls[0][0].binding.queries).toEqual(expected);
 expect(done.mock.calls[0][0].binding.planning_revision).toBe(1);
 expect(JSON.parse(fetcher.mock.calls.find(c=>c[1]?.method==='PUT')![1].body).settings.target_keywords.map((k:any)=>k.query)).toEqual(expected);
});
it('prevents blank, duplicate and overlong confirmation and resets confirmation after edits',async()=>{
 render(<Harness/>);await screen.findByLabelText('Target keyword 1');
 const button=screen.getByRole('button',{name:'Confirm target keywords & continue'}),confirm=screen.getByRole('checkbox');
 fireEvent.click(confirm);
 for(const value of ['', 'x'.repeat(301),String((screen.getByLabelText('Target keyword 2') as HTMLInputElement).value).toUpperCase()]){
  fireEvent.change(screen.getByLabelText('Target keyword 1'),{target:{value}});expect(confirm).not.toBeChecked();fireEvent.click(confirm);expect(button).toBeDisabled();
 }
 expect(fetcher.mock.calls.every(c=>c[1]?.method!=='PUT')).toBe(true);
});
it('shows load failure and explicit retry without making a charge or losing editor input',async()=>{
 fetcher.mockRejectedValueOnce(new Error('offline'));render(<Harness/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('offline');
 expect(screen.getByRole('button',{name:'Confirm target keywords & continue'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Reload saved settings · keep my keyword edits'}));
 await screen.findByLabelText('Target keyword 1');expect(screen.getByLabelText('Target keyword 1')).toBeEnabled();
 expect(fetcher.mock.calls.every(c=>String(c[0]).endsWith('/planning-settings'))).toBe(true);
});
it('keeps edits on a revision conflict and retries only after explicit reload',async()=>{
 render(<Harness/>);await screen.findByLabelText('Target keyword 1');
 fireEvent.change(screen.getByLabelText('Target keyword 1'),{target:{value:'Keep My Spelling'}});
 fireEvent.click(screen.getByRole('checkbox'));fetcher.mockResolvedValueOnce(Response.json({error:{code:'CONFLICT'}},{status:409}));
 fireEvent.click(screen.getByRole('button',{name:'Confirm target keywords & continue'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('changed in another page');
 expect(screen.getByLabelText('Target keyword 1')).toHaveValue('Keep My Spelling');expect(done).not.toHaveBeenCalled();
 revision=2;fireEvent.click(screen.getByRole('button',{name:'Reload saved settings · keep my keyword edits'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:'Confirm target keywords & continue'})).toBeEnabled());
 fireEvent.click(screen.getByRole('button',{name:'Confirm target keywords & continue'}));await waitFor(()=>expect(done).toHaveBeenCalledOnce());
 expect(done.mock.calls[0][0].binding.planning_revision).toBe(3);
 expect(done.mock.calls[0][0].binding.queries[0]).toBe('Keep My Spelling');
});
it.each([3,5])('prioritizes all %i saved SEO words but still requires a fresh explicit confirmation',async count=>{
 saved={...defaultPlanningSettings(),schema_version:'v22_planning_settings_v2',keyword_scope:scope,target_keywords:['First saved','Second saved','Third saved','Fourth saved','Fifth saved'].slice(0,count).map(query=>({query,origin:'seo',suggestion_refs:[]})),keyword_confirmation:{confirmed_by:E2E_IDS.userId,confirmed_at:new Date().toISOString()}};revision=4;
 render(<Harness/>);await screen.findByLabelText('Target keyword 1');expect(screen.getByLabelText('Target keyword 1')).toHaveValue('First saved');
 expect(screen.getAllByRole('textbox')).toHaveLength(count);expect(screen.getByRole('checkbox')).not.toBeChecked();expect(screen.getByRole('button',{name:'Confirm target keywords & continue'})).toBeDisabled();
 expect(screen.getAllByText(/Saved SEO keyword list/).length).toBeGreaterThan(0);
});

it('recovers a lost save response by retrying the same revision and exact edits',async()=>{
 render(<Harness/>);await screen.findByLabelText('Target keyword 1');
 fireEvent.change(screen.getByLabelText('Target keyword 1'),{target:{value:'Keep Exact near me'}});fireEvent.click(screen.getByRole('checkbox'));
 let committed=false;const revisions:number[]=[];
 fetcher.mockImplementation(async(_url:string,init?:RequestInit)=>{
  const body=JSON.parse(String(init?.body));revisions.push(body.expectedRevision);
  if(!committed){committed=true;saved={...body.settings,keyword_confirmation:{confirmed_by:E2E_IDS.userId,confirmed_at:new Date().toISOString()}};revision=1;throw Error('The save response was lost. Retry confirmation.');}
  return Response.json({caseId:E2E_IDS.caseId,siteUrl:E2E_IDS.siteUrl,revision,settings:saved});
 });
 fireEvent.click(screen.getByRole('button',{name:'Confirm target keywords & continue'}));
 expect(await screen.findByRole('alert')).toHaveTextContent('save response was lost');
 expect(screen.getByLabelText('Target keyword 1')).toHaveValue('Keep Exact near me');
 fireEvent.click(screen.getByRole('button',{name:'Retry keyword confirmation'}));
 await waitFor(()=>expect(done).toHaveBeenCalledOnce());expect(revisions).toEqual([0,0]);
 expect(done.mock.calls[0][0].binding.planning_revision).toBe(1);expect(done.mock.calls[0][0].binding.queries[0]).toBe('Keep Exact near me');
});
