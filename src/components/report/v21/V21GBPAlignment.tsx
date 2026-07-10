import {
  extractGBPAlignmentRows,
  formatAlignmentLayerLabel,
  type GBPAlignmentRow,
  type GBPAlignmentStatus,
  type ReportV21,
} from "@/lib/report-v21";
import { isAnalystView, type V21ViewMode } from "./viewMode";

const GBP_NOT_VERIFIED_MESSAGE = "GBP was not checked in this report, so GBP alignment could not be verified.";

export function V21GBPAlignment({
  reportV21,
  viewMode = "analyst",
}: {
  reportV21: ReportV21;
  viewMode?: V21ViewMode;
}) {
  const showTechnical = isAnalystView(viewMode);
  const gbpStatus = reportV21.gbp_status?.status || "not_checked";
  const reason = reportV21.gbp_status?.reason;

  if (gbpStatus !== "checked") {
    return (
      <LimitedState
        title="GBP alignment unavailable"
        message={GBP_NOT_VERIFIED_MESSAGE}
        detail={gbpStatus === "not_found" || gbpStatus === "error" ? reason ?? undefined : undefined}
      />
    );
  }

  const extraction = extractGBPAlignmentRows(reportV21);

  if (extraction.rows.length === 0) {
    return (
      <div className="space-y-5">
        <Intro />
        <LimitedState
          title="No structured alignment table"
          message="GBP was checked, but this report does not include a structured side-by-side GBP × Page alignment table."
          detail="Review entity consistency through L0-A Entity Presence, L0-B Entity Consistency, and available evidence in the trust layer breakdown."
        />
        {showTechnical && extraction.warnings.length > 0 && <Warnings warnings={extraction.warnings} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Intro />
      <div className="overflow-hidden rounded-[22px] border border-gray-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="bg-[#F8FAF5]">
              <tr>
                {["Field", "Page Signal", "GBP Signal", "Status", "Impact", "Suggested Fix"].map((header) => (
                  <th key={header} className="border-b border-gray-100 px-4 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-gray-500">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {extraction.rows.map((row, index) => (
                <AlignmentRow key={`${row.field_key}-${index}`} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showTechnical && extraction.warnings.length > 0 && <Warnings warnings={extraction.warnings} />}
    </div>
  );
}

function Intro() {
  return (
    <div className="rounded-[20px] border border-[#E4EDD2] bg-[#FBFDF5] p-5">
      <h3 className="text-[20px] font-black tracking-tight text-[#1A212B]">GBP × Page Alignment</h3>
      <p className="mt-2 text-[14px] font-medium leading-relaxed text-gray-600">
        Compares checked page/entity signals against GBP signals when structured GBP data is available.
      </p>
    </div>
  );
}

function AlignmentRow({ row }: { row: GBPAlignmentRow }) {
  return (
    <tr className="align-top odd:bg-white even:bg-gray-50/50">
      <td className="border-b border-gray-100 px-4 py-4">
        <p className="text-[14px] font-black text-[#1A212B]">{safeDisplay(row.field_label)}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {row.related_layer_keys.map((layerKey) => (
            <span key={layerKey} className="rounded-full border border-gray-100 bg-white px-2 py-1 text-[10px] font-bold text-gray-500">
              {formatAlignmentLayerLabel(layerKey)}
            </span>
          ))}
        </div>
      </td>
      <TextCell value={row.page_value} />
      <TextCell value={row.gbp_value} />
      <td className="border-b border-gray-100 px-4 py-4">
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${getAlignmentStatusTone(row.status)}`}>
          {getAlignmentStatusLabel(row.status)}
        </span>
      </td>
      <TextCell value={row.impact} />
      <TextCell value={row.suggested_fix} />
    </tr>
  );
}

function TextCell({ value }: { value: string }) {
  return (
    <td className="border-b border-gray-100 px-4 py-4">
      <p className="max-w-[230px] overflow-hidden text-ellipsis text-[13px] font-medium leading-relaxed text-gray-600">
        {safeDisplay(value)}
      </p>
    </td>
  );
}

function LimitedState({ title, message, detail }: { title: string; message: string; detail?: string }) {
  return (
    <div className="rounded-[22px] border border-amber-100 bg-amber-50 p-6">
      <p className="mb-2 text-[12px] font-black uppercase tracking-[0.14em] text-amber-700">{title}</p>
      <p className="text-[14px] font-bold leading-relaxed text-amber-900">{message}</p>
      {detail && <p className="mt-3 text-[13px] font-medium leading-relaxed text-amber-800">{detail}</p>}
    </div>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
      <p className="mb-2 text-[12px] font-black uppercase tracking-[0.12em] text-gray-400">Alignment parsing notes</p>
      <ul className="space-y-1">
        {warnings.map((warning, index) => (
          <li key={`${warning}-${index}`} className="text-[12px] font-medium text-gray-500">{warning}</li>
        ))}
      </ul>
    </div>
  );
}

function getAlignmentStatusLabel(status: GBPAlignmentStatus): string {
  const labels: Record<GBPAlignmentStatus, string> = {
    match: "Match",
    mismatch: "Mismatch",
    partial: "Partial",
    missing: "Missing",
    not_checked: "Not checked",
  };
  return labels[status] || "Not checked";
}

function getAlignmentStatusTone(status: GBPAlignmentStatus): string {
  const tones: Record<GBPAlignmentStatus, string> = {
    match: "border-emerald-100 bg-emerald-50 text-emerald-700",
    mismatch: "border-red-100 bg-red-50 text-red-700",
    partial: "border-amber-100 bg-amber-50 text-amber-700",
    missing: "border-orange-100 bg-orange-50 text-orange-700",
    not_checked: "border-gray-100 bg-gray-50 text-gray-500",
  };
  return tones[status] || tones.not_checked;
}

function safeDisplay(value: unknown): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "-";
}
