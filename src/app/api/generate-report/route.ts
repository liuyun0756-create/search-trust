import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const BACKEND_URL = "https://seo-backend-production-6f2b.up.railway.app/api/v1";
const DEV_MODE = process.env.DEV_BYPASS_AUTH === "true";

// TODO: 后端统一成英文后删除此映射
const PAGE_TYPE_MAP: Record<string, string> = {
  "Location Page": "Entity-Destination Page",
};

export async function POST(request: NextRequest) {
  try {
    let user = await getCurrentUser();

    // Dev bypass: create/get a test user
    if (!user && DEV_MODE) {
      const supabase = createServerClient();
      const devId = "dev-test-user";
      const { data: existing } = await supabase
        .from("users")
        .select("id, audit_credits")
        .eq("clerk_user_id", devId)
        .single();

      if (existing) {
        user = { userId: existing.id, auditCredits: existing.audit_credits };
      } else {
        const { data: newUser } = await supabase
          .from("users")
          .insert({ clerk_user_id: devId, email: "dev@test.com", name: "Dev Test", audit_credits: 99 })
          .select("id, audit_credits")
          .single();
        if (newUser) user = { userId: newUser.id, auditCredits: newUser.audit_credits };
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { url, page_type, gbp_url } = body;
    const normalizedPageType = PAGE_TYPE_MAP[page_type] || page_type;
    const normalizedGbpUrl = typeof gbp_url === "string" ? gbp_url.trim() : "";

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (user.auditCredits <= 0) {
      return NextResponse.json({ error: "No audit credits available" }, { status: 402 });
    }

    const supabase = createServerClient();
    const recentCutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: recentPending } = await supabase
      .from("reports")
      .select("report_id, task_id")
      .eq("user_id", user.userId)
      .eq("page_url", url)
      .eq("status", "pending")
      .gte("created_at", recentCutoff)
      .order("created_at", { ascending: false })
      .limit(1);

    if (recentPending?.[0]?.task_id) {
      return NextResponse.json({
        task_id: recentPending[0].task_id,
        report_id: recentPending[0].report_id,
      });
    }

    if (recentPending?.length) {
      return NextResponse.json({ error: "A report for this URL is already being created" }, { status: 409 });
    }

    const { data: previousCompleted } = await supabase
      .from("reports")
      .select("id")
      .eq("user_id", user.userId)
      .in("status", ["free_preview", "paid_full"])
      .limit(1);

    const accessType =
      user.auditCredits > 1 || (previousCompleted?.length ?? 0) > 0
        ? "paid_credit"
        : "free_trial";

    const reportId = `RPT-${Date.now().toString(36).toUpperCase()}`;
    const { error: insertError } = await supabase.from("reports").insert({
      report_id: reportId,
      user_id: user.userId,
      page_url: url,
      page_type: normalizedPageType,
      gbp_url: normalizedGbpUrl,
      status: "pending",
      access_type: accessType,
    });

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      return NextResponse.json(
        {
          error: "Failed to save report",
          detail: process.env.NODE_ENV === "production" ? undefined : insertError.message,
        },
        { status: 500 }
      );
    }

    console.log("/analyze接口，后端Received report generation request:", { url, page_type: normalizedPageType, gbp_url: normalizedGbpUrl });
    // 1. 调后端创建任务
    const analyzeRes = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        page_type: normalizedPageType,
        language: "English",
        gbp_url: normalizedGbpUrl,
      }),
    });

    if (!analyzeRes.ok) {
      const errText = await analyzeRes.text();
      console.error("Backend analyze error:", analyzeRes.status, errText);
      await supabase
        .from("reports")
        .update({ status: "failed" })
        .eq("report_id", reportId)
        .eq("user_id", user.userId);
      return NextResponse.json({ error: `Backend analyze failed (${analyzeRes.status}): ${errText}` }, { status: 502 });
    }

    const { task_id } = await analyzeRes.json();

    // 2. 更新 task_id，等待 SSE 完成后填充模块
    const { error } = await supabase
      .from("reports")
      .update({ task_id })
      .eq("report_id", reportId)
      .eq("user_id", user.userId);

    if (error) {
      console.error("Supabase task_id update error:", error);
      return NextResponse.json(
        {
          error: "Failed to save report",
          detail: process.env.NODE_ENV === "production" ? undefined : error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ task_id, report_id: reportId });
  } catch (error) {
    console.error("Generate report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
