import {build} from "esbuild";
import {mkdtemp,mkdir} from "node:fs/promises";
import {readdirSync,readFileSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import {expect,test} from "@playwright/test";
import type {createCapabilityDatabaseJourney} from "./integration/capability-database";
import type {createGeneratedFirstServiceJourney} from "./integration/generated-first-service";

const requireModule=createRequire(path.resolve("package.json"));
type Journey=Awaited<ReturnType<typeof createCapabilityDatabaseJourney>>;
let createJourney:typeof createCapabilityDatabaseJourney,script:string,visualCss="";
let createGeneratedJourney:typeof createGeneratedFirstServiceJourney;
test.beforeAll(async()=>{
  // Optional local visual inspection uses the actual production Tailwind CSS.
  // Ordinary integration tests remain independent of a Next build/server.
  if(process.env.V22_PRIORITY_VISUAL_QA==="true")visualCss=readdirSync(".next/static/chunks")
    .filter(name=>name.endsWith(".css")).map(name=>readFileSync(path.join(".next/static/chunks",name),"utf8")).join("\n");
  await mkdir("output/playwright/integration",{recursive:true});
  const dir=await mkdtemp(path.resolve("output/playwright/integration/capability-"));
  for(const [entry,output] of [["capability-database","database"],["generated-first-service","generated"]])await build({entryPoints:[`e2e/integration/${entry}.ts`],outfile:path.join(dir,`${output}.mjs`),bundle:true,platform:"node",format:"esm",packages:"external",jsx:"automatic",plugins:[{
    name:"test-only-module-boundaries",setup(b){
      b.onResolve({filter:/^server-only$/},()=>({path:"empty",namespace:"test-boundary"}));
      b.onLoad({filter:/.*/,namespace:"test-boundary"},()=>({contents:"export {};"}));
      b.onResolve({filter:/^(next\/server|ajv\/dist\/2020)$/},args=>({path:requireModule.resolve(args.path),external:true}));
    },
  }]});
  ({createCapabilityDatabaseJourney:createJourney}=await import(pathToFileURL(path.join(dir,"database.mjs")).href));
  ({createGeneratedFirstServiceJourney:createGeneratedJourney}=await import(pathToFileURL(path.join(dir,"generated.mjs")).href));
  const browser=await build({entryPoints:["e2e/integration/capability-browser.tsx"],bundle:true,write:false,platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"test"'},plugins:[{
    name:"test-only-router",setup(b){
      b.onResolve({filter:/^next\/link$/},()=>({path:"link",namespace:"test-link"}));
      b.onLoad({filter:/.*/,namespace:"test-link"},()=>({contents:'import React from "react";export default function Link(props){return React.createElement("a",props);}',resolveDir:process.cwd()}));
      b.onResolve({filter:/^next\/navigation$/},()=>({path:"router",namespace:"test-router"}));
      b.onLoad({filter:/.*/,namespace:"test-router"},()=>({contents:'export const useRouter=()=>({refresh:()=>window.dispatchEvent(new Event("journey-refresh"))});'}));
    },
  }]});script=browser.outputFiles[0].text;
});

async function mount(page:import("@playwright/test").Page,journey:Journey){
  const external:string[]=[];
  await page.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!=="http://127.0.0.1:3100"){external.push(url.origin);return route.abort();}
    if(req.isNavigationRequest())return route.fulfill({contentType:"text/html",body:'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/_journey/app.js"></script></body></html>'});
    if(url.pathname==="/_journey/app.js")return route.fulfill({contentType:"application/javascript",body:script});
    const response=await journey.dispatch(new Request(req.url(),{method:req.method(),headers:req.headers(),body:req.postData()}));
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  await page.goto("/_journey/report");await page.waitForLoadState("networkidle");
  if(visualCss)await page.addStyleTag({content:visualCss});
  return external;
}

function apiRequest(j:Journey,suffix:string,method="GET",body?:unknown){
  return new Request(`http://127.0.0.1:3100/api/v2/cases/${j.caseId}/reports/${j.job}/${suffix}`,{method,
    headers:{"Content-Type":"application/json",Origin:"http://127.0.0.1:3100"},body:body===undefined?undefined:JSON.stringify(body)});
}

async function approved(page:import("@playwright/test").Page,revision:number){
  await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Approve for delivery"}).click();
  await expect(page.getByText(`Revision ${revision} approved for delivery.`)).toBeVisible();
  await expect(page.getByRole("button",{name:"Download approved PDF"})).toBeEnabled();
}

