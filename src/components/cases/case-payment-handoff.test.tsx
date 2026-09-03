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
  it("shows a Case-scoped one-time checkout before payment", () => {
    const html = render("ready");
    expect(html).toContain("Continue to secure checkout");
    expect(html).toContain("Unlocks only this Case");
    expect(html).toContain("$19");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("locks the checkout action while preparing and shows the paid entitlement", () => {
    expect(render("creating_checkout")).toContain("disabled=\"\"");
    const unlocked = render("unlocked");
    expect(unlocked).toContain("1 prospect report available");
    expect(unlocked).not.toContain("Continue to secure checkout");
  });
});
