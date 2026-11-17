import {test,expect} from './support/journey-test';
test('offline v16 landing comparison keeps bounded samples and advisor sources separate',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('/e2e/landing-comparison');
 const section=page.getByRole('region',{name:'Landing page comparison'});
 await expect(section).toBeVisible();
 await expect(section.getByText('Website credential claims',{exact:true})).toBeVisible();
 expect(await section.innerText()).toContain('not full-site totals');
 expect(await section.innerText()).not.toMatch(/snapshot_id|\/payload\/|latitude|landing_content_rules|v22_public\./);
 await page.screenshot({path:'output/p1-03/landing-client.png',fullPage:true});
 await page.getByRole('link',{name:'Advisor preview'}).click();
 await section.getByText('Inspect landing page comparison sources').click();
 await expect(section.getByText(/"snapshot_id"/)).toBeVisible();
 await page.screenshot({path:'output/p1-03/landing-advisor.png',fullPage:true});
 expect(requests.some(url=>/serpapi|firecrawl|\/api\/v2\/analyze|prospect-workflow/.test(url))).toBe(false);
});
