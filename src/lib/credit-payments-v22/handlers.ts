import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  CasePaymentError,
  casePaymentErrorBody,
  type DodoClient,
  type DodoPayment,
} from "@/lib/payments-v22";
import {
  CREDIT_PURCHASE,
  isExactCreditPayment,
  parseCreditPaymentMetadata,
  type CreditRefundReviewReason,
} from "./contracts";
import type { CreditPaymentRepository } from "./repository";

type CurrentUser = { userId: string; clerkUserId: string } | null;

export interface CreditPaymentHandlerDependencies {
  getCurrentUser(): Promise<CurrentUser>;
  createRepository(): CreditPaymentRepository;
  createDodoClient(): DodoClient;
  isDodoConfigured(): boolean;
  getProductId(): string;
  getBaseUrl(): string;
}

function errorResponse(error: unknown, route: string, requestId: string) {
  const paymentError = error instanceof CasePaymentError ? error : CasePaymentError.internal();
  if (paymentError.status >= 500) {
    console.error("Credit payment request failed", {
      route,
      request_id: requestId,
      code: paymentError.code,
      error_type: error instanceof Error ? error.name : "UnknownError",
    });
  }
  return NextResponse.json(casePaymentErrorBody(paymentError), {
    status: paymentError.status,
    headers: { "x-request-id": requestId, "cache-control": "no-store" },
  });
}

export function parseCreditCheckoutBaseUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
    if (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) return null;
    if (url.username || url.password || url.hash || url.search || (url.pathname !== "/" && url.pathname !== "")) return null;
    return url;
  } catch {
    return null;
  }
}

function isSafeDodoCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && (url.hostname === "dodopayments.com" || url.hostname.endsWith(".dodopayments.com"));
  } catch {
    return false;
  }
}

async function requireUser(dependencies: CreditPaymentHandlerDependencies) {
  const user = await dependencies.getCurrentUser();
  if (!user) throw CasePaymentError.unauthorized();
  return user;
}

function requireCheckoutConfiguration(dependencies: CreditPaymentHandlerDependencies) {
  const productId = dependencies.getProductId().trim();
  const baseUrl = parseCreditCheckoutBaseUrl(dependencies.getBaseUrl());
  if (!dependencies.isDodoConfigured() || !productId || !baseUrl) throw CasePaymentError.unavailable();
  return { productId, baseUrl };
}

export function createCreditPaymentHandlers(dependencies: CreditPaymentHandlerDependencies) {
  return {
    async POST(_request: NextRequest) {
      const requestId = randomUUID();
      try {
        const user = await requireUser(dependencies);
        const { productId, baseUrl } = requireCheckoutConfiguration(dependencies);
        const repository = dependencies.createRepository();
        const claim = await repository.claimCheckout(user.userId, productId);
        if (claim.action === "reuse") {
          if (!claim.checkout_url || !claim.checkout_session_id || !isSafeDodoCheckoutUrl(claim.checkout_url)) {
            throw CasePaymentError.unavailable();
          }
          return NextResponse.json({
            order_id: claim.order_id,
            checkout_session_id: claim.checkout_session_id,
            checkout_url: claim.checkout_url,
            reused: true,
          }, { headers: { "x-request-id": requestId, "cache-control": "no-store" } });
        }
        if (claim.action === "initializing") {
          return NextResponse.json({
            error: { code: "CHECKOUT_INITIALIZING", message: "Secure checkout is still being prepared. Please retry shortly." },
            retry_after_seconds: claim.retry_after_seconds,
          }, {
            status: 409,
            headers: {
              "x-request-id": requestId,
              "cache-control": "no-store",
              "retry-after": String(claim.retry_after_seconds),
            },
          });
        }
        if (claim.provider_product_id !== productId) throw CasePaymentError.unavailable();

        const returnUrl = new URL("/pricing", baseUrl);
        returnUrl.searchParams.set("payment", "return");
        returnUrl.searchParams.set("order_id", claim.order_id);
        const cancelUrl = new URL("/pricing", baseUrl);
        cancelUrl.searchParams.set("payment", "cancelled");
        const checkout = await dependencies.createDodoClient().createCheckout({
          productId,
          returnUrl: returnUrl.toString(),
          cancelUrl: cancelUrl.toString(),
          metadata: {
            clerk_user_id: user.clerkUserId,
            order_id: claim.order_id,
            purchase_kind: CREDIT_PURCHASE,
          },
        });
        const attached = await repository.attachCheckoutSession({
          userId: user.userId,
          orderId: claim.order_id,
          initializationToken: claim.initialization_token,
          productId: claim.provider_product_id,
          sessionId: checkout.session_id,
          checkoutUrl: checkout.checkout_url,
        });
        if (attached.checkout_session_id !== checkout.session_id
          || attached.checkout_url !== checkout.checkout_url
          || !isSafeDodoCheckoutUrl(attached.checkout_url)) throw CasePaymentError.unavailable();
        return NextResponse.json({
          order_id: claim.order_id,
          checkout_session_id: attached.checkout_session_id,
          checkout_url: attached.checkout_url,
          reused: false,
        }, { status: 201, headers: { "x-request-id": requestId, "cache-control": "no-store" } });
      } catch (error) {
        return errorResponse(error, "POST /api/v2/credits/checkout", requestId);
      }
    },
  };
}

