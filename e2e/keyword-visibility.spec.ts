import {test,expect} from './support/journey-test';

test('first-page keyword client and advisor views stay separate without provider calls',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('/e2e/keyword-visibility');
 const section=page.getByRole('region',{name:'Target keyword visibility'});
 await expect(section).toBeVisible();
 await expect(section.getByText('Not observed on the first page of the sampled results.')).toBeVisible();
 await expect(section.getByText('Not checked in this sample.')).toHaveCount(2);
 await expect(section.getByText('Medium visibility in the checked sample. 2/3 keywords checked')).toHaveCount(2);
 expect(await section.innerText()).not.toMatch(/Google Maps reference|provider_position|latitude|snapshot_id|"ratio"|\/payload\//);
 await expect(page.getByRole('button',{name:/Start analysis|Generate Prospect report|Approve/})).toHaveCount(0);
 await page.screenshot({path:'output/p1-01/keyword-client.png',fullPage:true});
 await page.getByRole('link',{name:'Advisor preview'}).click();
 await expect(section.getByRole('heading',{name:'Google Maps reference · advisor only'})).toBeVisible();
 await section.getByText('Inspect keyword sampling conditions').click();
 await expect(section.getByText(/"latitude"/)).toBeVisible();
 await page.screenshot({path:'output/p1-01/keyword-advisor.png',fullPage:true});
 expect(requests.some(url=>/serpapi|firecrawl|\/api\/v2\/analyze|prospect-workflow/.test(url))).toBe(false);
});
