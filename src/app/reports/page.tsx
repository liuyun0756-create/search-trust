"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { FileSearch, CheckCircle } from "lucide-react";
import { ReportContent } from "@/components/report/ReportContent";
import { ReportHistory } from "@/components/report/ReportHistory";
import { RunAuditButton } from "@/components/common/RunAuditButton";
import { BackHeader } from "@/components/common/BackHeader";
import { useAuditModal } from "@/components/common/AuditModalProvider";
import { submitAudit } from "@/lib/submit-audit";
import type { Report } from "@/types/database";

const BACKEND_URL = "https://seo-backend-production-6f2b.up.railway.app/api/v1";

function parseScore(raw: string): Record<string, any> | null {
  try {
    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

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

function SSEIndicator({ progress }: { progress: { stage?: string; percent?: number; message?: string } | null }) {
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

export default function ReportsPageWrapper() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F8F9FA]" />}>
      <ReportsPage />
    </Suspense>
  );
}

function ReportsPage() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task_id");
  const pendingReportId = searchParams.get("report_id");
  const { isSignedIn, isLoaded } = useUser();
  const { refreshCredits, credits } = useAuditModal();

  // Debug: log all params on mount
  useEffect(() => {
    console.log("[ReportsPage] URL params:", {
      full_url: typeof window !== "undefined" ? window.location.href : "",
      payment: searchParams.get("payment"),
      audit_url: searchParams.get("audit_url"),
      audit_page_type: searchParams.get("audit_page_type"),
      task_id: searchParams.get("task_id"),
      report_id: searchParams.get("report_id"),
    });
  }, [searchParams]);

  const [activeReportId, setActiveReportId] = useState<string | undefined>(
    taskId ? pendingReportId || undefined : undefined
  );
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<{ date: string; items: { id: string; url: string; reportId: string }[] }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sseActive, setSseActive] = useState(false);
  const [sseProgress, setSseProgress] = useState<{ stage?: string; percent?: number; message?: string } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Handle payment success redirect — auto-submit audit if form data is present
  useEffect(() => {
    if (searchParams.get("payment") !== "success") return;
    // Wait for Clerk session to be ready after external redirect
    if (!isLoaded) return;

    const auditUrl = searchParams.get("audit_url");
    const auditPageType = searchParams.get("audit_page_type");
    const auditGbpUrl = searchParams.get("audit_gbp_url");

    console.log("[PaymentReturn]", { auditUrl, auditPageType, auditGbpUrl, isSignedIn, isLoaded });

    // Clean URL immediately
    window.history.replaceState({}, "", "/reports");

    if (auditUrl && auditPageType && isSignedIn) {
      // Payment returned with form data → auto-submit the audit
      (async () => {
        try {
          const result = await submitAudit({
            url: auditUrl,
            pageType: auditPageType,
            gbpUrl: auditGbpUrl || undefined,
          });
          console.log("[PaymentReturn] submitAudit result:", result);
          // Redirect to SSE streaming page
          window.location.href = `/reports?task_id=${result.task_id}&report_id=${result.report_id}`;
        } catch (err) {
          console.error("Auto-submit after payment failed:", err);
          const msg = err instanceof Error ? err.message : "Unknown error";
          alert("Payment succeeded but audit failed to start: " + msg);
          setPaymentSuccess(true);
          setTimeout(() => setPaymentSuccess(false), 4000);
        }
      })();
    } else {
      // Payment returned without form data or not signed in
      console.warn("[PaymentReturn] Missing data or not signed in, showing toast only");
      setPaymentSuccess(true);
      const timer = setTimeout(() => setPaymentSuccess(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, isLoaded, isSignedIn]);

  // Load history from API
  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/reports");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
    } catch {
    } finally {
      setHistoryLoading(false);
    }
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

  // SSE logic: when task_id is in URL
  useEffect(() => {
    if (!taskId) return;

    setSseActive(true);
    setSseProgress(null);

    const handleDone = async (result: any) => {
      // Parse score JSON from SSE result
      const parsed = result?.score ? parseScore(result.score) : null;

      // Construct Report object directly for instant rendering
      const isPaid = credits != null && credits > 1;
      const report: Report = {
        id: pendingReportId || "",
        report_id: pendingReportId || "",
        user_id: "",
        page_url: result.page_url || "",
        page_type: result.page_type || null,
        gbp_url: result.gbp_url || null,
        task_id: taskId,
        status: isPaid ? "paid_full" : "free_preview",
        trust_status: result.trust_status || null,
        ranking_potential: result.ranking_potential || null,
        risk_level: result.risk_level || null,
        generated_at: result.generated_at || null,
        module_1_overview: parsed?.module_1_overview || null,
        module_2_page_level: parsed?.module_2_page_level || null,
        module_3_key_problems: parsed?.module_3_key_problems || null,
        module_4_eight_layers: parsed?.module_4_eight_layers || null,
        module_5_optimization: parsed?.module_5_optimization || null,
        created_at: new Date().toISOString(),
      };

      // Render immediately
      setReport(report);
      setSseActive(false);
      if (pendingReportId) setActiveReportId(pendingReportId);

      // Async: save to DB + refresh credits + update history
      fetch("/api/report-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, result }),
      }).then(() => {
        refreshCredits();
      }).catch((err) => {
        console.error("Failed to save report result:", err);
      });

      loadHistory();
      window.history.replaceState({}, "", "/reports");
    };

    const eventSource = new EventSource(`${BACKEND_URL}/task/${taskId}/stream`);
    let taskDone = false;

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.progress) {
          setSseProgress(data.progress);
        }

        if (data.status === "done") {
          eventSource.close();
          taskDone = true;
          handleDone(data.result);
          return;
        }

        if (data.status === "failed") {
          eventSource.close();
          setSseActive(false);
          taskDone = true;

          try {
            await fetch("/api/report-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ task_id: taskId, result: null, failed: true }),
            });
          } catch {}

          alert("Report generation failed. Your credit has not been deducted.");
          await loadHistory();
          window.history.replaceState({}, "", "/reports");
          return;
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    eventSource.onerror = async () => {
      eventSource.close();
      if (taskDone) return;

      console.log("SSE error, falling back to load report from DB");
      setSseActive(false);

      let resultSaved = false;

      // Try to save result from backend REST API first
      try {
        const res = await fetch(`${BACKEND_URL}/task/${taskId}/result`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === "done" && data.result) {
            await fetch("/api/report-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ task_id: taskId, result: data.result }),
            });
            resultSaved = true;
          }
        }
      } catch {}

      if (!resultSaved) {
        // Task not found or no result — clean up the empty report
        try {
          await fetch("/api/report-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task_id: taskId, result: null, failed: true }),
          });
        } catch {}
      }

      // Reload history and show the latest valid report
      await loadHistory();
      setHistory(prev => {
        if (prev.length > 0 && prev[0].items.length > 0) {
          const firstId = prev[0].items[0].id;
          setActiveReportId(firstId);
          fetchReport(firstId);
        }
        return prev;
      });

      window.history.replaceState({}, "", "/reports");
    };

    return () => {
      eventSource.close();
    };
  }, [taskId, pendingReportId, fetchReport, loadHistory, refreshCredits]);

  // First load: if no task_id, load first report from history
  useEffect(() => {
    if (taskId) return;
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

  if (historyLoading || (!taskId && hasReports && !report && isLoading)) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#1A212B] selection:bg-[#A5D020]/30">
        <BackHeader />
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-24">
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-[#A5D020] border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (sseActive) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#1A212B] selection:bg-[#A5D020]/30">
        <BackHeader />
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-24">
          <SSEIndicator progress={sseProgress} />
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
      <AnimatePresence>
        {paymentSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-[#1D2531] text-white px-5 py-3 rounded-full shadow-lg"
          >
            <CheckCircle size={16} className="text-[#A5D020]" />
            <span className="text-sm font-bold">Payment successful! Credit added.</span>
          </motion.div>
        )}
      </AnimatePresence>
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
