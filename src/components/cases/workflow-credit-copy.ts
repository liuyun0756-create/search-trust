export type WorkflowCreditState = "free" | "reserving" | "checking" | "covered" | "returned" | "attention";

export const workflowCreditCopy: Record<WorkflowCreditState, { badge: string; title: string; details: string[] }> = {
  free: { badge: "Public setup is free", title: "Before using a credit", details: [
    "Check the primary website", "Confirm the public business", "Review the service and market scope",
  ] },
  reserving: { badge: "Reserving workflow credit", title: "Confirming your start request", details: [
    "Wait for the server to confirm the workflow", "Do not start another analysis while this request is checked", "The one-credit boundary covers discovery and the report",
  ] },
  checking: { badge: "Checking workflow credit", title: "Reconnecting to the saved workflow", details: [
    "Checking the existing task and credit status", "Reconnecting does not start a new analysis", "Wait for its status before retrying",
  ] },
  covered: { badge: "1 credit covered · no extra charge", title: "One credit for this workflow", details: [
    "Deducted once when competitor discovery starts", "Continue and refresh at no extra charge", "Technical failure returns the workflow credit",
  ] },
  returned: { badge: "Credit returned", title: "The failed workflow was refunded", details: [
    "The technical failure returned the credit", "A new attempt uses one credit only when you start it", "Review the Case before restarting",
  ] },
  attention: { badge: "Check workflow status", title: "Credit status needs review", details: [
    "Open the existing Case and check its task status", "A connection error alone does not confirm a refund", "Do not start another analysis until the result is clear",
  ] },
};
