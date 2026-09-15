const GA4_MEASUREMENT_ID = /^G-[A-Z0-9]{6,20}$/u;

export type GoogleAnalyticsPageView = {
  page_location: string;
  page_path: string;
};

export function parseGoogleAnalyticsMeasurementId(value: string | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? "";
  return GA4_MEASUREMENT_ID.test(normalized) ? normalized : null;
}

export function buildGoogleAnalyticsPageView(origin: string, pathname: string): GoogleAnalyticsPageView {
  const normalizedPath = pathname.startsWith("/")
    ? pathname.split(/[?#]/u, 1)[0] || "/"
    : "/";
  const normalizedOrigin = new URL(origin).origin;

  return {
    page_location: `${normalizedOrigin}${normalizedPath}`,
    page_path: normalizedPath,
  };
}
