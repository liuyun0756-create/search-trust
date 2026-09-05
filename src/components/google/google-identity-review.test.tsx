import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GoogleResource } from "@/lib/google-resources/contracts";
import type { IdentityAssessment } from "@/lib/google-resources/identity";
import { GoogleIdentityReview } from "./google-identity-review";

const resource: GoogleResource = { source: "gsc", id: "sc-domain:example.com", name: "Example", kind: "site", parent: null, account_name: null,
  website_urls: ["https://example.com/"], address: null, service_areas: [], permission: null, selectable: true, identity_review_token: "a".repeat(64) };
function render(status: IdentityAssessment["status"], confirmed = false, busy = false, token: string | undefined = resource.identity_review_token) {
  return renderToStaticMarkup(<GoogleIdentityReview resource={{ ...resource, identity_review_token: token,
    identity_assessment: { version: "v22-052.1", status, confidence: status === "matched" ? "high" : "medium", reasons: ["BRANCH_REVIEW"] } }}
    caseIdentity={{ business_name: "Case business", site_url: "https://example.com/", operating_model: "storefront", location: "Boston, US" }}
    confirmed={confirmed} busy={busy} onConfirm={() => {}} onSave={() => {}} onReview={() => {}} replaces="Search Console" />);
}
function saveDisabled(html: string) { return /<button[^>]* disabled=""[^>]*>Save this resource<\/button>/.test(html); }
describe("Google resource identity review", () => {
  it("allows high-confidence selection without an unnecessary checkbox", () => {
    const html = render("matched");
    expect(saveDisabled(html)).toBe(false);
    expect(html).toContain("High-confidence match");
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain("Boston, US"); expect(html).toContain("This replaces the current Search Console");
  });
  it("requires an unchecked explicit confirmation for uncertain evidence", () => {
    const html = render("needs_confirmation");
    expect(saveDisabled(html)).toBe(true); expect(html).toContain('type="checkbox"');
    expect(html).not.toContain('checked=""');
    expect(html).toContain("cannot automatically distinguish this branch");
    expect(saveDisabled(render("needs_confirmation", true))).toBe(false);
  });
  it("never enables a mismatched resource even if the checkbox state is stale", () => {
    const html = render("mismatch", true);
    expect(saveDisabled(html)).toBe(true); expect(html).not.toContain('type="checkbox"');
    expect(html).toContain("Identity mismatch");
  });
  it("disables saving while loading or without a preview digest", () => {
    expect(saveDisabled(render("matched", false, true))).toBe(true);
    expect(saveDisabled(render("matched", false, false, ""))).toBe(true);
  });
});
