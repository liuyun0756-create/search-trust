import type { ReportV21 } from "./types";

export const ENABLE_WHITE_LABEL_PLACEHOLDERS = true;

export interface EffectiveBranding {
  enabled: boolean;
  agencyName: string | null;
  agencyLogoUrl: string | null;
  clientName: string | null;
  footerNote: string | null;
}

export function getEffectiveBranding(reportV21: ReportV21): EffectiveBranding {
  if (!ENABLE_WHITE_LABEL_PLACEHOLDERS) return disabledBranding();

  try {
    const branding = reportV21.agency_branding;
    if (!branding || branding.enabled !== true) return disabledBranding();

    return {
      enabled: true,
      agencyName: textOrNull(branding.agency_name),
      agencyLogoUrl: textOrNull(branding.agency_logo_url),
      clientName: textOrNull(branding.client_name),
      footerNote: textOrNull(branding.footer_note),
    };
  } catch {
    return disabledBranding();
  }
}

export function hasWhiteLabelBranding(reportV21: ReportV21): boolean {
  const branding = getEffectiveBranding(reportV21);
  return Boolean(
    branding.enabled &&
    (branding.agencyName || branding.clientName || branding.agencyLogoUrl)
  );
}

function disabledBranding(): EffectiveBranding {
  return {
    enabled: false,
    agencyName: null,
    agencyLogoUrl: null,
    clientName: null,
    footerNote: null,
  };
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
