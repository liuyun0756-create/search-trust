import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.REPORT_API_BASE_URL || "https://seo-backend-production-6f2b.up.railway.app/api/v1";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");
  const pageType = searchParams.get("page_type");
  const gbpUrl = searchParams.get("gbp_url");

  if (!url || !pageType || !gbpUrl) {
    return NextResponse.json({ error: "url, page_type and gbp_url are required" }, { status: 400 });
  }

  const upstreamParams = new URLSearchParams({
    url,
    page_type: pageType,
    gbp_url: gbpUrl,
  });

  try {
    const res = await fetch(`${BACKEND_URL}/report-meta?${upstreamParams.toString()}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Report meta error:", res.status, errText);
      return NextResponse.json({ error: "Failed to fetch report meta" }, { status: 502 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Report meta route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
