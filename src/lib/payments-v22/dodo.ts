import { CASE_PROSPECT_PURCHASE, parseDodoPayment, type DodoPayment } from "./contracts";
import { CasePaymentError } from "./errors";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024;

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
    purchase_kind: typeof CASE_PROSPECT_PURCHASE | "case_verified_credit";
  };
}

export interface DodoClientOptions {
  timeoutMs?: number;
  maxResponseBytes?: number;
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

function redact(value: string, redactions: string[], maxLength: number) {
  let safe = value;
  for (const redaction of redactions) {
    if (redaction) safe = safe.replaceAll(redaction, "[redacted]");
  }
  return safe.slice(0, maxLength);
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
            .map((part) => typeof part === "string" ? redact(part, redactions, 64) : part)
          : [],
        message: typeof error.msg === "string" ? redact(error.msg, redactions, 160) : undefined,
      };
    });
  }
  return redact(JSON.stringify(value), redactions, 500);
}

class DodoDeadlineError extends Error {
  constructor() {
    super("Dodo request deadline exceeded.");
    this.name = "DodoDeadlineError";
  }
}

async function boundedJson(response: Response, maxBytes: number, signal: AbortSignal): Promise<unknown> {
  const encoding = response.headers.get("content-encoding");
  if (encoding && encoding.toLowerCase() !== "identity") throw CasePaymentError.unavailable();
  const declaredRaw = response.headers.get("content-length");
  if (declaredRaw !== null) {
    const declared = Number(declaredRaw);
    if (!Number.isSafeInteger(declared) || declared < 0 || declared > maxBytes) throw CasePaymentError.unavailable();
  }
  const reader = response.body?.getReader();
  if (!reader) throw CasePaymentError.unavailable();
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw CasePaymentError.unavailable();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof CasePaymentError) throw error;
    throw CasePaymentError.unavailable();
  } finally {
    signal.removeEventListener("abort", cancel);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw CasePaymentError.unavailable();
  }
}

export class DodoClient {
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly request: typeof fetch = fetch,
    options: DodoClientOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  }

  private async requestJson(endpoint: URL, init: RequestInit): Promise<{ response: Response; payload: unknown }> {
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort();
        reject(new DodoDeadlineError());
      }, this.timeoutMs);
    });
    try {
      const operation = (async () => {
        const response = await this.request(endpoint, {
          ...init,
          signal: controller.signal,
          cache: "no-store",
          headers: { accept: "application/json", "accept-encoding": "identity", ...(init.headers ?? {}) },
        });
        const payload = await boundedJson(response, this.maxResponseBytes, controller.signal);
        return { response, payload };
      })();
      return await Promise.race([operation, deadline]);
    } catch (error) {
      if (error instanceof DodoDeadlineError || (error instanceof Error && error.name === "AbortError")) {
        throw CasePaymentError.timeout();
      }
      if (error instanceof CasePaymentError) throw error;
      throw CasePaymentError.unavailable();
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    let endpoint: URL;
    try {
      endpoint = new URL("/checkouts", this.baseUrl);
    } catch {
      throw CasePaymentError.unavailable();
    }
    const { response, payload } = await this.requestJson(endpoint, {
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
      const providerError = safeProviderError(payload, [
        input.productId,
        input.returnUrl,
        input.cancelUrl,
        ...Object.values(input.metadata),
      ]);
      console.error("Dodo checkout request rejected", {
        provider_host: endpoint.hostname,
        provider_status: response.status,
        provider_error: providerError,
      });
      throw CasePaymentError.unavailable();
    }
    const record = payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown> : null;
    const checkoutUrl = safeCheckoutUrl(record?.checkout_url);
    if (!record || typeof record.session_id !== "string" || !record.session_id || !checkoutUrl) {
      throw CasePaymentError.unavailable();
    }
    return { session_id: record.session_id, checkout_url: checkoutUrl };
  }

  async getPayment(paymentId: string): Promise<DodoPayment> {
    let endpoint: URL;
    try {
      endpoint = new URL(`/payments/${encodeURIComponent(paymentId)}`, this.baseUrl);
    } catch {
      throw CasePaymentError.unavailable();
    }
    const { response, payload } = await this.requestJson(endpoint, {
      method: "GET",
      headers: { authorization: `Bearer ${this.apiKey}` },
    });
    if (!response.ok) throw CasePaymentError.unavailable();
    const payment = parseDodoPayment(payload);
    if (!payment) throw CasePaymentError.unavailable();
    return payment;
  }
}
