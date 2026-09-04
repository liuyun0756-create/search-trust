import type { EffectiveBranding } from "../report-v21";

export function parsePdfBranding(value: unknown): EffectiveBranding | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const text = (key: string, maxLength: number) => {
    const candidate = raw[key];
    return typeof candidate === "string" && candidate.trim()
      ? candidate.trim().slice(0, maxLength)
      : null;
  };
  const logoData = text("agency_logo_data", 1_500_000);
  if (logoData && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/i.test(logoData)) {
    throw new Error("Logo must be a PNG or JPEG image upload.");
  }
  const branding: EffectiveBranding = {
    enabled: true,
    agencyName: text("agency_name", 120),
    agencyLogoData: logoData,
    clientName: text("client_name", 120),
    footerNote: text("footer_note", 240),
  };
  return branding.agencyName || branding.agencyLogoData || branding.clientName || branding.footerNote
    ? branding
    : undefined;
}
