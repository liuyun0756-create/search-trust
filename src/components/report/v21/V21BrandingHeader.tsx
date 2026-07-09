import { getEffectiveBranding, hasWhiteLabelBranding, type ReportV21 } from "@/lib/report-v21";
import type { V21ViewMode } from "./viewMode";

export function V21BrandingHeader({
  reportV21,
  viewMode,
}: {
  reportV21: ReportV21;
  viewMode: V21ViewMode;
}) {
  if (!hasWhiteLabelBranding(reportV21)) return null;

  const branding = getEffectiveBranding(reportV21);
  const isClient = viewMode === "client";

  return (
    <div className={`rounded-[24px] border border-[#E4EDD2] bg-[#FBFDF5] ${isClient ? "p-6" : "p-5"}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          {branding.agencyLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.agencyLogoUrl}
              alt={branding.agencyName ? `${branding.agencyName} logo` : "Agency logo"}
              className="h-12 w-12 rounded-xl border border-white bg-white object-contain p-1 shadow-sm"
            />
          )}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#D6E8A8] bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-[#7A8A15]">
                Agency report
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-gray-400">
                Trust framework by SearchTrust
              </span>
            </div>
            {branding.clientName && (
              <p className="text-[18px] font-black tracking-tight text-[#1A212B]">
                Prepared for {branding.clientName}
              </p>
            )}
            {branding.agencyName && (
              <p className="mt-1 text-[14px] font-semibold text-gray-600">
                Prepared by {branding.agencyName}
              </p>
            )}
          </div>
        </div>

        {branding.footerNote && (
          <p className="max-w-md text-[13px] font-medium leading-relaxed text-gray-600">
            {branding.footerNote}
          </p>
        )}
      </div>
    </div>
  );
}
