export const E2E_IDS = Object.freeze({
  userId: "e2000000-0000-4000-8000-000000000001",
  caseId: "e2000000-0000-4000-8000-000000000002",
  discoveryJobId: "e2000000-0000-4000-8000-000000000003",
  analysisJobId: "e2000000-0000-4000-8000-000000000004",
  reportId: "e2000000-0000-4000-8000-000000000005",
  shareId: "e2000000-0000-4000-8000-000000000006",
  siteUrl: "https://searchtrust-e2e.example.invalid/",
  competitorUrl: "https://competitor-e2e.example.invalid/",
});

export function assertSyntheticFixtureValue(value: string): void {
  if (!value.includes("e2000000-") && !value.endsWith(".invalid/")) {
    throw new Error("E2E fixtures must use reserved synthetic identifiers.");
  }
}
