import { CASE_PROSPECT_PURCHASE, parseDodoPayment, type DodoPayment } from "./contracts";
import { CasePaymentError } from "./errors";

export interface CheckoutSession {
  session_id: string;
  checkout_url: string;
}

export interface CreateCheckoutInput {
  productId: string;
  returnUrl: string;
  cancelUrl: string;
  metadata: {
    clerk_user_id: string;
    case_id: string;
    order_id: string;
    purchase_kind: typeof CASE_PROSPECT_PURCHASE;
  };
}

function safeCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.hostname !== "dodopayments.com" && !url.hostname.endsWith(".dodopayments.com")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export class DodoClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly request: typeof fetch = fetch,
  ) {}

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const endpoint = new URL("/checkouts", this.baseUrl);
    const response = await this.request(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        product_cart: [{ product_id: input.productId, quantity: 1 }],
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        metadata: input.metadata,
      }),
    });
    if (!response.ok) {
      console.error("Dodo checkout request rejected", {
        provider_host: endpoint.hostname,
        provider_status: response.status,
      });
      throw CasePaymentError.unavailable();
    }
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    const checkoutUrl = safeCheckoutUrl(payload?.checkout_url);
    if (!payload || typeof payload.session_id !== "string" || !payload.session_id || !checkoutUrl) {
      throw CasePaymentError.unavailable();
    }
    return { session_id: payload.session_id, checkout_url: checkoutUrl };
  }

  async getPayment(paymentId: string): Promise<DodoPayment> {
    const response = await this.request(`${this.baseUrl}/payments/${encodeURIComponent(paymentId)}`, {
      method: "GET",
      headers: { authorization: `Bearer ${this.apiKey}` },
      cache: "no-store",
    });
    if (!response.ok) throw CasePaymentError.unavailable();
    const payment = parseDodoPayment(await response.json().catch(() => null));
    if (!payment) throw CasePaymentError.unavailable();
    return payment;
  }
}
