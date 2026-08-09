"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { FileSearch, FileQuestion } from "lucide-react";
import { ReportContent } from "@/components/report/ReportContent";
import { ReportHistory } from "@/components/report/ReportHistory";
import { RunAuditButton } from "@/components/common/RunAuditButton";
import { BackHeader } from "@/components/common/BackHeader";
import { useAuditModal } from "@/components/common/AuditModalProvider";
import type { Report } from "@/types/database";

const BACKEND_URL = process.env.NEXT_PUBLIC_REPORT_API_BASE_URL || "https://searchtrust-rd-production.up.railway.app/api/v1";

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
          Run your first Trust Audit to identify weak trust signals, review the evidence, and see what to fix first.
        </p>
        <RunAuditButton className="bg-[#1D2531] text-white px-10 py-4 rounded-full font-bold text-[15px] hover:bg-black transition-all shadow-lg">
          Run a Trust Audit
        </RunAuditButton>
      </motion.div>
    </div>
  );
}

function ReportLookupErrorState({
  message,
  onViewReports,
}: {
  message: string;
  onViewReports: () => void;
}) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg rounded-[28px] border border-gray-100 bg-white px-8 py-12 text-center shadow-sm"
      >
        <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#E4EDD2] bg-[#FBFDF5]">
          <FileQuestion className="h-7 w-7 text-[#8EB51B]" />
        </div>
        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#8BAA2B]">
          Report lookup
        </p>
        <h2 className="mb-3 text-[28px] font-bold tracking-tighter text-[#1A212B]">
          Report unavailable
        </h2>
        <p className="mx-auto mb-8 max-w-md text-[15px] font-medium leading-relaxed text-[#6B7280]">
          {message}
        </p>
        <button
          type="button"
          onClick={onViewReports}
          className="rounded-full bg-[#1D2531] px-8 py-3.5 text-[14px] font-bold text-white shadow-lg transition-colors hover:bg-black"
        >
          View my reports
        </button>
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
  const [reportLoadError, setReportLoadError] = useState<string | null>(null);
  const [sseActive, setSseActive] = useState(false);
  const [sseProgress, setSseProgress] = useState<{ stage?: string; percent?: number; message?: string } | null>(null);
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
    terminal_failure_confirmed?: boolean;
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
      terminal_failure_confirmed: payload.terminal_failure_confirmed,
    };
  }, [
    payloadTaskId,
    pendingReportId,
    report?.id,
    report?.report_id,
    selectedDatabaseReportId,
    selectedReportId,
  ]);

  // Confirm a completed credit purchase. Purchasing and running an audit are
  // deliberately separate flows, so no report is started from this callback.
  useEffect(() => {
    const paymentParam = searchParams.get("payment");
    if (paymentParam !== "success" && paymentParam !== "return") return;
    // Wait for Clerk session to be ready after external redirect
    if (!isLoaded) return;

    const paymentId = searchParams.get("payment_id");
    const paymentStatus = searchParams.get("status");

    console.log("[PaymentReturn]", { paymentId, paymentStatus, isSignedIn, isLoaded });

    if (paymentStatus && paymentStatus !== "succeeded") {
      setPaymentReturnLoading(false);
      setPaymentError("Payment was not completed. No report credit was added.");
      router.replace("/pricing?payment=failed");
      const timer = setTimeout(() => setPaymentError(null), 5000);
      return () => clearTimeout(timer);
    }

    if (paymentId && processedPaymentRef.current === paymentId) return;
    if (paymentId) processedPaymentRef.current = paymentId;

    if (paymentId && isSignedIn) {
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
              setPaymentError("Payment was not completed. No report credit was added.");
              router.replace("/pricing?payment=failed");
              setTimeout(() => setPaymentError(null), 5000);
              return;
            }
            throw new Error(err.error || "Payment could not be confirmed yet");
          }

          await refreshCredits({ force: true });
          router.replace("/pricing?payment=success");
        } catch (err) {
          console.error("Payment confirmation failed:", err);
          const msg = err instanceof Error ? err.message : "Unknown error";
          setPaymentError(`Payment could not be confirmed: ${msg}`);
          router.replace("/pricing?payment=failed");
          setTimeout(() => setPaymentError(null), 5000);
        } finally {
          setPaymentReturnLoading(false);
        }
      })();
    } else {
      console.warn("[PaymentReturn] Missing payment id or signed-in session");
      setPaymentError("Payment return was incomplete. Your credit could not be confirmed.");
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
      setReportLoadError(null);
      setReport(cached);
      setActiveReportId(cached.id);
      return;
    }

    setIsLoading(true);
    setReportLoadError(null);
    try {
      const res = await fetch(`/api/reports/${id}`);
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Sign in with the account that created this report, then try again.");
        }
        if (res.status === 404) {
          throw new Error("We couldn't find this report in your account. Check the report link or open it from your report history.");
        }
        throw new Error("The report could not be loaded right now. Please try again.");
      }
      const data = await res.json();
      reportCacheRef.current.set(data.id, data);
      reportCacheRef.current.set(data.report_id, data);
      if (data.external_report_id) reportCacheRef.current.set(data.external_report_id, data);
      setReportLoadError(null);
      setReport(data);
      setActiveReportId(data.id);
    } catch (error) {
      console.error("Failed to fetch report:", error);
      setReport(null);
      setReportLoadError(error instanceof Error ? error.message : "The report could not be loaded right now.");
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
    if (
      !report ||
      report.external_report_id ||
      report.status === "pending" ||
      report.status === "failed" ||
      !hasPersistableReportContent(report)
    ) return;
    loadReportMeta(report);
  }, [
    report?.id,
    report?.report_id,
    report?.external_report_id,
    report?.page_url,
    report?.page_type,
    report?.gbp_url,
    report?.status,
    report?.report_v2_1,
    report?.module_1_overview,
    report?.module_2_page_level,
    report?.module_3_key_problems,
    report?.module_4_eight_layers,
    report?.module_5_optimization,
    report?.trust_status,
    report?.ranking_potential,
    report?.risk_level,
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

    const markCurrentReportFailed = (
      payload: unknown,
      fallbackReason: string,
    ) => {
      const patch = failedReportPatch(taskId, payload, fallbackReason);
      setReport((prev) => {
        if (!prev) return prev;
        const matchesTask = prev.task_id === taskId;
        const matchesPendingReport = Boolean(
          pendingReportId && (
            prev.id === pendingReportId ||
            prev.report_id === pendingReportId ||
            prev.external_report_id === pendingReportId
          )
        );
        if (!matchesTask && !matchesPendingReport) return prev;

        const failedReport = { ...prev, ...patch } as Report;
        reportCacheRef.current.set(failedReport.id, failedReport);
        reportCacheRef.current.set(failedReport.report_id, failedReport);
        if (failedReport.external_report_id) {
          reportCacheRef.current.set(failedReport.external_report_id, failedReport);
        }
        return failedReport;
      });
    };

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
        markCurrentReportFailed(result, "empty_result");

        // Mark as failed — delete the empty report record
        try {
          await fetch("/api/report-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildReportStatusPayload({
              result: null,
              failed: true,
              failure_reason: "empty_result",
              terminal_failure_confirmed: true,
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
    let cancelled = false;
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
    let recoveryInFlight = false;

    const clearRecoveryTimer = () => {
      if (recoveryTimer) {
        clearTimeout(recoveryTimer);
        recoveryTimer = null;
      }
    };

    const handleBackendFailure = async (payload: unknown) => {
      if (taskDone || cancelled) return;
      taskDone = true;
      clearRecoveryTimer();
      eventSource.close();
      setSseActive(false);
      completedTaskIdsRef.current.add(taskId);
      markCurrentReportFailed(payload, "backend_failed");

      const record = asRecord(payload);
      try {
        await fetch("/api/report-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildReportStatusPayload({
            result: payload,
            failed: true,
            failure_reason: typeof record?.error_code === "string"
              ? record.error_code
              : "backend_failed",
            terminal_failure_confirmed: true,
          })),
        });
      } catch {}

      await loadHistory();
    };

    const scheduleRecoveryPoll = (delay = 1500) => {
      if (taskDone || cancelled || recoveryTimer) return;
      recoveryTimer = setTimeout(() => {
        recoveryTimer = null;
        void recoverTaskStatus();
      }, delay);
    };

    const recoverTaskStatus = async () => {
      if (taskDone || cancelled || recoveryInFlight) return;
      recoveryInFlight = true;
      try {
        const res = await fetch(`${BACKEND_URL}/task/${taskId}`, { cache: "no-store" });
        if (!res.ok) {
          // A temporary 404/5xx or network edge failure is not proof that the
          // backend task failed. Keep the pending report recoverable.
          scheduleRecoveryPoll(3000);
          return;
        }

        const data = await res.json();
        if (data.progress) setSseProgress(data.progress);

        if (data.status === "done") {
          taskDone = true;
          clearRecoveryTimer();
          eventSource.close();
          await handleDone(data.result);
          return;
        }

        if (data.status === "failed") {
          await handleBackendFailure(data.result || data);
          return;
        }

        // Includes known active states and unknown non-terminal states. The
        // SSE connection can reconnect in parallel; polling is only recovery.
        scheduleRecoveryPoll(3000);
      } catch {
        scheduleRecoveryPoll(3000);
      } finally {
        recoveryInFlight = false;
      }
    };

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        // The stream recovered, so the fallback poller can stand down until a
        // future transport error occurs.
        clearRecoveryTimer();

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
          await handleBackendFailure(data.result || data);
          return;
        }
      } catch (err) {
        console.error("SSE parse error:", err);
      }
    };

    eventSource.onerror = () => {
      if (taskDone || cancelled) return;
      // EventSource reconnects automatically. Polling the task endpoint gives
      // us an independent recovery path, but a transport error never becomes
      // a synthetic report failure.
      scheduleRecoveryPoll(500);
    };

    return () => {
      cancelled = true;
      clearRecoveryTimer();
      eventSource.close();
    };
  }, [taskId, pendingReportId, loadHistory, refreshCredits, buildReportStatusPayload, router]);

  // First load: open the selected report, otherwise default to the latest history item.
  useEffect(() => {
    if (taskId) return;
    if (selectedReportId) {
      if (
        report?.id === selectedReportId ||
        report?.report_id === selectedReportId ||
        report?.external_report_id === selectedReportId
      ) return;
      fetchReport(selectedReportId);
      return;
    }
    if (history.length > 0 && history[0].items.length > 0) {
      const firstId = history[0].items[0].id;
      setActiveReportId(firstId);
      fetchReport(firstId);
    }
  }, [
    taskId,
    selectedReportId,
    history,
    fetchReport,
    report?.id,
    report?.report_id,
    report?.external_report_id,
  ]);

  const handleSelect = (id: string) => {
    setReportLoadError(null);
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
  const reportHasContent = hasPersistableReportContent(report);
  const isWaitingForReport = Boolean(report?.status === "pending" && !reportHasContent);

  if (!paymentReturnLoading && !isPaymentReturn && !historyLoading && !hasReports && !report && !reportLoadError) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#1A212B] selection:bg-[#A5D020]/30">
        <BackHeader />
        <div className="max-w-7xl mx-auto px-6 pt-12 pb-24">
          <EmptyState />
        </div>
      </div>
    );
  }

  if (!paymentReturnLoading && !isPaymentReturn && !historyLoading && !hasReports && !report && reportLoadError) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#1A212B] selection:bg-[#A5D020]/30">
        <BackHeader />
        <div className="mx-auto flex min-h-[calc(100vh-96px)] max-w-7xl px-6 py-12">
          <ReportLookupErrorState
            message={reportLoadError}
            onViewReports={() => {
              setReportLoadError(null);
              router.replace("/reports");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-[#1A212B] selection:bg-[#A5D020]/30">
      <AnimatePresence>
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
        {report && !isWaitingForReport ? (
          <ReportContent
            report={report}
            isPaid={report.status === "paid_full"}
            isHeaderLoading={isLoading}
            isLoading={sseActive && !reportHasModules}
          />
        ) : isWaitingForReport ? (
          <DetailLoadingState
            text={
              report?.task_id
                ? sseProgress?.message || "Generating report..."
                : "Preparing analysis..."
            }
          />
        ) : historyLoading ? (
          <DetailLoadingState />
        ) : paymentReturnLoading || isPaymentReturn || isLoading || sseActive ? (
          <DetailLoadingState
            text={
              paymentReturnLoading || isPaymentReturn
                ? "Confirming payment and adding your report credit..."
                : sseActive
                  ? sseProgress?.message || "Generating report..."
                  : "Loading report..."
            }
          />
        ) : reportLoadError ? (
          <ReportLookupErrorState
            message={reportLoadError}
            onViewReports={() => {
              setReportLoadError(null);
              router.replace("/reports");
            }}
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
