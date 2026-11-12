import {test,expect} from './support/journey-test';
import {createNewCaseDraft} from '../src/lib/preflight-v22/state-machine';
import {preflightFixture,discoveryStatusFixture,E2E_BUSINESS,E2E_MARKET} from './fixtures/preflight';
import {E2E_IDS} from './fixtures/ids';
import {defaultPlanningSettings} from '../src/lib/planning-settings/contracts';
import {canonicalDigest} from '../src/lib/verified-analysis-v22/digest';
import report from '../src/lib/report-capability/fixtures/keywords-v14/confirmed-report.json';
const words=report.input_manifest.keyword_queries!;

test('enabled setup confirms ordered queries before mock collection and renders the same v14 words',async({page},info)=>{
 let revision=0,settings:any=defaultPlanningSettings(),confirmed:string[]=[],discovered:string[]=[],generated:string[]=[],analysisJob='',caseId='';
 await page.route('**/api/v2/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  if(path.endsWith('/planning-settings')){
   caseId=path.split('/')[4];
   if(request.method()==='PUT'){
    const body=request.postDataJSON();expect(body.expectedRevision).toBe(revision);revision++;
    settings={...body.settings,keyword_confirmation:{confirmed_by:report.input_manifest.user_id,confirmed_at:new Date().toISOString()}};
    confirmed=settings.target_keywords.map((k:any)=>k.query);
   }
   return route.fulfill({json:{caseId,siteUrl:'https://searchtrust-e2e.example.invalid/',revision,settings}});
  }
  if(path.endsWith('/prospect-workflow')&&request.method()==='POST'){
   discovered=request.postDataJSON().queries;expect(discovered).toEqual(confirmed);expect(discovered).toEqual(words);
   expect(request.headers()['x-searchtrust-keyword-planning-revision']).toBe(String(revision));
   return route.fallback();
  }
  if(path==='/api/v2/analyze'){
   generated=request.postDataJSON().queries;expect(generated).toEqual(discovered);
   expect(request.headers()['x-searchtrust-keyword-digest']).toBe(canonicalDigest(words));
   expect(request.headers()['x-searchtrust-keyword-planning-revision']).toBe('1');
   analysisJob=request.headers()['x-searchtrust-job-id'];
   return route.fulfill({status:202,json:{job_id:analysisJob,status:'queued',estimated_seconds:2}});
  }
  if(analysisJob&&path===`/api/v2/tasks/${analysisJob}/stream`)return route.fulfill({status:503,json:{error:{code:'LOCAL_POLL_ONLY'}}});
  if(analysisJob&&path===`/api/v2/tasks/${analysisJob}`)return route.fulfill({json:{schema_version:'v22_capability_task_status_v1',job_id:analysisJob,revision:2,run_generation:1,status:'succeeded',stage:'completed',progress:100,message:'Synthetic v14 complete',created_at:new Date().toISOString(),updated_at:new Date().toISOString(),deadline_at:new Date(Date.now()+60000).toISOString(),report_reference:{report_id:analysisJob,case_id:caseId,schema_version:'2.2.9',report_type:'prospect',payload_checksum:canonicalDigest(report)}}});
  return route.fallback();
 });
 // The local result page renders the exact checked-in report produced by the backend's mock input.
 await page.route('**/cases/*/reports/*',route=>route.fulfill({status:302,headers:{location:'/e2e/target-keywords?view=client'},body:''}));
 await page.goto(info.config.metadata.targetKeywordsEnabled?'/cases/new':'/e2e/target-keywords');
 await page.getByLabel('Business website').fill('searchtrust-e2e.example.invalid');
 await page.getByRole('button',{name:/Check this prospect/}).click();
 await page.getByRole('button',{name:/Confirm business scope/}).click();
 await expect(page.getByRole('heading',{name:'Target keywords (3–5)'})).toBeVisible();
 for(let i=0;i<words.length;i++)await page.getByLabel(`Target keyword ${i+1}`,{exact:true}).fill(i===0?'  '+words[i]+'  ':words[i]);
 await page.getByRole('checkbox',{name:'I confirm these exact target keywords and their order.'}).check();
 await page.screenshot({path:'output/p1-01/phase2-keyword-editor.png',fullPage:true});
 await page.getByRole('button',{name:'Confirm target keywords & continue'}).click();
 await expect(page.getByRole('button',{name:'Start analysis · uses 1 credit'})).toBeEnabled();
 await page.getByRole('button',{name:'Start analysis · uses 1 credit'}).click();
 await page.getByRole('button',{name:/Confirm 3 competitors/}).click();
 const locked=page.getByRole('region',{name:'Confirmed target keywords'});await expect(locked).toBeVisible();
 for(const word of words)await expect(locked.getByText(word,{exact:true})).toBeVisible();
 await expect(locked.getByRole('textbox')).toHaveCount(0);
 await page.reload();await expect(locked).toBeVisible();
 await expect(page.getByRole('button',{name:'Generate Prospect report'})).toBeEnabled();
 await page.getByRole('button',{name:'Generate Prospect report'}).click();
 await expect(page.getByRole('region',{name:'Target keyword visibility'})).toBeVisible();
 expect(generated).toEqual(words);expect(discovered).toEqual(words);
 const module=page.getByRole('region',{name:'Target keyword visibility'});
 for(const word of words)await expect(module.getByRole('rowheader',{name:word,exact:true})).toBeVisible();
 expect(await module.innerText()).not.toMatch(/Google Maps reference|provider_position|latitude|"ratio"|\/payload\//);
 await page.screenshot({path:'output/p1-01/phase2-client.png',fullPage:true});
 await page.getByRole('link',{name:'Advisor preview'}).click();
 await expect(page.getByRole('heading',{name:'Google Maps reference · advisor only'})).toBeVisible();
 await page.getByText('Inspect keyword sampling conditions').click();
 await page.screenshot({path:'output/p1-01/phase2-advisor.png',fullPage:true});
 expect(confirmed).toEqual(words);
});


