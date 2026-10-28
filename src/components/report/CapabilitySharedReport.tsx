"use client";
import {useState} from "react";
import type {ApprovedCapabilityDelivery} from "@/lib/report-capability/delivery";
import {CapabilityReportDocument} from "./CapabilityReportDocument";
import {saveCapabilityPdf} from "./CapabilityDeliveryActions";
export function CapabilitySharedReport({delivery,token}:{delivery:ApprovedCapabilityDelivery;token:string}) {
  const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
  return <main className="min-h-screen bg-[#f7faf7] px-4 py-8">
    <header className="mx-auto mb-6 flex max-w-4xl flex-wrap items-center justify-between gap-4">
      <div><p className="font-semibold">Secure client report</p><p className="text-sm">Report v{delivery.reportVersion} · Approved revision {delivery.revision}</p></div>
      <button className="rounded-lg bg-[#26432e] px-4 py-3 text-sm text-white disabled:opacity-50" disabled={busy} onClick={async()=>{
        if(busy)return;setBusy(true);setMessage("");
        try{await saveCapabilityPdf(await fetch("/api/share/pdf",{method:"POST",cache:"no-store",referrerPolicy:"no-referrer",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})}));}
        catch(error){setMessage(error instanceof Error?error.message:"Could not download this report.");}finally{setBusy(false);}
      }}>{busy?"Preparing PDF…":"Download PDF"}</button>
      <p role="status" className="w-full text-sm">{message}</p>
    </header>
    <CapabilityReportDocument document={delivery.document}/>
  </main>;
}
