import { describe, expect, it } from "vitest";

import prospectFixture from "@/lib/report-v22/contracts/fixtures/prospect.json";
import type { SearchTrustReportV2_2 } from "@/lib/report-v22/generated/types";
import { initialDeliveryPlan, validateDeliveryPlan } from "./plan";
import { buildDeliveryViewModel } from "./projection";

const report = prospectFixture as unknown as SearchTrustReportV2_2;

describe("SEO-reviewed delivery plan", () => {
  it("requires exactly the three original actions and rejects duplicate or invented IDs", () => {
    const original = initialDeliveryPlan(report);
    expect(validateDeliveryPlan(original, report)).toEqual(original);
    expect(validateDeliveryPlan([original[0], original[0], original[2]], report)).toBeNull();
    expect(validateDeliveryPlan([{ ...original[0], actionId: "invented" }, original[1], original[2]], report)).toBeNull();
    expect(validateDeliveryPlan([{ ...original[0], title: " " }, original[1], original[2]], report)).toBeNull();
  });

  it("uses one reordered plan for SEO and client views while preserving source evidence", () => {
    const original = initialDeliveryPlan(report);
    const edited = [original[2], { ...original[0], title: "Revise the service page", target: "A different service page" }, original[1]];
    const advisor = buildDeliveryViewModel(report, "advisor", edited);
    const client = buildDeliveryViewModel(report, "client", edited);

    expect(advisor.actions.map((action) => action.actionId)).toEqual(edited.map((action) => action.actionId));
    expect(client.actions.map((action) => action.title)).toEqual(edited.map((action) => action.title));
    expect(client.actions[1].reviewedPlan?.scopeChanged).toBe(true);
    expect(client.actions[1].expectedResult).toContain("separate validation");
    expect(advisor.evidence).toEqual(buildDeliveryViewModel(report, "advisor").evidence);
    expect(client.evidenceCards).toEqual(buildDeliveryViewModel(report, "client").evidenceCards);
    expect(report.top_actions[0].exact_targets).not.toContain("A different service page");
  });
});
