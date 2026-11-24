"use client";

import {useRef, useState} from "react";
import {IdentityConfirmationFields, type IdentityFieldValues} from "@/components/report/IdentityConfirmationFields";
import {validPreflightBranchReceipt, type PreflightBranchOption, type PreflightBranchReceipt} from "@/lib/preflight-branch/contracts";

export function PreflightBranchConfirmation({caseId, branches, receipt, request, onChange, onBusyChange}: {
  caseId: string;
  branches: PreflightBranchOption[];
  receipt: PreflightBranchReceipt | null;
  request: (path: string, init: RequestInit) => Promise<Response>;
  onChange(receipt: PreflightBranchReceipt | null): void;
  onBusyChange(busy: boolean): void;
}) {
  const [values, setValues] = useState<IdentityFieldValues>({branch: "", mode: "", reason: "", customersCanVisit: false});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const attempt = useRef<string | null>(null);
  const selected = branches.find((item) => item.ref === values.branch);

  async function confirm() {
    if (!selected || busy || !values.reason.trim()) return;
    setBusy(true);
    onBusyChange(true);
    setError("");
    attempt.current ??= crypto.randomUUID();
    try {
      const response = await request("/api/v2/cases/" + encodeURIComponent(caseId) + "/branch-confirmation", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({request_id: attempt.current, evidence_token: selected.evidence_token,
          operating_mode: values.mode || null, customers_can_visit: values.customersCanVisit, reason: values.reason.trim()}),
      });
      const payload: unknown = await response.json();
      if (response.status === 409) {
        setError("Saved preflight evidence has expired or changed. Run a new preflight check to confirm again, or start without branch confirmation.");
      } else if (!response.ok || !validPreflightBranchReceipt(payload) || payload.case_id !== caseId || payload.public_gbp_url !== selected.public_gbp_url) {
        setError("The branch could not be saved. Your choices are still here. Try again or continue without it.");
      } else {
        onChange(payload);
        attempt.current = null;
        setEditing(false);
      }
    } catch {
      setError("The branch could not be saved. Your choices are still here. Try again or continue without it.");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  return <section aria-label="Confirm GBP branch" className="my-4 rounded-2xl border border-[#c8d4ca] bg-[#f4f8f0] p-5 text-[#22382c]">
    <h2 className="text-lg font-semibold">Confirm GBP branch <span className="text-sm font-normal">(optional)</span></h2>
    <p className="mt-2 text-sm">Use saved preflight evidence to confirm the profile for this report. This step uses no credit.</p>
    {receipt && !editing && <p role="status" className="mt-2 text-sm">Branch saved. It will apply only if the report evidence still matches.</p>}
    {!!error && <p role="alert" className="mt-3 text-sm">{error}</p>}
    {editing && <>
      <IdentityConfirmationFields branches={branches.map((item) => ({
        ref: item.ref, name: item.name, address: item.address,
        evidence: [item.domain_matched && "Website domain matches", item.phone_matched && "Phone matches"].filter(Boolean).join(" · "),
      }))} values={values} onChange={(next) => {
        attempt.current = null;
        setError("");
        setValues(next);
      }} disabled={busy} optionalMode/>
      <button type="button" className="mt-4 rounded-lg bg-[#294d36] px-4 py-2 font-semibold text-white disabled:opacity-40"
        disabled={busy || !selected || !values.reason.trim()} onClick={() => void confirm()}>{busy ? "Saving…" : "Save branch confirmation"}</button>
    </>}
    {!editing && <button type="button" className="mt-3 underline" onClick={() => setEditing(true)}>
      {receipt ? "Change confirmed branch" : "Choose a branch"}
    </button>}
    {(receipt || editing) && <button type="button" className="ml-4 mt-3 underline" disabled={busy} onClick={() => {
      onChange(null);
      setEditing(false);
      setError("");
    }}>Continue without confirmation</button>}
  </section>;
}
