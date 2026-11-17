import type {AnalysisInputManifest,GbpComparison,GbpMetric} from './generated/types';
import {readerTarget} from './reader-copy';
export const GBP_METRICS=['categories','rating','review_count','reviews_90d','latest_review','visible_replies'] as const;
export const GBP_LABELS={categories:'Categories',rating:'Rating',review_count:'Total reviews',reviews_90d:'Reviews in the last 90 days',latest_review:'Sample latest review date',visible_replies:'Sample visible replies'};
const reasons:Record<string,string>={customer_reviews_not_collected:'Not checked: customer review samples were not collected.',source_unavailable:'Not checked: the saved source did not provide a usable value.',identity_unresolved:'Not checked: the profile identity could not be confirmed.',date_unavailable:'Not checked: sample review dates could not be verified.',no_review_sample:'Not checked: no usable review sample was saved.',no_reviews:'Not applicable: the confirmed total review count is zero.'};
function text(m:GbpMetric){
 if(m.status!=='observed')return reasons[m.reason]??'Not checked in this sample.';
 if(m.denominator!=null)return `${m.numerator}/${m.denominator} sampled reviews have a visible owner reply.`;
 if(Array.isArray(m.value))return m.value.map(readerTarget).join('; ');
 if(m.lower_bound)return `At least ${m.value}`;
 return typeof m.value==='string'&&/^\d{4}-\d\d-\d\dT/.test(m.value)?m.value.slice(0,10):readerTarget(String(m.value));
}
/** All display channels receive an explicit whitelist, including PDF of an advisor preview. */
export function clientGbpComparison(value:GbpComparisonView){return {rows:value.rows.map(r=>({name:r.name,subject:r.subject,metrics:r.metrics.map(m=>({...m}))})),differences:value.differences.map(d=>({...d}))};}
export function gbpComparisonView(value:GbpComparison,clientOnly:boolean){
 return {rows:value.rows.map(row=>({name:readerTarget(row.name),subject:row.subject,metrics:GBP_METRICS.map(key=>({key,label:GBP_LABELS[key],text:text(row.metrics[key]),sampledAt:row.metrics[key].sampled_at?.slice(0,10)??null}))})),
 differences:value.differences.map(d=>({metric:d.metric,text:d.status==='observed'
  ?d.direction==='different_categories'?`${d.competitor_indices.length} checked competitors share categories not returned for the customer.`
   :`${d.competitor_indices.length} checked competitors have a ${d.direction} ${GBP_LABELS[d.metric].toLowerCase()} in the saved sample.`
  :d.reason==='customer_unchecked'?'Comparison not checked: the customer value is not available.'
   :d.reason==='comparison_time_gap'?'Comparison not checked: original sampling times are more than 24 hours apart.'
   :'Comparison not checked: fewer than two eligible competitors support a comparable difference.'})),
 ...(!clientOnly?{technical:structuredClone(value)}:{})};
}
export type GbpComparisonView=ReturnType<typeof gbpComparisonView>;
export function gbpComparisonValid(value:GbpComparison,manifest:AnalysisInputManifest){
 const sources=Object.fromEntries(manifest.snapshots.map(s=>[s.source_kind,s.snapshot_id]));
 if(value.rows[0]?.subject!=='customer'||value.rows.slice(1).some(r=>r.subject!=='competitor'))return false;
 if(value.differences.map(d=>d.metric).join()!==GBP_METRICS.join())return false;
 for(const [i,row] of value.rows.entries()){
  if(Object.keys(row.metrics).sort().join()!==[...GBP_METRICS].sort().join())return false;
  for(const key of GBP_METRICS){const m=row.metrics[key];
   const expected=i===0&&['reviews_90d','latest_review','visible_replies'].includes(key)?[]:i===0
    ?[`${sources.public_gbp}:/payload/record/fields/${key}`]
    :[`${sources.competitor}:/payload/competitors/${i-1}/${['categories','rating','review_count'].includes(key)?'public_gbp/'+key:'reviews'}`];
   if(JSON.stringify(m.source_refs)!==JSON.stringify(expected))return false;
   if((m.status==='observed')!==(m.value!=null))return false;
   if(m.sampled_at!=null&&(!/(?:Z|[+-]\d\d:\d\d)$/.test(m.sampled_at)||!Number.isFinite(Date.parse(m.sampled_at))))return false;
   if(m.denominator!=null&&(m.numerator==null||m.numerator>m.denominator||typeof m.value!=='number'||Math.abs(m.value-m.numerator/m.denominator)>1e-12))return false;
   if(m.status!=='observed'&&(m.lower_bound||m.numerator!=null||m.denominator!=null))return false;
   if(i===0&&['reviews_90d','latest_review','visible_replies'].includes(key)&&(m.status!=='not_checked'||m.reason!=='customer_reviews_not_collected'))return false;
  }
 }
 return value.differences.every(d=>{if(d.status==='not_checked')return d.direction===null&&d.competitor_indices.length===0;
  const m=value.rows[0].metrics[d.metric];if(m.status!=='observed'||!m.sampled_at||d.competitor_indices.length<2||new Set(d.competitor_indices).size!==d.competitor_indices.length||d.reason!=='same_direction')return false;
  const others=d.competitor_indices.map(i=>value.rows[i]?.metrics[d.metric]);
  if(others.some(v=>!v||v.status!=='observed'||!v.sampled_at||v.lower_bound)||m.lower_bound)return false;
  const times=[m,...others].map(v=>Date.parse(v!.sampled_at!));if(Math.max(...times)-Math.min(...times)>86400000)return false;
  return d.metric==='categories'?d.direction==='different_categories'&&Array.isArray(m.value)&&others.every(v=>Array.isArray(v!.value)&&v!.value.some(category=>!(m.value as string[]).includes(category)&&others.filter(other=>Array.isArray(other!.value)&&other!.value.includes(category)).length>=2))
   :['rating','review_count'].includes(d.metric)&&typeof m.value==='number'&&others.every(v=>typeof v!.value==='number'&&(d.direction==='higher'?v!.value>(m.value as number):d.direction==='lower'&&v!.value<(m.value as number)));
 });
}
