// The frozen report and its identity review must agree on the complete version pair.
export const identityReportVersions = {
  v22_capability_public_v13: ["v22_analysis_input_v3", "2.2.8"],
  v22_capability_public_v14: ["v22_analysis_input_v4", "2.2.9"],
  v22_capability_public_v15: ["v22_analysis_input_v5", "2.2.10"],
  v22_capability_public_v16: ["v22_analysis_input_v6", "2.2.11"],
  v22_capability_public_v17: ["v22_analysis_input_v7", "2.2.12"],
  v22_capability_public_v18: ["v22_analysis_input_v8", "2.2.13"],
  v22_capability_public_v20: ["v22_analysis_input_v10", "2.2.15"],
} as const;

export const inheritedIdentityReportVersions = {
  v22_capability_public_v21: ["v22_analysis_input_v11", "2.2.16"],
  v22_capability_public_v22: ["v22_analysis_input_v12", "2.2.17"],
} as const;

const reviewVersions = { ...identityReportVersions, ...inheritedIdentityReportVersions };

export function supportsIdentityReview(reportType: string, ruleset: unknown, schema: unknown) {
  return reportType === "prospect" && typeof ruleset === "string"
    && Object.hasOwn(reviewVersions, ruleset) && reviewVersions[ruleset as keyof typeof reviewVersions][1] === schema;
}
