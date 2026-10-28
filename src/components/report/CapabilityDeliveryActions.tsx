"use client";
import {useEffect,useRef,useState} from "react";

type Share={id:string;revision_id:string;created_at:string;expires_at:string;revoked_at:string|null};
const button="rounded-lg border border-[#ccd9ce] px-4 py-2 text-sm font-semibold disabled:opacity-50";
export async function saveCapabilityPdf(response:Response) {
  if(!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) {
    const data=await response.json().catch(()=>null);throw new Error(data?.error??"PDF download failed. Please retry.");
  }
  const url=URL.createObjectURL(await response.blob());
  const anchor=document.createElement("a");anchor.href=url;anchor.download="SearchTrust-Approved-Report.pdf";
  document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
}
export function CapabilityDeliveryActions({caseId,reportId,revision,approved,pathPrefix=""}:{caseId:string;reportId:string;revision:number;approved:boolean;pathPrefix?:string}) {
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [shares,setShares]=useState<Share[]>([]),[shareUrl,setShareUrl]=useState("");
  const [agency,setAgency]=useState(""),[client,setClient]=useState(""),[footer,setFooter]=useState(""),[logo,setLogo]=useState("");
  const [logoLoading,setLogoLoading]=useState(false),[manage,setManage]=useState(false);
  const pending=useRef(false),logoReader=useRef<FileReader|null>(null);
  useEffect(()=>{setReady(true);return()=>logoReader.current?.abort();},[]);
  const base=`/api/v2/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportId)}${pathPrefix}`;
  async function run(work:()=>Promise<void>) {
    if(pending.current)return;pending.current=true;setBusy(true);setMessage("");
    try{await work();}catch(error){setMessage(error instanceof Error?error.message:"Unable to prepare delivery. Please retry.");}
    finally{pending.current=false;setBusy(false);}
  }
  async function loadShares() {
    const response=await fetch(`${base}/client-shares`,{cache:"no-store"});const data=await response.json();
    if(!response.ok||!Array.isArray(data.shares))throw new Error(data.error??"Could not load shared links.");
    setShares(data.shares);
  }
  function selectLogo(file?:File) {
    logoReader.current?.abort();setLogo("");setLogoLoading(false);setMessage("");
    if(!file)return;
    if(!["image/png","image/jpeg"].includes(file.type)||file.size>1024*1024){setMessage("Choose a PNG or JPEG logo up to 1 MB.");return;}
    const reader=new FileReader();logoReader.current=reader;setLogoLoading(true);
    reader.onload=()=>{setLogo(String(reader.result??""));setLogoLoading(false);};
    reader.onerror=()=>{setMessage("Could not read this logo.");setLogoLoading(false);};reader.readAsDataURL(file);
  }
  return <section aria-label="Approved report delivery" className="mx-auto my-6 max-w-4xl space-y-4 rounded-2xl border border-[#dce6d9] bg-white p-5">
    <h2 className="font-semibold">Deliver the reviewed report</h2>
    <p className="text-sm">{approved?`PDF and new links use approved revision ${revision}.` : "Approve the latest saved content before downloading a client PDF or creating a new link."} Existing links keep their original approved version until they expire or you revoke them.</p>
    <details><summary className="cursor-pointer text-sm font-medium">Optional PDF branding</summary>
      <p className="my-3 text-xs">Applies only to this download, not online shares. SearchTrust identification remains.</p>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Your name or business<input className="mt-1 w-full rounded border p-2" value={agency} maxLength={120} onChange={e=>setAgency(e.target.value)}/></label>
        <label className="text-sm">Client name<input className="mt-1 w-full rounded border p-2" value={client} maxLength={120} onChange={e=>setClient(e.target.value)}/></label>
        <label className="text-sm">Footer note<input className="mt-1 w-full rounded border p-2" value={footer} maxLength={240} onChange={e=>setFooter(e.target.value)}/></label>
        <label className="text-sm">Logo · PNG/JPEG, up to 1 MB<input className="mt-1 block w-full" type="file" accept="image/png,image/jpeg" onChange={e=>selectLogo(e.target.files?.[0])}/></label>
      </fieldset>
    </details>
    <div className="flex flex-wrap gap-3">
      <button className={button} disabled={!ready||busy||logoLoading||!approved} onClick={()=>void run(async()=>{
        await saveCapabilityPdf(await fetch(`${base}/client-pdf`,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedRevision:revision,branding:{agency_name:agency,client_name:client,footer_note:footer,agency_logo_data:logo}})}));
        setMessage(`Approved revision ${revision} downloaded.`);
      })}>Download approved PDF</button>
      <button className={button} disabled={!ready||busy||!approved} onClick={()=>void run(async()=>{
        const response=await fetch(`${base}/client-shares`,{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedRevision:revision})});
        const data=await response.json();if(!response.ok)throw new Error(data.error??"Could not create a link. Refresh shared links before retrying.");
        const url=new URL(data.url);if(url.origin!==window.location.origin||url.pathname!=="/share"||url.search||!/^#[A-Za-z0-9_-]{43}$/.test(url.hash))throw new Error("Could not confirm this share link.");
        setShareUrl(url.toString());setManage(true);await loadShares();setMessage("Link created. Anyone with this link can read this approved report for 30 days.");
      })}>Create client link</button>
      <button className={button} disabled={!ready||busy} onClick={()=>void run(async()=>{setManage(true);await loadShares();})}>Manage shared links</button>
    </div>
    {shareUrl?<div className="space-y-2"><label className="block text-sm">New client link<input readOnly className="mt-1 w-full rounded border p-2" value={shareUrl}/></label>
      <button className={button} onClick={async()=>{
        try{if(!navigator.clipboard)throw new Error("Clipboard unavailable");await navigator.clipboard.writeText(shareUrl);setMessage("Link copied.");}
        catch{setMessage("Copy failed. Select the link and copy it manually.");}
      }}>Copy link</button></div>:null}
    {manage?<ul aria-label="Shared links" className="space-y-2">{shares.length?shares.map(share=><li key={share.id} className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
      <span>Created {new Date(share.created_at).toLocaleDateString()} · {share.revoked_at?"Revoked":new Date(share.expires_at).getTime()<=Date.now()?"Expired":`Expires ${new Date(share.expires_at).toLocaleDateString()}`}</span>
      {!share.revoked_at?<button className={button} disabled={busy} onClick={()=>void run(async()=>{
        const response=await fetch(`${base}/client-shares/${share.id}`,{method:"DELETE",cache:"no-store"});
        if(!response.ok)throw new Error("Could not revoke the link. Please retry.");setShareUrl("");await loadShares();setMessage("Link revoked. It can no longer open or download the report.");
      })}>Revoke link</button>:null}</li>):<li className="text-sm">No shared links yet.</li>}</ul>:null}
    <p role="status" className="text-sm">{busy?"Preparing delivery…":message}</p>
  </section>;
}
