"use client";

import { useRef, useState } from "react";
import { Check, Copy, Download, Link2, LoaderCircle, RotateCcw, X } from "lucide-react";
import type { ReportV22Mode } from "@/lib/report-v22/view-model";

type Dialog = "pdf" | "share" | null;

export function ReportV22Actions({ caseId, reportId, mode }: { caseId: string; reportId: string; mode: ReportV22Mode }) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pdfMode, setPdfMode] = useState<ReportV22Mode>(mode);
  const [agencyName, setAgencyName] = useState("");
  const [clientName, setClientName] = useState("");
  const [footerNote, setFooterNote] = useState("");
  const [logoData, setLogoData] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [share, setShare] = useState<{ id: string; url: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const shareEndpoint = `/api/v2/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportId)}/shares`;

  const close = () => { if (!busy) { setDialog(null); setError(""); } };

  async function downloadPdf() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdf_variant: pdfMode === "client" ? "client" : "full",
          branding: { agency_name: agencyName, client_name: clientName, footer_note: footerNote, agency_logo_data: logoData },
        }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "PDF export failed.");
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `SearchTrust-${pdfMode}-report.pdf`; anchor.click();
      URL.revokeObjectURL(url); setDialog(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "PDF export failed."); }
    finally { setBusy(false); }
  }

  async function createShare() {
    setBusy(true); setError(""); setCopied(false);
    try {
      const response = await fetch(shareEndpoint, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "Share link creation failed.");
      setShare(body);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Share link creation failed."); }
    finally { setBusy(false); }
  }

  async function revokeShare() {
    if (!share) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${shareEndpoint}/${encodeURIComponent(share.id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Share link revocation failed.");
      setShare(null); setCopied(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Share link revocation failed."); }
    finally { setBusy(false); }
  }

  function selectLogo(file?: File) {
    setError("");
    if (!file) { setLogoData(""); return; }
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > 1_000_000) {
      setError("Use a PNG or JPEG logo smaller than 1 MB.");
      if (logoRef.current) logoRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogoData(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setError("The logo could not be read.");
    reader.readAsDataURL(file);
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => { setPdfMode(mode); setDialog("pdf"); }} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs font-black text-white/80 hover:bg-white/10"><Download className="h-4 w-4" /> PDF</button>
        <button type="button" onClick={() => setDialog("share")} className="inline-flex items-center gap-2 rounded-full bg-[#a5d020] px-4 py-2.5 text-xs font-black text-[#172019] hover:bg-[#b8dd3c]"><Link2 className="h-4 w-4" /> Share</button>
      </div>

      {dialog ? <div className="fixed inset-0 z-[110] flex items-end justify-center bg-[#111914]/70 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-label={dialog === "pdf" ? "Export PDF" : "Share client report"}>
        <button className="absolute inset-0 cursor-default" onClick={close} aria-label="Close dialog" />
        <div className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[28px] bg-[#f6f2e8] p-6 shadow-2xl sm:rounded-[28px] sm:p-8">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#7b971f]">{dialog === "pdf" ? "PDF export" : "Secure sharing"}</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#172019]">{dialog === "pdf" ? "Prepare the deliverable" : "Create a client-only link"}</h2></div><button type="button" onClick={close} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#445044]"><X className="h-4 w-4" /></button></div>
          {dialog === "pdf" ? <div className="mt-7 space-y-5">
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#e8ebdf] p-1.5">{(["advisor", "client"] as const).map((value) => <button key={value} type="button" onClick={() => setPdfMode(value)} className={`rounded-xl px-4 py-3 text-xs font-black capitalize ${pdfMode === value ? "bg-white text-[#243024] shadow-sm" : "text-[#707a6e]"}`}>{value}</button>)}</div>
            <p className="text-xs leading-5 text-[#717b6f]">Agency branding is optional and used only for this download. It is not saved.</p>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-black text-[#4c584b]">Agency name<input className="field-input mt-2 bg-white" value={agencyName} maxLength={120} onChange={(e) => setAgencyName(e.target.value)} /></label><label className="text-xs font-black text-[#4c584b]">Client name<input className="field-input mt-2 bg-white" value={clientName} maxLength={120} onChange={(e) => setClientName(e.target.value)} /></label></div>
            <label className="block text-xs font-black text-[#4c584b]">Footer note<input className="field-input mt-2 bg-white" value={footerNote} maxLength={240} onChange={(e) => setFooterNote(e.target.value)} /></label>
            <label className="block text-xs font-black text-[#4c584b]">Agency logo <span className="font-medium text-[#879086]">PNG/JPEG, up to 1 MB</span><input ref={logoRef} type="file" accept="image/png,image/jpeg" onChange={(e) => selectLogo(e.target.files?.[0])} className="mt-2 block w-full rounded-xl border border-[#d5dcd0] bg-white p-3 text-xs font-medium" /></label>
            <button type="button" disabled={busy} onClick={downloadPdf} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#172019] px-5 py-4 text-sm font-black text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download {pdfMode} PDF</button>
          </div> : <div className="mt-7">
            <p className="rounded-2xl border border-[#dce5cf] bg-[#f4f8eb] p-4 text-sm leading-6 text-[#56634f]">The link contains only the Client view, expires after 30 days, and replaces any previous active link.</p>
            {share ? <div className="mt-5"><div className="rounded-2xl border border-[#d7ddd1] bg-white p-4"><p className="break-all text-sm font-bold leading-6 text-[#344033]">{share.url}</p><p className="mt-2 text-xs text-[#818a80]">Expires {new Date(share.expiresAt).toLocaleDateString()}</p></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={async () => { await navigator.clipboard.writeText(share.url); setCopied(true); }} className="flex items-center justify-center gap-2 rounded-xl bg-[#a5d020] px-4 py-3 text-xs font-black text-[#172019]">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copied" : "Copy link"}</button><button type="button" disabled={busy} onClick={revokeShare} className="flex items-center justify-center gap-2 rounded-xl border border-[#dfc7bd] bg-white px-4 py-3 text-xs font-black text-[#9a4b2b]"><X className="h-4 w-4" /> Revoke</button></div></div> : <button type="button" disabled={busy} onClick={createShare} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#172019] px-5 py-4 text-sm font-black text-white disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Create secure link</button>}
          </div>}
          {error ? <p role="alert" className="mt-4 rounded-xl bg-[#fff0e8] px-4 py-3 text-sm font-bold text-[#9b4b29]">{error}</p> : null}
        </div>
      </div> : null}
    </>
  );
}
