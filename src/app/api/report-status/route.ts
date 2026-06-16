import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

function parseScore(raw: unknown): Record<string, any> | null {
  try {
    if (raw && typeof raw === "object") return raw as Record<string, any>;
    if (typeof raw !== "string") return null;

    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Failed to parse score JSON", error);
    return null;
  }
}

function normalizeScoreValue(raw: unknown): string | null {
  if (!raw) return null;
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}

// POST — 由前端在 SSE done 后调用，保存报告结果 + 扣减 credits
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { task_id, result, failed } = body;

    if (!task_id) {
      return NextResponse.json({ error: "task_id is required" }, { status: 400 });
    }

    const supabase = createServerClient();

    // Find report by task_id
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("id, task_id, status, access_type")
      .eq("task_id", task_id)
      .eq("user_id", user.userId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const canRecoverFailedReport = report.status === "failed" && result?.score;

    // Idempotency: a completed report should not be saved or charged again.
    if (report.status !== "pending" && !canRecoverFailedReport) {
      return NextResponse.json({ status: report.status, reportId: report.id, idempotent: true });
    }

    // Failed: mark the report failed, don't deduct credits
    if (failed) {
      await supabase.from("reports").update({ status: "failed" }).eq("id", report.id);
      return NextResponse.json({ status: "failed", reportId: report.id });
    }

    if (!result || !result.score) {
      // Empty result — treat as failed
      await supabase.from("reports").update({ status: "failed" }).eq("id", report.id);
      return NextResponse.json({ status: "failed", reason: "empty_result" });
    }

    // Parse result
    const rawScore = result.score || "";
    const parsed = parseScore(rawScore);

    // Query user credits once — used for both status determination and deduction
    const { data: userData } = await supabase
      .from("users")
      .select("audit_credits")
      .eq("id", user.userId)
      .single();

    const reportStatus = report.access_type === "free_trial" ? "free_preview" : "paid_full";

    const updateData: Record<string, any> = {
      status: reportStatus,
      completed_at: new Date().toISOString(),
      external_report_id: result.report_id || null,
      trust_status: normalizeScoreValue(result.trust_status),
      ranking_potential: normalizeScoreValue(result.ranking_potential),
      risk_level: normalizeScoreValue(result.risk_level),
      generated_at: result.generated_at || null,
    };

    if (result.page_url) updateData.page_url = result.page_url;
    if (result.page_type) updateData.page_type = result.page_type;
    if (result.gbp_url) updateData.gbp_url = result.gbp_url;
    if (typeof result.gbp_connected === "boolean") updateData.gbp_connected = result.gbp_connected;

    if (parsed) {
      if (parsed.module_1_overview) updateData.module_1_overview = parsed.module_1_overview;
      if (parsed.module_2_page_level) updateData.module_2_page_level = parsed.module_2_page_level;
      if (parsed.module_3_key_problems) updateData.module_3_key_problems = parsed.module_3_key_problems;
      if (parsed.module_4_eight_layers) updateData.module_4_eight_layers = parsed.module_4_eight_layers;
      if (parsed.module_5_optimization) updateData.module_5_optimization = parsed.module_5_optimization;
    }

    const { data: completedReport, error: updateError } = await supabase
      .from("reports")
      .update(updateData)
      .eq("id", report.id)
      .in("status", canRecoverFailedReport ? ["pending", "failed"] : ["pending"])
      .select("id")
      .single();

    if (updateError || !completedReport) {
      console.error("Supabase update error:", updateError);
      return NextResponse.json({ status: "already_processed", reportId: report.id, idempotent: true });
    }

    // Deduct credit after successful save (don't go below 0)
    if (userData && userData.audit_credits > 0) {
      await supabase
        .from("users")
        .update({ audit_credits: userData.audit_credits - 1, updated_at: new Date().toISOString() })
        .eq("id", user.userId);
    }

    return NextResponse.json({ status: "done", reportId: report.id });
  } catch (error) {
    console.error("Report status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
