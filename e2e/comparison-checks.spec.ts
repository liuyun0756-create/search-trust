import {build} from "esbuild";
import {mkdtemp,mkdir} from "node:fs/promises";
import {readFileSync,readdirSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import {expect,test} from "@playwright/test";
import {record,context,selection,target,resultView,checkId} from "../src/lib/comparison-checks/test-fixture";
import type {createComparisonHandlers as Factory} from "../src/lib/comparison-checks/handler";
import {collectionContext,collectionView} from "../src/lib/comparison-collections/test-fixture";
import {ga4Context,ga4View} from "../src/lib/ga4-comparison-collections/test-fixture";
import {canonicalDigest} from "../src/lib/verified-analysis-v22/digest";
import readingVectors from "../src/lib/comparison-checks/metric-reading-contracts/fixtures.json";
import type {createGa4ReviewHandlers as ReviewFactory} from "../src/lib/ga4-evidence-reviews/handler";
import {reviewView, reviewRecord, job as reviewedJob} from "../src/lib/ga4-evidence-reviews/test-fixture";
let reviewFactory: typeof ReviewFactory;
let factory:typeof Factory,script:string,css="";
test("GA4 confirms exact scope, recovers an acknowledgement and withholds unqualified values",async({page},info)=>{
  const catalog=structuredClone(ga4Context),commands:any[]=[],errors:string[]=[];let lose=true;
  const deps={enabled:()=>true,user:async()=>({userId:record.user_id}),config:()=>({baseUrl:"https://backend.invalid",token:"test"}),fetch:async(url:RequestInfo|URL,init?:RequestInit)=>{
    const c=JSON.parse(init!.body as string);commands.push(c);
    if(!String(url).endsWith("ga4-comparison-collections"))return Response.json(context);
    if(c.operation==="context")return Response.json(catalog);
    let job=catalog.jobs.find(j=>j.id===c.collection_id);
    if(!job){job=ga4View(c.collection_id,"queued",c.selection);catalog.jobs.push(job);}
    if(lose){lose=false;throw new Error("lost acknowledgement");}return Response.json(job);
  }};
  const comparisons=factory(deps),ga4=factory({...deps,kind:"ga4-collection"});
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url());if(url.origin!=="http://127.0.0.1:3100")return route.abort();
    if(req.isNavigationRequest())return route.fulfill({contentType:"text/html",body:'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/comparison.js"></script></body></html>'});
    if(url.pathname==="/comparison.js")return route.fulfill({contentType:"application/javascript",body:script});
    const h=url.pathname.endsWith("ga4-comparison-collections")?ga4:comparisons;
    const res=await h[req.method()==="POST"?"POST":"GET"](new Request(req.url(),{method:req.method(),headers:{...await req.allHeaders(),host:url.host},body:req.postData()}),{params:Promise.resolve({id:target.caseId,reportId:target.reportId})});
    return route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()});
  });
  await page.goto("/comparison-test?ga4=1");if(css)await page.addStyleTag({content:css});
  expect(commands).toHaveLength(0);await page.getByRole("button",{name:"Open free comparison checks"}).click();
  const panel=page.getByRole("region",{name:"Collect GA4 around this change"}),button=panel.getByRole("button",{name:"Collect GA4 periods · free"}),confirmation=panel.getByRole("checkbox");
  await expect(button).toBeDisabled();await expect(panel.getByText(/Property timezone: America\/Los_Angeles/)).toBeVisible();
  expect(commands.every(c=>c.operation==="context")).toBe(true);
  await confirmation.check();await panel.getByLabel("Exact landing path · optional").fill("https://other.test/a");
  await expect(confirmation).not.toBeChecked();await expect(button).toBeDisabled();
  await panel.getByLabel("Exact landing path · optional").fill("/services/repair");await confirmation.check();
  await page.getByLabel("Days in each period").selectOption("7");await expect(confirmation).not.toBeChecked();await expect(button).toBeDisabled();
  await page.getByLabel("Days in each period").selectOption("28");await confirmation.check();
  await panel.getByRole("button",{name:"Refresh GA4 status"}).click();await expect(confirmation).not.toBeChecked();
  await confirmation.check();await button.click();await expect(panel.getByText(/response could not be confirmed/)).toBeVisible();
  await page.reload();if(css)await page.addStyleTag({content:css});await page.getByRole("button",{name:"Open free comparison checks"}).click();
  await panel.getByRole("button",{name:"Check saved GA4 request"}).click();
  await expect(panel.getByText("Queued",{exact:true})).toBeVisible();
  const requests=commands.filter(c=>c.operation==="request");expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);expect(catalog.jobs).toHaveLength(1);
  expect(requests[0].selection.landing_path).toBe("/services/repair");
  catalog.jobs[0]=ga4View(catalog.jobs[0].id,"succeeded",catalog.jobs[0].selection);
  await panel.getByRole("button",{name:"Refresh GA4 status"}).click();
  await expect(panel.getByText("Collected · review limitations")).toBeVisible();
  await expect(panel.getByText(/No uplift or causal conclusion is published/)).toBeVisible();
  await panel.getByText("Original metric qualification").click();
  await expect(panel.getByText("Processing completeness has not been verified.").first()).toBeVisible();
  await expect(panel).not.toContainText("GA4_COMPLETENESS_NOT_ATTESTED");await panel.getByText("Original metric qualification").click();
  await expect(panel.getByRole("button",{name:"Use these periods in the comparison"})).toHaveCount(0);
  if(css){await page.setViewportSize({width:1280,height:1000});await panel.screenshot({path:info.outputPath("ga4-collection-desktop.png")});
    await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await panel.screenshot({path:info.outputPath("ga4-collection-mobile.png")});}
  catalog.previews[0].elapsed=false;await panel.getByRole("button",{name:"Refresh GA4 status"}).click();
  await expect(panel.getByText(/Waiting for the after period to finish/)).toBeVisible();await expect(button).toBeDisabled();
  catalog.previews[0].elapsed=true;catalog.jobs[0]=ga4View(catalog.jobs[0].id,"failed",catalog.jobs[0].selection);
  await panel.getByRole("button",{name:"Refresh GA4 status"}).click();await expect(panel.getByText("Collection could not complete")).toBeVisible();
  catalog.implementation!.revision+=1;await panel.getByRole("button",{name:"Refresh GA4 status"}).click();
  await expect(panel.getByText(/newer implementation record exists/)).toBeVisible();await expect(button).toBeDisabled();
  catalog.bindings=[];catalog.previews=[];await panel.getByRole("button",{name:"Refresh GA4 status"}).click();
  await expect(panel.getByText(/No current GA4 website scope is available/)).toBeVisible();
  expect(commands.filter(c=>c.operation==="freeze")).toHaveLength(0);expect(errors).toEqual([]);
});
test.beforeAll(async()=>{
  if(process.env.V22_PRIORITY_VISUAL_QA==="true") css=readdirSync(".next/static/chunks").filter(s=>s.endsWith(".css")).map(s=>readFileSync(path.join(".next/static/chunks",s),"utf8")).join("\n");
  const resolve=createRequire(path.resolve("package.json")).resolve;
  await mkdir("output/playwright/integration",{recursive:true});
  const directory=await mkdtemp(path.resolve("output/playwright/integration/comparison-"));
  await build({entryPoints:["e2e/integration/comparison-gateway.ts"],outfile:path.join(directory,"gateway.mjs"),bundle:true,platform:"node",format:"esm",packages:"external",plugins:[{name:"resolve-ajv",setup(b){b.onResolve({filter:/^ajv\/dist\/2020$/},a=>({path:resolve(a.path),external:true}));}}]});
  ({createComparisonHandlers:factory}=await import(pathToFileURL(path.join(directory,"gateway.mjs")).href));
  ({createGa4ReviewHandlers:reviewFactory}=await import(pathToFileURL(path.join(directory,"gateway.mjs")).href));
  const browser=await build({entryPoints:["e2e/integration/comparison-browser.tsx"],bundle:true,write:false,platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"test"'}});
  script=browser.outputFiles[0].text;
});
test("GA4 evidence review retains drafts, recovers saves and never promotes manual checks", async ({page}, info) => {
  const catalog = structuredClone(ga4Context); catalog.jobs = [reviewedJob];
  const history = reviewView(), commands: any[] = [], errors: string[] = [];
  let lose = true, conflict = false;
  const deps = {enabled: () => true, user: async () => ({userId: record.user_id}), config: () => ({baseUrl: "https://backend.invalid", token: "test"}),
    fetch: async (url: RequestInfo | URL, init?: RequestInit) => {
      const c = JSON.parse(init!.body as string); commands.push(c);
      if (String(url).endsWith("ga4-evidence-reviews")) {
        if (c.operation === "read") return Response.json({...history, saved: null});
        if (conflict) {conflict = false; return Response.json({code: "CONFLICT"}, {status: 409});}
        let saved = history.reviews.find(r => r.request_id === c.review.request_id);
        if (!saved) {saved = reviewRecord(c.review); history.reviews.unshift(saved);}
        if (lose) {lose = false; throw new Error("lost acknowledgement after save");}
        return Response.json({...history, saved});
      }
      return Response.json(String(url).endsWith("ga4-comparison-collections") ? catalog : context);
    }};
  const comparisons = factory(deps), ga4 = factory({...deps, kind: "ga4-collection"}), reviews = reviewFactory(deps);
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url()); if (url.origin !== "http://127.0.0.1:3100") return route.abort();
    if (req.isNavigationRequest()) return route.fulfill({contentType: "text/html", body: '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/comparison.js"></script></body></html>'});
    if (url.pathname === "/comparison.js") return route.fulfill({contentType: "application/javascript", body: script});
    const h = url.pathname.endsWith("ga4-evidence-reviews") ? reviews : url.pathname.endsWith("ga4-comparison-collections") ? ga4 : comparisons;
    const res = await h[req.method() === "POST" ? "POST" : "GET"](new Request(req.url(), {method: req.method(), headers: {...await req.allHeaders(), host: url.host}, body: req.postData()}), {params: Promise.resolve({id: target.caseId, reportId: target.reportId})});
    return route.fulfill({status: res.status, headers: Object.fromEntries(res.headers), body: await res.text()});
  });
  await page.goto("/comparison-test?ga4=1"); if (css) await page.addStyleTag({content: css});
  await page.getByRole("button", {name: "Open free comparison checks"}).click();
  await expect(page.getByText("Collected · review limitations")).toBeVisible();
  expect(commands.some(c => c.operation === "read")).toBe(false);
  await page.getByRole("button", {name: "Inspect evidence and record SEO checks"}).click();
  const panel = page.getByRole("region", {name: "GA4 evidence and SEO review"});
  await expect(panel.getByText("1. System-observed evidence")).toBeVisible();
  await panel.getByText("Report restrictions and truncation · 6 checks").click();
  await expect(panel.getByText("Truncation metadata was not captured in this older observation.")).toHaveCount(6);
  await panel.getByLabel("Historical event settings", {exact: true}).selectOption("no_issue_found");
  await expect(panel.getByRole("button", {name: "Save SEO checks · free"})).toBeDisabled();
  const note = panel.getByLabel(/Historical event settings · basis and notes/);
  await note.fill("Reviewed settings export dated 16 December. Earlier tag history remains unavailable.");
  await page.getByRole("button", {name: "Hide evidence and SEO checks"}).click();
  await page.getByRole("button", {name: "Inspect evidence and record SEO checks"}).click();
  await expect(note).toHaveValue(/Earlier tag history/);
  await panel.getByRole("button", {name: "Save SEO checks · free"}).click();
  await expect(panel.getByText(/Save confirmation was lost/)).toBeVisible();
  await expect(note).toBeDisabled();
  await panel.getByRole("button", {name: "Retry the same SEO review save"}).click();
  await expect(panel.getByText(/SEO review revision 1 saved/)).toBeVisible();
  const saves = commands.filter(c => c.operation === "save"); expect(saves).toHaveLength(2); expect(saves[0]).toEqual(saves[1]); expect(history.reviews).toHaveLength(1);
  await note.fill("Additional checks found a tag change; further investigation needed.");
  await panel.getByLabel("Historical event settings", {exact: true}).selectOption("issue_found");
  conflict = true; await panel.getByRole("button", {name: "Save SEO checks · free"}).click();
  await expect(panel.getByText(/Your draft is preserved/)).toBeVisible();
  await panel.getByRole("button", {name: "Reload latest SEO review"}).click();
  await expect(panel.getByText(/Your draft is unchanged/)).toBeVisible(); await expect(note).toHaveValue(/Additional checks/);
  await panel.getByRole("button", {name: "Save SEO checks · free"}).click();
  await expect(panel.getByText(/SEO review revision 2 saved/)).toBeVisible();
  await panel.getByText("Saved SEO review history · latest revision 2").click();
  await expect(panel.getByText(/Earlier tag history remains unavailable/)).toBeVisible();
  await expect(panel.getByText(/SEO notes do not unlock/)).toBeVisible();
  if (css) {
    await panel.getByText("Report restrictions and truncation · 6 checks").click();
    await panel.getByText("Saved SEO review history · latest revision 2").click();
    await page.setViewportSize({width: 1280, height: 1000}); await panel.screenshot({path: info.outputPath("ga4-evidence-review-desktop.png")});
    await page.setViewportSize({width: 390, height: 844}); expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await panel.screenshot({path: info.outputPath("ga4-evidence-review-mobile.png")});
  }
  expect(history.audit.comparisons_available).toBe(false); expect(history.audit.event_history).toBe("unverified");
  expect(commands.some(c => ["freeze", "request"].includes(c.operation))).toBe(false); expect(errors).toEqual([]);
});
test("metric reading keeps low counts, zero denominators and blocked data distinct", async ({page}, info) => {
  const catalogue = structuredClone(context), view = resultView(), errors: string[] = [], commands: string[] = [];
  const setResult = (name: string) => {
    view.result = structuredClone(readingVectors.find(v => v.name === name)!.result) as typeof view.result;
    catalogue.history = [{id: view.id, implementation: view.result.implementation, action_id: view.result.action_id,
      days: view.result.windows.days, source: view.result.scope.source, state: view.result.state, evaluated_at: view.result.evaluated_at}];
  };
  setResult("one_to_two");
  const routes = factory({enabled: () => true, user: async () => ({userId: record.user_id}),
    config: () => ({baseUrl: "https://backend.invalid", token: "test"}), fetch: async (_url, init) => {
      const command = JSON.parse(init!.body as string); commands.push(command.operation);
      return Response.json(command.operation === "context" ? catalogue : view);
    }});
  page.on("pageerror", e => errors.push(e.message));
  await page.route("**/*", async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== "http://127.0.0.1:3100") return route.abort();
    if (req.isNavigationRequest()) return route.fulfill({contentType: "text/html", body: '<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/comparison.js"></script></body></html>'});
    if (url.pathname === "/comparison.js") return route.fulfill({contentType: "application/javascript", body: script});
    const res = await routes.GET(new Request(req.url(), {headers: {...await req.allHeaders(), host: url.host}}), {params: Promise.resolve({id: target.caseId, reportId: target.reportId})});
    return route.fulfill({status: res.status, headers: Object.fromEntries(res.headers), body: await res.text()});
  });
  await page.goto("/comparison-test"); if (css) await page.addStyleTag({content: css});
  await page.getByRole("button", {name: "Open free comparison checks"}).click();
  await page.getByRole("button", {name: /Values aligned for comparison · 28 days/}).click();
  const aid = page.getByRole("region", {name: "What these numbers can support"});
  await expect(aid.getByText("1 → 2 clicks")).toBeVisible();
  await expect(aid.getByText(/entire observed difference is one click/)).toBeVisible();
  await aid.getByText("How this reading aid is calculated").click();
  await expect(aid.getByText(/Larger counts do not automatically qualify/)).toBeVisible();
  await aid.getByText("How this reading aid is calculated").click();
  if (css) {
    await page.setViewportSize({width: 1280, height: 1000}); await aid.screenshot({path: info.outputPath("metric-reading-desktop.png")});
    await page.setViewportSize({width: 390, height: 844});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await aid.screenshot({path: info.outputPath("metric-reading-mobile.png")});
  }
  setResult("no_before_impressions");
  await page.getByRole("button", {name: "Reload saved sources & history"}).click();
  await page.getByRole("button", {name: /Values aligned for comparison · 28 days/}).click();
  await expect(aid.getByText(/CTR change cannot be calculated/)).toBeVisible();
  setResult("ga4_withheld");
  await page.getByRole("button", {name: "Reload saved sources & history"}).click();
  await page.getByRole("button", {name: /Not comparable · 28 days · GA4/}).click();
  await expect(aid.getByText(/no trend interpretation/)).toBeVisible();
  await expect(aid.getByText("Clicks · count first")).toHaveCount(0);
  expect(commands.every(c => c === "context" || c === "read")).toBe(true); expect(errors).toEqual([]);
});
test("explicit collection: confirm once, recover, refresh, select periods without auto-analysis",async({page},info)=>{
  const catalog=structuredClone(context),collections=structuredClone(collectionContext),commands:any[]=[],errors:string[]=[];
  let lose=true;
  const backend:typeof fetch=async(_url,init)=>{
    const c=JSON.parse(init!.body as string);commands.push(c);
    if("collection_id" in c){
      if(c.operation==="context")return Response.json(collections);
      let job=collections.jobs.find(j=>j.id===c.collection_id);
      if(!job){job=collectionView(c.collection_id);collections.jobs.unshift(job);}
      if(lose){lose=false;throw new Error("lost acknowledgement");}
      return Response.json(job);
    }
    if(c.operation==="context")return Response.json(catalog);
    const view=resultView("positive",c.comparison_id);
    view.result.before_source!.snapshot_id=c.selection.before_snapshot_id;
    view.result.after_source!.snapshot_id=c.selection.after_snapshot_id;
    const {checksum:_,...content}=view.result;view.result.checksum=canonicalDigest(content);
    return Response.json(view);
  };
  const deps={enabled:()=>true,user:async()=>({userId:record.user_id}),config:()=>({baseUrl:"https://backend.invalid",token:"test"}),fetch:backend};
  const comparisonHandlers=factory(deps),collectionHandlers=factory({...deps,kind:"collection"});
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!=="http://127.0.0.1:3100")return route.abort();
    if(req.isNavigationRequest())return route.fulfill({contentType:"text/html",body:'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/comparison.js"></script></body></html>'});
    if(url.pathname==="/comparison.js")return route.fulfill({contentType:"application/javascript",body:script});
    const h=url.pathname.endsWith("comparison-collections")?collectionHandlers:comparisonHandlers;
    const result=await h[req.method()==="POST"?"POST":"GET"](new Request(req.url(),{method:req.method(),headers:{...await req.allHeaders(),host:url.host},body:req.postData()}),{params:Promise.resolve({id:target.caseId,reportId:target.reportId})});
    return route.fulfill({status:result.status,headers:Object.fromEntries(result.headers),body:await result.text()});
  });
  await page.goto("/comparison-test?collections=1");if(css)await page.addStyleTag({content:css});
  expect(commands).toHaveLength(0);
  await page.getByRole("button",{name:"Open free comparison checks"}).click();
  const confirm=page.getByRole("button",{name:"Confirm collection · free"});
  await expect(confirm).toBeDisabled();
  await expect(page.getByText("28 days per period · America/Los_Angeles · saved implementation revision 1")).toBeVisible();
  expect(commands.every(c=>c.operation==="context")).toBe(true);
  await page.getByRole("checkbox").check();await confirm.click();
  await expect(page.getByText(/Retry with the same selections/)).toBeVisible();
  await confirm.click();
  await expect(page.getByText("Queued · waiting to collect",{exact:true})).toBeVisible();
  const requests=commands.filter(c=>c.operation==="request");expect(requests).toHaveLength(2);expect(requests[0]).toEqual(requests[1]);
  expect(collections.jobs).toHaveLength(1);
  const job=collectionView(collections.jobs[0].id,"succeeded");collections.jobs[0]=job;
  catalog.sources.unshift({id:job.id,source:"gsc",resource:job.resource,coverage_start:job.windows.before.start,coverage_end:job.windows.after.end,fetched_at:job.created_at,expires_at:"2099-01-01T00:00:00Z",current_eligible:true});
  await page.getByRole("button",{name:"Refresh collection status"}).click();
  await expect(page.getByText("Collected · qualification still required")).toBeVisible();
  await page.getByRole("button",{name:"Use these periods in the comparison"}).click();
  await expect(page.getByLabel("Before observation")).toHaveValue(job.id);await expect(page.getByLabel("After observation")).toHaveValue(job.id);
  expect(commands.filter(c=>c.operation==="freeze")).toHaveLength(0);
  await page.getByRole("button",{name:"Check saved data · free"}).click();
  await expect(page.getByRole("heading",{name:"Values aligned for comparison"})).toBeVisible();
  await expect(page.getByText("No improvement, decline or causal effect is concluded.")).toBeVisible();
  if(css){await page.setViewportSize({width:1280,height:1000});await page.screenshot({path:info.outputPath("collection-desktop.png"),fullPage:true});
    await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath("collection-mobile.png"),fullPage:true});}
  await page.reload();if(css)await page.addStyleTag({content:css});
  await page.getByRole("button",{name:"Open free comparison checks"}).click();
  await expect(page.getByText("Collected · qualification still required")).toBeVisible();
  expect(commands.filter(c=>c.operation==="request")).toHaveLength(2);
  collections.previews[0].elapsed=false;
  await page.getByRole("button",{name:"Refresh collection status"}).click();
  await expect(page.getByText(/after window is still open/)).toBeVisible();await expect(confirm).toBeDisabled();
  expect(errors).toEqual([]);
});
test("saved-data comparison: recover a lost response, preserve history, show source limits",async({page},info)=>{
  const catalogue=structuredClone(context),saved=new Map<string,ReturnType<typeof resultView>>(),commands:{operation:string;comparison_id:string;selection:typeof selection}[]=[],errors:string[]=[],external:string[]=[];
  let lose=true;
  const routes=factory({enabled:()=>true,user:async()=>({userId:record.user_id}),config:()=>({baseUrl:"https://backend.invalid",token:"test"}),fetch:async(_url,init)=>{
    const command=JSON.parse(init!.body as string); commands.push(command);
    if(command.operation==="context")return Response.json(catalogue);
    if(command.operation==="read")return Response.json(saved.get(command.comparison_id));
    if(!saved.has(command.comparison_id)){
      const view=resultView("positive",command.comparison_id);saved.set(view.id,view);
      catalogue.history.unshift({id:view.id,implementation:view.result.implementation,action_id:view.result.action_id,days:view.result.windows.days,source:view.result.scope.source,state:view.result.state,evaluated_at:view.result.evaluated_at});
    }
    if(lose){lose=false;throw new Error("lost response after save");}
    return Response.json(saved.get(command.comparison_id));
  }});
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/*",async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!=="http://127.0.0.1:3100"){external.push(url.origin);return route.abort();}
    if(request.isNavigationRequest())return route.fulfill({contentType:"text/html",body:'<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/comparison.js"></script></body></html>'});
    if(url.pathname==="/comparison.js")return route.fulfill({contentType:"application/javascript",body:script});
    const req=new Request(request.url(),{method:request.method(),headers:{...await request.allHeaders(),host:url.host},body:request.postData()});
    const res=await routes[request.method()==="POST"?"POST":"GET"](req,{params:Promise.resolve({id:target.caseId,reportId:target.reportId})});
    return route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:await res.text()});
  });
  await page.goto("/comparison-test");if(css)await page.addStyleTag({content:css});
  expect(commands).toHaveLength(0);
  await page.getByRole("button",{name:"Open free comparison checks"}).click();
  await expect(page.getByLabel("Days in each period")).toHaveValue("28");
  await page.getByLabel("Before observation").selectOption(selection.before_snapshot_id!);
  await page.getByLabel("After observation").selectOption(selection.after_snapshot_id!);
  await page.getByRole("button",{name:"Check saved data · free"}).click();
  await expect(page.getByText(/response could not be confirmed/)).toBeVisible();
  expect(saved.size).toBe(1);
  await page.getByRole("button",{name:"Check saved data · free"}).click();
  await expect(page.getByRole("heading",{name:"Values aligned for comparison"})).toBeVisible();
  const freezes=commands.filter(c=>c.operation==="freeze");expect(freezes).toHaveLength(2);expect(freezes[0]).toEqual(freezes[1]);expect(saved.size).toBe(1);
  await expect(page.getByRole("table")).toContainText("clicks");
  await expect(page.getByText("No improvement, decline or causal effect is concluded.")).toBeVisible();
  await expect(page.getByRole("article")).toContainText("America/Los_Angeles");
  await expect(page.getByRole("article")).toContainText("Search Console hides some queries for privacy");
  await expect(page.getByRole("article")).not.toContainText("GSC_QUERY_PRIVACY_FILTERING");
  if(css){await page.setViewportSize({width:1280,height:1000});await page.screenshot({path:info.outputPath("comparison-desktop.png"),fullPage:true});
    await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:info.outputPath("comparison-mobile.png"),fullPage:true});}
  await page.reload();if(css)await page.addStyleTag({content:css});
  await page.getByRole("button",{name:"Open free comparison checks"}).click();
  await page.getByRole("button",{name:/Values aligned for comparison · 28 days/}).click();
  await expect(page.getByRole("heading",{name:"Values aligned for comparison"})).toBeVisible();
  const restricted=resultView("ga4_all",checkId);saved.set(checkId,restricted);
  catalogue.history.unshift({id:checkId,implementation:restricted.result.implementation,action_id:restricted.result.action_id,days:28,source:"ga4",state:"not_comparable",evaluated_at:restricted.result.evaluated_at});
  await page.getByRole("button",{name:"Reload saved sources & history"}).click();
  await page.getByRole("button",{name:/Not comparable · 28 days · GA4/}).click();
  await expect(page.getByRole("heading",{name:"Not comparable",exact:true})).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("article")).toContainText("GA4 period completeness has not been verified");
  await page.getByLabel("Data source").selectOption("ga4");
  await expect(page.getByLabel("Before observation")).toHaveValue("");
  expect(external).toEqual([]);expect(errors).toEqual([]);
});
