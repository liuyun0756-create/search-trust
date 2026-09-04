import { describe, expect, it, vi } from "vitest";

import { DodoClient } from "./dodo";

const input = {
  productId: "prod_report",
  returnUrl: "https://searchtrust.example/cases/new?payment=return",
  cancelUrl: "https://searchtrust.example/cases/new?payment=cancelled",
  metadata: {
    clerk_user_id: "user_123",
    case_id: "11111111-1111-4111-8111-111111111111",
    order_id: "22222222-2222-4222-8222-222222222222",
    purchase_kind: "case_prospect_report" as const,
  },
};

describe("Dodo v2.2 client", () => {
  it("creates a hosted checkout with Case metadata", async () => {
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      session_id: "cks_123",
      checkout_url: "https://test.checkout.dodopayments.com/session/cks_123",
    }), { status: 200 }));
    const client = new DodoClient("https://test.dodopayments.com", "secret", request as typeof fetch);

    await expect(client.createCheckout(input)).resolves.toEqual({
      session_id: "cks_123",
      checkout_url: "https://test.checkout.dodopayments.com/session/cks_123",
    });
    const init = request.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      product_cart: [{ product_id: "prod_report", quantity: 1 }],
      metadata: input.metadata,
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
    });
  });

  it("rejects a provider response that points outside Dodo checkout", async () => {
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      session_id: "cks_123",
      checkout_url: "https://attacker.example/collect",
    }), { status: 200 }));
    const client = new DodoClient("https://test.dodopayments.com", "secret", request as typeof fetch);
    await expect(client.createCheckout(input)).rejects.toMatchObject({ code: "CHECKOUT_UNAVAILABLE" });
  });

  it("logs only safe validation details when Dodo rejects checkout", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({
      detail: [{
        type: "value_error",
        loc: ["body", "product_cart", 0, "product_id"],
        msg: "Product is not available",
        input: "prod_private_value",
      }],
    }), { status: 422 }));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = new DodoClient("https://live.dodopayments.com", "secret", request as typeof fetch);

    await expect(client.createCheckout(input)).rejects.toMatchObject({ code: "CHECKOUT_UNAVAILABLE" });
    expect(log).toHaveBeenCalledWith("Dodo checkout request rejected", {
      provider_host: "live.dodopayments.com",
      provider_status: 422,
      provider_error: [{
        type: "value_error",
        location: ["body", "product_cart", 0, "product_id"],
        message: "Product is not available",
      }],
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("prod_private_value");
    log.mockRestore();
  });
});