for(const {clean,loseCompletion} of [{clean:false,loseCompletion:false},{clean:false,loseCompletion:true},{clean:true,loseCompletion:true}])test(`actual backend first-service generation reaches approved delivery (${clean?'no actions':'actionable'}, ${loseCompletion?'lost response':'normal'})`,async({page},testInfo)=>{
  test.setTimeout(90000);
  const j=await createGeneratedJourney(clean,loseCompletion);
  try{
    expect(j.recoveredCompletion).toBe(loseCompletion);
    expect(j.backendCalls.filter(name=>name==='complete_v22_capability_analysis')).toHaveLength(1);
    expect(j.backendCalls.filter(name=>name==='resolve_v22_capability_analysis_input')).toHaveLength(loseCompletion?3:2);
    expect(j.report.input_manifest).toMatchObject({mode:'first_service',previous_report:null});
    expect(j.report.report_type).toBe('verified_execution');
    expect(j.report.changes).toEqual([]);
    if(clean)expect(j.report.actions).toHaveLength(0);else expect(j.report.actions.length).toBeGreaterThan(0);
    expect(j.report.evidence.some(e=>e.source_kind==='gsc')).toBe(true);
    expect(j.report.evidence.some(e=>e.source_kind==='ga4')).toBe(true);
    if(!clean){
      expect(j.report.evidence.some(e=>e.source_kind==='gsc'&&e.value===750)).toBe(true);
      expect(j.report.evidence.some(e=>e.source_kind==='ga4'&&e.value===60)).toBe(true);
    }
    const errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    const external=await mount(page,j);
    if(!clean){
      expect(j.report.prioritization?.rules_version).toBe("v22_business_priority_v2");
      await expect(page.getByText("Why now",{exact:true})).toHaveCount(j.report.actions.length);
      const basis=page.getByText("Inspect the priority basis",{exact:true}).first();
      await basis.focus();await page.keyboard.press("Enter");
      await expect(basis.locator("..")).toHaveAttribute("open","");
      if(visualCss){
        const card=basis.locator("../..");
        await page.setViewportSize({width:1280,height:900});
        await card.screenshot({path:testInfo.outputPath("priority-desktop.png")});
        await page.setViewportSize({width:390,height:844});
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
        await card.screenshot({path:testInfo.outputPath("priority-mobile.png")});
      }
    }
    await page.getByText('Review & approve · optional edits').click();
    const summary=clean?j.report.summary:'Approved from the actual generated first-service diagnosis.';
    if(!clean){
      await page.getByLabel('Client summary').fill(summary);
      await page.getByRole('button',{name:'Save draft'}).click();
      await expect(page.getByText('Draft revision 1 saved. Not approved for delivery.')).toBeVisible();
    }
    const revision=clean?1:2;await approved(page,revision);
    const response=page.waitForResponse(r=>r.url().endsWith('/client-pdf')),download=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download approved PDF'}).click();
    await(await download).saveAs(testInfo.outputPath(`first-service-${clean?'zero':'actions'}.pdf`));
    const pdf=await response;expect(pdf.status()).toBe(200);
    expect(pdf.headers()['x-report-revision']).toBe(String(revision));
    const checksum=pdf.headers()['x-report-content-checksum'];
    await page.getByRole('button',{name:'Create client link'}).click();
    const link=page.getByLabel('New client link');await expect(link).toBeVisible();
    await page.goto(await link.inputValue());await expect(page.getByText(summary,{exact:true})).toBeVisible();
    const sharedResponse=page.waitForResponse(r=>r.url().endsWith('/api/share/pdf')),sharedDownload=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download PDF'}).click();
    await(await sharedDownload).saveAs(testInfo.outputPath('shared-first-service.pdf'));
    expect((await sharedResponse).headers()['x-report-content-checksum']).toBe(checksum);
    const state=await j.inspect();
    expect(state.balance).toBe(4);expect(state.ledger).toEqual([{kind:'verified_debit',delta:-1}]);
    expect(state.charge).toMatchObject({state:'consumed',final_capability_report_id:j.job});
    expect(state.reports).toEqual([{payload:j.report}]);
    expect(external).toEqual([]);expect(errors).toEqual([]);
    await testInfo.attach('generated-first-service-report',{body:JSON.stringify(j.report,null,2),contentType:'application/json'});
  }finally{await j.close();}
});