test('coverage rejects saved keyword drift without starting analysis or collecting again',async({page},info)=>{
 const binding={schema_version:'v22_target_keyword_binding_v1' as const,queries:words,queries_digest:canonicalDigest(words),planning_revision:1};
 const scope={primary_service:'Emergency plumbing',target_market:E2E_MARKET};
 const draft={...createNewCaseDraft(undefined,E2E_IDS.caseId,{target_keywords_enabled:true}),stage:'coverage',preflight:preflightFixture,
  business_confirmation:{business_identity:E2E_BUSINESS,...scope},prospect_workflow_id:E2E_IDS.prospectWorkflowId,
  discovery_job_id:E2E_IDS.discoveryJobId,discovery_status:discoveryStatusFixture('succeeded'),selected_competitor_ids:[...E2E_IDS.competitorIds],
  target_keywords:{items:words.map(query=>({query,origin:'seo',suggestion_refs:[]})),binding,case_id:E2E_IDS.caseId},discovery_keywords:binding};
 await page.addInitScript(value=>sessionStorage.setItem('searchtrust:v2.2:new-case-draft',JSON.stringify(value)),draft);
 let starts=0;
 await page.route('**/api/v2/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(req.method()==='POST'&&(path.endsWith('/prospect-workflow')||path==='/api/v2/analyze')){starts++;return route.fulfill({status:500,json:{error:{code:'UNEXPECTED_START'}}});}
  if(path.startsWith('/api/v2/prospect-workflows/'))return route.fulfill({json:{workflow_id:E2E_IDS.prospectWorkflowId,case_id:E2E_IDS.caseId,discovery_job_id:E2E_IDS.discoveryJobId,analysis_job_id:null,state:'reserved'}});
  if(path.endsWith('/planning-settings'))return route.fulfill({json:{caseId:E2E_IDS.caseId,siteUrl:E2E_IDS.siteUrl,revision:2,settings:{...defaultPlanningSettings(),schema_version:'v22_planning_settings_v2',keyword_scope:scope,
   target_keywords:words.map((query,i)=>({query:i===0?'Changed after discovery':query,origin:'seo',suggestion_refs:[]})),keyword_confirmation:{confirmed_by:E2E_IDS.userId,confirmed_at:new Date().toISOString()}}}});
  return route.fallback();
 });
 await page.goto(info.config.metadata.targetKeywordsEnabled?'/cases/new':'/e2e/target-keywords');
 await expect(page.getByRole('button',{name:'Generate Prospect report'})).toBeDisabled();
 await expect(page.getByText('Target keywords no longer match the confirmed discovery. Start a new Case check; this workflow will not collect again.')).toBeVisible();
 await expect(page.getByRole('region',{name:'Confirmed target keywords'}).getByRole('textbox')).toHaveCount(0);
 expect(starts).toBe(0);
});
