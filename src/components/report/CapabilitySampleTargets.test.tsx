import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { novaSampleDelivery, sampleTargetDelivery, sampleTarget, targetQueries, ordinaryTarget, unmatchedTarget } from "@/lib/report-capability/fixtures/sample-target-delivery";
import { readerTarget } from "@/lib/report-capability/reader-copy";
import { CapabilityReportDocument } from "./CapabilityReportDocument";
import { CapabilitySharedReport } from "./CapabilitySharedReport";

describe("P0-01 sample targets", () => {
  it.runIf(Boolean(process.env.P0_01_NOVA_REPORT_PATH))("renders the real Nova report in client, shared and advisor views without changing the delivery", () => {
    const delivery = novaSampleDelivery();
    const before = JSON.stringify(delivery);
    for (const element of [<CapabilityReportDocument key="client" document={delivery.document} />,
      <CapabilitySharedReport key="share" delivery={delivery} token="fixture-token" />]) {
      const html = renderToStaticMarkup(element);
      expect(html).toContain("Plumbing repair Fresno · Organic search");
      expect(html).not.toContain("36.774001");
      expect(html).not.toContain("· en · mobile");
    }
    const advisor = renderToStaticMarkup(<CapabilityReportDocument document={delivery.document} technicalDetails />);
    expect(advisor).toContain("36.774001,-119.68942 · en · mobile");
    expect(JSON.stringify(delivery)).toBe(before);
  });
  it.each(["client", "share"] as const)("cleans every sampling field and execution steps in the %s view without changing the delivery", (view) => {
    const delivery = sampleTargetDelivery();
    const before = JSON.stringify(delivery);
    const html = renderToStaticMarkup(view === "share"
      ? <CapabilitySharedReport delivery={delivery} token="fixture-token" />
      : <CapabilityReportDocument document={delivery.document} />);
    expect(html).not.toContain("36.774001");
    expect(html).not.toContain("-119.68942");
    // The deliberately non-sample string must keep its original suffix.
    expect(html.replaceAll(unmatchedTarget, "")).not.toContain("· en · mobile");
    expect(html).not.toContain("· en · desktop");
    for (const query of targetQueries) expect(html).toContain(`${query} · Organic search`);
    expect(html).toContain(ordinaryTarget);
    expect(html).toContain(unmatchedTarget);
    expect(html.match(/Scope query · Organic search/g)).toHaveLength(1);
    expect(JSON.stringify(delivery)).toBe(before);
  });

  it("retains complete sampling conditions in every advisor field, including execution steps", () => {
    const delivery = sampleTargetDelivery();
    const before = JSON.stringify(delivery);
    const html = renderToStaticMarkup(<CapabilityReportDocument document={delivery.document} technicalDetails />);
    for (const query of targetQueries) expect(html).toContain(sampleTarget(query));
    expect(html).toContain(sampleTarget(targetQueries[0], "desktop"));
    expect(JSON.stringify(delivery)).toBe(before);
  });

  it("deduplicates sample targets and keeps URLs and non-sample text unchanged", () => {
    expect(readerTarget(`${sampleTarget("Plumbing repair Fresno")}\n${sampleTarget("Plumbing repair Fresno", "desktop")}`))
      .toBe("Plumbing repair Fresno · Organic search");
    expect(readerTarget("Plumbing repair Fresno · maps · 36.774001,-119.68942 · en · mobile"))
      .toBe("Plumbing repair Fresno · Maps");
    expect(readerTarget("Plumbing repair Fresno · local_pack · 36.774001,-119.68942 · en-US · mobile"))
      .toBe("Plumbing repair Fresno · Search-result local pack");
    for (const value of [ordinaryTarget, unmatchedTarget, "Plain text", ""]) expect(readerTarget(value)).toBe(value);
  });
});
