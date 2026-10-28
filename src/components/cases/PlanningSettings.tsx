"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {parsePlanningSettings,parsePlanningView,type PlanningSettingsView,type PlanningSettings as Settings} from "@/lib/planning-settings/contracts";
export type PlanningStatus={ready:boolean;revision:number|null};
const field="mt-2 block min-h-11 w-full rounded-lg border border-[#ccd9ce] bg-white p-3 text-sm disabled:opacity-60";
export function PlanningSettings({caseId,onStatus,locked=false}:{caseId:string;onStatus:(status:PlanningStatus)=>void;locked?:boolean}){
  const [saved,setSaved]=useState<PlanningSettingsView|null>(null),[draft,setDraft]=useState<Settings|null>(null),[pages,setPages]=useState("");
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
  const [dirty,setDirty]=useState(false);
  const mounted=useRef(true),saving=useRef(false),callback=useRef(onStatus);callback.current=onStatus;
  const load=useCallback(async()=>{
    if(saving.current)return;setBusy(true);callback.current({ready:false,revision:null});
    try{
      const response=await fetch(`/api/v2/cases/${caseId}/planning-settings`,{cache:"no-store"});
      const value=parsePlanningView(await response.json(),caseId);if(!response.ok||!value)throw Error();
      if(!mounted.current)return;setSaved(value);setDraft(value.settings);setPages(value.settings.target_pages.join("\n"));setDirty(false);setError("");
      callback.current({ready:true,revision:value.revision});
    }catch{if(mounted.current)setError("Could not load the saved settings. Reload before confirming a diagnosis.");}
    finally{if(mounted.current)setBusy(false);}
  },[caseId]);
  useEffect(()=>{mounted.current=true;void load();return()=>{mounted.current=false;};},[load]);
  function changed(next:Settings){setDirty(true);setDraft(next);setMessage("");setError("");callback.current({ready:false,revision:saved?.revision??null});}
  async function save(){
    if(!draft||!saved||locked||saving.current)return;
    let urls:string[];try{urls=pages.split("\n").map(s=>s.trim()).filter(Boolean).map(s=>new URL(s).toString());}catch{setError("Use complete website URLs, one per line.");return;}
    const settings=parsePlanningSettings({...draft,target_pages:urls},saved.siteUrl);
    if(!settings){setError("Use up to 20 distinct URLs on this client's website, without fragments or login details.");return;}
    saving.current=true;setBusy(true);callback.current({ready:false,revision:saved.revision});
    try{
      const response=await fetch(`/api/v2/cases/${caseId}/planning-settings`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedRevision:saved.revision,settings})});
      const data=await response.json();if(!response.ok)throw Error(data.error?.message||"Could not confirm the save. Retry the same edits before continuing.");
      const value=parsePlanningView(data,caseId);if(!value||JSON.stringify(value.settings)!==JSON.stringify(settings)){
        // Compare structures, not transport object-key ordering.
        if(!value||value.settings.priority!==settings.priority||value.settings.target_pages.join("\n")!==settings.target_pages.join("\n")
          ||value.settings.execution_conditions.capacity!==settings.execution_conditions.capacity||value.settings.execution_conditions.publishing_access!==settings.execution_conditions.publishing_access)throw Error("Could not confirm the save. Your edits are still here.");
      }
      if(!mounted.current)return;setSaved(value!);setDraft(value!.settings);setPages(value!.settings.target_pages.join("\n"));setDirty(false);setError("");setMessage("Saved for the next diagnosis. Existing reports and approved plans are unchanged.");callback.current({ready:true,revision:value!.revision});
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:"Could not save. Your edits are still here.");}
    finally{saving.current=false;if(mounted.current)setBusy(false);}
  }
  return <section aria-label="Business focus and execution conditions" className="my-6 rounded-2xl border border-[#d7e4d2] bg-[#f3f7f2] p-5 sm:p-6">
    <h2 className="text-lg font-semibold">What matters for this diagnosis?</h2>
    <p className="mt-2 text-sm leading-6 text-[#52685b]">Optional. Keep unknowns as unknowns. These settings are frozen when you confirm the scope and prepare the diagnosis—not when competitors are first discovered. Saving is free.</p>
    {!draft?<p className="mt-4 text-sm" role="status">{busy?"Loading saved settings…":"Saved settings are unavailable."}</p>:<fieldset disabled={busy||locked} className="mt-5 space-y-5">
      <legend className="sr-only">Optional planning settings</legend>
      <label className="block text-sm font-medium">Client's confirmed business focus<select className={field} value={draft.priority??"unknown"} onChange={e=>changed({...draft,priority:e.target.value==="unknown"?null:e.target.value as Settings["priority"]})}>
        <option value="unknown">Not confirmed yet</option><option value="service_visibility">Service visibility</option><option value="contact_path">Clearer contact path</option><option value="business_identity">Accurate public business details</option>
      </select></label>
      <label className="block text-sm font-medium">Confirmed target pages · optional<textarea className={field} rows={3} value={pages} onChange={e=>{setPages(e.target.value);changed(draft);}} placeholder="https://your-client.example/service/"/>
        <span className="mt-2 block font-normal leading-6 text-[#52685b]">One full URL per line, on this client's website. Leave blank if the right page still needs checking.</span></label>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">Your execution capacity<select className={field} value={draft.execution_conditions.capacity} onChange={e=>changed({...draft,execution_conditions:{...draft.execution_conditions,capacity:e.target.value as Settings["execution_conditions"]["capacity"]}})}>
          <option value="unknown">Not planned yet</option><option value="limited">Limited time for changes</option><option value="available">Time can be arranged</option></select></label>
        <label className="block text-sm font-medium">Your publishing access<select className={field} value={draft.execution_conditions.publishing_access} onChange={e=>changed({...draft,execution_conditions:{...draft.execution_conditions,publishing_access:e.target.value as Settings["execution_conditions"]["publishing_access"]}})}>
          <option value="unknown">Not confirmed yet</option><option value="needs_approval">Client approval is needed</option><option value="available">I can publish agreed changes</option></select></label>
      </div>
      <p className="text-xs leading-6 text-[#52685b]">No hours or financial returns are estimated. Limited capacity only breaks otherwise comparable ties; critical prerequisites still come first.</p>
      <button type="button" className="min-h-11 rounded-lg bg-[#26432e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={!dirty} onClick={()=>void save()}>Save planning settings</button>
      <button type="button" className="ml-3 min-h-11 px-2 text-sm underline" onClick={()=>void load()}>Reload saved settings · discard unsaved edits</button>
    </fieldset>}
    {locked?<p className="mt-4 text-sm">The submitted request keeps its saved settings. Later changes cannot rewrite that diagnosis.</p>:null}
    {error?<div className="mt-4 text-sm"><p role="alert">{error}</p><button type="button" disabled={busy||locked} onClick={()=>void load()} className="mt-2 min-h-11 underline">Reload saved settings · replaces these unsaved edits</button></div>:null}
    <p role="status" aria-live="polite" className="mt-3 text-sm">{message||(!busy&&dirty?"Unsaved changes. Save or reload before confirming the diagnosis.":"")}</p>
  </section>;
}
