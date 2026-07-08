import type { DataCoverage, GBPStatus } from "@/lib/report-v21";
import { safeList, yesNo } from "./statusHelpers";
import { filterClientLimitations, isAnalystView, type V21ViewMode } from "./viewMode";

const GBP_NOT_VERIFIED_MESSAGE = "GBP was not checked in this report, so GBP alignment could not be verified.";

export function V21DataCoverage({
  gbpStatus,
  dataCoverage,
  source,
  viewMode = "analyst",
}: {
  gbpStatus: GBPStatus;
  dataCoverage: DataCoverage;
  source: string;
  viewMode?: V21ViewMode;
}) {
  const showTechnical = isAnalystView(viewMode);
  const limitations = showTechnical
    ? safeList(dataCoverage.limitations)
    : filterClientLimitations(dataCoverage.limitations);
  const coverageRows = [
    ["Page content checked", dataCoverage.page_content_checked],
    ["GBP checked", dataCoverage.gbp_checked],
    ["Schema checked", dataCoverage.schema_checked],
    ["Contact page checked", dataCoverage.contact_page_checked],
    ["About page checked", dataCoverage.about_page_checked],
    ["Reviews checked", dataCoverage.reviews_checked],
    ["Internal pages checked", dataCoverage.internal_pages_checked],
    ["Competitor pages checked", dataCoverage.competitor_pages_checked],
  ] as const;

  return (
    <div className="space-y-5">
      <div className="rounded-[22px] border border-gray-100 bg-white p-6 shadow-sm">
        <p className="mb-2 text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">GBP status</p>
        <h3 className="mb-2 text-[22px] font-black capitalize tracking-tight text-[#1A212B]">
          {gbpStatus.status.replace(/_/g, " ")}
        </h3>
        {gbpStatus.gbp_url && (
          <a href={gbpStatus.gbp_url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-bold text-blue-600 hover:text-blue-800">
            {gbpStatus.gbp_url}
          </a>
        )}
        {gbpStatus.reason && <p className="mt-3 text-[14px] font-medium leading-relaxed text-gray-600">{gbpStatus.reason}</p>}
        {gbpStatus.status !== "checked" && (
          <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-[13px] font-bold text-amber-800">
            {GBP_NOT_VERIFIED_MESSAGE}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {coverageRows.map(([label, checked]) => (
          <div key={label} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-3">
            <span className="text-[13px] font-bold text-[#1A212B]">{label}</span>
            <span className={`text-[13px] font-black ${checked ? "text-emerald-600" : "text-gray-400"}`}>{yesNo(checked)}</span>
          </div>
        ))}
      </div>

      {showTechnical && (source === "legacy_adapted" || source === "fallback") && (
        <p className="rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-[13px] font-medium text-blue-800">
          {source === "legacy_adapted"
            ? "This report was adapted from a legacy report format; structured v2.1 evidence may be incomplete."
            : "This report could not be fully normalized, so only a limited fallback view is available."}
        </p>
      )}

      {limitations.length > 0 && (
        <div className="rounded-[22px] border border-gray-100 bg-white p-5">
          <p className="mb-3 text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">Limitations</p>
          <ul className="space-y-2">
            {limitations.map((limitation, index) => (
              <li key={`${limitation}-${index}`} className="flex gap-2 text-[13px] font-medium leading-relaxed text-gray-600">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
                <span>{limitation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
