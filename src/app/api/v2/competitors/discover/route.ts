import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function POST() {
  return NextResponse.json({
    error: {
      code: "CHARGED_PROSPECT_WORKFLOW_REQUIRED",
      message: "Create a Case and start its one-credit Prospect workflow before discovery.",
    },
  }, { status: 410, headers: { "cache-control": "no-store" } });
}
