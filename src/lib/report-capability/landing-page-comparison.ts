import type {AnalysisInputManifest,LandingComparison,LandingMetric} from './generated/types';
import {readerTarget} from './reader-copy';

export const LANDING_LABELS={local_entities:'Distinct target cities mentioned',case_study:'Detailed project narratives',portfolio:'Work showcase sections',credentials:'Website credential claims',service_price:'Service pricing information',discount:'Discount offers',project_budget:'Project budget statements'} as const;
export const LANDING_METRICS=Object.keys(LANDING_LABELS) as (keyof typeof LANDING_LABELS)[];
function publicUrl(value:string){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.origin+u.pathname:null;}catch{return null;}}
const comparisonCopy={bounded_counts:'Full-site page totals are not compared: these are bounded samples.',customer_unchecked:'Comparison not checked: the customer element was not verified in the saved sample.',insufficient_comparators:'Comparison not checked: fewer than two eligible competitor samples.',comparison_time_gap:'Comparison not checked: original page sampling times are more than 24 hours apart.',no_supported_difference:'No supported difference is established from these bounded samples.'};
const uncheckedReason: Partial<Record<LandingMetric['reason'], string>> = {
  not_observed_in_saved_sample: 'Not checked: the saved sample does not establish this element.',
  no_usable_pages: 'Not checked: no usable pages were saved for this website.',
  source_unavailable: 'Not checked: the website sample was unavailable.',
  identity_unresolved: 'Not checked: the site sample could not be tied to the business.',
  target_city_unavailable: 'Not checked: no confirmed target city was saved.',
};
export function landingComparisonView(value:LandingComparison,clientOnly:boolean){return {
 cityLimit:value.target_city?`Only the confirmed target city (${readerTarget(value.target_city)}) is checked; other cities, neighbourhoods and landmarks are not assessed.`:'Target city not checked: no confirmed target city was saved.',
 rows:value.rows.map(r=>({name:readerTarget(r.name),subject:r.subject,
  scope:`${r.eligible_html_count} eligible HTML pages and ${r.deep_page_count} saved deep page samples. These are not full-site totals.`,
  pageTypes:Object.entries(r.page_type_counts).filter(([,n])=>n>0).map(([label,count])=>({label:label.replaceAll('_',' '),count})),
  metrics:LANDING_METRICS.map(key=>({key,label:LANDING_LABELS[key],text:r.metrics[key].status==='observed'
   ?key==='local_entities'?'Target city observed in the saved sample.':`At least ${r.metrics[key].count} observed in the saved sample.`
   :uncheckedReason[r.metrics[key].reason]??'Not checked: the saved sample does not establish this element.'})),
  sources:[...new Set(Object.values(r.metrics).flatMap(m=>m.evidence.map(e=>publicUrl(e.url))).filter((u):u is string=>u!==null))],
 })),comparisons:value.comparisons.map(c=>({metric:c.metric,label:c.metric==='page_type_counts'?'Page sample counts':LANDING_LABELS[c.metric],classification:'Inference',text:comparisonCopy[c.reason]})),
 ...(!clientOnly?{technical:structuredClone(value)}:{}),
};}
export type LandingComparisonView=ReturnType<typeof landingComparisonView>;
/** Always whitelist PDF/shared input, even when given an advisor projection. */
export function clientLandingComparison(value:LandingComparisonView){return {cityLimit:value.cityLimit,rows:value.rows.map(r=>({name:r.name,subject:r.subject,scope:r.scope,pageTypes:r.pageTypes.map(x=>({...x})),metrics:r.metrics.map(x=>({...x})),sources:[...r.sources]})),comparisons:value.comparisons.map(c=>({...c}))};}
export function landingComparisonValid(value:LandingComparison,m:AnalysisInputManifest){
 if(value.target_city!==(m.target_market?.city??null))return false;
 const sources=Object.fromEntries(m.snapshots.map(s=>[s.source_kind,s.snapshot_id]));
 if(value.rows[0]?.subject!=='customer'||value.rows.slice(1).some(r=>r.subject!=='competitor'))return false;
 if(value.comparisons.map(c=>c.metric).join()!==['page_type_counts',...LANDING_METRICS].join())return false;
 for(const [i,r] of value.rows.entries()){
  const sid=sources[i===0?'site':'competitor']??null,prefix=i===0?'/payload':`/payload/competitors/${i-1}/site_inventory`;
  if(r.snapshot_id!==sid||r.inventory_path!==prefix||Object.keys(r.metrics).sort().join()!==[...LANDING_METRICS].sort().join())return false;
  if(Object.values(r.page_type_counts).reduce((a,b)=>a+b,0)!==r.eligible_html_count)return false;
  for(const [key,v] of Object.entries(r.metrics)){
   if((v.status==='observed')!==(v.count!==null)||v.status==='observed'&&(v.count!==v.evidence.length||!v.lower_bound||v.reason!=='saved_positive'))return false;
   if(v.status==='not_checked'&&(v.evidence.length||v.lower_bound||v.reason==='saved_positive'))return false;
   if(key==='local_entities'&&(v.count??0)>1)return false;
   if(v.evidence.some(e=>e.snapshot_id!==sid||!e.path.startsWith(prefix+'/selected_pages/')||!Number.isFinite(Date.parse(e.sampled_at))))return false;
  }
 }
 for(const c of value.comparisons){
  if(c.metric==='page_type_counts'){if(c.reason!=='bounded_counts'||c.evidence.length||c.competitor_indices.length)return false;continue;}
  const customer=value.rows[0].metrics[c.metric],eligible=value.rows.slice(1).map((r,i)=>({m:r.metrics[c.metric],i:i+1})).filter(v=>v.m.status==='observed');
  const indices=customer.status==='observed'?eligible.map(v=>v.i):[],evidence=customer.status==='observed'?[...customer.evidence,...eligible.flatMap(v=>v.m.evidence)]:[];
  const times=evidence.map(e=>Date.parse(e.sampled_at));
  const reason=customer.status!=='observed'?'customer_unchecked':eligible.length<2?'insufficient_comparators':Math.max(...times)-Math.min(...times)>86400000?'comparison_time_gap':'no_supported_difference';
  if(c.reason!==reason||JSON.stringify(c.competitor_indices)!==JSON.stringify(indices)||JSON.stringify(c.evidence)!==JSON.stringify(evidence))return false;
 }
 return true;
}
