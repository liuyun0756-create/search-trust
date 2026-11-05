import {test,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const artifacts='output/playwright/p1-07';
test.beforeEach(async({page})=>{
 await mkdir(artifacts,{recursive:true});
 await page.setViewportSize({width:1440,height:1200});
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(['127.0.0.1','localhost'].includes(u.hostname))await route.continue();else await route.abort();});
});
test('five candidates: compare, acknowledge, approve, client/share/PDF',async({page})=>{
 await page.goto('/e2e/capability-candidates');
 const pool=page.getByRole('region',{name:'Other candidates'});
 await expect(pool).toBeVisible();await expect(pool.getByText('Advisor only · verification needed')).toBeVisible();
 await pool.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-110));
 await pool.screenshot({path:`${artifacts}/01-candidates.png`});
 await pool.getByRole('article',{name:'Synthetic CTA review 3'}).getByRole('button',{name:'Compare replacement'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').screenshot({path:`${artifacts}/02-comparison.png`});
 await page.getByRole('button',{name:'Confirm replacement'}).click();
 await expect(page.getByRole('heading',{name:'Technical issue will be omitted'})).toBeVisible();await page.getByRole('dialog').screenshot({path:`${artifacts}/03-warning.png`});
 await page.getByRole('button',{name:'Acknowledge and continue'}).click();
 await expect(page.getByLabel('Action title',{exact:true})).toHaveCount(3);
 await page.getByLabel('I have reviewed this content').check();await page.getByRole('button',{name:'Approve for delivery',exact:true}).click();
 await expect(page.getByText('Revision 1 approved for delivery.')).toBeVisible();
 for(const [button,file] of [['Client webpage','04-client.png'],['Share page','05-share.png']]){
  await page.getByRole('button',{name:button,exact:true}).click();await expect(pool).not.toBeVisible();
  await expect(page.getByRole('heading',{name:'01 · Synthetic CTA review 3',exact:true})).toBeVisible();
  await expect(page.getByText('Advisor-selected action',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Other candidates (2)'})).not.toBeVisible();
  await page.screenshot({path:`${artifacts}/${file}`,fullPage:true});
 }
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();await (await download).saveAs(`${artifacts}/06-approved.pdf`);
});
test('weak candidate is hidden until explicitly included; dependencies cannot be bypassed',async({page})=>{
 await page.goto('/e2e/capability-candidates');const card=page.getByRole('article',{name:'Synthetic CTA review 4'});
 await card.getByRole('combobox').selectOption('2');await card.getByRole('button',{name:'Compare replacement'}).click();await page.getByRole('button',{name:'Confirm replacement'}).click();
 await expect(page.getByLabel('Include action 3 in client report')).not.toBeChecked();
 await page.getByLabel('Include action 3 in client report').check();await page.getByLabel('I have reviewed this content').check();await page.getByRole('button',{name:'Approve for delivery',exact:true}).click();
 await expect(page.getByText('Revision 1 approved for delivery.')).toBeVisible();await page.getByRole('button',{name:'Client webpage',exact:true}).click();await expect(page.getByRole('heading',{name:'03 · Synthetic CTA review 4',exact:true})).toBeVisible();
 await page.goto('/e2e/capability-candidates?scenario=dependencies');
 await expect(page.getByRole('article',{name:'Synthetic CTA review 3'}).getByRole('button',{name:'Compare replacement'})).toBeDisabled();
 await page.getByLabel('Include action 1 in client report').click();await expect(page.getByLabel('Include action 1 in client report')).toBeChecked();
});


test('real Seamless v12: low name correction is advisor-only until explicitly included, then delivered on all surfaces',async({page})=>{
 await page.setViewportSize({width:1440,height:3400});
 const replayPath=`${artifacts}/seamless-v12.json`,before=await readFile(replayPath);
 const report=JSON.parse(before.toString()),nameFinding=report.findings.find((f:{rule_id:string})=>f.rule_id==='v22_public.gbp_name_alignment');
 expect(nameFinding.confidence).toBe('low');
 const candidate=report.action_candidates.find((a:{finding_ids:string[]})=>a.finding_ids.includes(nameFinding.id));
 expect(report.actions.map((a:{id:string})=>a.id)).not.toContain(candidate.id);
 await page.goto('/e2e/capability-candidates?scenario=seamless');
 const pool=page.getByRole('region',{name:'Other candidates'}),card=pool.getByRole('article',{name:candidate.title});
 await expect(card.getByText('Business name correction',{exact:true})).toBeVisible();
 await expect(card.getByText('Advisor only · verification needed',{exact:true})).toBeVisible();
 await expect(card).not.toContainText(/[\u3400-\u9fff]/);
 await expect(card.getByText('System rank 3 · Confidence: low')).toBeVisible();
 await pool.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-110));
 await pool.screenshot({path:`${artifacts}/seamless-01-candidate.png`});
 // Unchanged approval proves the real default still excludes the low candidate.
 await page.getByLabel('I have reviewed this content').check();await page.getByRole('button',{name:'Approve for delivery',exact:true}).click();
 await expect(page.getByText('Revision 1 approved for delivery.')).toBeVisible();
 await page.getByRole('button',{name:'Client webpage',exact:true}).click();
 await expect(page.getByRole('region',{name:'Action plan'}).getByRole('heading',{name:new RegExp(candidate.title)})).toHaveCount(0);
 await page.getByRole('button',{name:'Review candidates',exact:true}).click();
 await card.getByRole('combobox').selectOption('0');await card.getByRole('button',{name:'Compare replacement'}).click();
 await page.getByRole('dialog').screenshot({path:`${artifacts}/seamless-02-comparison.png`});
 await page.getByRole('button',{name:'Confirm replacement'}).click();
 await expect(page.getByLabel('Action title',{exact:true})).toHaveCount(2);
 const include=page.getByLabel('Include action 1 in client report');await expect(include).not.toBeChecked();
 await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.getByText('Draft revision 2 saved. Not approved for delivery.')).toBeVisible();
 await include.check();
 const selected=include.locator('xpath=ancestor::section[1]');
 await selected.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-110));
 await selected.screenshot({path:`${artifacts}/seamless-03-included.png`});
 await page.getByLabel('I have reviewed this content').check();
 const approvedResponse=page.waitForResponse(response=>response.url().endsWith('/e2e/capability-candidates/session')&&response.request().postDataJSON()?.content?.status==='approved');
 await page.getByRole('button',{name:'Approve for delivery',exact:true}).click();
 const approved=await (await approvedResponse).json();
 await expect(page.getByText('Revision 3 approved for delivery.')).toBeVisible();
 expect(approved.content.actions).toHaveLength(2);expect(approved.content.client_action_ids).toContain(candidate.id);
 expect(approved.delivery.document.actions.find((a:{id:string})=>a.id===candidate.id).needsVerification).toBe(true);
 await writeFile(`${artifacts}/seamless-approved.json`,JSON.stringify(approved));
 for(const [button,file] of [['Client webpage','seamless-04-client.png'],['Share page','seamless-05-share.png']]){
  await page.getByRole('button',{name:button,exact:true}).click();await expect(pool).not.toBeVisible();
  const plan=page.getByRole('region',{name:'Action plan'});
  await expect(plan.getByRole('heading',{name:`01 · ${candidate.title}`,exact:true})).toBeVisible();
  await expect(plan.getByText('Advisor-selected action',{exact:true})).toBeVisible();
  await expect(plan.getByText(/Observed: The eligible website business name does not align/)).toBeVisible();
  await expect(plan.getByRole('heading',{level:3})).toHaveCount(2);
  await plan.evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-110));
  await plan.screenshot({path:`${artifacts}/${file}`});
 }
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).click();
 await (await download).saveAs(`${artifacts}/seamless-06-approved.pdf`);
 expect((await readFile(`${artifacts}/seamless-06-approved.pdf`)).subarray(0,4).toString()).toBe('%PDF');
 expect(createHash('sha256').update(await readFile(replayPath)).digest('hex')).toBe(createHash('sha256').update(before).digest('hex'));
});
