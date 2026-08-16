export async function submitAudit({
  url,
  pageType,
  gbpUrl,
  locationContext,
}: {
  url: string;
  pageType: string;
  gbpUrl: string;
  locationContext?: string;
}, request: typeof fetch = fetch): Promise<{
  task_id: string | null;
  report_id: string;
  database_report_id?: string | null;
  pending_initialization?: boolean;
}> {
  const res = await request("/api/generate-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: url.trim(),
      page_type: pageType,
      gbp_url: gbpUrl?.trim() || undefined,
      location_context: locationContext?.trim() || undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to generate report");
  }

  return res.json();
}