test("SQL-backed browser delivery pins approved edits and revokes the original link",async({page},testInfo)=>{
  test.setTimeout(90000);const j=await createJourney(1);
  try{
    expect(j.migrations).toBeGreaterThanOrEqual(49);
    expect((await j.inspect()).ledger).toEqual([{kind:"prospect_debit",delta:-1}]);
    expect(await j.repository.loadCompletedReport(j.owner,j.caseId,j.job)).toBeNull();
    const settled=await j.settle();expect(settled.rows[0]).toMatchObject({idempotent:false});
    expect((await j.settle()).rows[0]).toMatchObject({idempotent:true});
    expect(await j.repository.listCompletedReports(j.owner)).toMatchObject([{reportId:j.job,deliveryStatus:"original",deliveryRevision:0}]);
    const external=await mount(page,j);
    await page.getByText("Review & approve · optional edits").click();
    const summary="客户批准摘要：先核实急诊联系页面。",material="Approved material: confirm the existing contact destination before publishing.";
    await page.getByLabel("Client summary").fill(summary);
    await page.getByLabel("Material content").fill(material);
    j.failNext("save_v22_completed_report_revision","before");
    await page.getByRole("button",{name:"Save draft"}).click();
    await expect(page.getByText("Could not save. Your edits have been kept; please retry.")).toBeVisible();
    await expect(page.getByLabel("Client summary")).toHaveValue(summary);expect((await j.inspect()).revisions).toHaveLength(0);
    await page.getByRole("button",{name:"Save draft"}).click();await expect(page.getByText("Draft revision 1 saved. Not approved for delivery.")).toBeVisible();
    await expect(page.getByRole("button",{name:"Create client link"})).toBeDisabled();
    await page.reload();await page.getByText("Review & approve · optional edits").click();await expect(page.getByLabel("Client summary")).toHaveValue(summary);
    await approved(page,2);
    expect(await j.repository.listCompletedReports(j.owner)).toMatchObject([{reportId:j.job,deliveryStatus:"approved",deliveryRevision:2}]);
    const ownerResponse=page.waitForResponse(r=>r.url().endsWith("/client-pdf")),download=page.waitForEvent("download");
    await page.getByRole("button",{name:"Download approved PDF"}).click();
    await (await download).saveAs(testInfo.outputPath("owner-approved.pdf"));
    const pdf=await ownerResponse;expect(pdf.headers()["x-report-revision"]).toBe("2");const checksum=pdf.headers()["x-report-content-checksum"];
    await page.getByRole("button",{name:"Create client link"}).click();
    const link=page.getByLabel("New client link");await expect(link).toBeVisible();const shareUrl=await link.inputValue();
    await page.getByLabel("Client summary").fill("PRIVATE DRAFT must not reach the shared report.");
    await page.getByRole("button",{name:"Save draft"}).click();await expect(page.getByText("Draft revision 3 saved. Not approved for delivery.")).toBeVisible();
    await expect(page.getByRole("button",{name:"Create client link"})).toBeDisabled();
    await approved(page,4);
    await page.goto(shareUrl);await expect(page.getByText(summary,{exact:true})).toBeVisible();
    await expect(page.getByText(material,{exact:true})).toBeVisible();await expect(page.getByText(/PRIVATE DRAFT/)).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(0);
    const sharedResponse=page.waitForResponse(r=>r.url().endsWith("/api/share/pdf")),sharedDownload=page.waitForEvent("download");
    await page.getByRole("button",{name:"Download PDF"}).click();await (await sharedDownload).saveAs(testInfo.outputPath("shared-approved.pdf"));
    expect((await sharedResponse).headers()["x-report-content-checksum"]).toBe(checksum);
    await page.goto("/_journey/report");await page.getByRole("button",{name:"Manage shared links"}).click();
    await page.getByRole("button",{name:"Revoke link"}).click();await expect(page.getByText(/Link revoked/)).toBeVisible();
    await page.goto(shareUrl);await expect(page.getByRole("heading",{name:"This report link is unavailable"})).toBeVisible();
    const state=await j.inspect();expect(state.balance).toBe(4);expect(state.ledger).toEqual([{kind:"prospect_debit",delta:-1}]);
    expect(state.charge).toMatchObject({state:"consumed",final_capability_report_id:j.job});
    expect(state.reports).toEqual([{payload:j.report}]);expect(state.revisions).toHaveLength(4);expect(external).toEqual([]);
  }finally{await j.close();}
});

