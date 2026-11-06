'use client';
import {useRef,useState} from 'react';
import type {CapabilityReport,DeliveryRevision} from '@/lib/report-capability/generated/types';
import {deliveryOrderConstraints} from '@/lib/report-capability/order';
import {IdentityConfirmation} from '@/components/report/IdentityConfirmation';
import {CapabilityDeliveryEditor,type CapabilitySaveResult} from '@/components/report/CapabilityDeliveryEditor';
import {CapabilityReportDocument} from '@/components/report/CapabilityReportDocument';
import {CapabilitySharedReport} from '@/components/report/CapabilitySharedReport';
import {saveCapabilityPdf} from '@/components/report/CapabilityDeliveryActions';
import type {ApprovedCapabilityDelivery} from '@/lib/report-capability/delivery';
export function IdentityPreview({base,scenario}:{base:CapabilityReport;scenario:string}){
 const [session]=useState(()=>globalThis.crypto.randomUUID()),[report,setReport]=useState<CapabilityReport|null>(null),[delivery,setDelivery]=useState<ApprovedCapabilityDelivery|null>(null),[view,setView]=useState('review'),[error,setError]=useState('');
 const [initial,setInitial]=useState<DeliveryRevision|null>(null);
 const approved=useRef<DeliveryRevision|null>(null);
 const endpoint=`/e2e/identity-review/session?scenario=${scenario}&session=${session}`;
 async function pdf(){return fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'pdf',content:approved.current})});}
 async function save(content:DeliveryRevision):Promise<CapabilitySaveResult>{
  const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation:'approve',content})});const v=await r.json();if(v.ok){approved.current=content;setDelivery(v.delivery);}return v;
 }
 return <main className="min-h-screen bg-[#fafbf8] px-4 py-8 text-[#1d2a22]"><div className="mx-auto max-w-5xl"><header className="mb-8 space-y-3"><p className="text-sm font-semibold uppercase tracking-wider">Local saved-input preview · no external calls</p><h1 className="text-3xl font-semibold">{scenario==='volcanoes-hiking-guides'?'Volcanoes':'PR Plumbing'} · identity review</h1><p>Use the frozen observations to try a mode change. Preview and create the separate report, then approve it to open client views. Refreshing starts a new local session.</p><nav aria-label="Preview views" className="flex flex-wrap gap-3">{['review','client','share'].map(v=><button key={v} disabled={v!=='review'&&!delivery} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-40" onClick={()=>setView(v)}>{v==='review'?'Review identity':v==='client'?'Client webpage':'Share page'}</button>)}<button disabled={!delivery} className="rounded-lg border bg-white px-4 py-2 disabled:opacity-40" onClick={async()=>{try{await saveCapabilityPdf(await pdf());}catch{setError('PDF could not be generated.');}}}>Preview PDF</button></nav>{error&&<p role="alert">{error}</p>}</header>
 <div hidden={view!=='review'}><IdentityConfirmation caseId={base.input_manifest.case_id} reportId={base.id} endpoint={endpoint} onCommitted={p=>{setReport(p.report);setInitial((p as typeof p & {initial:DeliveryRevision}).initial);}}/>{report&&initial&&<section aria-label="New report approval"><h2 className="mb-4 text-2xl font-semibold">Review and approve the new report</h2><CapabilityDeliveryEditor initial={initial} candidateReport={report} orderConstraints={deliveryOrderConstraints(report)} onSave={save}/></section>}</div>
 {delivery&&view==='client'&&<section aria-label="Client webpage"><CapabilityReportDocument document={delivery.document}/></section>}{delivery&&view==='share'&&<CapabilitySharedReport delivery={delivery} token="local-preview" downloadPdf={pdf}/>}
 </div></main>;
}
