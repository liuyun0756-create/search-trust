import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from("reports")
      .select("id, report_id, page_url, status, created_at")
      .eq("user_id", user.userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase query error:", error);
      return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
    }

    // 按日期分组，适配前端 ReportHistory 组件格式
    const grouped = (data || []).reduce(
      (acc, report) => {
        const date = new Date(report.created_at).toLocaleDateString("en-US", {
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
          reportId: report.report_id,
        });
        return acc;
      },
      [] as { date: string; items: { id: string; url: string; reportId: string }[] }[]
    );

    return NextResponse.json(grouped);
  } catch (error) {
    console.error("Fetch reports error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
