import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

function parseScore(raw: string): Record<string, any> | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse score JSON");
    return null;
  }
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
      .select("id, task_id, status")
      .eq("task_id", task_id)
      .eq("user_id", user.userId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Failed: delete the empty report record, don't deduct credits
    if (failed) {
      await supabase.from("reports").delete().eq("id", report.id);
      return NextResponse.json({ status: "failed", reportId: report.id });
    }

    if (!result || !result.page_url) {
      // Empty result — treat as failed, delete the empty report
      await supabase.from("reports").delete().eq("id", report.id);
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

    // Determine status: first report (free credit) → free_preview, paid credits → paid_full
    // User starts with 1 free credit, so credits > 1 means they have paid credits
    const reportStatus = (userData && userData.audit_credits > 1) ? "paid_full" : "free_preview";

    const updateData: Record<string, any> = {
      status: reportStatus,
      trust_status: result.trust_status || null,
      ranking_potential: result.ranking_potential || null,
      risk_level: result.risk_level || null,
      generated_at: result.generated_at || null,
      page_url: result.page_url || null,
    };

    if (parsed) {
      if (parsed.module_1_overview) updateData.module_1_overview = parsed.module_1_overview;
      if (parsed.module_2_page_level) updateData.module_2_page_level = parsed.module_2_page_level;
      if (parsed.module_3_key_problems) updateData.module_3_key_problems = parsed.module_3_key_problems;
      if (parsed.module_4_eight_layers) updateData.module_4_eight_layers = parsed.module_4_eight_layers;
      if (parsed.module_5_optimization) updateData.module_5_optimization = parsed.module_5_optimization;
    }

    const { error: updateError } = await supabase
      .from("reports")
      .update(updateData)
      .eq("id", report.id);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return NextResponse.json({ error: "Failed to save report data" }, { status: 500 });
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
