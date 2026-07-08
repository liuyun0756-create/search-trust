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

function asRecord(value: unknown): Record<string, any> | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function safeResultKeys(value: unknown): string[] {
  const record = asRecord(value);
  return record ? Object.keys(record).slice(0, 30) : [];
}

function parseJsonObject(raw: unknown): Record<string, any> | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, any>;
  if (typeof raw !== "string") return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, any>
      : null;
  } catch {
    return null;
  }
}

function hasLegacyModuleFields(value: Record<string, any>): boolean {
  return Boolean(
    value.module_1_overview ||
    value.module_2_page_level ||
    value.module_3_key_problems ||
    value.module_4_eight_layers ||
    value.module_5_optimization
  );
}

function hasStatusCards(value: Record<string, any>): boolean {
  return Boolean(
    value.trust_status ||
    value.ranking_potential ||
    value.risk_level ||
    value.overall_status
  );
}

function getReportV21(value: unknown): Record<string, any> | null {
  const report = parseJsonObject(value);
  if (!report) return null;

  const wrapped = asRecord(report.report_v2_1);
  return wrapped || report;
}

function hasPersistableReportContent(value: unknown): value is Record<string, any> {
  const record = asRecord(value);
  if (!record) return false;

  return Boolean(
    getReportV21(record.report_v2_1) ||
    record.score ||
    hasLegacyModuleFields(record) ||
    hasStatusCards(record)
  );
}

function hasPersistedReportContent(report: unknown): boolean {
  const record = asRecord(report);
  if (!record) return false;

  return Boolean(
    getReportV21(record.report_v2_1) ||
    record.score ||
    hasLegacyModuleFields(record) ||
    record.trust_status ||
    record.ranking_potential ||
    record.risk_level
  );
}

function unwrapPersistableReportResult(raw: unknown): Record<string, any> | null {
  const record = asRecord(raw);
  if (!record) return null;

  const nestedResult = asRecord(record.result);
  const candidates = [
    record,
    nestedResult,
    asRecord(record.final_report),
    asRecord(record.data),
    asRecord(record.payload),
    asRecord(nestedResult?.final_report),
    asRecord(nestedResult?.data),
  ];

  return candidates.find((candidate) => candidate && hasPersistableReportContent(candidate)) ?? null;
}

