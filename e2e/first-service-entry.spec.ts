import {build} from "esbuild";
import {mkdtemp,mkdir,readdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createRequire} from "node:module";
import {expect,test} from "@playwright/test";
import type {createFirstServiceEntryJourney} from "./integration/first-service-entry-database";
const resolve=createRequire(path.resolve('package.json')).resolve;
let createJourney:typeof createFirstServiceEntryJourney,script:string,css:string;
test.beforeAll(async()=>{
  await mkdir('output/playwright/integration',{recursive:true});const dir=await mkdtemp(path.resolve('output/playwright/integration/service-entry-'));
  await build({entryPoints:['e2e/integration/first-service-entry-database.ts'],outfile:path.join(dir,'database.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'test-boundaries',setup(b){
    b.onResolve({filter:/^server-only$/},()=>({path:'empty',namespace:'empty'}));b.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:'export {};'}));
    b.onResolve({filter:/^(next\/server|ajv\/dist\/2020)$/},a=>({path:resolve(a.path),external:true}));
  }}]});
  ({createFirstServiceEntryJourney:createJourney}=await import(pathToFileURL(path.join(dir,'database.mjs')).href));
  const output=await build({entryPoints:['e2e/integration/first-service-entry-browser.tsx'],bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'},plugins:[{name:'test-link',setup(b){
    b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'link'}));b.onLoad({filter:/.*/,namespace:'link'},()=>({contents:'import React from "react";export default function Link(props){return React.createElement("a",props);}',resolveDir:process.cwd()}));
  }}]});script=output.outputFiles[0].text;
  const chunks=await readdir('.next/static/chunks');css=(await Promise.all(chunks.filter(f=>f.endsWith('.css')).map(f=>readFile(`.next/static/chunks/${f}`,'utf8')))).join('\n');
});
for(const width of [1280,390])test(`SQL-backed first service reserves once and recovers confirmation at ${width}px`,async({page},info)=>{
  test.setTimeout(90000);const j=await createJourney();const external:string[]=[],errors:string[]=[];let posts=0;
  try {
    await page.setViewportSize({width,height:900});page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
      if(url.origin!=='http://127.0.0.1:3100'){external.push(url.origin);return route.abort();}
      if(req.isNavigationRequest())return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/_entry/styles.css"></head><body><div id="root"></div><script src="/_entry/app.js"></script></body></html>'});
      if(url.pathname==='/_entry/app.js')return route.fulfill({contentType:'application/javascript',body:script});
      if(url.pathname==='/_entry/styles.css')return route.fulfill({contentType:'text/css',body:css});
      if(!url.pathname.endsWith('/first-service'))return route.fulfill({status:404,body:''});
      if(req.method()==='POST')posts++;
      // Interception happens before Chromium adds the wire-level Host header.
      const res=await j.dispatch(new Request(req.url(),{method:req.method(),headers:{...await req.allHeaders(),host:url.host},body:req.postData()}));
      return route.fulfill({status:res.status,headers:Object.fromEntries(res.headers),body:Buffer.from(await res.arrayBuffer())});
    });
    await page.goto(`/_entry?case=${j.caseId}&owner=${j.owner}`);await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button',{name:'Use 1 credit & start'})).toBeDisabled();expect(posts).toBe(0);expect((await j.inspect()).balance).toBe(5);
    await page.screenshot({path:info.outputPath(`entry-${width}.png`),fullPage:true});
    j.loseResponse('reserve_v22_first_service_discovery');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Use 1 credit & start'}).click();
    await expect(page.getByRole('alert')).toBeVisible();expect((await j.inspect()).balance,JSON.stringify(j.sqlErrors)).toBe(4);
    await page.reload();await page.waitForLoadState('networkidle');await expect(page.getByText('Checking the market',{exact:true})).toBeVisible();expect(posts).toBe(1);
    await j.discover();await page.getByRole('button',{name:'Check current status'}).click();await expect(page.getByText('Synthetic Competitor 1',{exact:true})).toBeVisible();
    await page.getByRole('checkbox').first().check();await page.screenshot({path:info.outputPath(`competitors-${width}.png`),fullPage:true});
    j.loseResponse('confirm_v22_first_service_entry');await page.getByRole('button',{name:'Confirm competitors & prepare report'}).click();await expect(page.getByRole('alert')).toBeVisible();
    await page.reload();await page.waitForLoadState('networkidle');await expect(page.getByText('Preparing your first service diagnosis',{exact:true})).toBeVisible();
    const actual=await j.inspect();expect(actual.balance).toBe(4);expect(actual.ledger).toEqual([{kind:'welcome_grant',delta:5},{kind:'verified_debit',delta:-1}]);expect(actual.jobs).toHaveLength(1);expect(actual.collections).toHaveLength(1);
    await writeFile(info.outputPath('first-service-collection.json'),actual.collections[0].request_canonical);
    await info.attach('first-service-collection.json',{body:actual.collections[0].request_canonical,contentType:'application/json'});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);expect(external).toEqual([]);expect(errors).toEqual([]);
  }finally{await j.close();}
});
