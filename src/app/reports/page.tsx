"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
const PENDING_AUDIT_STORAGE_KEY = "searchtrust_pending_audit";

function mergeReportMeta(report: Report, meta: Record<string, any>): Report {
  return {
    ...report,
    external_report_id: meta.report_id || report.external_report_id,
    page_url: meta.page_url || meta.url || report.page_url,
    page_type: meta.page_type || report.page_type,
    gbp_url: meta.gbp_url || report.gbp_url,
    generated_at: meta.generated_at || report.generated_at,
  };
}

function toReportMetaPageType(pageType: string): string {
  return pageType
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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

function DetailLoadingState({ text = "Loading report..." }: { text?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[480px] bg-white rounded-[24px] border border-gray-100 shadow-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="w-8 h-8 border-3 border-[#A5D020] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-bold text-gray-400">{text}</p>
      </div>
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedReportId = searchParams.get("report_id");
  const isPaymentReturn = searchParams.get("payment") === "success";
  const { isSignedIn, isLoaded } = useUser();
  const { refreshCredits } = useAuditModal();

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

  const [activeReportId, setActiveReportId] = useState<string | undefined>(selectedReportId || undefined);
  const [report, setReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<{ date: string; items: { id: string; url: string; reportId: string; status?: string }[] }[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sseActive, setSseActive] = useState(false);
  const [sseProgress, setSseProgress] = useState<{ stage?: string; percent?: number; message?: string } | null>(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentReturnLoading, setPaymentReturnLoading] = useState(false);
  const processedPaymentRef = useRef<string | null>(null);
  const requestedMetaRef = useRef<Set<string>>(new Set());
  const reportCacheRef = useRef<Map<string, Report>>(new Map());
  const taskId = report?.status === "pending" ? report.task_id : null;
  const pendingReportId = report?.status === "pending" ? report.report_id : selectedReportId;

  // Handle payment success redirect — auto-submit audit if form data is present
  useEffect(() => {
    if (searchParams.get("payment") !== "success") return;
    sessionStorage.removeItem(PENDING_AUDIT_STORAGE_KEY);
    // Wait for Clerk session to be ready after external redirect
    if (!isLoaded) return;

    const auditUrl = searchParams.get("audit_url");
    const auditPageType = searchParams.get("audit_page_type");
    const auditGbpUrl = searchParams.get("audit_gbp_url");
    const paymentId = searchParams.get("payment_id");

    console.log("[PaymentReturn]", { auditUrl, auditPageType, auditGbpUrl, paymentId, isSignedIn, isLoaded });

    if (paymentId && processedPaymentRef.current === paymentId) return;
    if (paymentId) processedPaymentRef.current = paymentId;

    if (auditUrl && auditPageType && auditGbpUrl && paymentId && isSignedIn) {
      // Payment returned with form data → auto-submit the audit
      (async () => {
        try {
          setPaymentReturnLoading(true);
          const confirmRes = await fetch("/api/checkout/confirm", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ payment_id: paymentId }),
          });

          if (!confirmRes.ok) {
            const err = await confirmRes.json().catch(() => ({}));
            throw new Error(err.error || "Payment could not be confirmed yet");
          }

          await refreshCredits({ force: true });

          const result = await submitAudit({
            url: auditUrl,
            pageType: auditPageType,
            gbpUrl: auditGbpUrl,
          });
          console.log("[PaymentReturn] submitAudit result:", result);
          router.replace(`/reports?report_id=${result.report_id}`);
        } catch (err) {
          console.error("Auto-submit after payment failed:", err);
          const msg = err instanceof Error ? err.message : "Unknown error";
          alert("Payment succeeded but audit failed to start: " + msg);
          router.replace("/reports");
          setPaymentSuccess(true);
          setTimeout(() => setPaymentSuccess(false), 4000);
        } finally {
          setPaymentReturnLoading(false);
        }
      })();
    } else {
      // Payment returned without form data or not signed in
      console.warn("[PaymentReturn] Missing data or not signed in, showing toast only");
      setPaymentSuccess(true);
      const timer = setTimeout(() => setPaymentSuccess(false), 4000);
      router.replace("/reports");
      return () => clearTimeout(timer);
    }
  }, [searchParams, isLoaded, isSignedIn, refreshCredits, router]);

  // Load history from API
  const loadHistory = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    try {
      const res = await fetch("/api/reports");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setHistory(data);
    } catch {
    } finally {
      setHistoryLoading(false);
    }
  }, [isLoaded]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Fetch a single report by ID
  const fetchReport = useCallback(async (id: string) => {
    if (!isLoaded) return;

    const cached = reportCacheRef.current.get(id);
    if (cached) {
      setReport(cached);
      setActiveReportId(cached.id);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/reports/${id}`);
      if (!res.ok) throw new Error("Failed to fetch report");
      const data = await res.json();
      reportCacheRef.current.set(data.id, data);
      reportCacheRef.current.set(data.report_id, data);
      setReport(data);
      setActiveReportId(data.id);
    } catch (error) {
      console.error("Failed to fetch report:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoaded]);

  const loadReportMeta = useCallback(async (baseReport: Report) => {
    if (!baseReport.page_url || !baseReport.page_type || !baseReport.gbp_url) return;

    const metaPageType = toReportMetaPageType(baseReport.page_type);
    const requestKey = [
      baseReport.report_id,
      baseReport.page_url,
      metaPageType,
      baseReport.gbp_url,
    ].join("|");

    if (requestedMetaRef.current.has(requestKey)) return;
    requestedMetaRef.current.add(requestKey);

    try {
      const params = new URLSearchParams({
        url: baseReport.page_url,
        page_type: metaPageType,
        gbp_url: baseReport.gbp_url,
      });
      const res = await fetch(`/api/report-meta?${params.toString()}`);
      if (!res.ok) return;
      const meta = await res.json();
      setReport((prev) => {
        const isCurrentReport = prev?.id === baseReport.id || prev?.report_id === baseReport.report_id;
        if (!isCurrentReport) return prev;
        const merged = mergeReportMeta(prev, meta);
        reportCacheRef.current.set(merged.id, merged);
        reportCacheRef.current.set(merged.report_id, merged);
        return merged;
      });
      if (meta.report_id) {
        setHistory((prev) => prev.map((group) => ({
          ...group,
          items: group.items.map((item) => (
            item.id === baseReport.id ? { ...item, reportId: meta.report_id } : item
          )),
        })));
        fetch(`/api/reports/${baseReport.report_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            external_report_id: meta.report_id,
            page_url: meta.page_url || meta.url,
            page_type: meta.page_type,
            gbp_url: meta.gbp_url,
            generated_at: meta.generated_at,
          }),
        }).then(() => loadHistory()).catch(() => {});
      }
    } catch (error) {
      console.error("Failed to fetch report meta:", error);
    }
  }, [loadHistory]);

  useEffect(() => {
    if (!report || report.external_report_id) return;
    loadReportMeta(report);
  }, [
    report?.id,
    report?.report_id,
    report?.external_report_id,
    report?.page_url,
    report?.page_type,
    report?.gbp_url,
    loadReportMeta,
  ]);

  useEffect(() => {
    if (!report || report.external_report_id) return;
    const historyItem = history.flatMap((group) => group.items).find((item) => item.id === report.id);
    if (!historyItem || !historyItem.reportId || historyItem.reportId === report.report_id) return;
    setReport((prev) => {
      if (prev?.id !== report.id) return prev;
      const updated = { ...prev, external_report_id: historyItem.reportId };
      reportCacheRef.current.set(updated.id, updated);
      reportCacheRef.current.set(updated.report_id, updated);
      return updated;
    });
  }, [history, report?.id, report?.report_id, report?.external_report_id]);

  // SSE logic: when task_id is in URL
  useEffect(() => {
    if (!taskId) return;

    setSseActive(true);
    setSseProgress(null);

    const handleDone = async (result: any) => {
      // Handle empty result from backend (task done but no report data)
      if (!result || !result.score) {
        console.error("[SSE] Task done but result is empty:", result);
        setSseActive(false);
        setReport((prev) => prev?.task_id === taskId ? { ...prev, status: "failed" } : prev);

        // Mark as failed — delete the empty report record
        try {
          await fetch("/api/report-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ task_id: taskId, result: null, failed: true }),
          });
        } catch {}

        await loadHistory();
        return;
      }

      // Parse score JSON from SSE result
      const parsed = result?.score ? parseScore(result.score) : null;

      // Construct Report object directly for instant rendering
      // Render immediately
      setReport((prev) => {
        const reportStatus = prev?.access_type === "free_trial" ? "free_preview" : "paid_full";
        const completedReport: Report = {
          id: prev?.id || pendingReportId || "",
          report_id: prev?.report_id || pendingReportId || "",
          external_report_id: prev?.external_report_id || null,
          user_id: prev?.user_id || "",
          page_url: result.page_url || prev?.page_url || "",
          page_type: result.page_type || prev?.page_type || null,
          gbp_url: result.gbp_url || prev?.gbp_url || null,
          task_id: taskId,
          status: reportStatus,
          access_type: prev?.access_type,
          trust_status: result.trust_status || prev?.trust_status || null,
          ranking_potential: result.ranking_potential || prev?.ranking_potential || null,
          risk_level: result.risk_level || prev?.risk_level || null,
          generated_at: result.generated_at || prev?.generated_at || null,
          module_1_overview: parsed?.module_1_overview || null,
          module_2_page_level: parsed?.module_2_page_level || null,
          module_3_key_problems: parsed?.module_3_key_problems || null,
          module_4_eight_layers: parsed?.module_4_eight_layers || null,
          module_5_optimization: parsed?.module_5_optimization || null,
          created_at: prev?.created_at || new Date().toISOString(),
        };
        reportCacheRef.current.set(completedReport.id, completedReport);
        reportCacheRef.current.set(completedReport.report_id, completedReport);
        return completedReport;
      });
      setSseActive(false);
      if (pendingReportId) setActiveReportId(pendingReportId);

      // Async: save to DB + refresh credits + update history
      fetch("/api/report-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId, result }),
      }).then(() => {
        refreshCredits({ force: true });
      }).catch((err) => {
        console.error("Failed to save report result:", err);
      });

      await loadHistory();
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
          setReport((prev) => prev?.task_id === taskId ? { ...prev, status: "failed" } : prev);

          try {
            await fetch("/api/report-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ task_id: taskId, result: null, failed: true }),
            });
          } catch {}

          await loadHistory();
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
        setReport((prev) => prev?.task_id === taskId ? { ...prev, status: "failed" } : prev);
      }

      // Reload history but keep the current report surface visible.
      await loadHistory();
    };

    return () => {
      eventSource.close();
    };
  }, [taskId, pendingReportId, loadHistory, refreshCredits]);

  // First load: open the selected report, otherwise default to the latest history item.
  useEffect(() => {
    if (taskId) return;
    if (selectedReportId) {
      if (report?.id === selectedReportId || report?.report_id === selectedReportId) return;
      fetchReport(selectedReportId);
      return;
    }
    if (history.length > 0 && history[0].items.length > 0) {
      const firstId = history[0].items[0].id;
      setActiveReportId(firstId);
      fetchReport(firstId);
    }
  }, [taskId, selectedReportId, history, fetchReport, report?.id, report?.report_id]);

  const handleSelect = (id: string) => {
    setActiveReportId(id);
    if (report?.id !== id) setReport(null);
    router.replace(`/reports?report_id=${id}`);
    fetchReport(id);
  };

  const hasReports = history.length > 0 && history.some((g) => g.items.length > 0);
  const reportHasModules = Boolean(
    report?.module_1_overview ||
    report?.module_2_page_level ||
    report?.module_3_key_problems ||
    report?.module_4_eight_layers ||
    report?.module_5_optimization
  );

  if (!paymentReturnLoading && !isPaymentReturn && !historyLoading && !hasReports && !report) {
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
          isLoading={historyLoading}
        />
        {report ? (
          <ReportContent
            report={report}
            isPaid={report.status === "paid_full"}
            isHeaderLoading={isLoading}
            isLoading={sseActive && !reportHasModules}
          />
        ) : historyLoading ? (
          <DetailLoadingState />
        ) : paymentReturnLoading || isPaymentReturn || isLoading || sseActive ? (
          <DetailLoadingState
            text={
              paymentReturnLoading || isPaymentReturn
                ? "Confirming payment and starting your report..."
                : sseActive
                  ? sseProgress?.message || "Generating report..."
                  : "Loading report..."
            }
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
