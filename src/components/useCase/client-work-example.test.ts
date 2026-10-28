import { describe, expect, it } from "vitest";
import { clientWorkExample, formatBaseline } from "./client-work-example";

describe("Oak & Vale client work example", () => {
  it("keeps the business, target, baseline and implementation state consistent", () => {
    const example = clientWorkExample;
    expect(example.business.name).toBe("Oak & Vale Cooling");
    expect(example.page.path).toBe("/ac-repair/");
    expect(example.page.address).toBe("oakvalecooling.example/ac-repair/");
    expect(example.period).toEqual({ label: "Aug 31–Sep 27, 2026", days: 28 });
    expect(example.metrics).toEqual({
      impressions: 12_400,
      clicks: 310,
      ctr: "2.5%",
    });
    expect(example.metrics.ctr).toBe(
      `${((example.metrics.clicks / example.metrics.impressions) * 100).toFixed(1)}%`,
    );
    expect(formatBaseline(example)).toBe(
      "Aug 31–Sep 27, 2026 · 12,400 impressions · 310 clicks · 2.5% CTR",
    );
    expect(example.implementationStatus).toBe("Proposed · Not yet implemented");
  });

  it("keeps private evidence and confirmed facts out of the Prospect summary", () => {
    const example = clientWorkExample;
    expect(example.evidence.map((item) => item.id)).toEqual([
      "E01", "E02", "E03", "E04", "E05",
    ]);
    expect(example.evidence.filter((item) => item.access === "public")).toHaveLength(3);
    expect(example.evidence.filter((item) => item.access === "verified")).toHaveLength(2);
    const prospectText = JSON.stringify(example.prospect);
    expect(prospectText).not.toMatch(/12,400|310 clicks|Search Console|client confirms/i);
    expect(prospectText).toMatch(/still served|client confirmation/i);
    expect(example.verified.basis).toContain("12,400 impressions and 310 clicks");
    expect(example.verified.basis).toContain(example.period.label);
    expect(example.verified.limit).toMatch(/not qualified enquiries/i);
  });

  it("preserves the same work target and no claimed post-change outcome", () => {
    const example = clientWorkExample;
    expect(example.action.target).toBe(example.page.path);
    expect(example.action.steps).toHaveLength(4);
    expect(example.action.completion).toHaveLength(5);
    expect(example.action.review).toHaveLength(4);
    expect(example.deliveryCopy.client.proposedWork).toHaveLength(3);
    expect(example.deliveryCopy.client.intro).toContain("310 Google Search clicks");
    expect(example.deliveryCopy.seo.decision).toContain(example.page.path);
    expect(example.deliveryCopy.seo.reviewLimits).toMatch(/No implementation or post-change outcome/i);
  });
});
