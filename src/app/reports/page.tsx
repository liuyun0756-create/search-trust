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

const BACKEND_URL = process.env.NEXT_PUBLIC_REPORT_API_BASE_URL || "http://localhost:8000/api/v1";
const PENDING_AUDIT_STORAGE_KEY = "searchtrust_pending_audit";

function mergeReportMeta(report: Report, meta: Record<string, any>): Report {
  return {
    ...report,
    external_report_id: meta.report_id || report.external_report_id,
    page_url: meta.page_url || meta.url || report.page_url,
    page_type: meta.page_type || report.page_type,
    gbp_url: meta.gbp_url || report.gbp_url,
    gbp_connected: typeof meta.gbp_connected === "boolean" ? meta.gbp_connected : report.gbp_connected,
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

function parseScore(raw: unknown): Record<string, any> | null {
  try {
    if (raw && typeof raw === "object") return raw as Record<string, any>;
    if (typeof raw !== "string") return null;

    let cleaned = raw.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    }
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function normalizeScoreValue(raw: unknown): string | null {
  if (!raw) return null;
  return typeof raw === "string" ? raw : JSON.stringify(raw);
}

function asRecord(value: unknown): Record<string, any> | null {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, any>
    : null;
}

function safeResultKeys(value: unknown): string[] {
  const record = asRecord(value);
  return record ? Object.keys(record).slice(0, 30) : [];
}

function hasLegacyModuleFields(value: Record<string, any>): boolean {
  return Boolean(
    value.module_1_overview ||
    value.module_2_page_level ||
    value.module_3_key_problems ||
    value.module_4_eight_layers ||
    value.module_5_optimization
  );
}

function hasStatusCards(value: Record<string, any>): boolean {
  return Boolean(value.trust_status || value.ranking_potential || value.risk_level);
}

function hasPersistableReportContent(value: unknown): value is Record<string, any> {
  const record = asRecord(value);
  if (!record) return false;

  return Boolean(
    record.report_v2_1 ||
    record.score ||
    hasLegacyModuleFields(record) ||
    hasStatusCards(record)
  );
}

function getPersistableResult(result: unknown): Record<string, any> | null {
  const record = asRecord(result);
  if (!record) return null;

  const candidates = [
    record,
    asRecord(record.final_report),
    asRecord(record.data),
  ];

  return candidates.find((candidate) => candidate && hasPersistableReportContent(candidate)) ?? null;
}

function isDatabaseReportId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-/i.test(value);
}

function failedReportPatch(taskId: string | null, payload: unknown, fallbackReason: string): Partial<Report> {
  const record = asRecord(payload);
  return {
    status: "failed",
    task_id: taskId,
    error_code: typeof record?.error_code === "string" ? record.error_code : null,
    error_message: typeof record?.error === "string" ? record.error : null,
    user_message: typeof record?.user_message === "string" ? record.user_message : null,
    retryable: typeof record?.retryable === "boolean" ? record.retryable : true,
    validation_errors: Array.isArray(record?.validation_errors)
      ? record.validation_errors.map(String)
      : null,
    warnings: Array.isArray(record?.warnings)
      ? record.warnings.map(String)
      : null,
    failure_reason: typeof record?.error_code === "string" ? record.error_code : fallbackReason,
  };
}

function buildReportRoute(params: {
  report_id: string;
  task_id?: string | null;
  database_report_id?: string | null;
}) {
  const search = new URLSearchParams({ report_id: params.report_id });
  if (params.task_id) search.set("task_id", params.task_id);
  if (params.database_report_id) search.set("database_report_id", params.database_report_id);
  return `/reports?${search.toString()}`;
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
  const selectedTaskId = searchParams.get("task_id");
  const selectedDatabaseReportId = searchParams.get("database_report_id");
  const paymentReturnParam = searchParams.get("payment");
  const isPaymentReturn = paymentReturnParam === "success" || paymentReturnParam === "return";
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
      database_report_id: searchParams.get("database_report_id"),
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
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentReturnLoading, setPaymentReturnLoading] = useState(false);
  const processedPaymentRef = useRef<string | null>(null);
  const requestedMetaRef = useRef<Set<string>>(new Set());
  const reportCacheRef = useRef<Map<string, Report>>(new Map());
  const completedTaskIdsRef = useRef<Set<string>>(new Set());
  const reportTaskId = report?.task_id || null;
  const sseTaskIdCandidate = report?.status === "pending"
    ? reportTaskId
    : (!report ? selectedTaskId : null);
  const taskId = sseTaskIdCandidate && !completedTaskIdsRef.current.has(sseTaskIdCandidate)
    ? sseTaskIdCandidate
    : null;
  const payloadTaskId = reportTaskId || selectedTaskId || taskId;
  const pendingReportId = report?.status === "pending" ? report.report_id : selectedReportId;
  const buildReportStatusPayload = useCallback((payload: {
    result: unknown;
    failed?: boolean;
    failure_reason?: string;
  }) => {
    const reportId = pendingReportId || report?.report_id || selectedReportId || undefined;
    const databaseReportId = isDatabaseReportId(report?.id)
      ? report.id
      : (isDatabaseReportId(selectedDatabaseReportId) ? selectedDatabaseReportId : undefined);

    return {
      task_id: payloadTaskId,
      report_id: reportId,
      reportId,
      database_report_id: databaseReportId,
      result: payload.result,
      failed: payload.failed,
      failure_reason: payload.failure_reason,
    };
  }, [
    payloadTaskId,
    pendingReportId,
    report?.id,
    report?.report_id,
    selectedDatabaseReportId,
    selectedReportId,
  ]);

  // Handle payment success redirect — auto-submit audit if form data is present
  useEffect(() => {
    const paymentParam = searchParams.get("payment");
    if (paymentParam !== "success" && paymentParam !== "return") return;
    sessionStorage.removeItem(PENDING_AUDIT_STORAGE_KEY);
    // Wait for Clerk session to be ready after external redirect
    if (!isLoaded) return;

    const auditUrl = searchParams.get("audit_url");
    const auditPageType = searchParams.get("audit_page_type");
    const auditGbpUrl = searchParams.get("audit_gbp_url");
    const paymentId = searchParams.get("payment_id");
    const paymentStatus = searchParams.get("status");

    console.log("[PaymentReturn]", { auditUrl, auditPageType, auditGbpUrl, paymentId, paymentStatus, isSignedIn, isLoaded });

    if (paymentStatus && paymentStatus !== "succeeded") {
      setPaymentReturnLoading(false);
      setPaymentError("Payment was not completed. No report was generated.");
      router.replace("/pricing?payment=failed");
      const timer = setTimeout(() => setPaymentError(null), 5000);
      return () => clearTimeout(timer);
    }

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
            if (err.status && err.status !== "succeeded") {
              setPaymentError("Payment was not completed. No report was generated.");
              router.replace("/pricing?payment=failed");
              setTimeout(() => setPaymentError(null), 5000);
              return;
            }
            throw new Error(err.error || "Payment could not be confirmed yet");
          }

          await refreshCredits({ force: true });

          const result = await submitAudit({
            url: auditUrl,
            pageType: auditPageType,
            gbpUrl: auditGbpUrl,
          });
          console.log("[PaymentReturn] submitAudit result:", result);
          router.replace(buildReportRoute(result));
        } catch (err) {
          console.error("Auto-submit after payment failed:", err);
          const msg = err instanceof Error ? err.message : "Unknown error";
          setPaymentError(`Payment could not start the report: ${msg}`);
          router.replace("/pricing?payment=failed");
          setTimeout(() => setPaymentError(null), 5000);
        } finally {
          setPaymentReturnLoading(false);
        }
      })();
    } else {
      // Payment returned without form data or not signed in
      console.warn("[PaymentReturn] Missing data or not signed in, showing toast only");
      setPaymentError("Payment return was incomplete. No report was generated.");
      const timer = setTimeout(() => setPaymentError(null), 5000);
      router.replace("/pricing?payment=failed");
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

  // A duplicate browser submit can find the report row before its task_id is
  // persisted. Refresh that pending row until it is ready for the SSE stream.
  useEffect(() => {
    const pendingId = report?.id || report?.report_id;
    if (!pendingId || report?.status !== "pending" || report?.task_id) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refreshPendingReport = async () => {
      try {
        const res = await fetch(`/api/reports/${pendingId}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const nextReport = await res.json() as Report;
        if (cancelled) return;
        reportCacheRef.current.set(nextReport.id, nextReport);
        reportCacheRef.current.set(nextReport.report_id, nextReport);
        setReport((current) => (
          current?.id === nextReport.id || current?.report_id === nextReport.report_id
            ? nextReport
            : current
        ));
        if (nextReport.status === "pending" && !nextReport.task_id) {
          timer = setTimeout(refreshPendingReport, 1000);
        }
      } catch {
        if (!cancelled) timer = setTimeout(refreshPendingReport, 1000);
      }
    };

    refreshPendingReport();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [report?.id, report?.report_id, report?.status, report?.task_id]);

  const loadReportMeta = useCallback(async (baseReport: Report) => {
    if (!baseReport.page_url || !baseReport.page_type) return;

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
      });
      if (baseReport.gbp_url) params.set("gbp_url", baseReport.gbp_url);
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
            gbp_connected: meta.gbp_connected,
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
      const persistableResult = getPersistableResult(result);
      console.debug("[report persistence] SSE done", {
        taskId,
        hasResult: Boolean(result),
        resultKeys: safeResultKeys(result),
        hasPersistableResult: Boolean(persistableResult),
        persistableResultKeys: safeResultKeys(persistableResult),
        hasReportV21: Boolean(persistableResult?.report_v2_1),
        hasScore: Boolean(persistableResult?.score),
        hasFinalReport: Boolean(asRecord(result)?.final_report),
        hasData: Boolean(asRecord(result)?.data),
      });

      // Handle empty result from backend (task done but no report data)
      if (!persistableResult) {
        console.error("[SSE] Task done but result is empty", {
          taskId,
          hasResult: Boolean(result),
          resultKeys: safeResultKeys(result),
          hasFinalReport: Boolean(asRecord(result)?.final_report),
          hasData: Boolean(asRecord(result)?.data),
        });
        setSseActive(false);
        setReport((prev) => prev?.task_id === taskId ? {
          ...prev,
          ...failedReportPatch(taskId, result, "empty_result"),
        } : prev);

        // Mark as failed — delete the empty report record
        try {
          await fetch("/api/report-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildReportStatusPayload({
              result: null,
              failed: true,
              failure_reason: "empty_result",
            })),
          });
        } catch {}

        await loadHistory();
        return;
      }

      // Parse score JSON from SSE result
      if (taskId) completedTaskIdsRef.current.add(taskId);
      const parsed = persistableResult.score ? parseScore(persistableResult.score) : null;

      // Construct Report object directly for instant rendering
      // Render immediately
      setReport((prev) => {
        const reportStatus = prev?.access_type === "free_trial" ? "free_preview" : "paid_full";
        const completedReport: Report = {
          id: prev?.id || pendingReportId || "",
          report_id: prev?.report_id || pendingReportId || "",
          external_report_id: prev?.external_report_id || null,
          user_id: prev?.user_id || "",
          page_url: persistableResult.page_url || persistableResult.report_v2_1?.analyzed_url || prev?.page_url || "",
          page_type: persistableResult.page_type || persistableResult.report_v2_1?.page_type || prev?.page_type || null,
          gbp_url: persistableResult.gbp_url || persistableResult.report_v2_1?.gbp_status?.gbp_url || prev?.gbp_url || null,
          gbp_connected: typeof persistableResult.gbp_connected === "boolean" ? persistableResult.gbp_connected : prev?.gbp_connected ?? null,
          task_id: taskId,
          status: reportStatus,
          access_type: prev?.access_type,
          trust_status: normalizeScoreValue(persistableResult.trust_status) || prev?.trust_status || null,
          ranking_potential: normalizeScoreValue(persistableResult.ranking_potential) || prev?.ranking_potential || null,
          risk_level: normalizeScoreValue(persistableResult.risk_level) || prev?.risk_level || null,
          generated_at: persistableResult.generated_at || persistableResult.report_v2_1?.generated_at || prev?.generated_at || null,
          module_1_overview: parsed?.module_1_overview || persistableResult.module_1_overview || null,
          module_2_page_level: parsed?.module_2_page_level || persistableResult.module_2_page_level || null,
          module_3_key_problems: parsed?.module_3_key_problems || persistableResult.module_3_key_problems || null,
          module_4_eight_layers: parsed?.module_4_eight_layers || persistableResult.module_4_eight_layers || null,
          module_5_optimization: parsed?.module_5_optimization || persistableResult.module_5_optimization || null,
          report_v2_1: persistableResult.report_v2_1 || prev?.report_v2_1 || null,
          created_at: prev?.created_at || new Date().toISOString(),
        };
        reportCacheRef.current.set(completedReport.id, completedReport);
        reportCacheRef.current.set(completedReport.report_id, completedReport);
        return completedReport;
      });
      setSseActive(false);
      if (pendingReportId) setActiveReportId(pendingReportId);

      // Async: save to DB + refresh credits + update history
      console.debug("[report persistence] posting report-status", {
        taskId,
        hasReportV21: Boolean(persistableResult.report_v2_1),
        hasScore: Boolean(persistableResult.score),
        resultKeys: safeResultKeys(persistableResult),
      });

      try {
        const saveRes = await fetch("/api/report-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildReportStatusPayload({ result: persistableResult })),
        });
        const saveData = await saveRes.json().catch(() => null);
        console.debug("[report persistence] report-status response", {
          taskId,
          ok: saveRes.ok,
          status: saveData?.status,
          reportId: saveData?.reportId,
          hasReport: Boolean(saveData?.report),
          hasReportV21: Boolean(saveData?.report?.report_v2_1),
          hasScore: Boolean(saveData?.report?.score),
        });

        if (saveRes.ok && saveData?.report) {
          const savedReport = saveData.report as Report;
          setReport(savedReport);
          reportCacheRef.current.set(savedReport.id, savedReport);
          reportCacheRef.current.set(savedReport.report_id, savedReport);
          setActiveReportId(savedReport.id);
          router.replace(`/reports?report_id=${savedReport.report_id}`, { scroll: false });
        }
        refreshCredits({ force: true });
      } catch (err) {
        console.error("Failed to save report result:", err);
      }

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
          await handleDone(data.result);
          return;
        }

        if (data.status === "failed") {
          eventSource.close();
          setSseActive(false);
          taskDone = true;
          if (taskId) completedTaskIdsRef.current.add(taskId);
          setReport((prev) => prev?.task_id === taskId ? {
            ...prev,
            ...failedReportPatch(taskId, data.result || data, "backend_failed"),
          } : prev);

          try {
            await fetch("/api/report-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildReportStatusPayload({
                result: data.result || null,
                failed: true,
                failure_reason: typeof data.result?.error_code === "string"
                  ? data.result.error_code
                  : "backend_failed",
              })),
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
      if (taskDone) return;

      let resultSaved = false;

      // A long-running Dify report can close one SSE connection before the task
      // completes. Keep EventSource open so the browser reconnects while the
      // backend still reports an active task.
      try {
        const res = await fetch(`${BACKEND_URL}/task/${taskId}`);
        if (res.ok) {
          const data = await res.json();
          if (["queued", "scraping", "analyzing", "reporting"].includes(data.status)) {
            if (data.progress) setSseProgress(data.progress);
            console.log("SSE reconnecting while report generation continues", { taskId, status: data.status });
            return;
          }

          const persistableResult = getPersistableResult(data.result);
          if (data.status === "done" && persistableResult) {
            eventSource.close();
            taskDone = true;
            if (taskId) completedTaskIdsRef.current.add(taskId);
            console.debug("[report persistence] fallback posting report-status", {
              taskId,
              hasReportV21: Boolean(persistableResult.report_v2_1),
              hasScore: Boolean(persistableResult.score),
              resultKeys: safeResultKeys(persistableResult),
            });
            await fetch("/api/report-status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildReportStatusPayload({ result: persistableResult })),
            });
            resultSaved = true;
          }
        }
      } catch {}

      eventSource.close();
      setSseActive(false);

      if (!resultSaved) {
        // Task not found or no result — clean up the empty report
        try {
          await fetch("/api/report-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildReportStatusPayload({
              result: null,
              failed: true,
              failure_reason: "fallback_no_result",
            })),
          });
        } catch {}
        setReport((prev) => prev?.task_id === taskId ? {
          ...prev,
          ...failedReportPatch(taskId, null, "fallback_no_result"),
        } : prev);
      }

      // Reload history but keep the current report surface visible.
      await loadHistory();
    };

    return () => {
      eventSource.close();
    };
  }, [taskId, pendingReportId, loadHistory, refreshCredits, buildReportStatusPayload, router]);

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
        {paymentError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-red-600 text-white px-5 py-3 rounded-full shadow-lg"
          >
            <span className="text-sm font-bold">{paymentError}</span>
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
