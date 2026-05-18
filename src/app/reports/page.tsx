"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { FileSearch } from "lucide-react";
import { ReportContent } from "@/components/report/ReportContent";
import { ReportHistory } from "@/components/report/ReportHistory";
import { RunAuditButton } from "@/components/common/RunAuditButton";
import { BackHeader } from "@/components/common/BackHeader";
import type { Report } from "@/types/database";

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 bg-white rounded-[28px] border border-gray-100 shadow-sm flex items-center justify-center mx-auto mb-8">
          <FileSearch className="w-9 h-9 text-[#A5D020]" />
        </div>
        <h2 className="text-[28px] font-bold tracking-tighter text-[#1A212B] mb-3">
          No reports yet
        </h2>
        <p className="text-[15px] text-[#6B7280] font-medium mb-10 leading-relaxed">
          Run your first Trust Audit to diagnose why Google doesn&apos;t trust your local page.
        </p>
        <RunAuditButton className="bg-[#1D2531] text-white px-10 py-4 rounded-full font-bold text-[15px] hover:bg-black transition-all shadow-lg">
          Run a Trust Audit
        </RunAuditButton>
      </motion.div>
    </div>
  );
}

function PollingIndicator({ progress }: { progress: { stage?: string; percent?: number; message?: string } | null }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="w-16 h-16 bg-white rounded-2xl border border-gray-100 shadow-sm flex items-center justify-center mx-auto mb-6">
          <div className="w-6 h-6 border-3 border-[#A5D020] border-t-transparent rounded-full animate-spin" />
        </div>
        <h2 className="text-[22px] font-bold tracking-tighter text-[#1A212B] mb-2">
          Generating your report
        </h2>
        <p className="text-[14px] text-[#6B7280] font-medium">
          {progress?.message || "Analyzing page trust signals..."}
        </p>
        {progress?.percent != null && (
          <div className="mt-4 mx-auto max-w-xs">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#A5D020] rounded-full transition-all duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="mt-1.5 text-[12px] text-gray-400">{progress.percent}%</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task_id");
  const pendingReportId = searchParams.get("report_id");

  const [activeReportId, setActiveReportId] = useState<string | undefined>(
    taskId ? pendingReportId || undefined : undefined
  );
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<{ date: string; items: { id: string; url: string; reportId: string }[] }[]>([]);
  const [polling, setPolling] = useState(false);
  const [pollProgress, setPollProgress] = useState<{ stage?: string; percent?: number; message?: string } | null>(null);

  // Load history from API
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/reports");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
    } catch {}
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Fetch a single report by ID
  const fetchReport = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/reports/${id}`);
      if (!res.ok) throw new Error("Failed to fetch report");
      const data = await res.json();
      setReport(data);
    } catch (error) {
      console.error("Failed to fetch report:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Polling logic: when task_id is in URL
  useEffect(() => {
    if (!taskId) return;

    setPolling(true);
    setPollProgress(null);

    let stopped = false;
    const poll = async () => {
      if (stopped) return;

      try {
        const res = await fetch(`/api/report-status?task_id=${taskId}`);
        if (!res.ok) {
          // If polling fails, stop and try loading report directly
          stopped = true;
          setPolling(false);
          if (pendingReportId) fetchReport(pendingReportId);
          return;
        }

        const data = await res.json();

        if (data.status === "done") {
          stopped = true;
          setPolling(false);
          // Refresh history and load the completed report
          await loadHistory();
          if (data.reportId) {
            setActiveReportId(data.reportId);
            fetchReport(data.reportId);
          }
          // Clean URL params
          window.history.replaceState({}, "", "/reports");
          return;
        }

        if (data.status === "failed") {
          stopped = true;
          setPolling(false);
          alert("Report generation failed. Your credit has been refunded.");
          await loadHistory();
          window.history.replaceState({}, "", "/reports");
          return;
        }

        // Still processing — update progress and continue
        setPollProgress(data.progress);
        setTimeout(poll, 3000);
      } catch {
        // Network error — retry after delay
        setTimeout(poll, 5000);
      }
    };

    poll();

    return () => {
      stopped = true;
    };
  }, [taskId, pendingReportId, fetchReport, loadHistory]);

  // First load: if no task_id, load first report from history
  useEffect(() => {
    if (taskId) return; // polling will handle it
    if (history.length > 0 && history[0].items.length > 0) {
      const firstId = history[0].items[0].id;
      setActiveReportId(firstId);
      fetchReport(firstId);
    }
  }, [taskId, history, fetchReport]);

  const handleSelect = (id: string) => {
    setActiveReportId(id);
    fetchReport(id);
  };

  const hasReports = history.length > 0 && history.some((g) => g.items.length > 0);

  // Show polling indicator
  if (polling) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#1A212B] selection:bg-[#A5D020]/30">
        <BackHeader />
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-24">
          <PollingIndicator progress={pollProgress} />
        </div>
      </div>
    );
  }

  if (!hasReports) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#1A212B] selection:bg-[#A5D020]/30">
        <BackHeader />
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-24">
          <EmptyState />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#1A212B] selection:bg-[#A5D020]/30">
      <BackHeader />
      <div className="max-w-7xl mx-auto px-6 pt-12 pb-24 flex gap-10">
        <ReportHistory
          reports={history}
          activeId={activeReportId}
          onSelect={handleSelect}
        />
        {report ? (
          <ReportContent
            report={report}
            isPaid={report.status === "paid_full"}
            isLoading={isLoading}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p className="text-sm font-bold">Select a report to view</p>
          </div>
        )}
      </div>
    </div>
  );
}
