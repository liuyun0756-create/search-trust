import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

function parseReportDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("reports")
      .select("id, report_id, external_report_id, page_url, status, generated_at, completed_at, created_at")
      .eq("user_id", user.userId)
      // Show completed, failed, and the current pending report during generation
      .in("status", ["pending", "free_preview", "paid_full", "failed"])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json(
        {
          error: "Failed to fetch reports",
          detail: process.env.NODE_ENV === "production" ? undefined : error.message,
        },
        { status: 500 }
      );
    }

    // 按日期分组，适配前端 ReportHistory 组件格式
    const grouped = (data || []).reduce(
      (acc, report) => {
        const displayDate = parseReportDate(report.generated_at)
          || parseReportDate(report.completed_at)
          || parseReportDate(report.created_at)
          || new Date(report.created_at);
        const date = displayDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        let group = acc.find((g) => g.date === date);
        if (!group) {
          group = { date, items: [] };
          acc.push(group);
        }
        group.items.push({
          id: report.id,
          url: report.page_url,
          reportId: report.external_report_id || report.report_id,
          status: report.status,
        });
        return acc;
      },
      [] as { date: string; items: { id: string; url: string; reportId: string; status: string }[] }[]
    );

    return NextResponse.json(grouped);
  } catch (error) {
    console.error("Fetch reports error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
