import { describe, expect, it } from "vitest";
import type { CaseResource } from "@/lib/cases/service";
import { connectionCenterFixture } from "../../../e2e/fixtures/google";
import { preflightFixture } from "../../../e2e/fixtures/preflight";
import { firstServiceSetupView } from "./view";

const connections = connectionCenterFixture("needs_resources");
const client = {
  id: connections.case.id, status: "active", business_name: "Existing Client", site_url: "https://example.test/",
  business_identity: preflightFixture.identity_candidates[0].business,
  primary_service: "Repair", target_market: { display_name: "Austin" },
} as CaseResource;

describe("first-service preparation view", () => {
  it("projects only connection information, not legacy prerequisites, readiness or a billing authorization", () => {
    const result = firstServiceSetupView(client, connections);
    expect(result.sources.map((source) => source.key)).toEqual(["gsc", "ga4"]);
    expect(result).toMatchObject({ caseId: client.id, service: "Repair", market: "Austin" });
    expect(result).not.toHaveProperty("coverage");
    expect(result).not.toHaveProperty("billing");
    expect(result).not.toHaveProperty("verified_job");
    expect(result.sources[0]).not.toHaveProperty("action");
    expect(JSON.stringify(result)).not.toContain("parent_report_id");
  });
  it("does not invent public evidence from a saved link", () => {
    const result = firstServiceSetupView(client, connections);
    expect(result.publicProfile).toBe(client.business_identity.public_gbp_url);
    expect(result.sources).toHaveLength(2);
    expect(firstServiceSetupView({ ...client, business_identity: { ...client.business_identity, public_gbp_url: null } }, connections).publicProfile).toBeNull();
  });
  it("rejects an archived or mismatched Case", () => {
    expect(() => firstServiceSetupView({ ...client, status: "archived" }, connections)).toThrow();
    expect(() => firstServiceSetupView({ ...client, id: "another" }, connections)).toThrow();
  });
});
