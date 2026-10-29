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
    expect(html).toContain("Organising collected evidence");
    expect(html).toContain("Stage 3 of 4");
    expect(html).not.toContain("aria-valuenow");
    expect(html).not.toContain("55%");
    expect(html).toContain("server-owned task continues");
    expect(html).not.toContain("Return to evidence boundary");
  });
});

 it.each([
   ["collecting_site", "Checking website pages and the public business profile"],
   ["collecting_competitors", "Collecting confirmed competitor evidence"],
   ["persisting", "Saving the validated report"],
 ] as const)("shows the actual %s milestone without inventing a total percentage", (analysisStage, label) => {
   const html = renderToStaticMarkup(<CasePaymentHandoff status="analyzing" message="Server stage" caseId="case"
     analysisStage={analysisStage} progress={0} onCheckout={()=>undefined} onBack={()=>undefined}/>);
   expect(html).toContain(label);
   expect(html).not.toContain("0%");
   expect(html).not.toContain('role="progressbar"');
   expect(html).toContain('aria-current="step"');
   expect(html).toContain("not time remaining");
 });

it("does not present a refunded failed workflow as still covered", () => {
  const html = render("analysis_failed");
  expect(html).toContain("Credit returned");
  expect(html).toContain("New attempt uses 1 credit");
  expect(html).not.toContain("Covered · no extra credit");
  expect(html).not.toContain("No second charge");
});
