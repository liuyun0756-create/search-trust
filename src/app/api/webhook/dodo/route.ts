import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
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
  console.log("[DodoWebhook] POST received");

  const body = await request.text();
  console.log("[DodoWebhook] Body length:", body.length);
  console.log("[DodoWebhook] Body preview:", body.substring(0, 300));

  const headerPayload = await headers();

  // Log all headers for debugging
  const allHeaders: Record<string, string> = {};
  headerPayload.forEach((value, key) => {
    allHeaders[key] = value;
  });
  console.log("[DodoWebhook] All headers:", JSON.stringify(allHeaders, null, 2));

  const webhookId = headerPayload.get("webhook-id");
  const signature = headerPayload.get("webhook-signature");
  const timestamp = headerPayload.get("webhook-timestamp");

  console.log("[DodoWebhook] Signature found:", signature ? signature.substring(0, 30) + "..." : "MISSING");

  const WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET
    ? normalizeWebhookSecret(process.env.DODO_WEBHOOK_SECRET)
    : "";
  console.log("[DodoWebhook] SECRET configured:", !!WEBHOOK_SECRET);

  if (!WEBHOOK_SECRET) {
    console.error("[DodoWebhook] Missing DODO_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  if (!signature || !webhookId || !timestamp) {
    console.error("[DodoWebhook] Missing Svix headers:", { webhookId: !!webhookId, signature: !!signature, timestamp: !!timestamp });
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

  console.log("[DodoWebhook] Signature verified OK");

  const eventType = event.type || event.event_type;
  console.log("[DodoWebhook] Event type:", eventType);

  if (eventType === "payment.succeeded") {
    console.log("[DodoWebhook] Payment data:", JSON.stringify(event.data, null, 2));

    const clerkUserId = event.data?.metadata?.clerk_user_id;
    const paymentId = event.data?.payment_id || event.data?.id;

    if (!paymentId) {
      console.error("[DodoWebhook] No payment_id in payment data", event.data);
      return NextResponse.json({ error: "Missing payment_id" }, { status: 400 });
    }

    if (!clerkUserId) {
      console.error("[DodoWebhook] No clerk_user_id in payment metadata", event.data);
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
      payment: event.data,
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
    console.log("[DodoWebhook] Payment failed:", event.data?.payment_id || event.data?.id);
  }

  if (eventType === "payment.refunded") {
    const clerkUserId = event.data?.metadata?.clerk_user_id;

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

      const paymentId = event.data?.payment_id || event.data?.id;
      const { key } = await findExistingOrder(supabase, paymentId);
      await supabase.from("orders").update({ status: "refunded" }).eq(key, paymentId);
    }

    console.log(`[DodoWebhook] Payment refunded: -1 credit for ${clerkUserId}`);
  }

  return NextResponse.json({ received: true });
}
