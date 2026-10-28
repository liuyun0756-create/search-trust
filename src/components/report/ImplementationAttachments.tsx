"use client";

import {useEffect,useId,useRef,useState} from "react";
import {attachmentQuery,MAX_FILE_BYTES,parseAttachment,safeName,validateFile,type Attachment,type AttachmentTarget} from "@/lib/implementation-attachments/contracts";
type Props={ownerId:string;target:AttachmentTarget;readOnly?:boolean};
type Pending={version:1;id:string;name:string;mime:string;size:number;digest:string};
const digest=async(bytes:ArrayBuffer)=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
const messages:Record<string,string>={LIMIT:"The file count, storage or daily upload limit has been reached. Remove unneeded files or try later.",STALE:"A newer implementation record exists. Reload the record; this file was not attached to the new version.",EXPIRED:"This upload expired. Remove the pending upload before starting another.",CONFLICT:"This request belongs to a different file. Keep the original file or remove this upload.",INVALID:"Use a PNG, JPEG or PDF whose file type matches its name.",TOO_LARGE:"Choose a non-empty file up to 2 MiB.",UNAVAILABLE:"The upload could not be confirmed. Check this upload before trying again."};
export function ImplementationAttachments(props:Props) {
  const {target:t}=props;
  return <Panel key={`${props.ownerId}:${t.caseId}:${t.reportId}:${t.deliveryRevisionId}:${t.recordId}:${t.revision}:${t.checksum}:${t.actionId}`} {...props}/>;
}
function Panel({ownerId,target,readOnly=false}:Props) {
  const inputId=useId(),[files,setFiles]=useState<Attachment[]>([]),[file,setFile]=useState<File|null>(null),[pending,setPending]=useState<Pending|null>(null);
  const [missing,setMissing]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[loaded,setLoaded]=useState(false);
  const [confirmRemove,setConfirmRemove]=useState<string|null>(null),lock=useRef(false),controller=useRef<AbortController|null>(null),input=useRef<HTMLInputElement|null>(null);
  const query=attachmentQuery(target),base=`/api/v2/cases/${target.caseId}/reports/${target.reportId}/attachments?${query}`;
  const key=`v22:attachments:${ownerId}:${target.caseId}:${target.reportId}:${target.deliveryRevisionId}:${target.recordId}:${target.revision}:${target.checksum}:${target.actionId}`;
  function remember(value:Pending|null) {
    if (value) sessionStorage.setItem(key,JSON.stringify(value)); else sessionStorage.removeItem(key);
    setPending(value);
  }
  async function request(id?:string,method="GET",body?:File) {
    const response=await fetch(`${base}${id?`&attachmentId=${id}`:""}`,{method,body,cache:"no-store",signal:controller.current?.signal,
      headers:body?{"Content-Type":body.type,"X-File-Name":encodeURIComponent(safeName(body.name))}:undefined});
    const data=await response.json();
    if (!response.ok) throw new Error(response.status===404?"NOT_FOUND":data?.error?.code??"UNAVAILABLE");
    return data;
  }
  async function loadList() {
    const data=await request();
    if (!Array.isArray(data.files)||data.files.length>100) throw new Error("UNAVAILABLE");
    const parsed=data.files.map(parseAttachment);
    if (parsed.some((f:Attachment|null)=>!f)) throw new Error("UNAVAILABLE");
    if (!controller.current?.signal.aborted) {setFiles(parsed);setLoaded(true);}
  }
  async function checkPending(p:Pending,method="GET") {
    try {
      const a=parseAttachment(await request(p.id,method));
      if (!a||a.id!==p.id) throw new Error("UNAVAILABLE");
      if (controller.current?.signal.aborted) return;
      setMissing(false);
      if (a.status!=="uploading") {remember(null);setMessage(a.status==="ready"?`File attached to implementation revision ${target.revision}. No credits used.`:"File removed from access. Storage cleanup may still be pending.");}
      else setMessage("Upload is pending. Check its status or explicitly recover it; no second upload is started.");
      return true;
    } catch(e) {
      if ((e as Error).message==="NOT_FOUND") {setMissing(true);setMessage("No accepted upload was found. Reselect the same file to retry this request, or forget this unaccepted request.");return false;}
      else throw e;
    }
  }
  useEffect(()=>{
    const c=new AbortController();controller.current=c;
    void (async()=>{
      try {
        let p:Pending|null=null;
        const raw=sessionStorage.getItem(key);
        if(raw) {try {const v=JSON.parse(raw);if(v.version===1&&/^[a-f0-9-]{36}$/.test(v.id)&&typeof v.name==="string"&&typeof v.mime==="string"&&Number.isInteger(v.size)&&v.size>0&&v.size<=MAX_FILE_BYTES&&/^[a-f0-9]{64}$/.test(v.digest)) p=v;}catch{ /* invalid local metadata is not sent */ }}
        setPending(p);await loadList();if(p) await checkPending(p);
      }catch{if(!c.signal.aborted)setMessage("Files could not be loaded. Refresh to try again; no upload was started.");}
    })();
    return()=>c.abort();
    // Panel is keyed by the complete owner/source identity; no stale target survives navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key]);
  async function run(task:()=>Promise<void>) {
    if(lock.current)return;lock.current=true;setBusy(true);setMessage("");
    try{await task();}catch(e){if(!controller.current?.signal.aborted)setMessage(messages[(e as Error).message]??messages.UNAVAILABLE);}
    finally{lock.current=false;if(!controller.current?.signal.aborted)setBusy(false);}
  }
  async function upload() {
    if(!file||readOnly)return;
    await run(async()=>{
      if(file.size<1||file.size>MAX_FILE_BYTES)throw new Error("TOO_LARGE");
      const bytes=await file.arrayBuffer(),name=safeName(file.name);validateFile(name,file.type,new Uint8Array(bytes));
      const meta={name,mime:file.type,size:file.size,digest:await digest(bytes)};
      if(pending&&(!missing||["name","mime","size","digest"].some(k=>pending[k as keyof typeof meta]!==meta[k as keyof typeof meta]))) throw new Error("CONFLICT");
      const p:Pending=pending??{version:1,id:crypto.randomUUID(),...meta};
      // Persist before sending. If storage is unavailable, do not start an unrecoverable upload.
      remember(p);
      const a=parseAttachment(await request(p.id,"PUT",file));
      if(!a||a.id!==p.id)throw new Error("UNAVAILABLE");
      if(controller.current?.signal.aborted)return;
      setFile(null);if(input.current)input.current.value="";
      await checkPending(p);await loadList();
    });
  }
  async function download(a:Attachment) {
    await run(async()=>{
      const r=await fetch(`${base}&attachmentId=${a.id}&download=1`,{cache:"no-store",signal:controller.current?.signal});
      if(!r.ok||r.headers.get("content-type")!=="application/octet-stream")throw new Error("UNAVAILABLE");
      const blob=await r.blob();if(blob.size!==a.size)throw new Error("UNAVAILABLE");
      if(controller.current?.signal.aborted)return;
      const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=a.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });
  }
  return <section aria-label={`Supporting files for revision ${target.revision}`} className="mt-4 min-w-0 rounded-xl border border-[#dce6d9] bg-white p-4">
    <h4 className="text-sm font-semibold">Supporting files · optional <span className="font-normal text-[#52695b]">/ revision {target.revision}</span></h4>
    <p className="mt-2 text-xs leading-5 text-[#52695b]">Add screenshots or documents of the work you published. Files support your record; they do not verify completion or SEO results.</p>
    {!readOnly?<div className="mt-3 space-y-2">
      <label htmlFor={inputId} className="block text-sm font-medium">PNG, JPEG or PDF · up to 2 MiB · 5 files per action version</label>
      <input ref={input} id={inputId} type="file" accept=".png,.jpg,.jpeg,.pdf" disabled={busy||!loaded||!!pending&&!missing} className="block w-full min-w-0 text-sm" onChange={e=>setFile(e.target.files?.[0]??null)}/>
      <p className="text-xs text-[#52695b]">Only upload materials you have permission to use. Do not include passwords or unnecessary personal information. Files are not malware-scanned.</p>
      <button type="button" disabled={busy||!loaded||!file||!!pending&&!missing} onClick={()=>void upload()} className="rounded-lg bg-[#214532] px-3 py-2 text-sm text-white disabled:opacity-50">{pending?"Retry the same file":"Add a file · no credits used"}</button>
    </div>:<p className="mt-2 text-xs text-[#52695b]">Files belong to this saved version. They are not copied to later revisions.</p>}
    {pending?<div className="mt-3 space-y-2 rounded-lg bg-[#f6f9f4] p-3 text-sm">
      <p className="break-all">Pending upload · {pending.name}</p>
      <button type="button" disabled={busy} className="mr-3 underline" onClick={()=>void run(async()=>{await checkPending(pending);await loadList();})}>Check upload status</button>
      {!missing?<button type="button" disabled={busy} className="underline" onClick={()=>void run(async()=>{await checkPending(pending,"POST");await loadList();})}>Recover this upload</button>:<button type="button" disabled={busy} className="underline" onClick={()=>void run(async()=>{if(await checkPending(pending)===false)remember(null);})}>Forget unaccepted request</button>}
    </div>:null}
    <ul className="mt-3 space-y-2">{files.map(a=><li key={a.id} className="min-w-0 border-t border-[#dce6d9] pt-3 text-sm">
      <p className="break-all font-medium">{a.status==="removed"||a.status==="removing"?"File removed":a.name}</p>
      <p className="text-xs text-[#52695b]">{a.mime} · {Math.ceil(a.size/1024)} KiB · {new Date(a.createdAt).toLocaleString()} · {a.status==="ready"?"Available":a.status==="uploading"?"Pending":a.status==="removing"?"Unavailable · cleanup pending":"Removed"}</p>
      {a.status==="ready"?<button type="button" disabled={busy} className="mr-4 mt-2 underline" onClick={()=>void download(a)}>Download {a.name}</button>:null}
      {a.status==="ready"||a.status==="uploading"?<button type="button" disabled={busy} className="mt-2 underline" onClick={()=>setConfirmRemove(a.id)}>Remove {a.name}</button>:null}
      {confirmRemove===a.id?<div className="mt-2 rounded-lg bg-[#f6f9f4] p-3"><p>Remove this file? It will no longer be available from this record. The implementation record and report will stay unchanged.</p>
        <button type="button" disabled={busy} className="mr-4 mt-2 font-semibold underline" onClick={()=>void run(async()=>{await request(a.id,"DELETE");if(pending?.id===a.id)remember(null);setConfirmRemove(null);await loadList();setMessage("File removed from access. Storage cleanup may still be pending.");})}>Confirm removal</button>
        <button type="button" onClick={()=>setConfirmRemove(null)}>Cancel</button></div>:null}
    </li>)}</ul>
    {loaded&&!files.length?<p className="mt-3 text-sm text-[#52695b]">No files attached to this action version.</p>:null}
    {files.length===100?<p className="mt-2 text-xs">Showing the latest 100 file records.</p>:null}
    <button type="button" disabled={busy} className="mt-3 text-sm underline" onClick={()=>void run(async()=>{await loadList();if(pending)await checkPending(pending);})}>Refresh files</button>
    <p role="status" aria-live="polite" className="mt-2 break-words text-sm">{busy?"Working…":message}</p>
  </section>;
}
