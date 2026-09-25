import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CasePaymentHandoff } from "./case-payment-handoff";

function render(status: Parameters<typeof CasePaymentHandoff>[0]["status"]) {
  return renderToStaticMarkup(
    <CasePaymentHandoff
      status={status}
      message="Safe status message"
      caseId="11111111-1111-4111-8111-111111111111"
      onCheckout={() => undefined}
      onBack={() => undefined}
    />,
  );
}

describe("CasePaymentHandoff", () => {
  it("shows the one-credit Prospect workflow before reservation", () => {
    const html = render("ready");
    expect(html).toContain("Start analysis · uses 1 credit");
    expect(html).toContain("Ready to start the complete Prospect analysis");
    expect(html).toContain("Report build");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("locks the start action while preparing and shows charged recovery", () => {
    expect(render("creating_checkout")).toContain("disabled=\"\"");
    const unlocked = render("unlocked");
    expect(unlocked).toContain("Covered · no extra credit");
    expect(unlocked).not.toContain("Start analysis · uses 1 credit");
  });

  it("shows the report stages and a safe background-task promise while analyzing", () => {
    const html = renderToStaticMarkup(
      <CasePaymentHandoff
        status="analyzing"
        message="Connecting findings to evidence."
        caseId="11111111-1111-4111-8111-111111111111"
        businessName="Example Plumbing"
        scopeLine="Emergency plumbing · Austin · 1 confirmed competitor"
        analysisStage="building_evidence"
        progress={55}
        onCheckout={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(html).toContain("Building your evidence-backed Prospect report");
    expect(html).toContain("Judgment synthesis");
    expect(html).toContain("aria-valuenow=\"55\"");
    expect(html).toContain("server-owned task continues");
    expect(html).not.toContain("Return to evidence boundary");
  });
});
