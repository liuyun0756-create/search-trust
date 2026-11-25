import type {CapabilityReport,PossibleReasons,PossibleReason} from './generated/types';

const disclaimer='This difference may be one contributing factor. These observations do not establish ranking causation.';
export function expectedPossibleReasons(report:Pick<CapabilityReport,'gbp_comparison'|'landing_page_comparison'>):PossibleReasons{
 const g=report.gbp_comparison,items:PossibleReason[]=[];
 if(g&&report.landing_page_comparison){for(const metric of ['rating','review_count'] as const){
  const index=g.differences.findIndex(d=>d.metric===metric),d=g.differences[index];
  if(!d||d.status!=='observed'||d.direction!=='higher'||d.competitor_indices.length<2)continue;
  const values=[g.rows[0],...d.competitor_indices.map(i=>g.rows[i])].map(r=>r.metrics[metric]);
  if(values.some(v=>!v.source_refs.length))continue;
  const label=metric==='rating'?'ratings':'review totals',own=metric==='rating'?'rating':'review total';
  items.push({metric,classification:'inference',competitor_indices:d.competitor_indices as PossibleReason["competitor_indices"],
   basis_refs:[`/gbp_comparison/differences/${index}`,...values.flatMap(v=>v.source_refs)] as PossibleReason["basis_refs"],
   customer_text:`Sample competitor ${label}: ${values.slice(1).map(v=>String(v.value)).join(', ')}; your ${own}: ${values[0].value}. ${disclaimer}`});
 }}
 if(g?.schema_version==='gbp_comparison_v2'&&report.landing_page_comparison){
  const recent=g.differences[3], latest=g.differences[4];
  const latestIndices = new Set<number>(latest.competitor_indices);
  const indices = recent.competitor_indices.filter(index => latestIndices.has(index)).sort((a, b) => a - b);
  if(recent.direction==='higher'&&latest.direction==='higher'&&indices.length>=2){
   const rows=[g.rows[0],...indices.map(i=>g.rows[i])], counts=rows.map(r=>r.metrics.reviews_90d), dates=rows.map(r=>r.metrics.latest_review);
   const numbers=counts.slice(1).map(v=>(v.lower_bound?'at least ':'')+String(v.value)).join(', ');
   const dateList=dates.slice(1).map(v=>String(v.value).slice(0,10)).join(', ');
   items.push({metric:'recent_review_activity',classification:'inference',competitor_indices:indices as PossibleReason['competitor_indices'],
    basis_refs:['/gbp_comparison/differences/3','/gbp_comparison/differences/4',...[...counts,...dates].flatMap(v=>v.source_refs)] as PossibleReason['basis_refs'],
    customer_text:`Sample competitors had ${numbers} reviews in their 90-day windows and sample latest dates of ${dateList}. Your profile had ${counts[0].value} reviews in its sampled 90-day window and a sample latest date of ${String(dates[0].value).slice(0,10)}. ${disclaimer}`});
  }
 }
 return {schema_version:g?.schema_version==='gbp_comparison_v2'?'possible_reasons_v2':'possible_reasons_v1',
  status:items.length?'assessed':'not_assessed',items:items as PossibleReasons['items']};
}
export function possibleReasonsValid(report:CapabilityReport){
 // Existing GBP and landing validators independently verify all source gates first.
 const actual=report.possible_reasons,expected=expectedPossibleReasons(report);
 return !!actual&&actual.schema_version===expected.schema_version&&actual.status===expected.status&&
  actual.items.length===expected.items.length&&actual.items.every((v,i)=>{const e=expected.items[i];return v.metric===e.metric&&v.classification===e.classification&&v.customer_text===e.customer_text&&JSON.stringify(v.basis_refs)===JSON.stringify(e.basis_refs)&&JSON.stringify(v.competitor_indices)===JSON.stringify(e.competitor_indices);});
}
export function possibleReasonsView(value:PossibleReasons,clientOnly:boolean){return {status:value.status,items:value.items.map(item=>({text:item.customer_text})),...(!clientOnly?{technical:structuredClone(value)}:{})};}
export type PossibleReasonsView=ReturnType<typeof possibleReasonsView>;
export function clientPossibleReasons(value:PossibleReasonsView){return {status:value.status,items:value.items.map(item=>({text:item.text}))};}
