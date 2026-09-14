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
  it("accepts the Verified credit purchase kind without changing the checkout shape", async () => {
    const request = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      session_id: "cks_verified",
      checkout_url: "https://test.checkout.dodopayments.com/session/cks_verified",
    }), { status: 200 }));
    const client = new DodoClient("https://test.dodopayments.com", "secret", request as typeof fetch);
    await client.createCheckout({
      ...input,
      productId: "prod_verified",
      metadata: { ...input.metadata, purchase_kind: "case_verified_credit" },
    });
    expect(JSON.parse(String((request.mock.calls[0][1] as RequestInit).body)).metadata.purchase_kind)
      .toBe("case_verified_credit");
  });

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
        msg: "Product prod_report is not available",
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
        message: "Product [redacted] is not available",
      }],
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain("prod_private_value");
    expect(JSON.stringify(log.mock.calls)).not.toContain("prod_report");
    log.mockRestore();
  });

  it("enforces one total deadline even when fetch never resolves", async () => {
    const request = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => new Promise<Response>(() => undefined));
    const client = new DodoClient("https://test.dodopayments.com", "secret", request as typeof fetch, { timeoutMs: 5 });
    await expect(client.getPayment("pay_123")).rejects.toMatchObject({ code: "CHECKOUT_TIMEOUT", status: 504 });
  });

  it("applies the same total deadline to checkout creation", async () => {
    const request = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => new Promise<Response>(() => undefined));
    const client = new DodoClient("https://test.dodopayments.com", "secret", request as typeof fetch, { timeoutMs: 5 });
    await expect(client.createCheckout(input)).rejects.toMatchObject({ code: "CHECKOUT_TIMEOUT", status: 504 });
  });

  it("enforces the same deadline while a response body trickles", async () => {
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode("{")); } });
    const request = vi.fn(async () => new Response(body, { status: 200 }));
    const client = new DodoClient("https://test.dodopayments.com", "secret", request as typeof fetch, { timeoutMs: 5 });
    await expect(client.getPayment("pay_123")).rejects.toMatchObject({ code: "CHECKOUT_TIMEOUT", status: 504 });
  });

  it.each([
    ["declared oversize", new Response("{}", { headers: { "content-length": "2049" } })],
    ["actual oversize", new Response("x".repeat(2049))],
    ["compressed", new Response("{}", { headers: { "content-encoding": "gzip" } })],
    ["malformed JSON", new Response("{not json")],
  ])("rejects %s provider responses without logging payloads", async (_label, response) => {
    const request = vi.fn(async () => response.clone());
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const client = new DodoClient("https://test.dodopayments.com", "secret", request as typeof fetch, { maxResponseBytes: 2048 });
    await expect(client.getPayment("pay_123")).rejects.toMatchObject({ code: "CHECKOUT_UNAVAILABLE" });
    expect(JSON.stringify(log.mock.calls)).not.toContain("not json");
    log.mockRestore();
  });

  it("maps provider AbortError to a safe timeout", async () => {
    const request = vi.fn(async () => { throw new DOMException("private provider detail", "AbortError"); });
    const client = new DodoClient("https://test.dodopayments.com", "secret", request as typeof fetch);
    await expect(client.getPayment("pay_123")).rejects.toMatchObject({ code: "CHECKOUT_TIMEOUT", status: 504 });
  });
});
