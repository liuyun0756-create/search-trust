import type {AnalysisInputManifest, KeywordVisibility, KeywordPosition, KeywordAssessment} from './generated/types';

export const FIRST_PAGE_ABSENT = 'Not observed on the first page of the sampled results.';
function grade(k:number,h:number){return k<2?'not_assessed':3*h>=2*k?'strong':3*h>=k?'medium':'weak';}
export function keywordVisibilityValid(v:KeywordVisibility,m:AnalysisInputManifest){
  if(JSON.stringify(v.rows.map(r=>r.query))!==JSON.stringify(m.keyword_queries))return false;
  const source=m.snapshots.find(s=>s.source_kind==='serp');
  if(!source || v.sample.snapshot_id!==source.snapshot_id || v.sample.payload_checksum!==source.payload_checksum)return false;
  for(const channel of ['local_pack','organic'] as const){
    const k=v.rows.filter(r=>r[channel].status!=='not_checked').length;
    const h=v.rows.filter(r=>r[channel].status==='observed').length,a=v[channel];
    if(a.checked_keywords!==k||a.observed_keywords!==h||a.total_keywords!==v.rows.length
      ||a.assessment!==grade(k,h)||a.ratio!==(k>=2?h/k:null))return false;
  }
  return v.rows.every(r=>(['organic','local_pack','maps'] as const).every(c=>{
    const p=r[c],observed=p.status==='observed';
    return observed ? Number.isInteger(p.position)&&p.position!>0&&!!p.rank_source&&p.reason==='observed'&&p.record_ids.length>0
      :p.position===null&&p.rank_source===null&&p.record_ids.length===0&&(p.status==='not_detected')===(p.reason==='first_page_absent');
  }));
}
function position(p:KeywordPosition,channel:'organic'|'local_pack'|'maps'){
  return {status:p.status,text:p.status==='observed'
    ?p.rank_source==='response_order'?`Position ${p.position} in the returned sample.`:`Observed position: ${p.position}`
    :p.status==='not_detected'?channel==='organic'?FIRST_PAGE_ABSENT:channel==='local_pack'
      ?'Not observed in the sampled Map Pack.':'Not observed in the sampled Maps results.'
    :'Not checked in this sample.'};
}
function assessment(a:KeywordAssessment){return {
  label:{strong:'Strong visibility in the checked sample.',medium:'Medium visibility in the checked sample.',weak:'Weak visibility in the checked sample.',not_assessed:'Not assessed.'}[a.assessment],
  coverage:`${a.checked_keywords}/${a.total_keywords} keywords checked`,
};}
export function keywordVisibilityView(v:KeywordVisibility,clientOnly:boolean){
 return {rows:v.rows.map(r=>({query:r.query,localPack:position(r.local_pack,'local_pack'),organic:position(r.organic,'organic'),
   ...(!clientOnly?{maps:position(r.maps,'maps')}:{}),
 })),localPack:assessment(v.local_pack),organic:assessment(v.organic),
 ...(!clientOnly?{technical:{sample:structuredClone(v.sample),rows:structuredClone(v.rows),localPack:structuredClone(v.local_pack),organic:structuredClone(v.organic)}}:{}),
 };
}
export type KeywordVisibilityView=ReturnType<typeof keywordVisibilityView>;
/** Explicit whitelist even when an owner preview supplied an advisor projection. */
export function clientKeywordVisibility(v:KeywordVisibilityView){return {
 rows:v.rows.map(r=>({query:r.query,localPack:{...r.localPack},organic:{...r.organic}})),
 localPack:{...v.localPack},organic:{...v.organic},
};}
