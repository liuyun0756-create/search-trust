export interface PreflightBranchOption {
  ref: string;
  public_gbp_url: string;
  name: string;
  address: string | null;
  domain_matched: boolean;
  phone_matched: boolean;
  evidence_token: string;
}

export interface PreflightBranchReceipt {
  id: string;
  case_id: string;
  revision: number;
  public_gbp_url: string;
  expires_at: string;
}

export const branchConfirmationHeader = "x-searchtrust-gbp-branch-confirmation";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validPreflightBranchReceipt(value: unknown): value is PreflightBranchReceipt {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).sort().join(",") === "case_id,expires_at,id,public_gbp_url,revision" &&
    typeof row.id === "string" && uuid.test(row.id) && typeof row.case_id === "string" && uuid.test(row.case_id) &&
    typeof row.revision === "number" && Number.isInteger(row.revision) && row.revision > 0 &&
    typeof row.public_gbp_url === "string" && /^https:\/\/[^@\s]+\//.test(row.public_gbp_url) && row.public_gbp_url.length <= 2083 &&
    typeof row.expires_at === "string" && Number.isFinite(Date.parse(row.expires_at));
}
