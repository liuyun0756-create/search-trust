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
 return {schema_version:'possible_reasons_v1',status:items.length?'assessed':'not_assessed',items:items as PossibleReasons['items']};
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