// POST — 由前端在 SSE done 后调用，保存报告结果 + 扣减 credits
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { task_id, result, failed, report_id } = body;

    if (!task_id && !report_id) {
      return NextResponse.json({ error: "task_id or report_id is required" }, { status: 400 });
    }

    const persistableResult = unwrapPersistableReportResult(result);
    const hasLegacyScore = Boolean(persistableResult?.score);
    const reportV21 = getReportV21(persistableResult?.report_v2_1);
    const hasReportV21 = Boolean(reportV21);
    const hasLegacyModules = Boolean(persistableResult && hasLegacyModuleFields(persistableResult));
    const hasCards = Boolean(persistableResult && hasStatusCards(persistableResult));
    const hasPersistableContent = Boolean(
      persistableResult &&
      (hasLegacyScore || hasReportV21 || hasLegacyModules || hasCards)
    );

    console.info("[report-status save]", {
      taskId: task_id,
      reportId: report_id ?? null,
      hasResult: Boolean(result),
      resultKeys: safeResultKeys(result),
      persistableResultKeys: safeResultKeys(persistableResult),
      hasReportV21,
      hasScore: hasLegacyScore,
      hasLegacyModules,
      hasStatusCards: hasCards,
      hasFinalReport: Boolean(asRecord(result)?.final_report),
      hasData: Boolean(asRecord(result)?.data),
    });

    const supabase = createServerClient();

    const reportSelect = [
      "id",
      "report_id",
      "task_id",
      "status",
      "access_type",
      "report_v2_1",
      "module_1_overview",
      "module_2_page_level",
      "module_3_key_problems",
      "module_4_eight_layers",
      "module_5_optimization",
      "trust_status",
      "ranking_potential",
      "risk_level",
    ].join(", ");

    // Find report by task_id, falling back to same-user report_id for recovery/debug posts.
    let report: Record<string, any> | null = null;
    let reportError: unknown = null;

    if (task_id) {
      const lookup = await supabase
        .from("reports")
        .select(reportSelect)
        .eq("task_id", task_id)
        .eq("user_id", user.userId)
        .single();
      report = lookup.data;
      reportError = lookup.error;
    }

    if ((!report || reportError) && report_id) {
      const fallbackLookup = await supabase
        .from("reports")
        .select(reportSelect)
        .eq("report_id", report_id)
        .eq("user_id", user.userId)
        .single();
      report = fallbackLookup.data;
      reportError = fallbackLookup.error;
    }

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const existingHasContent = hasPersistedReportContent(report);
    const saveDecision = existingHasContent
      ? "already_processed_existing_content"
      : persistableResult
        ? "save_incoming_result"
        : failed
          ? "mark_failed_empty_result"
          : "no_persistable_result";

    console.info("[report-status idempotency check]", {
      taskId: task_id ?? null,
      reportId: report.report_id ?? report_id ?? null,
      existingStatus: report.status ?? null,
      existingHasContent,
      incomingHasResult: Boolean(result),
      incomingHasPersistableResult: Boolean(persistableResult),
      incomingKeys: safeResultKeys(persistableResult),
    });

    console.info("[report-status save decision]", {
      taskId: task_id ?? null,
      reportId: report.report_id ?? report_id ?? null,
      decision: saveDecision,
    });

    if (existingHasContent) {
      return NextResponse.json({
        ok: true,
        saved: false,
        status: "already_processed",
        reportId: report.id,
        idempotent: true,
        existingHasContent: true,
      });
    }

    // Failed: mark the report failed, don't deduct credits
    if (failed && !persistableResult) {
      await supabase.from("reports").update({ status: "failed" }).eq("id", report.id);
      return NextResponse.json({ ok: true, saved: false, status: "failed", reportId: report.id });
    }

    if (!hasPersistableContent || !persistableResult) {
      return NextResponse.json({
        ok: false,
        saved: false,
        status: "no_persistable_result",
        reason: "no_persistable_result",
        reportId: report.id,
      });
    }

    // Parse result
    const rawScore = persistableResult.score || "";
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
      external_report_id: persistableResult.report_id || reportV21?.report_id || null,
      trust_status: normalizeScoreValue(persistableResult.trust_status),
      ranking_potential: normalizeScoreValue(persistableResult.ranking_potential),
      risk_level: normalizeScoreValue(persistableResult.risk_level),
      generated_at: persistableResult.generated_at || reportV21?.generated_at || null,
    };

    if (persistableResult.page_url || reportV21?.analyzed_url) {
      updateData.page_url = persistableResult.page_url || reportV21?.analyzed_url;
    }
    if (persistableResult.page_type || reportV21?.page_type) {
      updateData.page_type = persistableResult.page_type || reportV21?.page_type;
    }
    if (persistableResult.gbp_url || reportV21?.gbp_status?.gbp_url) {
      updateData.gbp_url = persistableResult.gbp_url || reportV21?.gbp_status?.gbp_url;
    }
    if (typeof persistableResult.gbp_connected === "boolean") {
      updateData.gbp_connected = persistableResult.gbp_connected;
    }
    if (hasReportV21) updateData.report_v2_1 = reportV21;

    if (parsed) {
      if (parsed.module_1_overview) updateData.module_1_overview = parsed.module_1_overview;
      if (parsed.module_2_page_level) updateData.module_2_page_level = parsed.module_2_page_level;
      if (parsed.module_3_key_problems) updateData.module_3_key_problems = parsed.module_3_key_problems;
      if (parsed.module_4_eight_layers) updateData.module_4_eight_layers = parsed.module_4_eight_layers;
      if (parsed.module_5_optimization) updateData.module_5_optimization = parsed.module_5_optimization;
    }
    if (persistableResult.module_1_overview) updateData.module_1_overview = persistableResult.module_1_overview;
    if (persistableResult.module_2_page_level) updateData.module_2_page_level = persistableResult.module_2_page_level;
    if (persistableResult.module_3_key_problems) updateData.module_3_key_problems = persistableResult.module_3_key_problems;
    if (persistableResult.module_4_eight_layers) updateData.module_4_eight_layers = persistableResult.module_4_eight_layers;
    if (persistableResult.module_5_optimization) updateData.module_5_optimization = persistableResult.module_5_optimization;

    const { data: completedReport, error: updateError } = await supabase
      .from("reports")
      .update(updateData)
      .eq("id", report.id)
      .select("*")
      .single();

    if (updateError || !completedReport) {
      console.error("Supabase update error:", updateError);
      return NextResponse.json({ error: "Failed to save report result" }, { status: 500 });
    }

    // Deduct credit after successful save (don't go below 0)
    if (userData && userData.audit_credits > 0) {
      await supabase
        .from("users")
        .update({ audit_credits: userData.audit_credits - 1, updated_at: new Date().toISOString() })
        .eq("id", user.userId);
    }

    console.info("[report-status saved]", {
      taskId: task_id ?? null,
      reportId: report.report_id ?? report_id ?? null,
      updated: Boolean(completedReport),
      savedStatus: updateData.status,
      savedReportV21: Boolean(updateData.report_v2_1),
      savedScore: hasLegacyScore,
      savedStatusCards: Boolean(
        updateData.trust_status ||
        updateData.ranking_potential ||
        updateData.risk_level
      ),
    });

    return NextResponse.json({
      ok: true,
      saved: true,
      status: "completed",
      reportId: report.id,
      hasReportV21,
      hasScore: hasLegacyScore,
      hasStatusCards: hasCards,
      report: completedReport,
    });
  } catch (error) {
    console.error("Report status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
