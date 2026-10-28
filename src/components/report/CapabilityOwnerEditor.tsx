"use client";

import { useRouter } from "next/navigation";
import type { DeliveryRevision } from "@/lib/report-capability/generated/types";
import { CapabilityDeliveryEditor, type CapabilitySaveResult } from "./CapabilityDeliveryEditor";
import type { DeliveryOrderConstraints } from "@/lib/report-capability/order";

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,ordered(item)]));
  return value;
}

export function CapabilityOwnerEditor({initial,orderConstraints}: {initial:DeliveryRevision;orderConstraints?:DeliveryOrderConstraints}) {
  const router = useRouter();
  async function save(content:DeliveryRevision): Promise<CapabilitySaveResult> {
    const response = await fetch(`/api/v2/cases/${encodeURIComponent(initial.case_id)}/reports/${encodeURIComponent(initial.report_id)}/content-revision`,{
      method:content.status === "approved" ? "POST" : "PUT",cache:"no-store",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({content,reviewConfirmed:content.status === "approved"}),
    });
    const result = await response.json().catch(()=>null);
    if (!response.ok) return {ok:false,code:response.status === 409 ? "CAPABILITY_CONFLICT" : response.status === 400 ? "CAPABILITY_INVALID" : "CAPABILITY_UNAVAILABLE"};
    if (result?.ok !== true || result.revision !== content.expected_revision+1
      || JSON.stringify(ordered(result.content)) !== JSON.stringify(ordered(content))) return {ok:false,code:"CAPABILITY_UNAVAILABLE"};
    router.refresh();
    return {ok:true,revision:result.revision,content:result.content};
  }
  return <details className="mx-auto mt-8 max-w-4xl rounded-2xl border border-[#dce6d9] bg-white">
    <summary className="cursor-pointer p-5 font-semibold">Review &amp; approve · optional edits</summary>
    <CapabilityDeliveryEditor initial={initial} onSave={save} orderConstraints={orderConstraints} />
  </details>;
}
