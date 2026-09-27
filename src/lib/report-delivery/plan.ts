import type { SearchTrustReportV2_2 } from "@/lib/report-v22/generated/types";

export interface DeliveryPlanAction {
  actionId: string;
  title: string;
  target: string;
  steps: string;
  completion: string;
  owner: string;
  schedule: string;
  review: string;
}

export interface DeliveryPlanVersion {
  id: string;
  report_id: string;
  case_id: string;
  user_id: string;
  revision: number;
  source_report_version: number;
  status: "draft" | "approved";
  plan: DeliveryPlanAction[];
  created_at: string;
}

function lines(values: string[]) {
  return values.join("\n");
}

const periodLabel = {
  days_1_30: "Days 1–30",
  days_31_60: "Days 31–60",
  days_61_90: "Days 61–90",
} as const;

export function initialDeliveryPlan(report: SearchTrustReportV2_2): DeliveryPlanAction[] {
  const clientTitles = new Map(report.client_delivery.priority_actions.map((action) => [action.action_id, action.title]));
  return [...report.top_actions].sort((a, b) => a.sequence - b.sequence).map((action) => {
    const period = report.roadmap_30_60_90.phases.find((phase) => phase.action_ids.includes(action.action_id));
    return {
      actionId: action.action_id,
      title: clientTitles.get(action.action_id) ?? action.client_facing_explanation,
      target: lines(action.exact_targets),
      steps: lines(action.implementation_steps.map((step) => `${step.title}: ${step.instruction}`)),
      completion: lines(action.definition_of_done),
      owner: action.owner_suggestion,
      schedule: period ? periodLabel[period.period] : "Timing to confirm",
      review: `Review on ${action.review_date}; ${action.validation_metrics.map((metric) => metric.success_condition).join("; ")}`,
    };
  });
}

const fields = ["title", "target", "steps", "completion", "owner", "schedule", "review"] as const;

export function validateDeliveryPlan(value: unknown, report: SearchTrustReportV2_2): DeliveryPlanAction[] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const expectedIds = new Set(report.top_actions.map((action) => action.action_id));
  const seen = new Set<string>();
  const plan: DeliveryPlanAction[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.actionId !== "string" || !expectedIds.has(candidate.actionId) || seen.has(candidate.actionId)) return null;
    const action = { actionId: candidate.actionId } as DeliveryPlanAction;
    for (const field of fields) {
      const text = candidate[field];
      if (typeof text !== "string" || text.trim().length > 2000 || ((field === "title" || field === "target") && !text.trim())) return null;
      action[field] = text.trim();
    }
    seen.add(candidate.actionId);
    plan.push(action);
  }
  return plan;
}

export function deliveryPlanDiffers(report: SearchTrustReportV2_2, plan: DeliveryPlanAction[]): boolean {
  return JSON.stringify(initialDeliveryPlan(report)) !== JSON.stringify(plan);
}

export function deliveryPlanScopeChanged(report: SearchTrustReportV2_2, action: DeliveryPlanAction): boolean {
  return action.target !== initialDeliveryPlan(report).find((item) => item.actionId === action.actionId)?.target;
}
