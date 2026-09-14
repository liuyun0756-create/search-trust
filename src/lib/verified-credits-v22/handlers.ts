import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import type { CaseService } from "@/lib/cases/service";
import {
  CasePaymentError,
  casePaymentErrorBody,
  isUuid,
  type DodoClient,
  type DodoPayment,
} from "@/lib/payments-v22";
import {
  CASE_VERIFIED_CREDIT_PURCHASE,
  isExactVerifiedCreditPayment,
  parseVerifiedCreditPaymentMetadata,
} from "./contracts";
import type { VerifiedCreditRepository } from "./repository";

type CurrentUser = { userId: string; clerkUserId: string } | null;

export interface VerifiedCreditHandlerDependencies {
  getCurrentUser(): Promise<CurrentUser>;
  createCaseService(): CaseService;
  createRepository(): VerifiedCreditRepository;
  createDodoClient(): DodoClient;
  isCheckoutEnabled(): boolean;
  isDodoConfigured(): boolean;
  getProductId(): string;
  getBaseUrl(): string;
}

function errorResponse(error: unknown, route: string, requestId: string) {
  const paymentError = error instanceof CasePaymentError ? error : CasePaymentError.internal();
  if (paymentError.status >= 500) {
    console.error("Verified credit payment request failed", {
      route,
      request_id: requestId,
      code: paymentError.code,
      error_type: error instanceof Error ? error.name : "UnknownError",
    });
  }
  return NextResponse.json(casePaymentErrorBody(paymentError), {
    status: paymentError.status,
    headers: { "x-request-id": requestId },
  });
}

async function requireUser(dependencies: VerifiedCreditHandlerDependencies) {
  const user = await dependencies.getCurrentUser();
  if (!user) throw CasePaymentError.unauthorized();
  return user;
}

async function requireOwnedCase(dependencies: VerifiedCreditHandlerDependencies, userId: string, caseId: string) {
  if (!isUuid(caseId)) throw CasePaymentError.invalid("The Case ID is invalid.");
  try {
    await dependencies.createCaseService().get(userId, caseId);
  } catch {
    throw CasePaymentError.notFound();
  }
}

