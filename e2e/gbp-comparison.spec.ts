import {test,expect} from './support/journey-test';
test('offline v15 comparison shows bounded samples and keeps advisor details private',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('/e2e/gbp-comparison');
 const section=page.getByRole('region',{name:'Google Business Profile comparison'});
 await expect(section).toBeVisible();await expect(section.getByRole('cell').filter({hasText:/^At least 30/})).toHaveCount(3);
 await expect(section.getByRole('cell').filter({hasText:/^20\/30 sampled reviews have a visible owner reply\./})).toHaveCount(3);
 await expect(section.getByText('Not checked: customer review samples were not collected.',{exact:true})).toHaveCount(3);
 expect(await section.innerText()).not.toMatch(/source_refs|\/payload\/|latitude|provider_|req_|v22_public\./);
 await page.screenshot({path:'output/p1-02/gbp-client.png',fullPage:true});
 await page.getByRole('link',{name:'Advisor preview'}).click();
 await section.getByText('Inspect profile comparison sources').click();
 await expect(section.getByText(/"source_refs"/)).toBeVisible();
 await page.screenshot({path:'output/p1-02/gbp-advisor.png',fullPage:true});
 expect(requests.some(url=>/serpapi|firecrawl|\/api\/v2\/analyze|prospect-workflow/.test(url))).toBe(false);
});
