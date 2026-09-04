import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { ReportShareNotFoundError } from "@/lib/report-shares/service";
import { createServerReportShareService } from "@/lib/report-shares/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; reportId: string; shareId: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id, reportId, shareId } = await params;
    await createServerReportShareService().revoke(user.userId, id, reportId, shareId);
    return NextResponse.json({ revoked: true });
  } catch (error) {
    if (error instanceof ReportShareNotFoundError) {
      return NextResponse.json({ error: "Report share not found" }, { status: 404 });
    }
    console.error("Report share revoke failed", { error_type: error instanceof Error ? error.name : "UnknownError" });
    return NextResponse.json({ error: "Unable to revoke report share" }, { status: 500 });
  }
}
