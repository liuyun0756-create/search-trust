import type { PageLevel } from "@/lib/report-v21";
import { safeList } from "./statusHelpers";
import type { V21ViewMode } from "./viewMode";

export function V21PageLevel({ pageLevel, viewMode: _viewMode = "analyst" }: { pageLevel: PageLevel; viewMode?: V21ViewMode }) {
  const currentAssessment = pageLevel.current_assessment || pageLevel.what_it_looks_like;
  const existingFoundation = pageLevel.existing_foundation || listSummary(pageLevel.strengths, "No strong foundation was identified.");
  const mainLimitation = pageLevel.main_limitation || listSummary(pageLevel.missing_elements, "No material limitation was identified.");

  return (
    <div className="space-y-5">
      <div className="rounded-[22px] border border-gray-100 bg-gray-50/60 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">Current Assessment</p>
          <span className="rounded-full border border-[#E4EDD2] bg-[#FBFDF5] px-3 py-1.5 text-[12px] font-black text-[#7E9F20]">
            {pageLevel.label}
          </span>
        </div>
        <p className="text-[15px] font-medium leading-relaxed text-gray-700">{currentAssessment}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DetailCard title="Existing Foundation" value={existingFoundation} />
        <DetailCard title="Main Limitation" value={mainLimitation} />
        <DetailCard title="Likely Search Outcome" value={pageLevel.likely_search_outcome} />
        <DetailCard title="Competitive Interpretation" value={pageLevel.competitive_interpretation} />
      </div>
    </div>
  );
}

function DetailCard({ title, value }: { title: string; value?: string | null }) {
  return (
    <article className="rounded-[20px] border border-gray-100 bg-white p-5 shadow-sm">
      <h4 className="mb-3 text-[12px] font-black uppercase tracking-[0.12em] text-gray-400">{title}</h4>
      <p className="text-[14px] font-medium leading-relaxed text-gray-700">
        {value || "This interpretation was not available in the current report."}
      </p>
    </article>
  );
}

function listSummary(values: string[] | null | undefined, empty: string): string {
  const items = safeList(values).filter(Boolean);
  return items.length ? items.join(" ") : empty;
}
