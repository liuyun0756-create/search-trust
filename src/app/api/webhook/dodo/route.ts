import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

import { createServerClient } from "@/lib/supabase";
import {
  CASE_PROSPECT_PURCHASE,
  fulfillVerifiedCasePayment,
  parseDodoPayment,
  SupabaseCasePaymentRepository,
} from "@/lib/payments-v22";

function normalizeWebhookSecret(secret: string) {
  return secret.trim().replace(/^["']|["']$/g, "");
}

export async function POST(request: Request) {
  const body = await request.text();
  const headerPayload = await headers();
  const webhookId = headerPayload.get("webhook-id");
  const signature = headerPayload.get("webhook-signature");
  const timestamp = headerPayload.get("webhook-timestamp");
  const webhookSecret = process.env.DODO_WEBHOOK_SECRET
    ? normalizeWebhookSecret(process.env.DODO_WEBHOOK_SECRET)
    : "";

  if (!webhookSecret) {
    console.error("[DodoWebhook] Missing DODO_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }
  if (!signature || !webhookId || !timestamp) {
    console.error("[DodoWebhook] Missing signature headers");
    return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
  }

  let event: any;
  try {
    event = new Webhook(webhookSecret).verify(body, {
      "webhook-id": webhookId,
      "webhook-signature": signature,
      "webhook-timestamp": timestamp,
    });
  } catch (error) {
    console.error("[DodoWebhook] Signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const eventType = event.type || event.event_type;
  const paymentData = event.data?.object ?? event.data;
  const purchaseKind = paymentData?.metadata?.purchase_kind;

  if (purchaseKind !== CASE_PROSPECT_PURCHASE) {
    console.info("[DodoWebhook] Ignored unsupported purchase", { event_type: eventType });
    return NextResponse.json({ received: true, ignored: true });
  }

  if (eventType === "payment.succeeded") {
    const payment = parseDodoPayment(paymentData);
    if (!payment) return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 });
    try {
      const result = await fulfillVerifiedCasePayment({
        payment,
        repository: new SupabaseCasePaymentRepository(createServerClient()),
      });
      return NextResponse.json({ received: true, already_processed: result.idempotent });
    } catch (error) {
      console.error("[DodoWebhook] Case payment fulfillment failed", {
        error_type: error instanceof Error ? error.name : "UnknownError",
      });
      return NextResponse.json({ error: "Case payment fulfillment failed" }, { status: 500 });
    }
  }

  if (eventType === "payment.failed") {
    const localOrderId = paymentData?.metadata?.order_id;
    if (typeof localOrderId === "string") {
      try {
        await new SupabaseCasePaymentRepository(createServerClient()).markOrderFailed(localOrderId);
      } catch (error) {
        console.error("[DodoWebhook] Failed to close Case checkout", {
          error_type: error instanceof Error ? error.name : "UnknownError",
        });
        return NextResponse.json({ error: "Case checkout could not be updated" }, { status: 500 });
      }
    }
  }

  if (eventType === "payment.refunded") {
    const payment = parseDodoPayment({ ...paymentData, status: "succeeded" });
    const metadata = paymentData?.metadata;
    if (
      !payment ||
      typeof metadata?.order_id !== "string" ||
      typeof metadata?.clerk_user_id !== "string" ||
      typeof metadata?.case_id !== "string"
    ) return NextResponse.json({ error: "Invalid refund payload" }, { status: 400 });
    try {
      const result = await new SupabaseCasePaymentRepository(createServerClient()).refund({
        localOrderId: metadata.order_id,
        paymentId: payment.payment_id,
        clerkUserId: metadata.clerk_user_id,
        caseId: metadata.case_id,
      });
      return NextResponse.json({ received: true, already_processed: result.idempotent });
    } catch (error) {
      console.error("[DodoWebhook] Case payment refund failed", {
        error_type: error instanceof Error ? error.name : "UnknownError",
      });
      return NextResponse.json({ error: "Case payment refund failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
