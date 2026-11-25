import {test,expect,openProspectStart} from "./support/journey-test";
import {preflightFixture,E2E_BUSINESS,E2E_LATER} from "./fixtures/preflight";
import {E2E_IDS} from "./fixtures/ids";
import {randomUUID} from "node:crypto";

test("a new Case can confirm a saved GBP branch before the paid entry", async ({page}, info) => {
  let reservations = 0;
  const profile = E2E_BUSINESS.public_gbp_url!;
  await page.route("**/api/v2/preflight", route => route.fulfill({json:{...preflightFixture,gbp_lookup_reason:"site_map_link_address_only",branch_options:[{
    ref:"42",public_gbp_url:profile,name:"SearchTrust E2E Plumbing",address:"12 Example St, Austin, TX",
    domain_matched:true,phone_matched:true,evidence_token:"synthetic-preflight-proof",
  }]}}));
  await page.route("**/api/v2/cases/*/branch-confirmation", route => {
    const body = route.request().postDataJSON();
    expect(body).toMatchObject({evidence_token:"synthetic-preflight-proof",reason:"Domain and phone verified",operating_mode:null,customers_can_visit:false});
    const caseId = new URL(route.request().url()).pathname.split("/")[4];
    return route.fulfill({json:{id:randomUUID(),case_id:caseId,revision:1,public_gbp_url:profile,expires_at:E2E_LATER}});
  });
  await page.route("**/api/v2/cases/*/prospect-workflow", route => {
    reservations++;
    return route.fulfill({status:500,json:{error:{code:"UNEXPECTED_PAID_ENTRY"}}});
  });
  await openProspectStart(page);
  const area = page.getByRole("region",{name:"Confirm GBP branch"});
  await expect(area.getByText(/The website’s Maps link pointed to a street address/)).toBeVisible();
  await area.getByRole("button",{name:"Choose a branch"}).click();
  await area.getByLabel("Google Business Profile",{exact:true}).selectOption("42");
  await expect(area.getByText("Website domain matches · Phone matches")).toBeVisible();
  await expect(area.getByText(/Choose an operating model and confirm that customers can visit/)).toBeVisible();
  await expect(area.getByRole("button",{name:"Save branch confirmation"})).toBeDisabled();
  await area.getByRole("textbox",{name:"Confirmation reason"}).fill("Domain and phone verified");
  await page.screenshot({path:info.outputPath("new-case-confirm-gbp-branch.png"),fullPage:true});
  await area.getByRole("button",{name:"Save branch confirmation"}).click();
  await expect(area.getByRole("status")).toHaveText("Branch saved. It will apply only if the report evidence still matches.");
  await expect(page.getByRole("button",{name:"Start analysis · uses 1 credit"})).toBeEnabled();
  expect(reservations).toBe(0);
  expect(JSON.parse(await page.evaluate(() => sessionStorage.getItem("searchtrust:v2.2:new-case-draft") ?? "{}")).branch_confirmation)
    .toMatchObject({public_gbp_url:profile});
});
