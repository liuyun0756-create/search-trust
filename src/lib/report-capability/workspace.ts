import type { ReportWorkspaceItem } from "@/components/report/report-case-workspace";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Only accept metadata returned by the completed/consumed SQL gate. */
export function capabilityWorkspaceItem(value: unknown, userId: string): ReportWorkspaceItem {
  const row = value as Record<string, unknown> | null;
  if (!row || row.user_id !== userId || ![row.id,row.case_id].every(v => typeof v === "string" && uuid.test(v))
    || ![row.business_name,row.site_url,row.market,row.service].every(v => typeof v === "string" && v.trim().length)
    || !["prospect","verified_execution"].includes(String(row.report_type))
    || !Number.isSafeInteger(row.version) || Number(row.version)<1
    || typeof row.generated_at !== "string" || !Number.isFinite(Date.parse(row.generated_at))
    || !Number.isSafeInteger(row.delivery_revision) || Number(row.delivery_revision)<0
    || !["original","draft","approved"].includes(String(row.delivery_status))
    || (row.delivery_status === "original") !== (row.delivery_revision === 0)) throw new Error("Invalid completed report index");
  return {caseId:row.case_id as string,reportId:row.id as string,businessName:row.business_name as string,
    siteUrl:row.site_url as string,market:row.market as string,service:row.service as string,
    type:row.report_type as ReportWorkspaceItem["type"],version:row.version as number,generatedAt:row.generated_at,
    deliveryRevision:row.delivery_revision as number,deliveryStatus:row.delivery_status as "original"|"draft"|"approved"};
}
