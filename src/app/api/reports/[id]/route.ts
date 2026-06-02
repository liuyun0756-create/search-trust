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
    const externalReportId = body.external_report_id;

    if (!externalReportId || typeof externalReportId !== "string") {
      return NextResponse.json({ error: "external_report_id is required" }, { status: 400 });
    }

    const supabase = createServerClient();
    const query = supabase
      .from("reports")
      .update({ external_report_id: externalReportId })
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
