"use client";

import { Clock, ArrowUpRight } from "lucide-react";

interface ReportItem {
  id: string;
  url?: string;
  page_url?: string;
  reportId: string;
}

interface ReportHistoryProps {
  reports: {
    date: string;
    items: ReportItem[];
  }[];
  activeId?: string;
  onSelect?: (id: string) => void;
}

export function ReportHistory({ reports, activeId, onSelect }: ReportHistoryProps) {
  return (
    <aside className="hidden lg:block w-64 flex-shrink-0">
      <div className="sticky top-6">
        <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#A5D020]" /> History
        </h3>
        <div className="space-y-8 max-h-[calc(100vh-120px)] overflow-y-auto pr-1">
        {reports.map((group, gi) => (
          <div key={gi}>
            <p className="text-[12px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300" /> {group.date}
            </p>
            <div className="space-y-3">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelect?.(item.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer group ${
                    activeId === item.id
                      ? "bg-white border-gray-100 shadow-sm"
                      : "hover:bg-white border-transparent hover:border-gray-100"
                  }`}
                >
                  <p className="text-[11px] text-blue-500 font-medium truncate mb-1">{item.page_url || item.url}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-gray-400 italic">Report ID: {item.reportId}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#A5D020] transition-all" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        </div>
      </div>
    </aside>
  );
}
