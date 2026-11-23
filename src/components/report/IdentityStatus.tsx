import { modeLabels } from "@/lib/identity-review/view";
import type { BusinessIdentityV2, ContactCheck, IdentityInheritance } from "@/lib/report-capability/generated/types";

function branchEvidence(identity: BusinessIdentityV2) {
  const ref = identity.selected_branch_ref;
  if (identity.public_gbp_url) {
    const url = new URL(identity.public_gbp_url);
    const cid = url.searchParams.get("cid") ?? url.searchParams.get("ludocid");
    const placeId = url.searchParams.get("place_id") ?? url.searchParams.get("query_place_id");
    if (cid && (!ref || ref === cid)) return `CID ${cid}`;
    if (placeId && (!ref || ref === placeId)) return `Place ID ${placeId}`;
  }
  return ref ? `Saved branch ID ${ref}` : "No branch ID saved";
}

export function IdentityStatus({ identity, checks = [], inheritance }: {
  identity?: BusinessIdentityV2;
  checks?: ContactCheck[];
  inheritance?: IdentityInheritance;
}) {
  const mode = identity?.operating_model;
  const branch = identity?.selected_branch_ref;
  const manuallyConfirmed = Boolean(mode?.confirmation_ref);
  const manualBranch = inheritance?.branch === "retained"
    || Boolean(branch && mode?.confirmation_ref?.selected_branch_ref === branch);
  const visit = identity?.operating_location;
  const notApplicable = mode?.value === "service_area" || mode?.value === "meeting_point";
  const confirmedVisit = Boolean(
    branch && visit?.state === "seo_confirmed" && visit.role === "customer_facing"
    && visit.confirmation_ref?.selected_branch_ref === branch,
  );
  const matchedOn: readonly string[] = identity?.identity_match.matched_on ?? [];
  const phone = checks.find(check => check.field === "phone" && check.status === "confirmed");
  const phoneEvidence = matchedOn.includes("phone") || phone?.result === "match" ? "Recorded match"
    : phone?.result === "mismatch" ? "Recorded difference"
      : phone?.result === "partial_match" ? "Recorded partial match" : "Match detail not saved";
  return <dl className="mt-4 grid gap-3 sm:grid-cols-3" data-testid="current-address">
    <div className="rounded-lg bg-white p-3">
      <dt className="text-sm font-medium">GBP branch match</dt>
      <dd className="mt-1 font-semibold">{inheritance?.branch === "needs_confirmation" ? "Needs confirmation" : manualBranch ? "Manually confirmed"
        : identity?.identity_match.state === "matched" ? "Machine matched" : "No saved match"}</dd>
      {identity ? <dd className="mt-2 space-y-1 text-sm break-words">
        <p>{branchEvidence(identity)}</p>
        <p>Website domain · {identity.normalized_domain} · {matchedOn.includes("domain") ? "Recorded match" : "Match detail not saved"}</p>
        <p>Phone · {phoneEvidence}</p>
      </dd> : null}
    </div>
    <div className="rounded-lg bg-white p-3">
      <dt className="text-sm font-medium">Operating model</dt>
      <dd className="mt-1 font-semibold">{manuallyConfirmed ? "Manually confirmed"
        : mode?.state === "resolved" ? "Machine identified · awaiting confirmation" : "Unknown"}</dd>
      {mode?.value ? <dd className="mt-2 text-sm">{modeLabels[mode.value]}</dd> : null}
    </div>
    <div className="rounded-lg bg-white p-3">
      <dt className="text-sm font-medium">Customer visits at this address</dt>
      <dd className="mt-1 font-semibold">{confirmedVisit ? "Confirmed" : notApplicable ? "Not applicable" : "Unconfirmed"}</dd>
    </div>
  </dl>;
}
