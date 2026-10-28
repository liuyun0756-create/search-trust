// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BillingDetails } from "./BillingDetails";
import { WhatOneCreditStarts } from "./WhatOneCreditStarts";
import { pricingFAQData, pricingJsonLd } from "./pricing-content";
import { FAQAccordion } from "@/components/common/FAQAccordion";
import { clientWorkExample } from "@/components/useCase/client-work-example";

describe("pricing deliverables and rules", () => {
  it("shows concrete stage-appropriate excerpts with shared evidence and links", () => {
    render(<WhatOneCreditStarts />);
    const cards = screen.getAllByRole("article");
    expect(cards).toHaveLength(2);
    expect(screen.getAllByText("1 credit")).toHaveLength(2);
    expect(within(cards[0]).getByText(/Fast, reliable cooling solutions/)).toBeVisible();
    expect(within(cards[0]).queryByText(/12,400/)).not.toBeInTheDocument();
    expect(within(cards[1]).getByText(new RegExp(clientWorkExample.metrics.impressions.toLocaleString("en-US")))).toBeVisible();
    expect(within(cards[1]).getByText(/completed Prospect Case with eligible client data/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Read the sample report" })).toHaveAttribute("href", "/sample-report#sample-prospect");
    expect(screen.getByRole("link", { name: "Read the sample plan" })).toHaveAttribute("href", "/sample-report#sample-verified");
    expect(screen.queryByText(/five credits can follow/i)).not.toBeInTheDocument();
  });
  it("keeps four rules and the real refund policy link", () => {
    render(<BillingDetails />);
    expect(screen.getAllByRole("term")).toHaveLength(4);
    expect(screen.getByText("1 additional credit")).toBeVisible();
    expect(screen.getByText("No additional credit")).toBeVisible();
    expect(screen.getByRole("link", { name: "Refund policy" })).toHaveAttribute("href", "/refund-policy");
  });
  it("uses the same seven answers for schema and accessible, fully collapsible FAQ", () => {
    render(<FAQAccordion items={pricingFAQData} initialOpenIndex={null} collapsible />);
    expect(pricingJsonLd.mainEntity).toHaveLength(7);
    pricingFAQData.forEach((item, i) => {
      expect(pricingJsonLd.mainEntity[i].acceptedAnswer.text).toBe(item.answer);
      const button = screen.getByRole("button", { name: item.question });
      expect(button).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(button);
      expect(screen.getByRole("region", { name: item.question })).toHaveTextContent(item.answer);
      fireEvent.click(button);
      expect(button).toHaveAttribute("aria-expanded", "false");
    });
  });
});
