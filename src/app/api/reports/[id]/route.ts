import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createServerClient();

    // Support both Supabase id (UUID) and report_id (RPT-xxx)
    const query = supabase
      .from("reports")
      .select("*")
      .eq("user_id", user.userId);

    const isUUID = /^[0-9a-f]{8}-/.test(id);
    const { data, error } = await (isUUID
      ? query.eq("id", id).single()
      : query.eq("report_id", id).single());

    if (error || !data) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Fetch report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const updateData: Record<string, string | boolean> = {};

    if (typeof body.external_report_id === "string" && body.external_report_id.trim()) {
      updateData.external_report_id = body.external_report_id.trim();
    }
    if (typeof body.page_url === "string" && body.page_url.trim()) {
      updateData.page_url = body.page_url.trim();
    }
    if (typeof body.page_type === "string" && body.page_type.trim()) {
      updateData.page_type = body.page_type.trim();
    }
    if (typeof body.gbp_url === "string" && body.gbp_url.trim()) {
      updateData.gbp_url = body.gbp_url.trim();
    }
    if (typeof body.gbp_connected === "boolean") {
      updateData.gbp_connected = body.gbp_connected;
    }
    if (typeof body.generated_at === "string" && body.generated_at.trim()) {
      updateData.generated_at = body.generated_at.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid report fields to update" }, { status: 400 });
    }

    const supabase = createServerClient();
    const query = supabase
      .from("reports")
      .update(updateData)
      .eq("user_id", user.userId)
      .select("*");

    const isUUID = /^[0-9a-f]{8}-/.test(id);
    const { data, error } = await (isUUID
      ? query.eq("id", id).single()
      : query.eq("report_id", id).single());

    if (error || !data) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Update report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
