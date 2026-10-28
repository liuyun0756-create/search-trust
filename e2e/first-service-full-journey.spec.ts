import {build} from 'esbuild';
import {mkdtemp,mkdir} from 'node:fs/promises';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {expect,test} from '@playwright/test';
import type {createFirstServiceFullJourney} from './integration/first-service-full-journey';
import {defaultPlanningSettings} from '../src/lib/planning-settings/contracts';

let createJourney:typeof createFirstServiceFullJourney,script:string,visualCss='';
test.beforeAll(async()=>{
  if(process.env.V22_PRIORITY_VISUAL_QA==='true')visualCss=readdirSync('.next/static/chunks').filter(n=>n.endsWith('.css')).map(n=>readFileSync(path.join('.next/static/chunks',n),'utf8')).join('\n');
  const resolve=createRequire(path.resolve('package.json')).resolve;
  await mkdir('output/playwright/integration',{recursive:true});
  const dir=await mkdtemp(path.resolve('output/playwright/integration/full-entry-'));
  await build({entryPoints:['e2e/integration/first-service-full-journey.ts'],outfile:path.join(dir,'database.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',jsx:'automatic',plugins:[{
    name:'test-boundaries',setup(b){
      b.onResolve({filter:/^server-only$/},()=>({path:'empty',namespace:'empty'}));
      b.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'export {};'}));
      b.onResolve({filter:/^(next\/server|ajv\/dist\/2020)$/},a=>({path:resolve(a.path),external:true}));
    },
  }]});
  ({createFirstServiceFullJourney:createJourney}=await import(pathToFileURL(path.join(dir,'database.mjs')).href));
  const built=await build({entryPoints:['e2e/integration/capability-browser.tsx'],bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},plugins:[{
    name:'test-router',setup(b){
      b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'link'}));
      b.onLoad({filter:/.*/,namespace:'link'},()=>({contents:'import React from "react";export default function Link(props){return React.createElement("a",props);}',resolveDir:process.cwd()}));
      b.onResolve({filter:/^next\/navigation$/},()=>({path:'router',namespace:'router'}));
      b.onLoad({filter:/.*/,namespace:'router'},()=>({contents:'export const useRouter=()=>({refresh:()=>window.dispatchEvent(new Event("journey-refresh"))});'}));
    },
  }]});script=built.outputFiles[0].text;
});

