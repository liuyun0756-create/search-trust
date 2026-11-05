'use client';
import {useRef,useState} from 'react';
import type {CapabilityReport,DeliveryRevision} from '@/lib/report-capability/generated/types';
import type {ApprovedCapabilityDelivery} from '@/lib/report-capability/delivery';
import {deliveryOrderConstraints} from '@/lib/report-capability/order';
import {CapabilityDeliveryEditor, type CapabilitySaveResult} from '@/components/report/CapabilityDeliveryEditor';
import {CapabilityReportDocument} from '@/components/report/CapabilityReportDocument';
import {CapabilitySharedReport} from '@/components/report/CapabilitySharedReport';
import {saveCapabilityPdf} from '@/components/report/CapabilityDeliveryActions';
export function CandidatePreview({report,initial,scenario}:{report:CapabilityReport;initial:DeliveryRevision;scenario:string}){
  const [view,setView]=useState('review'),[delivery,setDelivery]=useState<ApprovedCapabilityDelivery|null>(null),[error,setError]=useState('');
  const revision=useRef(0),approved=useRef<DeliveryRevision|null>(null);
  async function pdf(){return fetch('/e2e/capability-candidates/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario,content:approved.current,pdf:true})});}
  async function save(content:DeliveryRevision):Promise<CapabilitySaveResult>{
    if(content.expected_revision!==revision.current)return {ok:false,code:'CAPABILITY_CONFLICT'};
    const response=await fetch('/e2e/capability-candidates/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario,content})});
    const result=await response.json();if(result.ok){revision.current=result.revision;if(result.delivery){approved.current=content;setDelivery(result.delivery);}}return result;
  }
  return <main className="min-h-screen bg-[#fafbf8] px-4 py-8 text-[#1d2a22]"><div className="mx-auto max-w-5xl">
    <header className="mb-8 space-y-3"><p className="text-sm font-semibold uppercase tracking-wider">{scenario==='seamless'?'Seamless · real frozen-input v12 replay · no external calls':'Local synthetic preview · no external calls'}</p><h1 className="text-3xl font-semibold">Candidate review playground</h1><p>{scenario==='seamless'?'Three real candidates, two selected slots. The business-name correction remains low confidence and advisor-only by default.':'Five candidates, three selected slots, one weak candidate.'} Save and approve to open the client views. State lasts for this page session; refreshing resets it.</p><nav className="flex flex-wrap gap-3" aria-label="Preview views">{['review','client','share'].map(v=><button key={v} disabled={v!=='review'&&!delivery} aria-pressed={view===v} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-40" onClick={()=>setView(v)}>{v==='review'?'Review candidates':v==='client'?'Client webpage':'Share page'}</button>)}<button disabled={!delivery} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-40" onClick={async()=>{try{await saveCapabilityPdf(await pdf());}catch{setError('PDF could not be generated.');}}}>Preview PDF</button></nav><p role="status">{error}</p></header>
    <div hidden={view!=='review'}><CapabilityDeliveryEditor initial={initial} onSave={save} orderConstraints={deliveryOrderConstraints(report)} candidateReport={report}/></div>
    {delivery&&view==='client'&&<section aria-label="Client webpage"><CapabilityReportDocument document={delivery.document}/></section>}
    {delivery&&view==='share'&&<CapabilitySharedReport delivery={delivery} token="local-preview" downloadPdf={pdf}/>}
  </div></main>;
}
