import type { ClientReportV22ViewModel } from "./view-model";

export function clientDeliveryLanguage(reportType: ClientReportV22ViewModel["header"]["reportType"]) {
  return reportType === "prospect"
    ? {
        stage: "Prospect proposal",
        context: "Recommendations for the first client discussion",
      }
    : {
        stage: "Service action plan",
        context: "Recommendations informed by connected client data",
      };
}

export const CLIENT_DELIVERY_STATUS =
  "These are recommended actions and planned checks. Completion and results are assessed in a later review.";
