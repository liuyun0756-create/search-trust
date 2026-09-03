import { describe, expect, it } from "vitest";

import { parseCasePaymentMetadata, parseDodoPayment } from "./contracts";

const metadata = {
  clerk_user_id: "user_123",
  case_id: "11111111-1111-4111-8111-111111111111",
  order_id: "22222222-2222-4222-8222-222222222222",
  purchase_kind: "case_prospect_report",
};

describe("v2.2 case payment contracts", () => {
  it("accepts only complete Case-scoped metadata", () => {
    expect(parseCasePaymentMetadata(metadata)).toEqual(metadata);
    expect(parseCasePaymentMetadata({ ...metadata, case_id: "not-a-uuid" })).toBeNull();
    expect(parseCasePaymentMetadata({ ...metadata, purchase_kind: "legacy_credit" })).toBeNull();
    expect(parseCasePaymentMetadata({ ...metadata, extra: "ignored" })).toEqual(metadata);
  });

  it("normalizes a Dodo payment without trusting arbitrary shapes", () => {
    expect(parseDodoPayment({
      payment_id: "pay_123",
      status: "succeeded",
      total_amount: 1900,
      currency: "USD",
      metadata,
    })).toMatchObject({ payment_id: "pay_123", total_amount: 1900 });
    expect(parseDodoPayment({ status: "succeeded", total_amount: 1900, currency: "USD", metadata })).toBeNull();
    expect(parseDodoPayment({ payment_id: "pay_123", status: "succeeded", total_amount: "1900", currency: "USD", metadata })).toBeNull();
  });
});

