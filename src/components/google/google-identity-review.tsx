"use client";

import type { GoogleResource, ResourcePage } from "@/lib/google-resources/contracts";
import { IDENTITY_REASONS } from "../../lib/google-resources/identity";

export function GoogleIdentityReview({ resource, caseIdentity, busy, confirmed, replaces, onConfirm, onSave, onReview }: {
  resource: GoogleResource; caseIdentity: ResourcePage["case_identity"]; busy: boolean; confirmed: boolean; replaces?: string;
  onConfirm(value: boolean): void; onSave(): void; onReview(): void;
}) {
  const assessment = resource.identity_assessment;
  const canSave = !busy && !!resource.identity_review_token && !!assessment && assessment.status !== "mismatch"
    && (assessment.status === "matched" || confirmed);
  return <div className="space-y-3 rounded-xl bg-[#f3f4ed] p-5" aria-label="Review selected resource">
    <h3 className="text-lg font-semibold">Confirm {resource.name}</h3>
    <p className="break-all">{resource.id}</p>
    {resource.website_urls.map(url => <p key={url} className="break-all">Website: {url}</p>)}
    {resource.website_urls.length === 0 && <p>No website URL is available for this resource.</p>}
    {resource.address && <p>Address: {resource.address}</p>}
    {resource.service_areas.length > 0 && <p>Service area: {resource.service_areas.join(", ")}</p>}
    {caseIdentity && <div className="rounded-lg border border-[#dce1d5] p-3">
      <p className="font-medium">Compare with this Case</p>
      <p>{caseIdentity.business_name} · {caseIdentity.operating_model.replaceAll("_", " ")}</p>
      <p className="break-all">{caseIdentity.site_url}</p>
      <p>{caseIdentity.location || "No location details available."}</p>
    </div>}
    {assessment && <div role="status" className="space-y-2">
      <p className="font-semibold">{assessment.status === "matched" ? "High-confidence match"
        : assessment.status === "mismatch" ? "Identity mismatch — choose another resource"
        : `${assessment.confidence === "medium" ? "Partial match" : "Insufficient evidence"} — your confirmation is required`}</p>
      <ul className="list-disc space-y-1 pl-5">{assessment.reasons.map(reason => <li key={reason}>{IDENTITY_REASONS[reason]}</li>)}</ul>
    </div>}
    {assessment?.status === "needs_confirmation" && <label className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <input type="checkbox" checked={confirmed} disabled={busy} onChange={e => onConfirm(e.target.checked)} className="mt-1" />
      <span>I reviewed the differences and missing information, and confirm this resource belongs to this client&apos;s website or business location.</span>
    </label>}
    <p className="text-sm">Saving records who confirmed the identity and when. Data health and synchronization are separate checks.</p>
    {replaces && <p>This replaces the current {replaces} selection for this Case.</p>}
    <div className="flex flex-wrap gap-3">
      <button disabled={!canSave} className="rounded-xl bg-[#1c251b] px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-40" onClick={onSave}>Save this resource</button>
      <button disabled={busy} className="rounded-xl border border-[#dce1d5] px-4 py-2 disabled:opacity-40" onClick={onReview}>Review again</button>
    </div>
  </div>;
}
