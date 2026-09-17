import { NextResponse } from "next/server";
import { requireV22PublicEntry } from "@/lib/release-v22/public-entry";

export const dynamic = "force-dynamic";
const rejectFreeDiscovery = async () => {
  return NextResponse.json({
    error: {
      code: "CHARGED_PROSPECT_WORKFLOW_REQUIRED",
      message: "Create a Case and start its one-credit Prospect workflow before discovery.",
    },
  }, { status: 410, headers: { "cache-control": "no-store" } });
};

export const POST = requireV22PublicEntry(rejectFreeDiscovery);