for(const {clean,loss} of [{clean:false,loss:'none'},{clean:false,loss:'freeze'},{clean:true,loss:'handoff'},{clean:false,loss:'collection'}] as const)
test(`first-service browser entry through actual workers to delivery (${clean?'zero actions':'actions'}, ${loss})`,async({page},info)=>{
  test.setTimeout(120000);const j=await createJourney(clean,loss),external:string[]=[],errors:string[]=[];
  try{
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.origin!=='http://127.0.0.1:3100'){external.push(url.origin);return route.abort();}
      if(req.isNavigationRequest())return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/_entry/app.js"></script></body></html>'});
      if(url.pathname==='/_entry/app.js')return route.fulfill({contentType:'application/javascript',body:script});
      const res=await j.dispatch(new Request(req.url(),{method:req.method(),headers:{...await req.allHeaders(),host:url.host},body:req.postData()}));
      return route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});
    });
    await page.goto(`/_entry?case=${j.caseId}&owner=${j.owner}&planning=1`);
    if(visualCss)await page.addStyleTag({content:visualCss});
    await expect(page.getByRole('button',{name:'Use 1 credit & start'})).toBeDisabled();
    expect((await j.entry.inspect()).balance).toBe(5);
    await page.getByLabel("Client's confirmed business focus").selectOption('contact_path');
    await page.getByRole('textbox',{name:/Confirmed target pages/}).fill(new URL('/service',j.siteUrl).toString());
    await page.getByLabel('Your execution capacity').selectOption('limited');
    await page.getByLabel('Your publishing access').selectOption('needs_approval');
    if(loss==='none')j.entry.loseResponse('save_v22_case_planning_settings');
    await page.getByRole('button',{name:'Save planning settings'}).click();
    if(loss==='none'){
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByLabel("Client's confirmed business focus")).toHaveValue('contact_path');
      await page.getByRole('button',{name:'Save planning settings'}).click();
    }
    await expect(page.getByText(/Saved for the next diagnosis/)).toBeVisible();
    if(visualCss){
      const form=page.getByRole('region',{name:'Business focus and execution conditions'});
      await page.setViewportSize({width:1280,height:900});await form.screenshot({path:info.outputPath('planning-desktop.png')});
      await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      await form.screenshot({path:info.outputPath('planning-mobile.png')});
    }
    expect((await j.entry.inspect()).balance).toBe(5);
    for(let i=0;i<j.queries.length;i++)await page.getByLabel(`Search query ${i+1}`).fill(j.queries[i]);
    await page.getByRole('checkbox').check();
    const started=page.waitForResponse(r=>r.url().endsWith('/first-service')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'Use 1 credit & start'}).click();
    expect((await started).status(),JSON.stringify(j.entry.sqlErrors)).toBe(200);
    await expect(page.getByText('Checking the market',{exact:true})).toBeVisible();
    await j.discover();await page.getByRole('button',{name:'Check current status'}).click();
    await expect(page.getByText('Competitor 1',{exact:true})).toBeVisible();
    for(const checkbox of await page.getByRole('checkbox').all())await checkbox.check();
    await page.getByRole('button',{name:'Confirm competitors & prepare report'}).click();
    await expect(page.getByText('Preparing your first service diagnosis',{exact:true})).toBeVisible();
    const before=await j.entry.inspect();expect(before.jobs).toHaveLength(1);expect(before.collections).toHaveLength(1);
    // Changing current preferences cannot rewrite the already frozen scope.
    await j.entry.updatePlanning(1,{...defaultPlanningSettings(),priority:'business_identity'});
    const {delivery:d,result,jobs}=await j.run();
    expect(result.recovered).toBe(loss!=='none');expect(result.provider_calls).toEqual([loss==='collection'?2:1,1,1]);
    expect(result.calls.filter((s:string)=>s==='freeze_v22_first_service_preparation')).toHaveLength(1);
    expect(result.calls.filter((s:string)=>s==='complete_v22_capability_analysis')).toHaveLength(1);
    expect(result.queue_deliveries).toBe(loss==='handoff'?2:1);
    expect(new Date(result.created_at)).toEqual(jobs[0].created_at);expect(new Date(result.deadline_at)).toEqual(jobs[0].deadline_at);
    expect(d.job).toBe((before.jobs[0] as {id:string}).id);
    expect(d.report.input_manifest).toMatchObject({mode:'first_service',previous_report:null});
    expect(d.report.input_manifest.business).toMatchObject({priority:'contact_path',target_pages:[new URL('/service',j.siteUrl).toString()],execution_conditions:{capacity:'limited',publishing_access:'needs_approval'}});
    expect(d.report.input_manifest.snapshots).toHaveLength(6);
    if(clean)expect(d.report.actions).toHaveLength(0);else expect(d.report.actions.length).toBeGreaterThan(0);
    await page.getByRole('button',{name:'Check current status'}).click();
    await expect(page.getByText('Your diagnosis is ready',{exact:true})).toBeVisible();
    await page.getByRole('link',{name:'Open your diagnosis'}).click();
    await expect(page.getByRole('heading',{name:d.report.title})).toBeVisible();
    if(visualCss)await page.addStyleTag({content:visualCss});
    await page.getByText('Review & approve · optional edits').click();
    const move=page.getByRole('button',{name:'Move action 1 down'});
    if(!clean && await move.count() && await move.isEnabled()){
      await move.click();await expect(page.getByRole('button',{name:'Restore system order'})).toBeEnabled();
      await page.getByRole('button',{name:'Restore system order'}).click();
      await expect(page.getByRole('button',{name:'Restore system order'})).toBeDisabled();
      await move.click();
      if(visualCss){
        const order=page.getByText('Your delivery order',{exact:true}).locator('..');
        await page.setViewportSize({width:1280,height:900});await order.screenshot({path:info.outputPath('order-desktop.png')});
        await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
        await order.screenshot({path:info.outputPath('order-mobile.png')});
      }
    }
    await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Approve for delivery'}).click();
    await expect(page.getByText('Revision 1 approved for delivery.')).toBeVisible();
    if(loss==='none'){
      await page.goto(`${page.url()}?implementation=1`);
      if(visualCss)await page.addStyleTag({content:visualCss});
      const record=page.getByRole('region',{name:'Record what you actually changed.'});
      await record.getByLabel('I implemented this action').first().check();
      const day=new Date(Date.now()-86400000).toISOString().slice(0,10);
      await record.getByLabel('Date implemented').fill(day);await record.getByLabel('Implementation timezone').fill('UTC');
      await record.getByLabel('What changed · optional').fill('Updated the approved service explanation and contact step.');
      d.failNext('save_v22_implementation_record','after');
      await record.getByRole('button',{name:'Save implementation record · free'}).click();
      await expect(record.getByRole('alert')).toBeVisible();await expect(record.getByLabel('Date implemented')).toHaveValue(day);
      await record.getByRole('button',{name:'Save implementation record · free'}).click();
      await expect(record.getByText('User recorded · revision 1')).toBeVisible();
      await record.getByLabel('Date implemented').fill(new Date(Date.now()-2*86400000).toISOString().slice(0,10));
      await record.getByRole('button',{name:'Save implementation record · free'}).click();await expect(record.getByText('User recorded · revision 2')).toBeVisible();
      const planner=record.getByRole('region',{name:'Plan a comparison window'});
      await expect(planner.getByText('Before · 28 full days')).toBeVisible();
      await planner.getByLabel('Days per window').selectOption('7');
      await expect(planner.getByText('After · 7 full days')).toBeVisible();
      await expect(planner.getByText('After window still open · wait for the full dates.')).toBeVisible();
      await planner.getByRole('button',{name:'Check calendar again · free'}).click();
      await record.getByText('Record history · latest 2 revisions').click();
      if(visualCss){
        await page.setViewportSize({width:1280,height:900});await record.screenshot({path:info.outputPath('implementation-desktop.png')});
        await planner.screenshot({path:info.outputPath('comparison-window-desktop.png')});
        await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
        await record.screenshot({path:info.outputPath('implementation-mobile.png')});
        await planner.screenshot({path:info.outputPath('comparison-window-mobile.png')});
      }
      await page.reload();if(visualCss)await page.addStyleTag({content:visualCss});
      await expect(page.getByText('User recorded · revision 2')).toBeVisible();
      const implemented=await d.inspect();expect(implemented.implementationRecords).toHaveLength(2);
      expect(implemented.balance).toBe(4);expect(implemented.revisions).toHaveLength(1);
      const versions=await d.implementationRepository.approvedVersions(d.owner,d.caseId,d.job);
      expect(versions).toHaveLength(1);expect(versions[0].revision).toBe(1);
    }
    const response=page.waitForResponse(r=>r.url().endsWith('/client-pdf')),download=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download approved PDF'}).click();
    await(await download).saveAs(info.outputPath('entry-approved.pdf'));
    const pdf=await response;expect(pdf.status()).toBe(200);const checksum=pdf.headers()['x-report-content-checksum'];
    await page.getByRole('button',{name:'Create client link'}).click();
    await expect(page.getByLabel('New client link')).toBeVisible();await page.goto(await page.getByLabel('New client link').inputValue());
    await expect(page.getByText(d.report.summary,{exact:true})).toBeVisible();
    const sharedResponse=page.waitForResponse(r=>r.url().endsWith('/api/share/pdf')),sharedDownload=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download PDF'}).click();await(await sharedDownload).saveAs(info.outputPath('entry-shared.pdf'));
    expect((await sharedResponse).headers()['x-report-content-checksum']).toBe(checksum);
    const state=await d.inspect();expect(state.balance).toBe(4);expect(state.ledger).toEqual([{kind:'verified_debit',delta:-1}]);
    expect(state.charge).toMatchObject({state:'consumed',final_capability_report_id:d.job});expect(state.reports).toEqual([{payload:d.report}]);
    expect(j.entry.sqlErrors).toEqual([]);expect(external).toEqual([]);expect(errors).toEqual([]);
    await info.attach('worker-chain',{body:JSON.stringify(result,null,2),contentType:'application/json'});
  }finally{await j.close();}
});
