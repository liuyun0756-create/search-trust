import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { ReportShareNotFoundError } from "@/lib/report-shares/service";
import { createServerReportShareService } from "@/lib/report-shares/server";

type Context = { params: Promise<{ id: string; reportId: string }> };

function failure(error: unknown) {
  if (error instanceof ReportShareNotFoundError) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  console.error("Report share request failed", { error_type: error instanceof Error ? error.name : "UnknownError" });
  return NextResponse.json({ error: "Unable to manage report sharing" }, { status: 500 });
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, reportId } = await context.params;
    const shares = await createServerReportShareService().list(user.userId, id, reportId);
    return NextResponse.json({ shares });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, reportId } = await context.params;
    const share = await createServerReportShareService().create(user.userId, id, reportId);
    return NextResponse.json({
      id: share.id,
      expiresAt: share.expires_at,
      url: new URL(`/share/${share.token}`, request.nextUrl.origin).toString(),
    }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
