import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";
import { captureServerEvent } from "@/lib/analytics-server";
import {
  getAuditEventProperties,
  getCreditsBucket,
  type AnalyticsProperties,
} from "@/lib/analytics-properties";

const BACKEND_URL = process.env.REPORT_API_BASE_URL || "http://localhost:8000/api/v1";
const DEV_MODE = process.env.DEV_BYPASS_AUTH === "true";

// TODO: 后端统一成英文后删除此映射
const PAGE_TYPE_MAP: Record<string, string> = {
  "Location Page": "Entity-Destination Page",
};

export async function POST(request: NextRequest) {
  let analyticsDistinctId = "anonymous";
  let analyticsProperties: AnalyticsProperties = {};

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
        user = { userId: existing.id, clerkUserId: devId, auditCredits: existing.audit_credits };
      } else {
        const { data: newUser } = await supabase
          .from("users")
          .insert({ clerk_user_id: devId, email: "dev@test.com", name: "Dev Test", audit_credits: 99 })
          .select("id, audit_credits")
          .single();
        if (newUser) user = { userId: newUser.id, clerkUserId: devId, auditCredits: newUser.audit_credits };
      }
    }

    if (!user) {
      await captureServerEvent({
        distinctId: analyticsDistinctId,
        event: "report generation failed",
        properties: { failure_reason: "unauthorized" },
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    analyticsDistinctId = user.clerkUserId;

    const body = await request.json();
    const { url, page_type, gbp_url } = body;
    const normalizedPageType = PAGE_TYPE_MAP[page_type] || page_type;
    const normalizedGbpUrl = typeof gbp_url === "string" ? gbp_url.trim() : "";
    analyticsProperties = getAuditEventProperties(
      { url, pageType: normalizedPageType, gbpUrl: normalizedGbpUrl },
      { credits_bucket: getCreditsBucket(user.auditCredits) }
    );

    if (!url) {
      await captureServerEvent({
        distinctId: analyticsDistinctId,
        event: "report generation failed",
        properties: { ...analyticsProperties, failure_reason: "missing_url" },
      });
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    if (user.auditCredits <= 0) {
      await captureServerEvent({
        distinctId: analyticsDistinctId,
        event: "report generation failed",
        properties: { ...analyticsProperties, failure_reason: "no_credits" },
      });
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
    const { data: insertedReport, error: insertError } = await supabase
      .from("reports")
      .insert({
        report_id: reportId,
        user_id: user.userId,
        page_url: url,
        page_type: normalizedPageType,
        gbp_url: normalizedGbpUrl,
        status: "pending",
        access_type: accessType,
      })
      .select("id, report_id")
      .single();

    if (insertError) {
      console.error("Supabase insert error:", insertError);
      await captureServerEvent({
        distinctId: analyticsDistinctId,
        event: "report generation failed",
        properties: { ...analyticsProperties, failure_reason: "report_insert_failed" },
      });
      return NextResponse.json(
        {
          error: "Failed to save report",
          detail: process.env.NODE_ENV === "production" ? undefined : insertError.message,
        },
        { status: 500 }
      );
    }

    await captureServerEvent({
      distinctId: analyticsDistinctId,
      event: "report generation started",
      properties: { ...analyticsProperties, report_id: reportId, access_type: accessType },
    });

    console.info("[report creation identity]", {
      reportId,
      databaseReportId: insertedReport?.id ?? null,
      taskId: null,
      inserted: Boolean(insertedReport),
      taskIdPersisted: false,
    });

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
      await captureServerEvent({
        distinctId: analyticsDistinctId,
        event: "report generation failed",
        properties: {
          ...analyticsProperties,
          report_id: reportId,
          failure_reason: "backend_analyze_failed",
          backend_status: analyzeRes.status,
        },
      });
      return NextResponse.json({ error: `Backend analyze failed (${analyzeRes.status}): ${errText}` }, { status: 502 });
    }

    const { task_id } = await analyzeRes.json();

    // 2. 更新 task_id，等待 SSE 完成后填充模块
    const { data: taskIdUpdate, error } = await supabase
      .from("reports")
      .update({ task_id })
      .eq("report_id", reportId)
      .eq("user_id", user.userId)
      .select("id, report_id, task_id")
      .single();

    if (error) {
      console.error("Supabase task_id update error:", error);
      await captureServerEvent({
        distinctId: analyticsDistinctId,
        event: "report generation failed",
        properties: {
          ...analyticsProperties,
          report_id: reportId,
          task_id,
          failure_reason: "task_id_update_failed",
        },
      });
      return NextResponse.json(
        {
          error: "Failed to save report",
          detail: process.env.NODE_ENV === "production" ? undefined : error.message,
        },
        { status: 500 }
      );
    }

    await captureServerEvent({
      distinctId: analyticsDistinctId,
      event: "report generation succeeded",
      properties: { ...analyticsProperties, report_id: reportId, task_id },
    });

    console.info("[report creation identity]", {
      reportId,
      databaseReportId: taskIdUpdate?.id ?? insertedReport?.id ?? null,
      taskId: task_id,
      inserted: Boolean(insertedReport),
      taskIdPersisted: Boolean(taskIdUpdate?.task_id),
    });

    return NextResponse.json({
      task_id,
      report_id: reportId,
      database_report_id: taskIdUpdate?.id ?? insertedReport?.id ?? null,
    });
  } catch (error) {
    console.error("Generate report error:", error);
    await captureServerEvent({
      distinctId: analyticsDistinctId,
      event: "report generation failed",
      properties: { ...analyticsProperties, failure_reason: "internal_error" },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
