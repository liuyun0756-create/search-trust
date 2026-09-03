import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import {
  CASE_PROSPECT_PURCHASE,
  parseDodoPayment,
  fulfillVerifiedCasePayment,
  SupabaseCasePaymentRepository,
} from "@/lib/payments-v22";
import { Webhook } from "svix";

function normalizeWebhookSecret(secret: string) {
  return secret.trim().replace(/^["']|["']$/g, "");
}

async function findExistingOrder(supabase: ReturnType<typeof createServerClient>, paymentId: string) {
  const paymentIdQuery = await supabase
    .from("orders")
    .select("id, status")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (!paymentIdQuery.error) {
    return { data: paymentIdQuery.data, key: "payment_id" as const };
  }

  const orderIdQuery = await supabase
    .from("orders")
    .select("id, status")
    .eq("order_id", paymentId)
    .maybeSingle();

  return { data: orderIdQuery.data, key: "order_id" as const };
}

async function upsertPaidOrder({
  supabase,
  key,
  paymentId,
  userId,
  payment,
}: {
  supabase: ReturnType<typeof createServerClient>;
  key: "payment_id" | "order_id";
  paymentId: string;
  userId: string;
  payment: any;
}) {
  const baseOrder = {
    [key]: paymentId,
    user_id: userId,
    amount: payment.total_amount || payment.settlement_amount || payment.amount || 1900,
    status: "paid",
    credits_purchased: 1,
    paid_at: new Date().toISOString(),
  };

  const result = await supabase.from("orders").upsert(
    key === "payment_id"
      ? { ...baseOrder, currency: payment.currency || payment.settlement_currency || "USD" }
      : baseOrder,
    { onConflict: key }
  );

  if (!result.error) return result;

  return supabase.from("orders").upsert(baseOrder, { onConflict: key });
}

export async function POST(request: Request) {
  const body = await request.text();
  const headerPayload = await headers();

  const webhookId = headerPayload.get("webhook-id");
  const signature = headerPayload.get("webhook-signature");
  const timestamp = headerPayload.get("webhook-timestamp");

  const WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET
    ? normalizeWebhookSecret(process.env.DODO_WEBHOOK_SECRET)
    : "";
  if (!WEBHOOK_SECRET) {
    console.error("[DodoWebhook] Missing DODO_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  if (!signature || !webhookId || !timestamp) {
    console.error("[DodoWebhook] Missing signature headers");
    return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
  }

  const wh = new Webhook(WEBHOOK_SECRET);
  let event: any;
  try {
    event = wh.verify(body, {
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

  if (eventType === "payment.succeeded") {
    if (paymentData?.metadata?.purchase_kind === CASE_PROSPECT_PURCHASE) {
      const payment = parseDodoPayment(paymentData);
      if (!payment) return NextResponse.json({ error: "Invalid payment payload" }, { status: 400 });
      try {
        const supabase = createServerClient();
        const result = await fulfillVerifiedCasePayment({
          payment,
          repository: new SupabaseCasePaymentRepository(supabase),
        });
        return NextResponse.json({
          received: true,
          already_processed: result.idempotent,
        });
      } catch (error) {
        console.error("[DodoWebhook] Case payment fulfillment failed", {
          error_type: error instanceof Error ? error.name : "UnknownError",
        });
        return NextResponse.json({ error: "Case payment fulfillment failed" }, { status: 500 });
      }
    }

    const clerkUserId = paymentData?.metadata?.clerk_user_id;
    const paymentId = paymentData?.payment_id || paymentData?.id;

    if (!paymentId) {
      console.error("[DodoWebhook] No payment_id in payment data");
      return NextResponse.json({ error: "Missing payment_id" }, { status: 400 });
    }

    if (!clerkUserId) {
      console.error("[DodoWebhook] No clerk_user_id in payment metadata");
      return NextResponse.json({ error: "Missing clerk_user_id" }, { status: 400 });
    }

    const supabase = createServerClient();

    const { data: user } = await supabase
      .from("users")
      .select("id, audit_credits")
      .eq("clerk_user_id", clerkUserId)
      .single();

    if (!user) {
      console.error("[DodoWebhook] User not found for clerk_user_id:", clerkUserId);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: existingOrder, key: orderKey } = await findExistingOrder(supabase, paymentId);

    if (existingOrder?.status === "paid") {
      console.log("[DodoWebhook] Payment already processed:", paymentId);
      return NextResponse.json({ received: true, already_processed: true });
    }

    const orderResult = await upsertPaidOrder({
      supabase,
      key: orderKey,
      paymentId,
      userId: user.id,
      payment: paymentData,
    });

    if (orderResult.error) {
      console.error("[DodoWebhook] Failed to save order:", orderResult.error);
      return NextResponse.json({ error: "Failed to save order" }, { status: 500 });
    }

    const { error } = await supabase
      .from("users")
      .update({
        audit_credits: user.audit_credits + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("[DodoWebhook] Failed to update credits:", error);
      return NextResponse.json({ error: "Failed to update credits" }, { status: 500 });
    }

    console.log(`[DodoWebhook] Payment succeeded: +1 credit for ${clerkUserId}, order saved`);
  }

  if (eventType === "payment.failed") {
    if (paymentData?.metadata?.purchase_kind === CASE_PROSPECT_PURCHASE) {
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
    console.log("[DodoWebhook] Payment failed");
  }

  if (eventType === "payment.refunded") {
    if (paymentData?.metadata?.purchase_kind === CASE_PROSPECT_PURCHASE) {
      const payment = parseDodoPayment({ ...paymentData, status: "succeeded" });
      const metadata = paymentData?.metadata;
      if (
        !payment ||
        typeof metadata?.order_id !== "string" ||
        typeof metadata?.clerk_user_id !== "string" ||
        typeof metadata?.case_id !== "string"
      ) return NextResponse.json({ error: "Invalid refund payload" }, { status: 400 });
      try {
        const repository = new SupabaseCasePaymentRepository(createServerClient());
        const result = await repository.refund({
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

    const clerkUserId = paymentData?.metadata?.clerk_user_id;

    if (clerkUserId) {
      const supabase = createServerClient();
      const { data: user } = await supabase
        .from("users")
        .select("id, audit_credits")
        .eq("clerk_user_id", clerkUserId)
        .single();

      if (user && user.audit_credits > 0) {
        await supabase
          .from("users")
          .update({
            audit_credits: user.audit_credits - 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }

      const paymentId = paymentData?.payment_id || paymentData?.id;
      if (paymentId) {
        const { key } = await findExistingOrder(supabase, paymentId);
        await supabase.from("orders").update({ status: "refunded" }).eq(key, paymentId);
      }
    }

    console.log("[DodoWebhook] Payment refunded");
  }

  return NextResponse.json({ received: true });
}
