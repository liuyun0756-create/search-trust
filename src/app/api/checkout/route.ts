import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@/lib/supabase";
import { captureServerEvent } from "@/lib/analytics-server";
import { getAuditEventProperties } from "@/lib/analytics-properties";

const DODO_API_BASE = process.env.DODO_BASE_URL || "https://test.dodopayments.com";
const DODO_API_KEY = process.env.DODO_API_KEY!;
const DODO_PRODUCT_ID = process.env.DODO_PRODUCT_ID!;
const DEV_MODE = process.env.DEV_BYPASS_AUTH === "true";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();

    // Dev bypass: create/get a test user in Supabase
    let effectiveUserId = userId;
    if (!effectiveUserId && DEV_MODE) {
      const supabase = createServerClient();
      const devId = "dev-test-user";
      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_user_id", devId)
        .single();

      if (existing) {
        effectiveUserId = devId;
      } else {
        const { data: newUser } = await supabase
          .from("users")
          .insert({ clerk_user_id: devId, email: "dev@test.com", name: "Dev Test", audit_credits: 99 })
          .select("id")
          .single();
        effectiveUserId = devId;
      }
    }

    if (!effectiveUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const formData: { url?: string; pageType?: string; gbpUrl?: string } = body.formData || {};

    // Encode form data into return_url so we can auto-submit after payment
    const returnParams = new URLSearchParams({ payment: "return" });
    if (formData.url) returnParams.set("audit_url", formData.url);
    if (formData.pageType) returnParams.set("audit_page_type", formData.pageType);
    if (formData.gbpUrl) returnParams.set("audit_gbp_url", formData.gbpUrl);

    const returnUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/reports?${returnParams.toString()}`;

    const res = await fetch(`${DODO_API_BASE}/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DODO_API_KEY}`,
      },
      body: JSON.stringify({
        product_cart: [
          {
            product_id: DODO_PRODUCT_ID,
            quantity: 1,
          },
        ],
        metadata: {
          clerk_user_id: effectiveUserId,
        },
        return_url: returnUrl,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Dodo checkout error:", res.status, err);
      return NextResponse.json({ error: `Checkout failed (${res.status}): ${err}` }, { status: 500 });
    }

    const data = await res.json();
    const checkout_url = data.checkout_url || data.url;

    await captureServerEvent({
      distinctId: effectiveUserId,
      event: "checkout created",
      properties: getAuditEventProperties({
        url: formData.url,
        pageType: formData.pageType,
        gbpUrl: formData.gbpUrl,
      }),
    });

    return NextResponse.json({ checkout_url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
