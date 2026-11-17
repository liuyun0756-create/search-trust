import {test,expect} from './support/journey-test';
test('offline v17 reasons retain inference wording and advisor evidence',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('/e2e/possible-reasons');
 const section=page.getByRole('region',{name:'Possible contributing factors'});
 await expect(section).toBeVisible();
 await expect(section.getByText(/Sample competitor ratings:/)).toBeVisible();
 expect(await section.innerText()).toContain('may be one contributing factor');
 expect(await section.innerText()).not.toMatch(/snapshot_id|\/payload\/|latitude|landing_content_rules|v22_public\./);
 await page.screenshot({path:'output/p1-04/reasons-client.png',fullPage:true});
 await page.getByRole('link',{name:'Advisor preview'}).click();
 await section.getByText('Inspect possible reason sources').click();
 await expect(section.getByText(/"basis_refs"/)).toBeVisible();
 await page.screenshot({path:'output/p1-04/reasons-advisor.png',fullPage:true});
 expect(requests.some(url=>/serpapi|firecrawl|\/api\/v2\/analyze|prospect-workflow/.test(url))).toBe(false);
});
