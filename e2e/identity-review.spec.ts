import {test,expect} from '@playwright/test';
import {mkdir,readFile} from 'node:fs/promises';
const output='output/playwright/p1-05';
test.beforeEach(async({page})=>{
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await mkdir(output,{recursive:true});
});
for(const row of [{scenario:'volcanoes-hiking-guides',mode:'meeting_point',expected:'Street address check is not applicable',shot:'volcanoes-meeting-point'},{scenario:'pr-plumbing-fresno',mode:'hybrid',expected:'Street address check applies.',shot:'pr-hybrid'}]){
 test(`${row.scenario}: confirm identity, compare, create and approve separate delivery`,async({page})=>{
  await page.goto(`/e2e/identity-review?scenario=${row.scenario}`);
  await expect(page.getByTestId('current-address')).toContainText('Identity is not confirmed');
  const profile=page.getByLabel('Google Business Profile',{exact:true});
  if(row.mode==='meeting_point'){
   await expect(profile.locator('option')).toHaveCount(3);
   await profile.selectOption('cid:17234196230790564629');
   await expect(page.getByRole('button',{name:'Preview reassessment',exact:true})).toBeDisabled();
   await profile.selectOption('cid:16906567364961418758');
  }
  await page.getByLabel('Operating model',{exact:true}).selectOption(row.mode);
  await expect(page.getByLabel('Confirmation reason',{exact:true})).toHaveValue('');
  await expect(page.getByRole('button',{name:'Preview reassessment',exact:true})).toBeDisabled();
  await page.getByLabel('Confirmation reason',{exact:true}).fill('Confirmed with the business owner');
  await expect(page.getByText('Your choices have not been applied.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Preview reassessment',exact:true}).click();
  await expect(page.getByTestId('reassessed-address')).toContainText(row.expected,{timeout:60000});
  if(row.mode==='hybrid')await expect(page.getByTestId('reassessed-address')).toContainText('Not checked');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`${output}/${row.shot}.png`,fullPage:true});
  await expect(page.getByRole('button',{name:'Client webpage',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Create new report for approval',exact:true}).click();
  await expect(page.getByText('New report created. Approval required.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Client webpage',exact:true})).toBeDisabled();
  await page.getByLabel('I have reviewed this content').check();
  await page.getByRole('button',{name:'Approve for delivery',exact:true}).click();
  await expect(page.getByRole('button',{name:'Client webpage',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Client webpage',exact:true}).click();
  await expect(page.getByRole('region',{name:'Client webpage',exact:true})).toContainText('Reassessed from saved observations');
  await expect(page.getByRole('heading',{name:'Identity confirmation',exact:true})).toBeHidden();
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`${output}/${row.shot}-client.png`,fullPage:true});
  await page.getByRole('button',{name:'Share page',exact:true}).click();
  await expect(page.getByText('Reassessed from saved observations.',{exact:false}).last()).toBeVisible();
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Preview PDF',exact:true}).click();
  const file=`${output}/${row.shot}.pdf`;await (await downloaded).saveAs(file);
  expect((await readFile(file)).subarray(0,4).toString()).toBe('%PDF');
 });
}
test('conflict retains choices and does not label the old report reassessed',async({page})=>{
 await page.goto('/e2e/identity-review?scenario=pr-plumbing-fresno');await expect(page.getByTestId('current-address')).toBeVisible();
 await page.getByLabel('Operating model',{exact:true}).selectOption('hybrid');await page.getByLabel('Confirmation reason',{exact:true}).fill('Confirmed by owner');
 await page.route('**/e2e/identity-review/session?*',async route=>{const b=route.request().postDataJSON();if(b.operation==='preview')await route.fulfill({status:409,contentType:'application/json',body:'{"code":"CONFLICT"}'});else await route.continue();});
 await page.getByRole('button',{name:'Preview reassessment',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Your choices are retained'})).toBeVisible();
 await expect(page.getByLabel('Operating model',{exact:true})).toHaveValue('hybrid');await expect(page.getByLabel('Confirmation reason',{exact:true})).toHaveValue('Confirmed by owner');
 await expect(page.getByRole('button',{name:'Create new report for approval',exact:true})).toHaveCount(0);
});

test('PR explicit visit confirmation is branch-scoped, records provenance and preserves the real parse failure',async({page})=>{
 await page.goto('/e2e/identity-review?scenario=pr-plumbing-fresno');
 await expect(page.getByTestId('current-address')).toBeVisible();
 const mode=page.getByLabel('Operating model',{exact:true}),profile=page.getByLabel('Google Business Profile',{exact:true});
 const tick=page.getByLabel('Customers can visit this Google Business Profile address',{exact:true});
 const reason=page.getByLabel('Confirmation reason',{exact:true}),preview=page.getByRole('button',{name:'Preview reassessment',exact:true});
 await expect(reason).toHaveValue('');await expect(reason).toHaveAttribute('required','');await expect(preview).toBeDisabled();
 await expect(tick).toHaveCount(0);
 await mode.selectOption('hybrid');await expect(tick).not.toBeChecked();
 const branch=await profile.inputValue();await profile.selectOption('');await expect(tick).toHaveCount(0);
 await profile.selectOption(branch);await expect(tick).not.toBeChecked();await tick.check();
 await mode.selectOption('service_area');await expect(tick).toHaveCount(0);
 await mode.selectOption('meeting_point');await expect(tick).toHaveCount(0);
 await mode.selectOption('storefront');await expect(tick).not.toBeChecked();await tick.check();
 await mode.selectOption('hybrid');await expect(tick).not.toBeChecked();await tick.check();
 await profile.selectOption('');await profile.selectOption(branch);await expect(tick).not.toBeChecked();
 await reason.fill('   ');await expect(preview).toBeDisabled();
 await reason.fill('Owner confirms that customers can visit the selected GBP address.');
 await preview.click();await expect(page.getByTestId('reassessed-address')).toContainText('Not checked',{timeout:60000});
 await tick.check();await expect(page.getByTestId('reassessed-address')).toHaveCount(0);
 const response=page.waitForResponse(r=>r.url().includes('/e2e/identity-review/session?')&&r.request().postDataJSON()?.operation==='preview');
 await preview.click();const result=await (await response).json();
 expect(result.selection.customers_can_visit).toBe(true);
 expect(result.identity.operating_location.role).toBe('customer_facing');expect(result.identity.operating_location.state).toBe('seo_confirmed');
 expect(result.identity.operating_location.confirmation_ref.confirmed_by).toBe(result.report.input_manifest.user_id);
 expect(result.identity.operating_location.confirmation_ref.confirmed_at).toBe(result.report.input_manifest.evaluated_at);
 expect(result.identity.operating_location.confirmation_ref.selected_branch_ref).toBe(branch.split(':')[1]);
 expect(result.report.contact_checks.find((c:{field:string})=>c.field==='address')).toMatchObject({status:'not_checked',result:'none'});
 await expect(page.getByTestId('reassessed-address')).toContainText('Not checked');
 await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${output}/pr-hybrid-visit-confirmed.png`,fullPage:true});
 await page.getByRole('button',{name:'Create new report for approval',exact:true}).click();
 await expect(page.getByText('New report created. Approval required.',{exact:true})).toBeVisible();
});
