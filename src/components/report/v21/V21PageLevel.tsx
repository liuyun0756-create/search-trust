import type { PageLevel } from "@/lib/report-v21";
import { safeList } from "./statusHelpers";
import type { V21ViewMode } from "./viewMode";

export function V21PageLevel({ pageLevel, viewMode: _viewMode = "analyst" }: { pageLevel: PageLevel; viewMode?: V21ViewMode }) {
  return (
    <div className="space-y-6">
      <div className="rounded-[22px] border border-gray-100 bg-gray-50/60 p-6">
        <p className="mb-2 text-[12px] font-black uppercase tracking-[0.14em] text-gray-400">Page level</p>
        <h3 className="mb-3 text-[24px] font-black tracking-tight text-[#1A212B]">{pageLevel.label}</h3>
        <p className="text-[15px] font-medium leading-relaxed text-gray-700">{pageLevel.what_it_looks_like}</p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ListCard title="Strengths" values={pageLevel.strengths} tone="good" />
        <ListCard title="Missing / Weak Elements" values={pageLevel.missing_elements} tone="weak" />
      </div>
    </div>
  );
}

function ListCard({ title, values, tone }: { title: string; values?: string[] | null; tone: "good" | "weak" }) {
  const items = safeList(values).filter(Boolean);
  const dot = tone === "good" ? "bg-emerald-500" : "bg-amber-500";

  return (
    <article className="rounded-[20px] border border-gray-100 bg-white p-5 shadow-sm">
      <h4 className="mb-4 text-[15px] font-black text-[#1A212B]">{title}</h4>
      {items.length ? (
        <ul className="space-y-2.5">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-3 text-[14px] font-medium leading-relaxed text-gray-600">
              <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] font-medium text-gray-400">No structured items available.</p>
      )}
    </article>
  );
}