function exactPaymentInput(payment: DodoPayment) {
  const metadata = parseCreditPaymentMetadata(payment.metadata);
  if (!metadata || !isExactCreditPayment(payment)) throw CasePaymentError.invalid("Payment settlement is invalid.");
  return {
    metadata,
    payment: {
      localOrderId: metadata.order_id,
      paymentId: payment.payment_id,
      clerkUserId: metadata.clerk_user_id,
      amount: payment.total_amount,
      currency: payment.currency,
      checkoutSessionId: payment.checkout_session_id,
      productId: payment.product_cart[0].product_id,
    },
  };
}

export async function fulfillCreditPayment(input: {
  payment: DodoPayment;
  expectedClerkUserId?: string;
  repository: CreditPaymentRepository;
}) {
  const parsed = exactPaymentInput(input.payment);
  if (input.expectedClerkUserId && parsed.metadata.clerk_user_id !== input.expectedClerkUserId) {
    throw new CasePaymentError("PAYMENT_OWNER_MISMATCH", "Payment does not belong to the current user.", 403);
  }
  if (input.payment.status !== "succeeded") throw CasePaymentError.paymentPending(input.payment.status);
  return input.repository.fulfill(parsed.payment);
}

export async function refundCreditPayment(input: {
  payment: DodoPayment;
  providerRefundId: string;
  repository: CreditPaymentRepository;
}) {
  const parsed = exactPaymentInput(input.payment);
  return input.repository.refund({ ...parsed.payment, providerRefundId: input.providerRefundId });
}

export async function recordCreditRefundReview(input: {
  payment: DodoPayment;
  providerRefundId: string;
  reason: Exclude<CreditRefundReviewReason, "credit_already_spent">;
  refundAmount: number | null;
  refundCurrency: string | null;
  isPartial: boolean;
  repository: CreditPaymentRepository;
}) {
  const parsed = exactPaymentInput(input.payment);
  return input.repository.recordRefundReview({
    ...parsed.payment,
    providerRefundId: input.providerRefundId,
    reason: input.reason,
    refundAmount: input.refundAmount,
    refundCurrency: input.refundCurrency,
    isPartial: input.isPartial,
    paymentRefundStatus: input.payment.refund_status,
  });
}

export function createCreditPaymentConfirmHandler(dependencies: CreditPaymentHandlerDependencies) {
  return {
    async POST(request: NextRequest) {
      const requestId = randomUUID();
      try {
        const user = await requireUser(dependencies);
        if (!dependencies.isDodoConfigured()) throw CasePaymentError.unavailable();
        const body = await request.json().catch(() => null) as { payment_id?: unknown } | null;
        if (!body || typeof body.payment_id !== "string" || !body.payment_id) {
          throw CasePaymentError.invalid("payment_id is required.");
        }
        const payment = await dependencies.createDodoClient().getPayment(body.payment_id);
        const result = await fulfillCreditPayment({
          payment,
          expectedClerkUserId: user.clerkUserId,
          repository: dependencies.createRepository(),
        });
        return NextResponse.json({
          ok: true,
          payment_id: payment.payment_id,
          credits_added: result.credits_added,
          credit_balance: result.credit_balance,
          already_confirmed: result.idempotent,
        }, { headers: { "x-request-id": requestId, "cache-control": "no-store" } });
      } catch (error) {
        return errorResponse(error, "POST /api/v2/credits/checkout/confirm", requestId);
      }
    },
  };
}
