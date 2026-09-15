import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import {
  CASE_PROSPECT_PURCHASE,
  fulfillVerifiedCasePayment,
  parseCasePaymentMetadata,
  parseDodoPayment,
  parseDodoRefund,
  DodoClient,
  CasePaymentError,
  SupabaseCasePaymentRepository,
  type CasePaymentRepository,
} from "@/lib/payments-v22";
import { createServerClient } from "@/lib/supabase";
import {
  CASE_VERIFIED_CREDIT_PURCHASE,
  fulfillVerifiedCreditPayment,
  isExactVerifiedCreditPayment,
  parseVerifiedCreditPaymentMetadata,
  refundVerifiedCreditPayment,
  SupabaseVerifiedCreditRepository,
  type VerifiedCreditRepository,
} from "@/lib/verified-credits-v22";

type HeaderReader = { get(name: string): string | null };

export interface DodoWebhookDependencies {
  getHeaders(): Promise<HeaderReader>;
  getWebhookSecret(): string;
  verify(body: string, secret: string, signatureHeaders: Record<string, string>): unknown;
  createCaseRepository(): CasePaymentRepository;
  createVerifiedCreditRepository(): VerifiedCreditRepository;
  createDodoClient(): DodoClient;
}

function normalizeWebhookSecret(secret: string) {
  return secret.trim().replace(/^["']|["']$/g, "");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function eventDetails(value: unknown) {
  const event = asRecord(value);
  const eventType = typeof event?.type === "string"
    ? event.type
    : typeof event?.event_type === "string" ? event.event_type : "";
  const data = asRecord(event?.data);
  return { eventType, paymentData: asRecord(data?.object) ?? data };
}

function failure(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

function verifiedRefundReviewReason(
  refund: { is_partial: boolean; amount: number | null; currency: string | null },
  payment: { total_amount: number; currency: string; refund_status: "partial" | "full" | null },
) {
  if (refund.is_partial) return "partial_refund" as const;
  if (refund.amount !== payment.total_amount) return "amount_mismatch" as const;
  if (refund.currency !== payment.currency) return "currency_mismatch" as const;
  return "payment_refund_status_mismatch" as const;
}

export function createDodoWebhookHandler(dependencies: DodoWebhookDependencies) {
  return async function POST(request: Request) {
    const body = await request.text();
    const headerPayload = await dependencies.getHeaders();
    const webhookId = headerPayload.get("webhook-id");
    const signature = headerPayload.get("webhook-signature");
    const timestamp = headerPayload.get("webhook-timestamp");
    const webhookSecret = normalizeWebhookSecret(dependencies.getWebhookSecret());

    if (!webhookSecret) {
      console.error("[DodoWebhook] Missing DODO_WEBHOOK_SECRET");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }
    if (!signature || !webhookId || !timestamp) {
      console.error("[DodoWebhook] Missing signature headers");
      return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
    }

    let verifiedEvent: unknown;
    try {
      verifiedEvent = dependencies.verify(body, webhookSecret, {
        "webhook-id": webhookId,
        "webhook-signature": signature,
        "webhook-timestamp": timestamp,
      });
    } catch (error) {
      console.error("[DodoWebhook] Signature verification failed", {
        error_type: error instanceof Error ? error.name : "UnknownError",
      });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const { eventType, paymentData } = eventDetails(verifiedEvent);

    if (eventType === "refund.succeeded") {
      const refund = parseDodoRefund(paymentData);
      if (!refund) return NextResponse.json({ error: "Invalid refund payload" }, { status: 400 });
      let payment;
      try {
        payment = await dependencies.createDodoClient().getPayment(refund.payment_id);
      } catch (error) {
        const status = error instanceof CasePaymentError ? error.status : 503;
        return NextResponse.json({ error: "Refund verification unavailable" }, { status });
      }
      if (payment.payment_id !== refund.payment_id) {
        return NextResponse.json({ error: "Invalid refund payment binding" }, { status: 400 });
      }
      const trustedMetadata = asRecord(payment.metadata);
      const trustedKind = trustedMetadata?.purchase_kind;
      if (trustedKind !== CASE_PROSPECT_PURCHASE && trustedKind !== CASE_VERIFIED_CREDIT_PURCHASE) {
        console.info("[DodoWebhook] Ignored unsupported purchase", { event_type: eventType });
        return NextResponse.json({ received: true, ignored: true });
      }
      const verifiedMetadata = trustedKind === CASE_VERIFIED_CREDIT_PURCHASE
        ? parseVerifiedCreditPaymentMetadata(payment.metadata)
        : null;
      if (trustedKind === CASE_VERIFIED_CREDIT_PURCHASE && (!verifiedMetadata || !isExactVerifiedCreditPayment(payment))) {
        return NextResponse.json({ error: "Invalid refund payment binding" }, { status: 400 });
      }
      const fullRefund = !refund.is_partial
        && refund.amount === payment.total_amount
        && refund.currency === payment.currency
        && payment.refund_status === "full";
      if (!fullRefund) {
        if (trustedKind === CASE_VERIFIED_CREDIT_PURCHASE) {
          const reason = verifiedRefundReviewReason(refund, payment);
          try {
            const result = await dependencies.createVerifiedCreditRepository().recordRefundReview({
              providerRefundId: refund.refund_id,
              localOrderId: verifiedMetadata!.order_id,
              paymentId: payment.payment_id,
              clerkUserId: verifiedMetadata!.clerk_user_id,
              caseId: verifiedMetadata!.case_id,
              paymentAmount: payment.total_amount,
              paymentCurrency: payment.currency,
              checkoutSessionId: payment.checkout_session_id!,
              productId: payment.product_cart![0].product_id,
              reason,
              refundAmount: refund.amount,
              refundCurrency: refund.currency,
              isPartial: refund.is_partial,
              paymentRefundStatus: payment.refund_status,
            });
            console.warn("[DodoWebhook] Payment refund requires manual review", {
              event_type: eventType,
              purchase_kind: trustedKind,
              review_id: result.review_id,
              reason: result.reason,
              already_processed: result.idempotent,
            });
            return NextResponse.json({
              received: true,
              manual_review: true,
              review_id: result.review_id,
              already_processed: result.idempotent,
            });
          } catch (error) {
            console.error("[DodoWebhook] Refund review persistence failed", {
              purchase_kind: trustedKind,
              error_type: error instanceof Error ? error.name : "UnknownError",
              error_code: "REFUND_REVIEW_PERSISTENCE_FAILED",
            });
            return failure("Refund review could not be persisted");
          }
        }
        console.warn("[DodoWebhook] Payment refund requires manual review", {
          event_type: eventType,
          purchase_kind: trustedKind,
          reason: "REFUND_NOT_EXACT_FULL_PAYMENT",
          manual_review: true,
        });
        return NextResponse.json({ received: true, manual_review: true });
      }
      try {
        if (trustedKind === CASE_VERIFIED_CREDIT_PURCHASE) {
          const result = await refundVerifiedCreditPayment({
            payment,
            repository: dependencies.createVerifiedCreditRepository(),
          });
          if (result.manual_review) {
            console.warn("[DodoWebhook] Verified credit refund requires manual review", {
              event_type: eventType,
              purchase_kind: trustedKind,
              manual_review: true,
              already_processed: result.idempotent,
            });
          }
          return NextResponse.json({
            received: true,
            already_processed: result.idempotent,
            manual_review: result.manual_review,
          });
        }
        const parsedMetadata = parseCasePaymentMetadata(payment.metadata);
        if (!parsedMetadata) return NextResponse.json({ error: "Invalid refund payment binding" }, { status: 400 });
        const result = await dependencies.createCaseRepository().refund({
          localOrderId: parsedMetadata.order_id,
          paymentId: payment.payment_id,
          clerkUserId: parsedMetadata.clerk_user_id,
          caseId: parsedMetadata.case_id,
        });
        return NextResponse.json({ received: true, already_processed: result.idempotent });
      } catch (error) {
        console.error("[DodoWebhook] Payment refund failed", {
          purchase_kind: trustedKind,
          error_type: error instanceof Error ? error.name : "UnknownError",
        });
        return failure("Payment refund failed");
      }
    }

    const metadata = asRecord(paymentData?.metadata);
    const purchaseKind = metadata?.purchase_kind;
    if (purchaseKind !== CASE_PROSPECT_PURCHASE && purchaseKind !== CASE_VERIFIED_CREDIT_PURCHASE) {
      console.info("[DodoWebhook] Ignored unsupported purchase", { event_type: eventType });
      return NextResponse.json({ received: true, ignored: true });
    }

    if (eventType === "payment.succeeded") {
      const payment = parseDodoPayment(paymentData);
      if (!payment) return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 });
      try {
        const result = purchaseKind === CASE_PROSPECT_PURCHASE
          ? await fulfillVerifiedCasePayment({ payment, repository: dependencies.createCaseRepository() })
          : await fulfillVerifiedCreditPayment({
            payment,
            repository: dependencies.createVerifiedCreditRepository(),
          });
        return NextResponse.json({ received: true, already_processed: result.idempotent });
      } catch (error) {
        console.error("[DodoWebhook] Payment fulfillment failed", {
          purchase_kind: purchaseKind,
          error_type: error instanceof Error ? error.name : "UnknownError",
        });
        return failure("Payment fulfillment failed");
      }
    }

    if (eventType === "payment.failed") {
      const parsedMetadata = purchaseKind === CASE_PROSPECT_PURCHASE
        ? parseCasePaymentMetadata(metadata)
        : parseVerifiedCreditPaymentMetadata(metadata);
      if (!parsedMetadata) return NextResponse.json({ error: "Invalid payment metadata" }, { status: 400 });
      try {
        if (purchaseKind === CASE_PROSPECT_PURCHASE) {
          await dependencies.createCaseRepository().markOrderFailed(parsedMetadata.order_id);
        } else {
          await dependencies.createVerifiedCreditRepository().markOrderFailed(parsedMetadata.order_id);
        }
      } catch (error) {
        console.error("[DodoWebhook] Failed to close checkout", {
          purchase_kind: purchaseKind,
          error_type: error instanceof Error ? error.name : "UnknownError",
        });
        return failure("Checkout could not be updated");
      }
    }

    return NextResponse.json({ received: true });
  };
}

export const POST = createDodoWebhookHandler({
  getHeaders: headers,
  getWebhookSecret: () => process.env.DODO_WEBHOOK_SECRET || "",
  verify: (body, secret, signatureHeaders) => new Webhook(secret).verify(body, signatureHeaders),
  createCaseRepository: () => new SupabaseCasePaymentRepository(createServerClient()),
  createVerifiedCreditRepository: () => new SupabaseVerifiedCreditRepository(createServerClient()),
  createDodoClient: () => new DodoClient(process.env.DODO_BASE_URL || "", process.env.DODO_API_KEY || ""),
});
