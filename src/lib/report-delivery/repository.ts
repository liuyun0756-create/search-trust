import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SearchTrustReportV2_2 } from "@/lib/report-v22/generated/types";
import { validateDeliveryPlan, type DeliveryPlanAction, type DeliveryPlanVersion } from "./plan";

const columns = "id,report_id,case_id,user_id,revision,source_report_version,status,plan,created_at";

export async function latestDeliveryPlanVersion(client: SupabaseClient, reportId: string): Promise<DeliveryPlanVersion | null> {
  const { data, error } = await client.from("report_delivery_plan_versions")
    .select(columns).eq("report_id", reportId).order("revision", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as DeliveryPlanVersion | null;
}

export async function deliveryPlanVersionById(client: SupabaseClient, versionId: string): Promise<DeliveryPlanVersion | null> {
  const { data, error } = await client.from("report_delivery_plan_versions")
    .select(columns).eq("id", versionId).maybeSingle();
  if (error) throw error;
  return data as DeliveryPlanVersion | null;
}

export class DeliveryPlanConflictError extends Error {
  constructor() { super("The plan changed in another tab. Reload before saving again."); }
}

export async function saveDeliveryPlanVersion(client: SupabaseClient, input: {
  userId: string;
  caseId: string;
  reportId: string;
  report: SearchTrustReportV2_2;
  expectedRevision: number;
  status: "draft" | "approved";
  plan: unknown;
}): Promise<DeliveryPlanVersion> {
  const plan = validateDeliveryPlan(input.plan, input.report);
  if (!plan) throw new Error("The plan must contain the three original actions with valid editable fields.");
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) throw new Error("Invalid plan revision.");
  const { data, error } = await client.rpc("save_v22_delivery_plan_version", {
    p_user_id: input.userId,
    p_case_id: input.caseId,
    p_report_id: input.reportId,
    p_expected_revision: input.expectedRevision,
    p_source_report_version: input.report.report_version.version_number,
    p_status: input.status,
    p_plan: plan as DeliveryPlanAction[],
  });
  if (error) {
    if (error.code === "40001") throw new DeliveryPlanConflictError();
    throw error;
  }
  if (!data) throw new Error("The plan could not be saved.");
  return data as DeliveryPlanVersion;
}
