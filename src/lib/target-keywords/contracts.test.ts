import {expect,it,vi,afterEach} from 'vitest';
import {checkedKeywordQueries,keywordSuggestions,parseTargetKeywords,validKeywordBinding} from './contracts';
import {canonicalDigest} from '../verified-analysis-v22/digest';
import {isTargetKeywordsEnabled} from './config';
import {createNewCaseDraft,reduceWorkspaceState} from '../preflight-v22/state-machine';
import {parseDraft,loadDraft,saveDraft,NEW_CASE_DRAFT_STORAGE_KEY} from '../preflight-v22/draft';
const market={display_name:'Austin, TX',country_code:'US',region:'TX',city:'Austin',postal_code:null,latitude:null,longitude:null};
const items=['My Exact phrase','service near me','repair Austin'].map(query=>({query,origin:'seo' as const,suggestion_refs:[]}));
afterEach(()=>vi.unstubAllEnvs());
it('trims only outer whitespace, keeps spelling/near me/order, and accepts 3 or 5 terms',()=>{
 expect(checkedKeywordQueries(['  My Exact phrase  ','service near me','repair Austin'])).toEqual(items.map(k=>k.query));
 expect(checkedKeywordQueries(['a','b','c','d','e'])).toHaveLength(5);
 expect(parseTargetKeywords(items)).toEqual(items);
});
it.each([[],['a','b'],['a','b','c','d','e','f'],['','b','c'],['A','a','c'],['Straße','STRASSE','x'],['a'.repeat(301),'b','c']].map(queries=>({queries})))('rejects invalid keyword list $queries',({queries})=>{
 expect(checkedKeywordQueries(queries)).toBeNull();
});
it('orders saved SEO, templates, then explicit saved service signals without ranking inputs',()=>{
 const suggestions=keywordSuggestions({primary_service:'Plumbing',target_market:market},items,[{text:'Boiler installation',source:'Saved page H1 service phrase',ref:'site:h1'},{text:'Home',source:'Saved title',ref:'site:title'},{text:'Privacy Policy',source:'Saved title',ref:'site:title'},{text:'Terms of Use',source:'Saved H1',ref:'site:h1'}]);
 expect(suggestions.slice(0,3).map(s=>s.query)).toEqual(items.map(k=>k.query));
 expect(suggestions[3]).toMatchObject({query:'Plumbing Austin',source:'Confirmed service and market template'});
 expect(suggestions.at(-1)?.query).toBe('Boiler installation');
 expect(suggestions.some(s=>['Home','Privacy Policy','Terms of Use'].includes(s.query))).toBe(false);
});
it('creates v3 only for enabled new drafts and restores an existing v2 without adding fields',()=>{
 const old=createNewCaseDraft(),newDraft=createNewCaseDraft(undefined,undefined,{target_keywords_enabled:true});
 expect(old.schema_version).toBe('2.2-new-case-v2');expect(Object.hasOwn(old,'target_keywords')).toBe(false);
 expect(newDraft.schema_version).toBe('2.2-new-case-v3');expect(parseDraft(newDraft)).toEqual(newDraft);
 const store=new Map([[NEW_CASE_DRAFT_STORAGE_KEY,JSON.stringify({...old,prospect_workflow_id:crypto.randomUUID()})]]);
 const storage={getItem:(k:string)=>store.get(k)??null,setItem:(k:string,v:string)=>{store.set(k,v);},removeItem:(k:string)=>{store.delete(k);}};
 const restored=loadDraft(storage,new Date(),true);expect(restored.schema_version).toBe(old.schema_version);
 expect(Object.hasOwn(restored,'target_keywords')).toBe(false);
 const editing={...newDraft,target_keywords:{items:[{query:'',origin:'seo' as const,suggestion_refs:[]}],binding:null,case_id:null}};
 saveDraft(storage,editing);expect(loadDraft(storage,new Date(),true)).toEqual(editing);
});
it('locks the confirmed digest and rejects coverage word edits without changing discovery/task references',()=>{
 const binding={schema_version:'v22_target_keyword_binding_v1' as const,queries:items.map(k=>k.query),queries_digest:canonicalDigest(items.map(k=>k.query)),planning_revision:2};
 expect(validKeywordBinding(binding)).toBe(true);
 const draft={...createNewCaseDraft(undefined,undefined,{target_keywords_enabled:true}),stage:'coverage' as const,
  prospect_workflow_id:crypto.randomUUID(),target_keywords:{items,binding,case_id:crypto.randomUUID()},discovery_keywords:binding};
 expect(reduceWorkspaceState(draft,{type:'EDIT_TARGET_KEYWORDS',items:[...items].reverse()})).toBe(draft);
 expect(reduceWorkspaceState(draft,{type:'EDIT_BUSINESS'})).toBe(draft);
 expect(parseDraft({...draft,discovery_keywords:{...binding,planning_revision:0}})).toBeNull();
});
it('keeps all new entries off unless target keyword, dispatch and intake flags are explicitly enabled',()=>{
 for(const flag of ['V22_TARGET_KEYWORDS_ENABLED','V22_CAPABILITY_DISPATCH_ENABLED','V22_CAPABILITY_INTAKE_ENABLED'])vi.stubEnv(flag,'true');
 expect(isTargetKeywordsEnabled()).toBe(true);vi.stubEnv('V22_TARGET_KEYWORDS_ENABLED','');expect(isTargetKeywordsEnabled()).toBe(false);
});
