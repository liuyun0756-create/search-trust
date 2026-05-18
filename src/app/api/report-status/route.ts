import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const BACKEND_URL = "https://seo-backend-production-6f2b.up.railway.app/api/v1";

function parseScore(raw: string): Record<string, any> | null {
  try {
    let cleaned = raw.trim();
    // Remove ```json ... ``` wrapping
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    return JSON.parse(cleaned);
  } catch {
    console.error("Failed to parse score JSON");
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("task_id");

    if (!taskId) {
      return NextResponse.json({ error: "task_id is required" }, { status: 400 });
    }

    // Find report by task_id
    const supabase = createServerClient();
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("id, task_id, status")
      .eq("task_id", taskId)
      .eq("user_id", user.userId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Call backend to check task status
    const backendRes = await fetch(`${BACKEND_URL}/task/${taskId}`);
    if (!backendRes.ok) {
      const errText = await backendRes.text();
      console.error("Backend task status error:", errText);
      return NextResponse.json({ error: "Backend request failed" }, { status: 502 });
    }

    const backendData = await backendRes.json();
    const status: string = backendData.status;
    const progress = backendData.progress || null;

    // Not done yet — return progress
    if (status !== "done") {
      // If failed, refund credit
      if (status === "failed") {
        await supabase
          .from("users")
          .update({ audit_credits: user.auditCredits + 1, updated_at: new Date().toISOString() })
          .eq("id", user.userId);

        await supabase
          .from("reports")
          .update({ status: "failed" })
          .eq("id", report.id);
      }

      return NextResponse.json({
        status,
        progress,
        reportId: report.id,
      });
    }

    // status === "done" — parse result and save to Supabase
    const result = backendData.result || {};
    const rawScore = result.score || "";
    const parsed = parseScore(rawScore);

    const updateData: Record<string, any> = {
      status: "free_preview",
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

    return NextResponse.json({
      status: "done",
      progress,
      reportId: report.id,
    });
  } catch (error) {
    console.error("Report status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
