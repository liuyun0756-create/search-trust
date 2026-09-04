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

function safeProviderError(value: unknown, redactions: string[]) {
  if (!value || typeof value !== "object") return undefined;
  const detail = (value as { detail?: unknown }).detail;
  if (Array.isArray(detail)) {
    return detail.slice(0, 3).map((item) => {
      if (!item || typeof item !== "object") return { type: "unknown" };
      const error = item as { type?: unknown; loc?: unknown; msg?: unknown };
      return {
        type: typeof error.type === "string" ? error.type : "unknown",
        location: Array.isArray(error.loc)
          ? error.loc.filter((part): part is string | number => typeof part === "string" || typeof part === "number")
          : [],
        message: typeof error.msg === "string" ? error.msg.slice(0, 160) : undefined,
      };
    });
  }
  let summary = JSON.stringify(value).slice(0, 500);
  for (const redaction of redactions) {
    if (redaction) summary = summary.replaceAll(redaction, "[redacted]");
  }
  return summary;
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
      const providerError = safeProviderError(await response.json().catch(() => null), [
        input.productId,
        input.returnUrl,
        input.cancelUrl,
        ...Object.values(input.metadata),
      ]);
      let productListStatus: number | undefined;
      let productCandidates: Array<Record<string, unknown>> | undefined;
      if (response.status === 422) {
        const productsEndpoint = new URL("/products?page_size=100&recurring=false", this.baseUrl);
        const productsResponse = await this.request(productsEndpoint, {
          method: "GET",
          headers: { authorization: `Bearer ${this.apiKey}` },
          cache: "no-store",
        }).catch(() => null);
        productListStatus = productsResponse?.status;
        const productsPayload = productsResponse?.ok
          ? await productsResponse.json().catch(() => null) as { items?: unknown } | null
          : null;
        const products = Array.isArray(productsPayload?.items) ? productsPayload.items : [];
        productCandidates = products.slice(0, 20).map((item) => {
          if (!item || typeof item !== "object") return { product_id: "unknown" };
          const product = item as Record<string, unknown>;
          return {
            product_id: typeof product.product_id === "string" ? product.product_id : "unknown",
            name: typeof product.name === "string" ? product.name.slice(0, 100) : undefined,
            currency: typeof product.currency === "string" ? product.currency : undefined,
            price: typeof product.price === "number" ? product.price : undefined,
          };
        });
      }
      console.error("Dodo checkout request rejected", {
        provider_host: endpoint.hostname,
        provider_status: response.status,
        provider_error: providerError,
        product_list_status: productListStatus,
        product_candidates: productCandidates,
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
