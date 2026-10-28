import {build} from "esbuild";
import {mkdtemp,mkdir} from "node:fs/promises";
import {readFileSync,readdirSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {expect,test,type Page} from "@playwright/test";
import {owner,target,pdf,fileView} from "../src/lib/implementation-attachments/test-fixture";
import type {createAttachmentHandlers} from "../src/lib/implementation-attachments/handler";
import type {AttachmentService} from "../src/lib/implementation-attachments/service";
import type {StoredAttachment,FileMetadata} from "../src/lib/implementation-attachments/repository";
let factory:typeof createAttachmentHandlers,Service:typeof AttachmentService,script:string,css="";
test.beforeAll(async()=>{
  if(process.env.V22_PRIORITY_VISUAL_QA==="true")css=readdirSync(".next/static/chunks").filter(n=>n.endsWith(".css")).map(n=>readFileSync(path.join(".next/static/chunks",n),"utf8")).join("\n");
  await mkdir("output/playwright/integration",{recursive:true});const dir=await mkdtemp(path.resolve("output/playwright/integration/attachments-"));
  await build({entryPoints:["e2e/integration/attachment-gateway.ts"],outfile:path.join(dir,"gateway.mjs"),bundle:true,platform:"node",format:"esm",packages:"external",
    plugins:[{name:"server-marker",setup(b){b.onResolve({filter:/^server-only$/},()=>({path:"server-only",namespace:"empty"}));b.onLoad({filter:/.*/,namespace:"empty"},()=>({contents:"export {};"}));}}]});
  ({createAttachmentHandlers:factory,AttachmentService:Service}=await import(pathToFileURL(path.join(dir,"gateway.mjs")).href));
  const browser=await build({entryPoints:["e2e/integration/attachment-browser.tsx"],bundle:true,write:false,platform:"browser",jsx:"automatic",define:{"process.env.NODE_ENV":'"test"'}});script=browser.outputFiles[0].text;
});
async function mount(page:Page,loss:"none"|"before"|"after"="none") {
  const saved=new Map<string,StoredAttachment>(),objects=new Map<string,Uint8Array>(),requests:string[]=[],errors:string[]=[];
  let uploads=0,lose=loss!=="none",account=owner;
  const read=async(user:string,_t:unknown,id:string)=>{if(user!==owner||!saved.has(id))throw new Error("missing");return saved.get(id)!;};
  const repo={list:async(user:string)=>user===owner?[...saved.values()].map(a=>a.view):[],read,
    reserve:async(user:string,t:unknown,id:string,m:FileMetadata)=>{if(saved.has(id))return {created:false,attachment:await read(user,t,id)};
      const a={view:{...fileView("uploading",id),name:m.name,mime:m.mime,size:m.size},key:`files/${id}`,digest:m.digest};saved.set(id,a);return {created:true,attachment:a};},
    finalize:async(user:string,t:unknown,id:string)=>{const a=await read(user,t,id);a.view.status="ready";return a;},
    remove:async(user:string,t:unknown,id:string)=>{const a=await read(user,t,id);a.view.status="removing";return a;}};
  const storage={upload:async(key:string,bytes:Uint8Array)=>{uploads++;objects.set(key,bytes);},read:async(key:string)=>objects.get(key)??null,remove:async(key:string)=>{objects.delete(key);}};
  const svc=new Service(repo,storage),gateway=factory({enabled:()=>true,user:async()=>({userId:account}),service:()=>svc});
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",async route=>{
    const req=route.request(),url=new URL(req.url());if(url.origin!=="http://127.0.0.1:3100")return route.abort();
    if(req.isNavigationRequest())return route.fulfill({contentType:"text/html",body:`<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/attachment.js"></script></body></html>`});
    if(url.pathname==="/attachment.js")return route.fulfill({contentType:"application/javascript",body:script});
    const method=req.method() as keyof typeof gateway;requests.push(method);
    if(method==="PUT"&&lose&&loss==="before"){lose=false;return route.abort();}
    const body=req.postDataBuffer();
    const response=await gateway[method](new Request(req.url(),{method,headers:{...await req.allHeaders(),host:url.host},body:body?new Uint8Array(body):null}),{params:Promise.resolve({id:target.caseId,reportId:target.reportId})});
    if(method==="PUT"&&lose&&loss==="after"){lose=false;return route.abort();}
    // Fake repository's absent entry maps to an inaccessible object, without any provider access.
    if(method==="GET"&&url.searchParams.has("attachmentId")&&!saved.has(url.searchParams.get("attachmentId")!))return route.fulfill({status:404,contentType:"application/json",body:JSON.stringify({error:{code:"NOT_FOUND"}})});
    await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  await page.goto("/attachments-test");await page.waitForLoadState("networkidle");
  return {saved,requests,errors,uploads:()=>uploads,switchAccount:()=>{account="77777777-7777-4777-8777-777777777777";}};
}
async function choose(page:Page,name="published-work.pdf",bytes=pdf) {await page.getByLabel("PNG, JPEG or PDF · up to 2 MiB · 5 files per action version").setInputFiles({name,mimeType:"application/pdf",buffer:Buffer.from(bytes)});}
test("upload/download/remove with keyboard, limitations and responsive layout",async({page},info)=>{
  const m=await mount(page);await expect(page.getByText("No files attached to this action version.")).toBeVisible();await choose(page);
  const add=page.getByRole("button",{name:"Add a file · no credits used"});await add.focus();await page.keyboard.press("Enter");
  await expect(page.getByRole("button",{name:"Download published-work.pdf"})).toBeVisible();expect(m.uploads()).toBe(1);
  await expect(page.getByText("File attached to implementation revision 1. No credits used.")).toBeVisible();
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Download published-work.pdf"}).click();expect((await download).suggestedFilename()).toBe("published-work.pdf");
  if(css){await page.setViewportSize({width:1280,height:900});await page.screenshot({path:info.outputPath("attachments-desktop.png"),fullPage:true});
    await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath("attachments-mobile.png"),fullPage:true});}
  await page.getByRole("button",{name:"Remove published-work.pdf",exact:true}).click();expect(m.requests.filter(v=>v==="DELETE")).toHaveLength(0);
  await page.getByRole("button",{name:"Cancel",exact:true}).click();await page.getByRole("button",{name:"Remove published-work.pdf",exact:true}).click();await page.getByRole("button",{name:"Confirm removal"}).click();
  await expect(page.getByText("File removed",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Download published-work.pdf"})).toHaveCount(0);expect(m.uploads()).toBe(1);expect(m.errors).toEqual([]);
});
test("lost acknowledgement refresh uses GET only, never uploads twice",async({page})=>{
  const m=await mount(page,"after");await choose(page);await page.getByRole("button",{name:"Add a file · no credits used"}).click();await expect(page.getByText(/The upload could not be confirmed/)).toBeVisible();
  await page.reload();await page.waitForLoadState("networkidle");await expect(page.getByRole("button",{name:"Download published-work.pdf"})).toBeVisible();expect(m.uploads()).toBe(1);expect(m.requests.filter(v=>v==="PUT")).toHaveLength(1);
  expect(await page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith("v22:attachments:")))).toEqual([]);
});
test("unaccepted request needs same-file explicit retry",async({page})=>{
  const m=await mount(page,"before");await choose(page);await page.getByRole("button",{name:"Add a file · no credits used"}).click();await expect(page.getByText(/The upload could not be confirmed/)).toBeVisible();await page.reload();await page.waitForLoadState("networkidle");
  await expect(page.getByText(/No accepted upload was found/)).toBeVisible();expect(m.requests.filter(v=>v==="PUT")).toHaveLength(1);
  await choose(page,"different.pdf");await page.getByRole("button",{name:"Retry the same file"}).click();await expect(page.getByText(/belongs to a different file/)).toBeVisible();expect(m.uploads()).toBe(0);
  await choose(page);await page.getByRole("button",{name:"Retry the same file"}).click();await expect(page.getByRole("button",{name:"Download published-work.pdf"})).toBeVisible();expect(m.saved.size).toBe(1);expect(m.uploads()).toBe(1);
});
test("invalid signature and oversized files never leave browser",async({page})=>{
  const m=await mount(page);await choose(page,"bad.pdf",new TextEncoder().encode("not a pdf"));await page.getByRole("button",{name:"Add a file · no credits used"}).click();await expect(page.getByText(/whose file type matches/)).toBeVisible();
  await choose(page,"big.pdf",new Uint8Array(2097153));await page.getByRole("button",{name:"Add a file · no credits used"}).click();await expect(page.getByText("Choose a non-empty file up to 2 MiB.")).toBeVisible();expect(m.uploads()).toBe(0);expect(m.requests).toEqual(["GET"]);
});
test("account and version navigation isolate pending uploads; history is read only",async({page})=>{
  const m=await mount(page,"before");await choose(page);await page.getByRole("button",{name:"Add a file · no credits used"}).click();await expect(page.getByText(/The upload could not be confirmed/)).toBeVisible();
  m.switchAccount();await page.goto("/attachments-test?owner=77777777-7777-4777-8777-777777777777");await page.waitForLoadState("networkidle");await expect(page.getByRole("button",{name:"Check upload status"})).toHaveCount(0);
  await page.goto("/attachments-test?revision=2&readonly=1");await page.waitForLoadState("networkidle");await expect(page.getByRole("button",{name:"Add a file · no credits used"})).toHaveCount(0);expect(m.uploads()).toBe(0);expect(m.requests.filter(v=>v==="PUT")).toHaveLength(1);
});
