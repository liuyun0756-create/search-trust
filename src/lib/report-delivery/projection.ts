import type { SearchTrustReportV2_2 } from "@/lib/report-v22/generated/types";
import {
  buildReportV22ViewModel,
  type AdvisorReportV22ViewModel,
  type ClientReportV22ViewModel,
  type ReportV22Mode,
  type ReportV22ViewModel,
} from "@/lib/report-v22/view-model";
import { deliveryPlanDiffers, deliveryPlanScopeChanged, validateDeliveryPlan, type DeliveryPlanAction } from "./plan";

function split(value: string, fallback: string) {
  const entries = value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 12);
  return entries.length ? entries : [fallback];
}

function reviewed(action: DeliveryPlanAction, report: SearchTrustReportV2_2) {
  return {
    target: action.target,
    steps: action.steps,
    completion: action.completion,
    owner: action.owner,
    schedule: action.schedule,
    review: action.review,
    scopeChanged: deliveryPlanScopeChanged(report, action),
  };
}

export function buildDeliveryViewModel(report: SearchTrustReportV2_2, mode: "client", plan?: DeliveryPlanAction[] | null): ClientReportV22ViewModel;
export function buildDeliveryViewModel(report: SearchTrustReportV2_2, mode: "advisor", plan?: DeliveryPlanAction[] | null): AdvisorReportV22ViewModel;
export function buildDeliveryViewModel(report: SearchTrustReportV2_2, mode: ReportV22Mode, plan?: DeliveryPlanAction[] | null): ReportV22ViewModel;
export function buildDeliveryViewModel(report: SearchTrustReportV2_2, mode: ReportV22Mode, plan?: DeliveryPlanAction[] | null): ReportV22ViewModel {
  const base = mode === "client" ? buildReportV22ViewModel(report, "client") : buildReportV22ViewModel(report, "advisor");
  if (!plan) return base;
  const valid = validateDeliveryPlan(plan, report);
  if (!valid) throw new Error("Stored delivery plan is invalid for this report.");
  if (!deliveryPlanDiffers(report, valid)) return base;

  if (base.mode === "client") {
    const originalById = new Map(report.client_delivery.priority_actions.map((action) => [action.action_id, action]));
    const baseBySequence = new Map(base.actions.map((action) => [action.sequence, action]));
    const actions = valid.map((item, index) => {
      const original = originalById.get(item.actionId);
      if (!original) throw new Error("Delivery plan action is missing from the report.");
      const prior = baseBySequence.get(original.sequence);
      if (!prior) throw new Error("Client action is missing from the report.");
      const planDetail = reviewed(item, report);
      return {
        ...prior,
        sequence: index + 1,
        title: item.title,
        expectedResult: planDetail.scopeChanged ? "The revised scope needs separate validation before an outcome can be expected." : prior.expectedResult,
        reviewedPlan: planDetail,
      };
    });
    return {
      ...base,
      actions,
      deliveryPlanEdited: true,
      roadmap: base.roadmap.map((phase, index) => ({
        ...phase,
        label: valid[index].schedule || "Timing to confirm",
        objective: valid[index].title,
        expectedResult: valid[index].completion || "Completion standard to confirm",
      })),
    };
  }

  const originals = new Map(base.actions.map((action) => [action.actionId, action]));
  const actions = valid.map((item, index) => {
    const original = originals.get(item.actionId);
    if (!original) throw new Error("Advisor action is missing from the report.");
    const details = reviewed(item, report);
    const steps = split(item.steps, "Execution details to confirm");
    return {
      ...original,
      sequence: index + 1,
      clientFacingExplanation: item.title,
      exactTargets: split(item.target, "Target to confirm") as typeof original.exactTargets,
      implementationSteps: steps.map((step, stepIndex) => ({ sequence: stepIndex + 1, title: `Step ${stepIndex + 1}`, instruction: step })) as typeof original.implementationSteps,
      definitionOfDone: split(item.completion, "Completion standard to confirm") as typeof original.definitionOfDone,
      ownerSuggestion: item.owner || "Owner to confirm",
      reviewedPlan: details,
    };
  });
  return {
    ...base,
    actions,
    deliveryPlanEdited: true,
    roadmap: base.roadmap.map((phase, index) => ({
      ...phase,
      label: valid[index].schedule || "Timing to confirm",
      objective: valid[index].title,
      actionIds: [valid[index].actionId],
      actionLabels: [valid[index].title],
      exitCriteria: split(valid[index].completion, "Completion standard to confirm"),
    })),
  };
}
