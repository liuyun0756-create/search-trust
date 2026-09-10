import { E2E_IDENTITY } from "../../src/lib/e2e-v22/config";

export const E2E_IDS = Object.freeze({
  userId: E2E_IDENTITY.internalUserId,
  caseId: "e2000000-0000-4000-8000-000000000002",
  discoveryJobId: "e2000000-0000-4000-8000-000000000003",
  analysisJobId: "e2000000-0000-4000-8000-000000000004",
  reportId: "e2000000-0000-4000-8000-000000000005",
  shareId: "e2000000-0000-4000-8000-000000000006",
  preflightId: "e2000000-0000-4000-8000-000000000007",
  discoveryId: "e2000000-0000-4000-8000-000000000008",
  marketSnapshotId: "e2000000-0000-4000-8000-000000000009",
  orderId: "e2000000-0000-4000-8000-00000000000a",
  connectionId: "e2000000-0000-4000-8000-00000000000b",
  gscBindingId: "e2000000-0000-4000-8000-00000000000c",
  ga4BindingId: "e2000000-0000-4000-8000-00000000000d",
  gbpBindingId: "e2000000-0000-4000-8000-00000000000e",
  gscSnapshotId: "e2000000-0000-4000-8000-00000000000f",
  ga4SnapshotId: "e2000000-0000-4000-8000-000000000010",
  gbpSnapshotId: "e2000000-0000-4000-8000-000000000011",
  syncJobId: "e2000000-0000-4000-8000-000000000012",
  competitorIds: [
    "cp_searchtrust_e2e_1",
    "cp_searchtrust_e2e_2",
    "cp_searchtrust_e2e_3",
  ],
  siteUrl: "https://searchtrust-e2e.example.invalid/",
  competitorUrl: "https://competitor-e2e.example.invalid/",
  gbpUrl: "https://gbp.searchtrust-e2e.example.invalid/location",
});

export function assertSyntheticFixtureValue(value: string): void {
  let invalidDomain = false;
  try { invalidDomain = new URL(value).hostname.endsWith(".invalid"); } catch { /* UUIDs are checked below. */ }
  if (!value.includes("e2000000-") && !value.startsWith("cp_searchtrust_e2e_") && !invalidDomain) {
    throw new Error("E2E fixtures must use reserved synthetic identifiers.");
  }
}
