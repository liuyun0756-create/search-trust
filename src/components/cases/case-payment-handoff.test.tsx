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
    expect(html).toContain("Discovery and report included");
    expect(html).toContain("1 credit");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("locks the start action while preparing and shows charged recovery", () => {
    expect(render("creating_checkout")).toContain("disabled=\"\"");
    const unlocked = render("unlocked");
    expect(unlocked).toContain("Already covered · no second charge");
    expect(unlocked).not.toContain("Start analysis · uses 1 credit");
  });
});
