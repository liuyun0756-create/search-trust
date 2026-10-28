import {expect,test} from "./support/journey-test";
import fixture from "../src/lib/report-capability/fixtures/generated/public-0.json";
import {validateCapabilityReport} from "../src/lib/report-capability/validate";
import {initialCapabilityRevision} from "../src/lib/report-capability/revision";
import {buildApprovedCapabilityDelivery} from "../src/lib/report-capability/delivery";

test("new approved client page is read-only and rechecks the token on PDF download",async({page})=>{
  const checked=validateCapabilityReport(fixture);
  if(!checked.ok)throw new Error("Invalid fixture");
  const report=checked.report,content=initialCapabilityRevision(report);content.status="approved";
  const delivery=buildApprovedCapabilityDelivery(report,{id:"00000000-0000-0000-0000-000000009999",report_id:report.id,
    user_id:report.input_manifest.user_id,case_id:report.input_manifest.case_id,revision:1,status:"approved",approved_at:"2026-09-01T12:00:00Z",content});
  delivery.document.title="客户诊断报告 · Café";
  delivery.document.summary="先确认现有服务页面，再讨论下一步。";
  const token="z".repeat(43),urls:string[]=[];
  let revoked=false;
  page.on("request",request=>urls.push(request.url()));
  await page.route("**/api/share/resolve",async route=>{
    expect(route.request().method()).toBe("POST");expect(route.request().postDataJSON()).toEqual({token});
    await route.fulfill({status:revoked?404:200,json:revoked?{error:"Report share not found"}:{schemaVersion:"2.2.2",delivery}});
  });
  await page.route("**/api/share/pdf",async route=>{
    expect(route.request().postDataJSON()).toEqual({token});
    await route.fulfill({status:404,json:{error:"Report share not found"}});
  });
  await page.goto(`/share#${token}`);
  await expect(page.getByRole("heading",{name:"客户诊断报告 · Café"})).toBeVisible();
  await expect(page.getByText("先确认现有服务页面，再讨论下一步。")).toBeVisible();
  await expect(page.getByText(`Report v${delivery.reportVersion} · Approved revision ${delivery.revision}`)).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button",{name:/Save draft|Approve for delivery|Create client link/})).toHaveCount(0);
  await page.getByRole("button",{name:"Download PDF"}).click();
  await expect(page.getByRole("status")).toHaveText("Report share not found");
  await expect(page.getByRole("button",{name:"Download PDF"})).toBeEnabled();
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  revoked=true;await page.reload();
  await expect(page.getByRole("heading",{name:"This report link is unavailable"})).toBeVisible();
  expect(urls.every(url=>!url.includes(token))).toBe(true);
  expect(urls.some(url=>url.includes("posthog"))).toBe(false);
});
