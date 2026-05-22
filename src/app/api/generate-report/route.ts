import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

const BACKEND_URL = "https://seo-backend-production-6f2b.up.railway.app/api/v1";
const DEV_MODE = process.env.DEV_BYPASS_AUTH === "true";

// TODO: 后端统一成英文后删除此映射
const PAGE_TYPE_MAP: Record<string, string> = {
  "Service Page": "本地服务落地页",
  "Location Page": "实体目的地",
  "City Page": "门店信息",
  "Service-Area Page": "服务总览",
  "Product Page": "商品",
  "Blog Post": "文章",
  "Landing Page": "分类页",
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

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }
    console.log("/analyze接口，后端Received report generation request:", { url, page_type, gbp_url });
    // 1. 调后端创建任务
    const analyzeRes = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        page_type: page_type,
        language: "English",
        ...(gbp_url ? { gbp_url } : {}),
      }),
    });

    if (!analyzeRes.ok) {
      const errText = await analyzeRes.text();
      console.error("Backend analyze error:", analyzeRes.status, errText);
      return NextResponse.json({ error: `Backend analyze failed (${analyzeRes.status}): ${errText}` }, { status: 502 });
    }

    const { task_id } = await analyzeRes.json();

    // 2. 在 reports 表创建记录（module 字段为空，等待 SSE 完成后填充）
    const supabase = createServerClient();
    const reportId = `RPT-${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from("reports").insert({
      report_id: reportId,
      user_id: user.userId,
      page_url: url,
      page_type,
      gbp_url: gbp_url || null,
      task_id,
      status: "pending",
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "Failed to save report" }, { status: 500 });
    }

    return NextResponse.json({ task_id, report_id: reportId });
  } catch (error) {
    console.error("Generate report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
