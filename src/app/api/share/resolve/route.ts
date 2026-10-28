import { NextResponse } from "next/server";

import { readShareToken } from "@/lib/report-shares/public-request";
import { ReportShareNotFoundError } from "@/lib/report-shares/service";
import { resolveVersionedShare } from "@/lib/report-shares/versioned";

const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function POST(request: Request) {
  const token = await readShareToken(request);
  if (!token) return NextResponse.json({ error: "Report share not found" }, { status: 404, headers: HEADERS });

  try {
    const resolved = await resolveVersionedShare(token);
    return NextResponse.json(resolved.kind === "review" ? {schemaVersion:"2.2.3",...resolved.value} : resolved.kind === "capability" ? {schemaVersion:"2.2.2",...resolved.value} : resolved.value, { headers: HEADERS });
  } catch (error) {
    if (error instanceof ReportShareNotFoundError) {
      return NextResponse.json({ error: "Report share not found" }, { status: 404, headers: HEADERS });
    }
    console.error("Shared report resolution failed", {
      error_type: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json({ error: "Unable to open report" }, { status: 500, headers: HEADERS });
  }
}
