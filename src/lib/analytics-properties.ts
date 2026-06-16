export type AnalyticsProperties = Record<
  string,
  string | number | boolean | null | undefined
>;

export type AuditAnalyticsInput = {
  url?: string;
  pageType?: string;
  gbpUrl?: string;
};

export function compactAnalyticsProperties(
  properties: AnalyticsProperties = {}
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  ) as Record<string, string | number | boolean | null>;
}

export function getCreditsBucket(credits: number | null | undefined) {
  if (typeof credits !== "number") return undefined;
  if (credits <= 0) return "0";
  if (credits === 1) return "1";
  return "2_plus";
}

export function getUrlHost(rawUrl: string | null | undefined) {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim();
  if (!trimmed) return undefined;

  try {
    const parsed = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`
    );
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return undefined;
  }
}

export function getAuditEventProperties(
  data: AuditAnalyticsInput,
  extra: AnalyticsProperties = {}
) {
  return compactAnalyticsProperties({
    page_type: data.pageType,
    has_gbp_url: Boolean(data.gbpUrl?.trim()),
    url_host: getUrlHost(data.url),
    ...extra,
  });
}
