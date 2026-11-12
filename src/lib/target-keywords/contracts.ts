import {sameTargetMarket} from '../report-v22/normalization';
import {casefold} from '../report-v22/normalization';
import type {TargetMarket} from '@/lib/report-v22/generated/types';

export type TargetKeyword={query:string;origin:'seo'|'system_accepted';suggestion_refs:string[]};
export type KeywordScope={primary_service:string;target_market:TargetMarket};
export type KeywordBinding={schema_version:'v22_target_keyword_binding_v1';queries:string[];queries_digest:string;planning_revision:number};
export type KeywordDraft={items:TargetKeyword[];binding:KeywordBinding|null;case_id:string|null};
export type KeywordSuggestion={query:string;source:string;ref:string};

export function checkedKeywordQueries(value:unknown):string[]|null{
 if(!Array.isArray(value)||value.length<3||value.length>5)return null;
 const queries:string[]=[];
 for(const q of value){if(typeof q!=='string')return null;const clean=q.trim();if(!clean||Array.from(clean).length>300||/[\u0000-\u001f]/.test(clean))return null;queries.push(clean);}
 return new Set(queries.map(casefold)).size===queries.length?queries:null;
}
export function parseTargetKeywords(value:unknown):TargetKeyword[]|null{
 if(!Array.isArray(value)||!checkedKeywordQueries(value.map(v=>v?.query)))return null;
 if(!value.every(v=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()==='origin,query,suggestion_refs'
  &&['seo','system_accepted'].includes(v.origin)&&Array.isArray(v.suggestion_refs)&&v.suggestion_refs.length<=10
  &&v.suggestion_refs.every((r:unknown)=>typeof r==='string'&&r.length>0&&r.length<=300)))return null;
 return value.map(v=>({...v,query:v.query.trim(),suggestion_refs:[...v.suggestion_refs]}));
}
export function validKeywordBinding(v:unknown):v is KeywordBinding{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const x=v as KeywordBinding;
 return Object.keys(x).sort().join()==='planning_revision,queries,queries_digest,schema_version'
  &&x.schema_version==='v22_target_keyword_binding_v1'&&checkedKeywordQueries(x.queries)!==null
  &&x.queries.every(q=>q===q.trim())&&/^sha256:[a-f0-9]{64}$/.test(x.queries_digest)
  &&Number.isSafeInteger(x.planning_revision)&&x.planning_revision>0&&x.planning_revision<=2147483647;
}
export async function keywordQueriesDigest(queries:string[]):Promise<string>{
 const bytes=new TextEncoder().encode(JSON.stringify(queries));
 const digest=await crypto.subtle.digest('SHA-256',bytes);
 return 'sha256:'+Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
/** Only saved signals. No provider or ranking inputs are accepted here. */
export function keywordSuggestions(scope:KeywordScope,saved:TargetKeyword[]=[],phrases:{text:string;source:string;ref:string}[]=[]):KeywordSuggestion[]{
 const city=scope.target_market.city?.trim()||scope.target_market.display_name.trim(),service=scope.primary_service.trim();
 const list:KeywordSuggestion[]=[...saved.map((k,i)=>({query:k.query,source:'Saved SEO keyword list',ref:`saved:${i}`})),
  ...[`${service} ${city}`,`best ${service} ${city}`,`${service} near me`].map((query,i)=>({query,source:'Confirmed service and market template',ref:`template:${i}`})),
  ...phrases.filter(p=>p.text.trim().length>2&&!/^(home|about(?: us)?|contact(?: us)?|privacy(?: policy)?|terms(?: of (?:use|service))?|legal(?: notice)?|cookies?(?: policy)?|welcome|untitled)$/i.test(p.text.trim()))
    .map(p=>({query:p.text.trim(),source:p.source,ref:p.ref}))];
 const seen=new Set<string>();return list.filter(s=>{const key=casefold(s.query);if(seen.has(key)||Array.from(s.query).length>300)return false;seen.add(key);return true;});
}

export function sameKeywordScope(a:KeywordScope,b:KeywordScope){return a.primary_service===b.primary_service&&sameTargetMarket(a.target_market,b.target_market);}
