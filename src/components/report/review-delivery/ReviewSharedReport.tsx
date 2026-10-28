"use client";
import {useState} from "react";
import type {ReviewClientDocument} from "@/lib/review-reports/projection";
import {ReviewDocument} from "./ReviewDocument";
import {saveCapabilityPdf} from "../CapabilityDeliveryActions";
export function ReviewSharedReport({delivery,token}:{delivery:ReviewClientDocument;token:string}){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  return <main className="min-h-screen bg-[#f6f9f3] px-4 py-8"><div className="mx-auto max-w-4xl"><header className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="font-semibold">Secure client report</p><p className="mt-1 text-sm">Report v{delivery.reportVersion} · Approved revision {delivery.revision}</p></div>
    <button disabled={busy} className="rounded-lg bg-[#244633] px-5 py-3 text-sm text-white disabled:opacity-50" onClick={async()=>{if(busy)return;setBusy(true);setMessage("");try{await saveCapabilityPdf(await fetch("/api/share/pdf",{method:"POST",cache:"no-store",referrerPolicy:"no-referrer",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})}));}catch(e){setMessage(e instanceof Error?e.message:"Could not download this report.");}finally{setBusy(false);}}}>Download approved PDF</button><p role="status" className="w-full text-sm">{message}</p></header><ReviewDocument document={delivery}/></div></main>;
}