export function parseVerifiedCheckoutBaseUrl(raw: string): URL | null {
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

function requireCheckoutConfiguration(dependencies: VerifiedCreditHandlerDependencies) {
  const productId = dependencies.getProductId();
  const baseUrl = dependencies.getBaseUrl();
  if (!dependencies.isCheckoutEnabled() || !dependencies.isDodoConfigured() || !productId || !baseUrl) {
    throw CasePaymentError.unavailable();
  }
  const parsedBaseUrl = parseVerifiedCheckoutBaseUrl(baseUrl);
  if (!parsedBaseUrl) throw CasePaymentError.unavailable();
  return { productId, baseUrl: parsedBaseUrl };
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

export function createVerifiedCreditHandlers(dependencies: VerifiedCreditHandlerDependencies) {
  type Context = { params: Promise<{ id: string }> };
  return {
    async GET(_request: NextRequest, context: Context) {
      const requestId = randomUUID();
      try {
        const user = await requireUser(dependencies);
        const caseId = (await context.params).id;
        await requireOwnedCase(dependencies, user.userId, caseId);
        const auditCredits = await dependencies.createRepository().getBalance(user.userId);
        return NextResponse.json({ case_id: caseId, audit_credits: auditCredits }, {
          headers: { "x-request-id": requestId, "cache-control": "no-store" },
        });
      } catch (error) {
        return errorResponse(error, "GET /api/v2/cases/:id/verified-credit/checkout", requestId);
      }
    },

    async POST(_request: NextRequest, context: Context) {
      const requestId = randomUUID();
      let pendingOrderId: string | null = null;
      let repository: VerifiedCreditRepository | null = null;
      try {
        const user = await requireUser(dependencies);
        const caseId = (await context.params).id;
        await requireOwnedCase(dependencies, user.userId, caseId);
        const { productId, baseUrl } = requireCheckoutConfiguration(dependencies);
        repository = dependencies.createRepository();
        const existing = await repository.getPendingCheckout(user.userId, caseId);
        if (existing?.checkout_session_id && existing.checkout_url
          && existing.provider_product_id === productId && isSafeDodoCheckoutUrl(existing.checkout_url)) {
          return NextResponse.json({
            case_id: caseId,
            order_id: existing.id,
            checkout_session_id: existing.checkout_session_id,
            checkout_url: existing.checkout_url,
            reused: true,
          }, { headers: { "x-request-id": requestId } });
        }
        if (existing) {
          await repository.markOrderFailed(existing.id);
        }

        const order = await repository.createPendingOrder(user.userId, caseId, productId);
        pendingOrderId = order.id;
        const connectionPath = `/cases/${caseId}/connections`;
        const returnUrl = new URL(connectionPath, baseUrl);
        returnUrl.searchParams.set("payment", "return");
        returnUrl.searchParams.set("order_id", order.id);
        const cancelUrl = new URL(connectionPath, baseUrl);
        cancelUrl.searchParams.set("payment", "cancelled");

        const checkout = await dependencies.createDodoClient().createCheckout({
          productId,
          returnUrl: returnUrl.toString(),
          cancelUrl: cancelUrl.toString(),
          metadata: {
            clerk_user_id: user.clerkUserId,
            case_id: caseId,
            order_id: order.id,
            purchase_kind: CASE_VERIFIED_CREDIT_PURCHASE,
          },
        });
        await repository.attachCheckoutSession(order.id, checkout.session_id, checkout.checkout_url);
        return NextResponse.json({
          case_id: caseId,
          order_id: order.id,
          checkout_session_id: checkout.session_id,
          checkout_url: checkout.checkout_url,
          reused: false,
        }, { status: 201, headers: { "x-request-id": requestId } });
      } catch (error) {
        if (repository && pendingOrderId) await repository.markOrderFailed(pendingOrderId).catch(() => undefined);
        return errorResponse(error, "POST /api/v2/cases/:id/verified-credit/checkout", requestId);
      }
    },
  };
}

function verifiedPaymentInput(payment: DodoPayment, expectedProductId: string) {
  const metadata = parseVerifiedCreditPaymentMetadata(payment.metadata);
  if (!metadata || !isExactVerifiedCreditPayment(payment, expectedProductId)) {
    throw CasePaymentError.invalid("Payment settlement is invalid.");
  }
  return { metadata, payment: {
    localOrderId: metadata.order_id,
    paymentId: payment.payment_id,
    clerkUserId: metadata.clerk_user_id,
    caseId: metadata.case_id,
    amount: payment.total_amount,
    currency: payment.currency,
    checkoutSessionId: payment.checkout_session_id,
    productId: expectedProductId,
  } };
}

export async function fulfillVerifiedCreditPayment(input: {
  payment: DodoPayment;
  expectedClerkUserId?: string;
  expectedCaseId?: string;
  expectedProductId: string;
  repository: VerifiedCreditRepository;
}) {
  const parsed = verifiedPaymentInput(input.payment, input.expectedProductId);
  if (input.expectedClerkUserId && parsed.metadata.clerk_user_id !== input.expectedClerkUserId) {
    throw new CasePaymentError("PAYMENT_OWNER_MISMATCH", "Payment does not belong to the current user.", 403);
  }
  if (input.expectedCaseId && parsed.metadata.case_id !== input.expectedCaseId) {
    throw new CasePaymentError("PAYMENT_CASE_MISMATCH", "Payment does not belong to this Case.", 403);
  }
  if (input.payment.status !== "succeeded") throw CasePaymentError.paymentPending(input.payment.status);
  return input.repository.fulfill(parsed.payment);
}

export async function refundVerifiedCreditPayment(input: {
  payment: DodoPayment;
  expectedProductId: string;
  repository: VerifiedCreditRepository;
}) {
  const parsed = verifiedPaymentInput(input.payment, input.expectedProductId);
  return input.repository.refund(parsed.payment);
}

export function createVerifiedCreditConfirmHandler(dependencies: VerifiedCreditHandlerDependencies) {
  type Context = { params: Promise<{ id: string }> };
  return {
    async POST(request: NextRequest, context: Context) {
      const requestId = randomUUID();
      try {
        const user = await requireUser(dependencies);
        const caseId = (await context.params).id;
        await requireOwnedCase(dependencies, user.userId, caseId);
        const productId = dependencies.getProductId();
        if (!dependencies.isDodoConfigured() || !productId) throw CasePaymentError.unavailable();
        const body = await request.json().catch(() => null) as { payment_id?: unknown } | null;
        if (!body || typeof body.payment_id !== "string" || !body.payment_id) {
          throw CasePaymentError.invalid("payment_id is required.");
        }
        const payment = await dependencies.createDodoClient().getPayment(body.payment_id);
        const result = await fulfillVerifiedCreditPayment({
          payment,
          expectedProductId: productId,
          expectedClerkUserId: user.clerkUserId,
          expectedCaseId: caseId,
          repository: dependencies.createRepository(),
        });
        return NextResponse.json({
          ok: true,
          case_id: caseId,
          payment_id: payment.payment_id,
          credits_added: 1,
          audit_credits: result.audit_credits,
          already_confirmed: result.idempotent,
        }, { headers: { "x-request-id": requestId, "cache-control": "no-store" } });
      } catch (error) {
        return errorResponse(error, "POST /api/v2/cases/:id/verified-credit/checkout/confirm", requestId);
      }
    },
  };
}
