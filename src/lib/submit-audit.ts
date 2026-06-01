export async function submitAudit({
  url,
  pageType,
  gbpUrl,
}: {
  url: string;
  pageType: string;
  gbpUrl: string;
}): Promise<{ task_id: string; report_id: string }> {
  const res = await fetch("/api/generate-report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: url.trim(),
      page_type: pageType,
      gbp_url: gbpUrl?.trim() || undefined,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Failed to generate report");
  }

  return res.json();
}
