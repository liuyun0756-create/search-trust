import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const DODO_API_BASE = process.env.DODO_BASE_URL || "https://test.dodopayments.com";
const DODO_API_KEY = process.env.DODO_API_KEY!;

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
    amount: payment.total_amount || payment.amount || 1900,
    status: "paid",
    credits_purchased: 1,
    paid_at: new Date().toISOString(),
  };

  const result = await supabase.from("orders").upsert(
    key === "payment_id"
      ? { ...baseOrder, currency: payment.currency || "USD" }
      : baseOrder,
    { onConflict: key }
  );

  if (!result.error) return result;

  // Some existing schemas do not have a currency column.
  return supabase.from("orders").upsert(baseOrder, { onConflict: key });
}

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    const user = await getCurrentUser();

    if (!clerkUserId || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { payment_id } = await request.json();

    if (!payment_id || typeof payment_id !== "string") {
      return NextResponse.json({ error: "payment_id is required" }, { status: 400 });
    }

    const paymentRes = await fetch(`${DODO_API_BASE}/payments/${payment_id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${DODO_API_KEY}`,
      },
      cache: "no-store",
    });

    if (!paymentRes.ok) {
      const errText = await paymentRes.text();
      console.error("Dodo payment confirm error:", paymentRes.status, errText);
      return NextResponse.json({ error: "Failed to confirm payment" }, { status: 502 });
    }

    const payment = await paymentRes.json();
    const status = payment.status;
    const paymentClerkUserId = payment.metadata?.clerk_user_id;

    if (paymentClerkUserId && paymentClerkUserId !== clerkUserId) {
      return NextResponse.json({ error: "Payment does not belong to current user" }, { status: 403 });
    }

    if (status !== "succeeded") {
      return NextResponse.json({ error: "Payment is not completed", status }, { status: 409 });
    }

    const supabase = createServerClient();

    const { data: existingOrder, key: orderKey } = await findExistingOrder(supabase, payment_id);

    if (existingOrder?.status === "paid") {
      const { data: userData } = await supabase
        .from("users")
        .select("audit_credits")
        .eq("id", user.userId)
        .single();

      return NextResponse.json({
        ok: true,
        payment_id,
        already_confirmed: true,
        credits: userData?.audit_credits ?? null,
      });
    }

    const orderResult = await upsertPaidOrder({
      supabase,
      key: orderKey,
      paymentId: payment_id,
      userId: user.userId,
      payment,
    });

    if (orderResult.error) {
      console.error("Failed to upsert confirmed order:", orderResult.error);
      return NextResponse.json({ error: "Failed to save confirmed order" }, { status: 500 });
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("audit_credits")
      .eq("id", user.userId)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const nextCredits = userData.audit_credits + 1;
    const { error: creditError } = await supabase
      .from("users")
      .update({
        audit_credits: nextCredits,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.userId);

    if (creditError) {
      console.error("Failed to update credits after confirm:", creditError);
      return NextResponse.json({ error: "Failed to update credits" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, payment_id, credits: nextCredits });
  } catch (error) {
    console.error("Checkout confirm error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
