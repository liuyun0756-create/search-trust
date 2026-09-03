import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import type { CaseService } from "@/lib/cases/service";
import {
  CASE_PROSPECT_PURCHASE,
  isUuid,
  parseCasePaymentMetadata,
  type DodoPayment,
} from "./contracts";
import type { DodoClient } from "./dodo";
import { CasePaymentError, casePaymentErrorBody } from "./errors";
import type { CasePaymentRepository } from "./repository";

type CurrentUser = { userId: string; clerkUserId: string } | null;

export interface CasePaymentHandlerDependencies {
  getCurrentUser(): Promise<CurrentUser>;
  createCaseService(): CaseService;
  createRepository(): CasePaymentRepository;
  createDodoClient(): DodoClient;
  getProductId(): string;
  getBaseUrl(): string;
}

function errorResponse(error: unknown, route: string, requestId: string) {
  const paymentError = error instanceof CasePaymentError ? error : CasePaymentError.internal();
  if (paymentError.status >= 500) {
    console.error("Case payment request failed", {
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

async function requireUser(dependencies: CasePaymentHandlerDependencies) {
  const user = await dependencies.getCurrentUser();
  if (!user) throw CasePaymentError.unauthorized();
  return user;
}

async function requireOwnedCase(
  dependencies: CasePaymentHandlerDependencies,
  userId: string,
  caseId: string,
) {
  if (!isUuid(caseId)) throw CasePaymentError.invalid("The Case ID is invalid.");
  try {
    await dependencies.createCaseService().get(userId, caseId);
  } catch {
    throw CasePaymentError.notFound();
  }
}

export function createCasePaymentHandlers(dependencies: CasePaymentHandlerDependencies) {
  type Context = { params: Promise<{ id: string }> };

  return {
    async GET(_request: NextRequest, context: Context) {
      const requestId = randomUUID();
      try {
        const user = await requireUser(dependencies);
        const caseId = (await context.params).id;
        await requireOwnedCase(dependencies, user.userId, caseId);
        const entitlementStatus = await dependencies.createRepository()
          .getEntitlementStatus(user.userId, caseId);
        return NextResponse.json({
          case_id: caseId,
          report_type: "prospect",
          entitlement_status: entitlementStatus,
          unlocked: ["available", "reserved", "consumed"].includes(entitlementStatus),
        }, { headers: { "x-request-id": requestId } });
      } catch (error) {
        return errorResponse(error, "GET /api/v2/cases/:id/checkout", requestId);
      }
    },

    async POST(_request: NextRequest, context: Context) {
      const requestId = randomUUID();
      let pendingOrderId: string | null = null;
      let repository: CasePaymentRepository | null = null;
      try {
        const user = await requireUser(dependencies);
        const caseId = (await context.params).id;
        await requireOwnedCase(dependencies, user.userId, caseId);
        const productId = dependencies.getProductId();
        const baseUrl = dependencies.getBaseUrl();
        if (!productId || !baseUrl) throw CasePaymentError.unavailable();

        repository = dependencies.createRepository();
        const currentStatus = await repository.getEntitlementStatus(user.userId, caseId);
        if (currentStatus !== "locked") {
          throw CasePaymentError.alreadyUnlocked();
        }
        const existingCheckout = await repository.getOpenCheckout(user.userId, caseId);
        if (existingCheckout?.status === "pending" && existingCheckout.checkout_url && existingCheckout.checkout_session_id) {
          return NextResponse.json({
            case_id: caseId,
            order_id: existingCheckout.id,
            checkout_session_id: existingCheckout.checkout_session_id,
            checkout_url: existingCheckout.checkout_url,
            reused: true,
          }, { headers: { "x-request-id": requestId } });
        }
        if (existingCheckout) throw CasePaymentError.alreadyUnlocked();

        const order = await repository.createPendingOrder(user.userId, caseId);
        pendingOrderId = order.id;
        const returnUrl = new URL("/cases/new", baseUrl);
        returnUrl.searchParams.set("payment", "return");
        returnUrl.searchParams.set("case_id", caseId);
        returnUrl.searchParams.set("order_id", order.id);
        const cancelUrl = new URL("/cases/new", baseUrl);
        cancelUrl.searchParams.set("payment", "cancelled");
        cancelUrl.searchParams.set("case_id", caseId);

        const checkout = await dependencies.createDodoClient().createCheckout({
          productId,
          returnUrl: returnUrl.toString(),
          cancelUrl: cancelUrl.toString(),
          metadata: {
            clerk_user_id: user.clerkUserId,
            case_id: caseId,
            order_id: order.id,
            purchase_kind: CASE_PROSPECT_PURCHASE,
          },
        });
        await repository.attachCheckoutSession(order.id, checkout.session_id, checkout.checkout_url);
        return NextResponse.json({
          case_id: caseId,
          order_id: order.id,
          checkout_session_id: checkout.session_id,
          checkout_url: checkout.checkout_url,
        }, { status: 201, headers: { "x-request-id": requestId } });
      } catch (error) {
        if (repository && pendingOrderId) {
          await repository.markOrderFailed(pendingOrderId).catch(() => undefined);
        }
        return errorResponse(error, "POST /api/v2/cases/:id/checkout", requestId);
      }
    },
  };
}

export async function fulfillVerifiedCasePayment(input: {
  payment: DodoPayment;
  expectedClerkUserId?: string;
  expectedCaseId?: string;
  repository: CasePaymentRepository;
}) {
  const metadata = parseCasePaymentMetadata(input.payment.metadata);
  if (!metadata) throw CasePaymentError.invalid("Payment metadata is invalid.");
  if (input.expectedClerkUserId && metadata.clerk_user_id !== input.expectedClerkUserId) {
    throw new CasePaymentError("PAYMENT_OWNER_MISMATCH", "Payment does not belong to the current user.", 403);
  }
  if (input.expectedCaseId && metadata.case_id !== input.expectedCaseId) {
    throw new CasePaymentError("PAYMENT_CASE_MISMATCH", "Payment does not belong to this Case.", 403);
  }
  if (input.payment.status !== "succeeded") throw CasePaymentError.paymentPending(input.payment.status);
  return input.repository.fulfill({
    localOrderId: metadata.order_id,
    paymentId: input.payment.payment_id,
    clerkUserId: metadata.clerk_user_id,
    caseId: metadata.case_id,
    amount: input.payment.total_amount,
    currency: input.payment.currency,
  });
}

export function createCasePaymentConfirmHandler(dependencies: CasePaymentHandlerDependencies) {
  type Context = { params: Promise<{ id: string }> };
  return {
    async POST(request: NextRequest, context: Context) {
      const requestId = randomUUID();
      try {
        const user = await requireUser(dependencies);
        const caseId = (await context.params).id;
        await requireOwnedCase(dependencies, user.userId, caseId);
        const body = await request.json().catch(() => null) as { payment_id?: unknown } | null;
        if (!body || typeof body.payment_id !== "string" || !body.payment_id) {
          throw CasePaymentError.invalid("payment_id is required.");
        }
        if (!dependencies.getProductId()) throw CasePaymentError.unavailable();
        const payment = await dependencies.createDodoClient().getPayment(body.payment_id);
        const result = await fulfillVerifiedCasePayment({
          payment,
          expectedClerkUserId: user.clerkUserId,
          expectedCaseId: caseId,
          repository: dependencies.createRepository(),
        });
        return NextResponse.json({
          ok: true,
          case_id: caseId,
          payment_id: payment.payment_id,
          entitlement_status: result.entitlement_status,
          already_confirmed: result.idempotent,
        }, { headers: { "x-request-id": requestId } });
      } catch (error) {
        return errorResponse(error, "POST /api/v2/cases/:id/checkout/confirm", requestId);
      }
    },
  };
}
