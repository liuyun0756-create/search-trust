import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import crypto from "crypto";

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

  // Try both possible header names
  const signature =
    headerPayload.get("webhook-signature") ||
    headerPayload.get("x-dodo-signature") ||
    headerPayload.get("x-webhook-signature");

  console.log("[DodoWebhook] Signature found:", signature ? signature.substring(0, 20) + "..." : "MISSING");

  const WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET;
  console.log("[DodoWebhook] SECRET configured:", !!WEBHOOK_SECRET);

  if (!WEBHOOK_SECRET) {
    console.error("[DodoWebhook] Missing DODO_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  if (!signature) {
    console.error("[DodoWebhook] No signature header found");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Verify signature
  const expectedSig = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  console.log("[DodoWebhook] Expected sig:", expectedSig.substring(0, 20) + "...");

  // Dodo may send multiple signatures separated by spaces or in "t,signature" format
  const sigs = signature.split(" ").map((s) => {
    const parts = s.split(",");
    return parts.length > 1 ? parts[parts.length - 1] : s;
  });

  let isValid = false;
  try {
    isValid = sigs.some((s) =>
      crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expectedSig))
    );
  } catch {
    // Length mismatch — try direct comparison for debugging
    console.log("[DodoWebhook] timingSafeEqual failed, lengths:", sigs[0]?.length, "vs", expectedSig.length);
    isValid = sigs.some((s) => s === expectedSig);
  }

  if (!isValid) {
    console.error("[DodoWebhook] Signature verification failed");
    console.error("[DodoWebhook] Received sigs:", JSON.stringify(sigs));
    console.error("[DodoWebhook] Expected sig:", expectedSig);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  console.log("[DodoWebhook] Signature verified OK");

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.type || event.event_type;
  console.log("[DodoWebhook] Event type:", eventType);

  if (eventType === "payment.succeeded") {
    console.log("[DodoWebhook] Payment data:", JSON.stringify(event.data, null, 2));

    const clerkUserId = event.data?.metadata?.clerk_user_id;
    const paymentId = event.data?.payment_id || event.data?.id;

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

    await supabase.from("orders").upsert({
      payment_id: paymentId,
      user_id: user.id,
      amount: event.data?.amount || 1900,
      currency: event.data?.currency || "USD",
      status: "paid",
      credits_purchased: 1,
    });

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
      await supabase
        .from("orders")
        .update({ status: "refunded" })
        .eq("payment_id", paymentId);
    }

    console.log(`[DodoWebhook] Payment refunded: -1 credit for ${clerkUserId}`);
  }

  return NextResponse.json({ received: true });
}
