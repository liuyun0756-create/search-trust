// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CasePaymentHandoff } from "./case-payment-handoff";

describe("CasePaymentHandoff interactions", () => {
  it("starts checkout only from the ready action and keeps the Case scope visible", async () => {
    const user = userEvent.setup();
    const onCheckout = vi.fn();
    render(<CasePaymentHandoff status="ready" message="Ready for checkout." caseId="e2000000-0000-4000-8000-000000000002" onCheckout={onCheckout} onBack={vi.fn()} />);

    expect(screen.getByText(/Case e2000000-/)).toBeInTheDocument();
    const checkout = screen.getByRole("button", { name: "Continue to secure checkout" });
    expect(checkout).toBeEnabled();
    await user.click(checkout);
    expect(onCheckout).toHaveBeenCalledOnce();
  });

  it("disables a busy checkout and exposes compensated analysis retry copy", async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const { rerender } = render(<CasePaymentHandoff status="creating_checkout" message="Opening." caseId={null} onCheckout={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Opening checkout…" })).toBeDisabled();

    rerender(<CasePaymentHandoff status="analysis_failed" message="One credit has been returned. Generating again will use one credit." caseId="e2000000-0000-4000-8000-000000000002" onCheckout={vi.fn()} onRetryAnalysis={retry} onBack={vi.fn()} />);
    expect(screen.getByText(/One credit has been returned/)).toHaveAttribute("aria-live", "polite");
    await user.click(screen.getByRole("button", { name: "Generate again · uses 1 credit" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
