import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import {
  CASE_PROSPECT_PURCHASE,
  fulfillVerifiedCasePayment,
  parseCasePaymentMetadata,
  parseDodoPayment,
  SupabaseCasePaymentRepository,
  type CasePaymentRepository,
} from "@/lib/payments-v22";
import { createServerClient } from "@/lib/supabase";
import {
  CASE_VERIFIED_CREDIT_PURCHASE,
  fulfillVerifiedCreditPayment,
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
          : await fulfillVerifiedCreditPayment({ payment, repository: dependencies.createVerifiedCreditRepository() });
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

    if (eventType === "payment.refunded") {
      // Dodo refund payloads do not consistently repeat the terminal payment
      // status. Preserve the existing Prospect normalization; the verified RPC
      // independently verifies the immutable order, amount and currency.
      const payment = parseDodoPayment({ ...paymentData, status: "succeeded" });
      if (!payment) return NextResponse.json({ error: "Invalid refund payload" }, { status: 400 });
      try {
        if (purchaseKind === CASE_VERIFIED_CREDIT_PURCHASE) {
          const result = await refundVerifiedCreditPayment({
            payment,
            repository: dependencies.createVerifiedCreditRepository(),
          });
          if (result.manual_review) {
            console.warn("[DodoWebhook] Verified credit refund requires manual review", {
              event_type: eventType,
              purchase_kind: purchaseKind,
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
        if (!parsedMetadata) return NextResponse.json({ error: "Invalid refund payload" }, { status: 400 });
        const result = await dependencies.createCaseRepository().refund({
          localOrderId: parsedMetadata.order_id,
          paymentId: payment.payment_id,
          clerkUserId: parsedMetadata.clerk_user_id,
          caseId: parsedMetadata.case_id,
        });
        return NextResponse.json({ received: true, already_processed: result.idempotent });
      } catch (error) {
        console.error("[DodoWebhook] Payment refund failed", {
          purchase_kind: purchaseKind,
          error_type: error instanceof Error ? error.name : "UnknownError",
        });
        return failure("Payment refund failed");
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
});
