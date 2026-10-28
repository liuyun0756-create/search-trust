import type { CaseResource } from "@/lib/cases/service";
import type { ConnectionCenterResponse } from "@/lib/connection-center/contracts";

/** A preparation projection, deliberately not a generation authorization. */
export function firstServiceSetupView(client: CaseResource, connections: ConnectionCenterResponse) {
  if (client.id !== connections.case.id || client.status !== "active") {
    throw new Error("First-service preparation scope mismatch");
  }
  return {
    caseId: client.id,
    businessName: client.business_name,
    siteUrl: client.site_url,
    service: client.primary_service,
    market: client.target_market.display_name,
    publicProfile: client.business_identity.public_gbp_url ?? null,
    // Project only source health, not the legacy Prospect dependency, payment actions,
    // job/report payloads, or any raw provider content.
    sources: connections.sources.filter((source) => source.source_key === "gsc" || source.source_key === "ga4")
      .map((source) => ({
        key: source.source_key,
        title: source.title,
        status: source.user_status,
        summary: source.summary,
        resource: source.technical_status.resource_name,
        fetchedAt: source.technical_status.snapshot?.fetched_at ?? null,
        coverageStart: source.technical_status.snapshot?.coverage_start ?? null,
        coverageEnd: source.technical_status.snapshot?.coverage_end ?? null,
      })),
  };
}

export type FirstServiceSetupView = ReturnType<typeof firstServiceSetupView>;