test("zero-action diagnosis can be approved unchanged; lost saves recover without extra credit or silent overwrite",async({page},testInfo)=>{
  test.setTimeout(90000);const j=await createJourney(0);
  try{
    await j.settle();const external=await mount(page,j);await page.getByText("Review & approve · optional edits").click();
    await approved(page,1);expect((await j.inspect()).revisions[0]).toMatchObject({status:"approved",content:{actions:[],summary:j.report.summary}});
    const pdfDownload=page.waitForEvent("download");await page.getByRole("button",{name:"Download approved PDF"}).click();
    await (await pdfDownload).saveAs(testInfo.outputPath("zero-action-approved.pdf"));
    await page.getByLabel("Client summary").fill("Saved once despite the missing response.");
    j.failNext("save_v22_completed_report_revision","after");await page.getByRole("button",{name:"Save draft"}).click();
    await expect(page.getByText("Could not save. Your edits have been kept; please retry.")).toBeVisible();
    expect((await j.inspect()).revisions).toHaveLength(2);
    await page.getByRole("button",{name:"Save draft"}).click();
    await expect(page.getByText(/A newer revision was saved elsewhere/)).toBeVisible();await expect(page.getByRole("button",{name:"Copy unsaved edits"})).toBeVisible();
    await expect(page.getByLabel("Client summary")).toHaveValue("Saved once despite the missing response.");
    expect((await j.inspect()).revisions).toHaveLength(2);
    await page.reload();await page.getByText("Review & approve · optional edits").click();await expect(page.getByLabel("Client summary")).toHaveValue("Saved once despite the missing response.");
    await approved(page,3);
    const state=await j.inspect();expect(state.balance).toBe(4);expect(state.ledger).toEqual([{kind:"prospect_debit",delta:-1}]);expect(state.charge).toMatchObject({state:"consumed"});expect(external).toEqual([]);
  }finally{await j.close();}
});

test("two live tabs cannot overwrite each other's revisions",async({page,context})=>{
  test.setTimeout(90000);const j=await createJourney(1),other=await context.newPage();
  try{
    await j.settle();await mount(page,j);await mount(other,j);
    for(const tab of [page,other])await tab.getByText("Review & approve · optional edits").click();
    await page.getByLabel("Client summary").fill("First tab persisted this summary.");
    await other.getByLabel("Client summary").fill("Second tab must keep this unsaved text.");
    await page.getByRole("button",{name:"Save draft"}).click();await expect(page.getByText("Draft revision 1 saved. Not approved for delivery.")).toBeVisible();
    await other.getByRole("button",{name:"Save draft"}).click();await expect(other.getByText(/A newer revision was saved elsewhere/)).toBeVisible();
    await expect(other.getByLabel("Client summary")).toHaveValue("Second tab must keep this unsaved text.");
    await expect(other.getByRole("button",{name:"Approve for delivery"})).toBeDisabled();
    const state=await j.inspect();expect(state.revisions).toHaveLength(1);expect(state.revisions[0]).toMatchObject({content:{summary:"First tab persisted this summary."}});
    expect(state.ledger).toEqual([{kind:"prospect_debit",delta:-1}]);
  }finally{await other.close();await j.close();}
});

test("settlement rollback and ambiguous share creation recover without an entitlement leak",async({page})=>{
  test.setTimeout(90000);const j=await createJourney(0);
  try{
    await j.settlementFailure(true);await expect(j.settle()).rejects.toThrow("INJECTED_SETTLEMENT_FAILURE");
    expect((await j.inspect()).reports).toHaveLength(0);expect((await j.inspect()).charge).toMatchObject({state:"reserved"});
    expect((await j.dispatch(apiRequest(j,"content-revision"))).status).toBe(404);
    expect((await j.dispatch(apiRequest(j,"client-pdf","POST",{expectedRevision:1}))).status).toBe(404);
    await j.settlementFailure(false);await j.settle();await mount(page,j);
    expect((await j.dispatch(apiRequest(j,"content-revision"),null)).status).toBe(401);
    expect((await j.dispatch(apiRequest(j,"content-revision"),randomUUID())).status).toBe(404);
    expect((await j.dispatch(apiRequest(j,"client-shares","POST",{expectedRevision:1}),randomUUID())).status).toBe(404);
    await page.getByText("Review & approve · optional edits").click();await approved(page,1);
    j.failNext("create_v22_capability_share","after");await page.getByRole("button",{name:"Create client link"}).click();
    await expect(page.getByText("Unable to prepare this delivery. Please retry.")).toBeVisible();
    await expect(page.getByLabel("New client link")).toHaveCount(0);expect((await j.inspect()).shares).toHaveLength(1);
    // The plaintext token is deliberately unrecoverable; the owner can still revoke the record.
    await page.getByRole("button",{name:"Manage shared links"}).click();await page.getByRole("button",{name:"Revoke link"}).click();
    await expect(page.getByText(/Link revoked/)).toBeVisible();
    expect((await j.inspect()).shares[0]).toMatchObject({revoked_at:expect.any(Date)});
    await page.getByRole("button",{name:"Create client link"}).click();await expect(page.getByLabel("New client link")).toBeVisible();
    const shareUrl=await page.getByLabel("New client link").inputValue();await page.goto(shareUrl);await expect(page.getByRole("heading",{name:j.report.title})).toBeVisible();
    const state=await j.inspect();expect(state.balance).toBe(4);expect(state.ledger).toEqual([{kind:"prospect_debit",delta:-1}]);expect(state.shares).toHaveLength(2);
    expect(state.revisions).toHaveLength(1);
  }finally{await j.close();}
});
