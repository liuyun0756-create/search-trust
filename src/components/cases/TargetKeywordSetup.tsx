'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {parsePlanningView,type PlanningSettingsView,type PlanningSettingsV2} from '@/lib/planning-settings/contracts';
import {keywordQueriesDigest,keywordSuggestions,parseTargetKeywords,sameKeywordScope,type KeywordDraft,type KeywordScope,type TargetKeyword} from '@/lib/target-keywords/contracts';
import type {PreflightResponse} from '@/lib/preflight-v22';

const field='min-h-11 w-full rounded-lg border border-[#ccd9ce] bg-white px-3 py-2 text-sm';
export function TargetKeywordSetup({caseId,scope,preflight,value,onEdit,onConfirm,onBack,onRetryCase,caseMessage,profileUrl}:{
 caseId:string|null;scope:KeywordScope;preflight:PreflightResponse;value:KeywordDraft|null;profileUrl:string|null;
 onEdit:(items:TargetKeyword[])=>void;onConfirm:(value:KeywordDraft)=>void;onBack:()=>void;onRetryCase:()=>void;caseMessage:string;
}){
 const [saved,setSaved]=useState<PlanningSettingsView|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [confirmed,setConfirmed]=useState(false),[loaded,setLoaded]=useState(false);
 const callback=useRef(onEdit);callback.current=onEdit;
 const sequence=useRef(0);
 const current=useRef(value);current.current=value;
 // Service candidates already extracted by the free preflight; no new provider request.
 const phrases=(preflight.target_keyword_suggestions?.items??[])
  .filter(p=>p.source!=='matched_gbp_category'||(p.profile_url!==null&&p.profile_url.replace(/\/$/,'')===profileUrl?.replace(/\/$/,'')))
  .map(p=>({text:p.text,source:{matched_gbp_category:'Matched GBP category',site_title:'Saved page title service phrase',site_h1:'Saved page H1 service phrase'}[p.source],ref:p.ref}));
 const savedItems=saved?.settings.schema_version==='v22_planning_settings_v2'&&sameKeywordScope(saved.settings.keyword_scope,scope)?saved.settings.target_keywords:[];
 const suggestions=keywordSuggestions(scope,savedItems,phrases);
 const items=value?.items??[];
 const load=useCallback(async(replace=false)=>{
  if(!caseId)return;const version=++sequence.current;setBusy(true);setError('');setLoaded(false);
  try{
   const response=await fetch(`/api/v2/cases/${caseId}/planning-settings`,{cache:'no-store'});
   const view=parsePlanningView(await response.json(),caseId);if(!response.ok||!view)throw Error('Saved keyword settings could not be loaded. Retry loading before continuing.');
   if(version!==sequence.current)return;setSaved(view);setLoaded(true);
   const prior=view.settings.schema_version==='v22_planning_settings_v2'&&sameKeywordScope(view.settings.keyword_scope,scope)?view.settings.target_keywords:[];
   if(replace||!current.current?.items.length){
    const proposed=keywordSuggestions(scope,prior).slice(0,prior.length||3).map(s=>({query:s.query,origin:'system_accepted' as const,suggestion_refs:[s.ref]}));
    callback.current(proposed);
   }
  }catch(e){if(version===sequence.current)setError(e instanceof Error?e.message:'Saved keyword settings could not be loaded. Retry loading before continuing.');}
  finally{if(version===sequence.current)setBusy(false);}
 },[caseId,scope]);
 useEffect(()=>{void load();return()=>{sequence.current++;};},[load]);
 function edit(next:TargetKeyword[]){setConfirmed(false);setError('');onEdit(next);}
 async function save(){
  if(busy||!saved||!loaded||!caseId)return;
  const keywords=parseTargetKeywords(items);
  if(!keywords||!confirmed){setError('Confirm 3–5 distinct, nonblank keywords, each no longer than 300 characters.');return;}
  const version=sequence.current;setBusy(true);setError('');
  try{
   const base=saved.settings;
   const settings:PlanningSettingsV2={schema_version:'v22_planning_settings_v2',priority:base.priority,target_pages:base.target_pages,execution_conditions:base.execution_conditions,
    target_keywords:keywords,keyword_scope:scope,keyword_confirmation:null};
   const response=await fetch(`/api/v2/cases/${caseId}/planning-settings`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({expectedRevision:saved.revision,settings})});
   const payload=await response.json();
   if(!response.ok)throw Error(response.status===409?'Saved settings changed in another page. Reload saved settings, compare your edits and confirm again.':payload?.error?.message||'Target keywords could not be saved. Retry confirmation; your edits are kept.');
   const view=parsePlanningView(payload,caseId);
   if(!view||view.settings.schema_version!=='v22_planning_settings_v2'||!view.settings.keyword_confirmation||!sameKeywordScope(view.settings.keyword_scope,scope)
    ||JSON.stringify(view.settings.target_keywords.map(k=>[k.query,k.origin,k.suggestion_refs]))!==JSON.stringify(keywords.map(k=>[k.query,k.origin,k.suggestion_refs])))throw Error('The keyword save could not be confirmed. Retry confirmation; your edits are kept.');
   const queries=keywords.map(k=>k.query),digest=await keywordQueriesDigest(queries);
   if(version!==sequence.current)return;
   onConfirm({items:keywords,case_id:caseId,binding:{schema_version:'v22_target_keyword_binding_v1',queries,queries_digest:digest,planning_revision:view.revision}});
  }catch(e){setError(e instanceof Error?e.message:'Target keywords could not be saved. Retry confirmation; your edits are kept.');}
  finally{setBusy(false);}
 }
 return <section aria-label="Target keyword setup" className="space-y-6">
  <div><p className="text-xs font-bold text-[#718218]">02 / Confirm the business and target keywords</p><h1 className="mt-3 text-3xl font-semibold">Target keywords (3–5)</h1>
   <p className="mt-3 text-sm">{scope.primary_service} · {scope.target_market.display_name}</p>
   <p className="mt-2 text-sm text-[#52685b]">Edit and order the exact queries to sample. Suggestions need SEO confirmation; they do not indicate search volume or ranking. Saving is free.</p></div>
  {!caseId?<div><p role="status">{caseMessage}</p><button type="button" onClick={onRetryCase} className="min-h-11 underline">Retry saving Case</button></div>:null}
  {caseId&&busy&&!saved?<p role="status">Loading saved keyword settings…</p>:null}
  <fieldset disabled={!caseId||!loaded||busy} className="space-y-3">
   <legend className="sr-only">Ordered target keywords</legend>
   {items.map((item,index)=><div key={index} className="rounded-xl border border-[#d7e4d2] bg-white p-4">
    <label className="block text-sm font-semibold">Target keyword {index+1}<input className={field+' mt-2'} value={item.query} onChange={e=>edit(items.map((k,i)=>i===index?{query:e.target.value,origin:'seo',suggestion_refs:[]}:k))}/></label>
    <p className="mt-2 text-xs">Pending SEO confirmation · {item.origin==='seo'?'SEO entered':item.suggestion_refs.map(ref=>suggestions.find(s=>s.ref===ref)?.source??(ref.startsWith('saved:')?'Saved SEO keyword list':ref.startsWith('template:')?'Confirmed service and market template':'Saved preflight service phrase')).join('; ')}</p>
    <div className="mt-2 flex gap-3 text-sm"><button type="button" disabled={index===0} aria-label={`Move keyword ${index+1} up`} onClick={()=>{const next=[...items];[next[index-1],next[index]]=[next[index],next[index-1]];edit(next);}}>Move up</button>
     <button type="button" disabled={index===items.length-1} aria-label={`Move keyword ${index+1} down`} onClick={()=>{const next=[...items];[next[index+1],next[index]]=[next[index],next[index+1]];edit(next);}}>Move down</button>
     <button type="button" aria-label={`Remove keyword ${index+1}`} onClick={()=>edit(items.filter((_,i)=>i!==index))}>Remove</button></div>
   </div>)}
   <button type="button" disabled={items.length>=5} onClick={()=>edit([...items,{query:'',origin:'seo',suggestion_refs:[]}])} className="min-h-11 underline">Add target keyword</button>
   <details className="rounded-xl bg-[#edf3e8] p-4"><summary>Suggestions · pending SEO confirmation</summary><ul className="mt-3 space-y-3">{suggestions.map(s=><li key={s.ref} className="text-sm"><span>{s.query} · {s.source} · Pending SEO confirmation</span> <button type="button" disabled={items.length>=5} className="underline" onClick={()=>edit([...items,{query:s.query,origin:'system_accepted',suggestion_refs:[s.ref]}])}>Add suggestion</button></li>)}</ul></details>
   <label className="flex gap-3 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm these exact target keywords and their order.</label>
   <button type="button" disabled={!confirmed||!parseTargetKeywords(items)} onClick={()=>void save()} className="min-h-11 rounded-lg bg-[#26432e] px-5 text-sm font-semibold text-white disabled:opacity-50">{busy?'Saving target keywords…':'Confirm target keywords & continue'}</button>
  </fieldset>
  {(!parseTargetKeywords(items)&&loaded)?<p role="status" className="text-sm">Use 3–5 distinct, nonblank keywords, each no longer than 300 characters.</p>:null}
  {error?<div><p role="alert">{error}</p><button type="button" disabled={busy} onClick={()=>void load(false)} className="min-h-11 underline">Reload saved settings · keep my keyword edits</button>{loaded&&confirmed?<button type="button" disabled={busy} onClick={()=>void save()} className="ml-4 min-h-11 underline">Retry keyword confirmation</button>:null}</div>:null}
  <button type="button" disabled={busy} onClick={onBack} className="min-h-11 underline">Edit business scope</button>
 </section>;
}
