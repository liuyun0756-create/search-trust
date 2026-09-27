import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isLocalE2ETestMode } from "@/lib/e2e-v22/config";
import { DeliveryPlanConflictError, latestDeliveryPlanVersion, saveDeliveryPlanVersion } from "@/lib/report-delivery/repository";
import { initialDeliveryPlan } from "@/lib/report-delivery/plan";
import { loadUserReportV22 } from "@/lib/report-v22/server-report";
import { createServerClient } from "@/lib/supabase";

type Context = { params: Promise<{ id: string; reportId: string }> };

async function owned(context: Context) {
  const user = await getCurrentUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { id, reportId } = await context.params;
  const client = createServerClient();
  const selected = await loadUserReportV22(client, user.userId, id, reportId);
  if (!selected.ok) return { response: NextResponse.json({ error: "Report not found" }, { status: 404 }) };
  return { client, userId: user.userId, caseId: id, reportId: selected.databaseId, report: selected.report };
}

function errorResponse(error: unknown) {
  if (error instanceof DeliveryPlanConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof Error && (error.message.startsWith("The plan must") || error.message === "Invalid plan revision.")) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error("Delivery plan request failed", { error_type: error instanceof Error ? error.name : "UnknownError" });
  return NextResponse.json({ error: "Unable to save the delivery plan" }, { status: 500 });
}

export async function GET(_request: Request, context: Context) {
  try {
    const target = await owned(context);
    if (target.response) return target.response;
    const latest = await latestDeliveryPlanVersion(target.client!, target.reportId!);
    return NextResponse.json({ revision: latest?.revision ?? 0, status: latest?.status ?? "original", plan: latest?.plan ?? initialDeliveryPlan(target.report!) });
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: Request, context: Context) {
  if (isLocalE2ETestMode()) return NextResponse.json({ error: "Plan editing is unavailable in fixture mode." }, { status: 403 });
  try {
    const target = await owned(context);
    if (target.response) return target.response;
    const body = await request.json().catch(() => null);
    const saved = await saveDeliveryPlanVersion(target.client!, {
      userId: target.userId!, caseId: target.caseId!, reportId: target.reportId!, report: target.report!,
      expectedRevision: body?.expectedRevision, status: "draft", plan: body?.plan,
    });
    return NextResponse.json({ revision: saved.revision, status: saved.status, plan: saved.plan });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  if (isLocalE2ETestMode()) return NextResponse.json({ error: "Plan approval is unavailable in fixture mode." }, { status: 403 });
  try {
    const target = await owned(context);
    if (target.response) return target.response;
    const body = await request.json().catch(() => null);
    if (body?.reviewConfirmed !== true) return NextResponse.json({ error: "Confirm that you reviewed the client preview before approval." }, { status: 400 });
    const latest = await latestDeliveryPlanVersion(target.client!, target.reportId!);
    if (body?.expectedRevision !== (latest?.revision ?? 0)) throw new DeliveryPlanConflictError();
    const saved = await saveDeliveryPlanVersion(target.client!, {
      userId: target.userId!, caseId: target.caseId!, reportId: target.reportId!, report: target.report!,
      expectedRevision: latest?.revision ?? 0, status: "approved", plan: latest?.plan ?? initialDeliveryPlan(target.report!),
    });
    return NextResponse.json({ revision: saved.revision, status: saved.status, plan: saved.plan });
  } catch (error) { return errorResponse(error); }
}
