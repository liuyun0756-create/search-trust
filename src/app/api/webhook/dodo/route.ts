import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import crypto from "crypto";

export async function POST(request: Request) {
  const WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error("Missing DODO_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body = await request.text();
  const headerPayload = await headers();
  const signature = headerPayload.get("webhook-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Verify webhook signature
  const expectedSig = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  // Dodo may send multiple signatures separated by spaces
  const sigs = signature.split(" ").map((s) => s.split(",")[1] || s);
  const isValid = sigs.some((s) => crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expectedSig)));

  if (!isValid) {
    console.error("Dodo webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.type || event.event_type;

  if (eventType === "payment.succeeded") {
    const clerkUserId = event.data?.metadata?.clerk_user_id;
    const paymentId = event.data?.payment_id || event.data?.id;

    if (!clerkUserId) {
      console.error("No clerk_user_id in payment metadata", event.data);
      return NextResponse.json({ error: "Missing clerk_user_id" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Add 1 credit
    const { data: user } = await supabase
      .from("users")
      .select("id, audit_credits")
      .eq("clerk_user_id", clerkUserId)
      .single();

    if (!user) {
      console.error("User not found for clerk_user_id:", clerkUserId);
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
      console.error("Failed to update credits:", error);
      return NextResponse.json({ error: "Failed to update credits" }, { status: 500 });
    }

    // Record order
    await supabase.from("orders").upsert({
      payment_id: paymentId,
      user_id: user.id,
      amount: event.data?.amount || 1900,
      currency: event.data?.currency || "USD",
      status: "paid",
      credits_purchased: 1,
    });

    console.log(`Payment succeeded: +1 credit for ${clerkUserId}`);
  }

  if (eventType === "payment.failed") {
    console.log("Payment failed:", event.data?.payment_id || event.data?.id);
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

    console.log(`Payment refunded: -1 credit for ${clerkUserId}`);
  }

  return NextResponse.json({ received: true });
}
