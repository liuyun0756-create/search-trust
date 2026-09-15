"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  Circle,
  ExternalLink,
  Globe2,
  LoaderCircle,
  CreditCard,
  FileCheck2,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import type {
  ConnectionCenterAction,
  ConnectionCenterResponse,
  ConnectionCenterSource,
  ConnectionCenterUserStatus,
} from "@/lib/connection-center/contracts";
import { GoogleResourceSelector } from "./google-resource-selector";

const STATUS_LABELS: Record<ConnectionCenterUserStatus, string> = {
  needs_profile: "Profile required",
  needs_connection: "Connection required",
  needs_resource: "Choose resource",
  needs_identity_confirmation: "Confirm identity",
  ready_to_sync: "Ready to sync",
  syncing: "Syncing",
  healthy: "Healthy",
  needs_attention: "Needs attention",
  optional_unavailable: "Optional",
};

const HEALTH_LABELS: Record<string, string> = {
  healthy: "Healthy",
  unhealthy: "Needs attention",
  degraded: "Needs attention",
  expired: "Expired",
  not_checked: "Not checked",
  matched: "Matched",
  mismatch: "Mismatch",
  needs_confirmation: "Needs confirmation",
};

const ERROR_MESSAGES: Record<string, string> = {
  CONNECTION_CENTER_BUSY: "Connection status changed while it was loading. Please refresh once more.",
  CONNECTION_CENTER_NOT_FOUND: "This Case is unavailable or you no longer have access.",
  CONNECTION_CENTER_STORAGE_UNAVAILABLE: "Connection status is temporarily unavailable. Please try again.",
};

type TaskStatusPayload = {
  job_id?: unknown;
  status?: unknown;
  message?: unknown;
  database_report_id?: unknown;
  report?: { report_version?: { report_id?: unknown } } | null;
};

type Props = {
  caseId: string;
  businessName: string;
  siteUrl: string;
  gscSyncEnabled?: boolean;
  ga4SyncEnabled?: boolean;
  gbpSyncEnabled?: boolean;
  initialData?: ConnectionCenterResponse;
  navigate?: (url: string) => void;
};

function sourceIcon(source: ConnectionCenterSource) {
  const className = "h-5 w-5";
  if (source.source_key === "public_gbp") return <Globe2 className={className} aria-hidden="true" />;
  if (source.source_key === "gsc") return <Search className={className} aria-hidden="true" />;
  return <BarChart3 className={className} aria-hidden="true" />;
}

function statusIcon(source: ConnectionCenterSource) {
  if (source.user_status === "syncing") return <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />;
  if (source.ready) return <Check className="h-4 w-4" aria-hidden="true" />;
  if (["needs_attention", "needs_profile"].includes(source.user_status)) {
    return <AlertTriangle className="h-4 w-4" aria-hidden="true" />;
  }
  return <Circle className="h-3.5 w-3.5" aria-hidden="true" />;
}

function statusClasses(source: ConnectionCenterSource): string {
  if (source.ready) return "border-[#c6d99d] bg-[#f2f8df] text-[#425315]";
  if (source.user_status === "syncing") return "border-[#c8d7e7] bg-[#eff6fc] text-[#31516e]";
  if (["needs_attention", "needs_profile"].includes(source.user_status)) return "border-[#ecd9af] bg-[#fff7e6] text-[#7b5710]";
  return "border-[#dfe3da] bg-[#f6f7f3] text-[#596257]";
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

function technicalLabel(value: string | null): string {
  if (!value) return "Not connected";
  return HEALTH_LABELS[value] ?? value.replaceAll("_", " ");
}

async function responseMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null) as { error?: { message?: unknown } } | null;
  return typeof body?.error?.message === "string" ? body.error.message : fallback;
}

function safeCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:"
      && (url.hostname === "dodopayments.com" || url.hostname.endsWith(".dodopayments.com"))) {
      return url.toString();
    }
    if (process.env.NEXT_PUBLIC_E2E_TEST_MODE === "true"
      && process.env.NEXT_PUBLIC_E2E_BASE_URL) {
      const e2eBase = new URL(process.env.NEXT_PUBLIC_E2E_BASE_URL);
      if (url.origin === e2eBase.origin && url.pathname === "/e2e/verified-credit-checkout") {
        return url.toString();
      }
    }
    return null;
  } catch { return null; }
}

function SourceCard({ source, onAction }: { source: ConnectionCenterSource; onAction: (action: ConnectionCenterAction) => void }) {
  const details = source.technical_status;
  return <article data-source-key={source.source_key} className="flex min-h-[25rem] flex-col rounded-[1.4rem] border border-[#d9ded3] bg-white p-6 shadow-[0_12px_32px_rgba(34,45,31,0.05)]">
    <div className="flex items-start justify-between gap-4">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#182218] text-[#b8e626]">{sourceIcon(source)}</span>
      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(source)}`}>
        {statusIcon(source)} {STATUS_LABELS[source.user_status]}
      </span>
    </div>
    <div className="mt-5 flex-1">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7a8376]">{source.required_for_verified_core ? "Verified Core" : "Optional source"}</p>
      <h2 className="mt-2 text-xl font-semibold text-[#182218]">{source.title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#626d5f]">{source.summary}</p>
      {details.resource_name && <div className="mt-4 rounded-xl bg-[#f5f6f1] p-3">
        <p className="text-sm font-medium text-[#253023]">{details.resource_name}</p>
        {details.resource_id && <p className="mt-1 break-all text-xs text-[#758071]">{details.resource_id}</p>}
      </div>}
      <details className="group mt-4 border-t border-[#e8ebe4] pt-4 text-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-[#53604f]">
          Technical details <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs leading-5 text-[#687362]">
          <dt>Connection</dt><dd className="text-right font-medium text-[#344032]">{technicalLabel(details.connection_status)}</dd>
          <dt>Identity</dt><dd className="text-right font-medium text-[#344032]">{technicalLabel(details.identity_match_status)}</dd>
          <dt>Data health</dt><dd className="text-right font-medium text-[#344032]">{technicalLabel(details.snapshot?.effective_health_status ?? null)}</dd>
          {details.snapshot && <><dt>Collected</dt><dd className="text-right font-medium text-[#344032]">{displayDate(details.snapshot.fetched_at)}</dd></>}
          {details.job && <><dt>Latest sync</dt><dd className="text-right font-medium capitalize text-[#344032]">{technicalLabel(details.job.status)}</dd></>}
        </dl>
        {details.warnings.length > 0 && <p className="mt-3 rounded-lg bg-[#fff7e6] p-2 text-xs text-[#77550f]">The latest refresh failed, but the current healthy evidence is still available.</p>}
      </details>
    </div>
    {source.action && <button type="button" onClick={() => onAction(source.action!)} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#cfd6c9] px-4 py-2.5 text-sm font-semibold text-[#263125] transition hover:border-[#96b331] hover:bg-[#f7faed] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b8e626]/30">
      {source.action.label} <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </button>}
  </article>;
}

export function ConnectionCenter({
  caseId,
  businessName,
  siteUrl,
  gscSyncEnabled = false,
  ga4SyncEnabled = false,
  gbpSyncEnabled = false,
  initialData,
  navigate,
}: Props) {
  const endpoint = `/api/v2/cases/${caseId}/connection-center`;
  const [data, setData] = useState<ConnectionCenterResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState<"generate" | "checkout" | "confirm" | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(() => {
    const job = initialData?.verified_job;
    return job && ["queued", "running"].includes(job.status) ? job.id : null;
  });
  const [settlingJobId, setSettlingJobId] = useState<string | null>(() => {
    const job = initialData?.verified_job;
    return job?.status === "failed" && job.charge_state === "reserved" ? job.id : null;
  });
  const [settlementRecoveryBlocked, setSettlementRecoveryBlocked] = useState(false);
  const [latestProjectionSync, setLatestProjectionSync] = useState<"hidden" | "refreshing" | "pending">("hidden");
  const [taskMessage, setTaskMessage] = useState("");
  const [paymentRetry, setPaymentRetry] = useState<"hidden" | "waiting" | "ready">("hidden");
  const [balanceRefresh, setBalanceRefresh] = useState<"hidden" | "refreshing" | "pending">("hidden");
  const actionLock = useRef(false);
  const paymentIdRef = useRef<string | null>(null);
  const paymentAttemptRef = useRef(0);
  const paymentConfirmFlight = useRef(false);
  const paymentRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paymentAbort = useRef<AbortController | null>(null);
  const balanceRefreshAttemptRef = useRef(0);
  const balanceRefreshFlight = useRef(false);
  const balanceRefreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const balanceRefreshAbort = useRef<AbortController | null>(null);
  const balanceRefreshCallback = useRef<() => void>(() => undefined);
  const settledJobRef = useRef<NonNullable<ConnectionCenterResponse["verified_job"]> | null>(null);
  const latestProjectionAttemptRef = useRef(0);
  const latestProjectionFlight = useRef(false);
  const latestProjectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestProjectionAbort = useRef<AbortController | null>(null);
  const latestProjectionCallback = useRef<() => void>(() => undefined);
  const loadSequence = useRef(0);
  const loadFlights = useRef(new Map<string, { sequence: number; request: Promise<ConnectionCenterResponse | null> }>());
  const mounted = useRef(true);
  const go = useCallback((url: string) => {
    if (navigate) navigate(url);
    else window.location.assign(url);
  }, [navigate]);

  const activeSync = useMemo(() => Boolean(data && [...data.sources, ...data.optional_sources]
    .some((source) => source.technical_status.job && ["queued", "running"].includes(source.technical_status.job.status))), [data]);

  const load = useCallback(async (signal?: AbortSignal, force = false, trackedJobId?: string): Promise<ConnectionCenterResponse | null> => {
    const requestUrl = trackedJobId ? `${endpoint}?tracked_job_id=${encodeURIComponent(trackedJobId)}` : endpoint;
    if (!force) {
      for (;;) {
        const existing = loadFlights.current.get(requestUrl);
        if (!existing) break;
        if (existing.sequence === loadSequence.current) return existing.request;
        try { await existing.request; } catch { /* An obsolete request cannot satisfy this refresh. */ }
      }
    }
    const sequence = ++loadSequence.current;
    const request = (async () => {
      const response = await fetch(requestUrl, { cache: "no-store", signal });
      let body: ConnectionCenterResponse | { error?: { code?: string; message?: string } };
      try { body = await response.json(); }
      catch {
        if (sequence !== loadSequence.current) return null;
        throw new Error("Connection status could not be loaded. Please sign in again.");
      }
      if (!response.ok) {
        if (sequence !== loadSequence.current) return null;
        const code = "error" in body ? body.error?.code : undefined;
        throw new Error(code && ERROR_MESSAGES[code] ? ERROR_MESSAGES[code] : "Connection status could not be loaded. Please try again.");
      }
      if (sequence !== loadSequence.current) return null;
      const next = body as ConnectionCenterResponse;
      setData(next);
      setError("");
      return next;
    })();
    loadFlights.current.set(requestUrl, { sequence, request });
    const clear = () => { if (loadFlights.current.get(requestUrl)?.request === request) loadFlights.current.delete(requestUrl); };
    void request.then(clear, clear);
    return request;
  }, [endpoint]);

  const refreshLatestProjection = useCallback(async () => {
    const settledJob = settledJobRef.current;
    if (!settledJob || latestProjectionFlight.current) return;
    if (latestProjectionTimer.current) clearTimeout(latestProjectionTimer.current);
    latestProjectionTimer.current = null;
    latestProjectionFlight.current = true;
    latestProjectionAttemptRef.current += 1;
    setLatestProjectionSync("refreshing");
    setTaskMessage("Credit status settled. Refreshing the latest Verified Action Plan status…");
    const controller = new AbortController();
    latestProjectionAbort.current = controller;
    try {
      const latest = await load(controller.signal);
      if (!latest) throw new Error("A newer status refresh replaced this response.");
      if (!mounted.current) return;
      settledJobRef.current = null;
      latestProjectionAttemptRef.current = 0;
      setLatestProjectionSync("hidden");
      if (latest.verified_job?.id === settledJob.id && settledJob.status === "succeeded" && settledJob.report_id) {
        go(`/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(settledJob.report_id)}`);
      } else if (latest.verified_job && ["queued", "running"].includes(latest.verified_job.status)) {
        setTaskMessage("Latest Verified Action Plan found. Resuming its status…");
      } else if (settledJob.charge_state === "compensated") {
        setTaskMessage("Generation failed. 1 credit returned. You can try again when ready.");
      } else {
        setTaskMessage("The saved job has finished. Your current balance is shown above.");
      }
    } catch (value) {
      if (value instanceof Error && value.name === "AbortError") return;
      if (!mounted.current) return;
      setLatestProjectionSync("pending");
      setTaskMessage("Credit status settled. The latest status refresh is pending; generation remains locked.");
      if (latestProjectionAttemptRef.current < 3) {
        const delayMs = 2 ** latestProjectionAttemptRef.current * 1000;
        latestProjectionTimer.current = setTimeout(() => {
          latestProjectionTimer.current = null;
          latestProjectionCallback.current();
        }, delayMs);
      }
    } finally {
      if (latestProjectionAbort.current === controller) {
        latestProjectionAbort.current = null;
        latestProjectionFlight.current = false;
      }
    }
  }, [caseId, go, load]);
  latestProjectionCallback.current = () => { void refreshLatestProjection(); };

  const schedulePaymentRetry = useCallback((retryAfter: string | null) => {
    if (paymentRetryTimer.current) clearTimeout(paymentRetryTimer.current);
    const parsedDate = retryAfter && !/^\d+$/.test(retryAfter) ? Date.parse(retryAfter) : Number.NaN;
    const retryAfterSeconds = retryAfter && /^\d+$/.test(retryAfter)
      ? Number(retryAfter)
      : Number.isFinite(parsedDate) ? Math.ceil((parsedDate - Date.now()) / 1000) : null;
    const fallbackSeconds = Math.min(2 ** Math.min(paymentAttemptRef.current, 4), 30);
    const delayMs = Math.min(Math.max(retryAfterSeconds ?? fallbackSeconds, 1), 60) * 1000;
    setPaymentRetry("waiting");
    paymentRetryTimer.current = setTimeout(() => {
      paymentRetryTimer.current = null;
      setPaymentRetry("ready");
      setTaskMessage("Payment confirmation can be retried safely.");
    }, delayMs);
  }, []);

  const refreshBalanceAfterPayment = useCallback(async () => {
    if (balanceRefreshFlight.current) return;
    if (balanceRefreshTimer.current) clearTimeout(balanceRefreshTimer.current);
    balanceRefreshTimer.current = null;
    balanceRefreshFlight.current = true;
    balanceRefreshAttemptRef.current += 1;
    setBalanceRefresh("refreshing");
    setTaskMessage("Payment confirmed. Refreshing your credit balance…");
    const controller = new AbortController();
    balanceRefreshAbort.current = controller;
    try {
      const refreshed = await load(controller.signal, true);
      if (!refreshed) throw new Error("A newer balance refresh replaced this response.");
      if (!mounted.current) return;
      balanceRefreshAttemptRef.current = 0;
      setBalanceRefresh("hidden");
      setTaskMessage("1 credit added. You can generate when you are ready.");
    } catch (value) {
      if (value instanceof Error && value.name === "AbortError") return;
      if (!mounted.current) return;
      setBalanceRefresh("pending");
      setTaskMessage("Payment confirmed. Your balance refresh is pending; no payment retry is needed.");
      if (balanceRefreshAttemptRef.current < 3) {
        const delayMs = 2 ** balanceRefreshAttemptRef.current * 1000;
        balanceRefreshTimer.current = setTimeout(() => {
          balanceRefreshTimer.current = null;
          balanceRefreshCallback.current();
        }, delayMs);
      }
    } finally {
      if (balanceRefreshAbort.current === controller) {
        balanceRefreshAbort.current = null;
        balanceRefreshFlight.current = false;
      }
    }
  }, [load]);
  balanceRefreshCallback.current = () => { void refreshBalanceAfterPayment(); };

  const confirmReturnedPayment = useCallback(async () => {
    const paymentId = paymentIdRef.current;
    if (!paymentId || paymentConfirmFlight.current || paymentRetry === "waiting") return;
    paymentConfirmFlight.current = true;
    actionLock.current = true;
    paymentAttemptRef.current += 1;
    setActionBusy("confirm");
    setPaymentRetry("hidden");
    setTaskMessage("Confirming your credit purchase…");
    const controller = new AbortController();
    paymentAbort.current = controller;
    try {
      const response = await fetch(`/api/v2/cases/${encodeURIComponent(caseId)}/verified-credit/checkout/confirm`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payment_id: paymentId }),
        signal: controller.signal,
      });
      if (!mounted.current) return;
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: { code?: unknown } } | null;
        const code = typeof body?.error?.code === "string" ? body.error.code : "";
        if ((response.status === 409 && code === "PAYMENT_NOT_COMPLETED") || response.status === 429 || response.status === 503) {
          setTaskMessage("Payment is still processing. Wait briefly, then retry confirmation.");
          schedulePaymentRetry(response.headers.get("retry-after"));
        } else {
          setTaskMessage("The payment could not be confirmed. Please contact support if this continues.");
          setPaymentRetry("hidden");
        }
        return;
      }
      paymentIdRef.current = null;
      setPaymentRetry("hidden");
      void refreshBalanceAfterPayment();
    } catch (value) {
      if (value instanceof Error && value.name === "AbortError") return;
      setTaskMessage("Payment confirmation is temporarily unavailable. Wait briefly, then retry.");
      schedulePaymentRetry(null);
    } finally {
      if (paymentAbort.current === controller) {
        paymentAbort.current = null;
        paymentConfirmFlight.current = false;
        actionLock.current = false;
        if (mounted.current) setActionBusy(null);
      }
    }
  }, [caseId, paymentRetry, refreshBalanceAfterPayment, schedulePaymentRetry]);

  useEffect(() => {
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        await load(abort.signal);
        if (!abort.signal.aborted && activeSync) timer = setTimeout(refresh, 4000);
      } catch (value) {
        if (!abort.signal.aborted) setError(value instanceof Error ? value.message : "Connection status could not be loaded.");
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    };
    void refresh();
    return () => { abort.abort(); if (timer) clearTimeout(timer); };
  }, [load, revision, activeSync]);

  useEffect(() => {
    const job = data?.verified_job;
    if (job && ["queued", "running"].includes(job.status) && !settlingJobId) setActiveJobId((current) => current ?? job.id);
    if (job?.status === "failed" && job.charge_state === "reserved") setSettlingJobId((current) => current ?? job.id);
  }, [data?.verified_job, settlingJobId]);

  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const response = await fetch(`/api/v2/tasks/${encodeURIComponent(activeJobId)}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(await responseMessage(response, "The Verified Action Plan status could not be checked."));
        const body = await response.json() as TaskStatusPayload;
        if (body.job_id !== activeJobId || !["queued", "running", "succeeded", "failed"].includes(String(body.status))) {
          throw new Error("The Verified Action Plan returned an invalid status.");
        }
        if (cancelled) return;
        setTaskMessage(typeof body.message === "string" && body.message ? body.message : "Generating your Verified Action Plan…");
        if (body.status === "succeeded") {
          const reportId = typeof body.database_report_id === "string"
            ? body.database_report_id
            : typeof body.report?.report_version?.report_id === "string" ? body.report.report_version.report_id : null;
          if (!reportId) throw new Error("The report finished but its saved report ID is unavailable.");
          setActiveJobId(null);
          go(`/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(reportId)}`);
          return;
        }
        if (body.status === "failed") {
          setActiveJobId(null);
          setSettlingJobId(activeJobId);
          setTaskMessage("Generation ended. Finalizing your credit status…");
          return;
        }
        timer = setTimeout(poll, 4000);
      } catch {
        if (!cancelled) {
          setTaskMessage("The task service is reconnecting. Checking the saved job and credit status…");
          setActiveJobId(null);
          setSettlingJobId(activeJobId);
        }
      }
    };
    void poll();
    return () => { cancelled = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [activeJobId, caseId, go, load]);

  useEffect(() => {
    if (!settlingJobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let missingAttempts = 0;
    let unavailableAttempts = 0;
    const controller = new AbortController();
    const refreshSettlement = async () => {
      try {
        const exact = await load(controller.signal, false, settlingJobId);
        if (cancelled) return;
        if (!exact) throw new Error("A newer settlement refresh replaced this response.");
        unavailableAttempts = 0;
        const job = exact?.verified_job;
        if (!job || job.id !== settlingJobId) {
          missingAttempts += 1;
          if (missingAttempts >= 3) {
            try { await load(controller.signal, true); } catch { /* Keep the last safe view. */ }
            if (!cancelled) {
              setSettlingJobId(null);
              setSettlementRecoveryBlocked(true);
              setTaskMessage("The saved job could not be recovered. Select Refresh status before continuing.");
            }
            return;
          }
          setTaskMessage("The saved job is not visible yet. Checking its credit status safely…");
          if (!cancelled) timer = setTimeout(refreshSettlement, 4_000 * 2 ** (missingAttempts - 1));
          return;
        }
        missingAttempts = 0;
        if (job.charge_state !== "reserved") {
          settledJobRef.current = job;
          setSettlingJobId(null);
          setLatestProjectionSync("refreshing");
          setTaskMessage("Credit status settled. Refreshing the latest Verified Action Plan status…");
          latestProjectionCallback.current();
          return;
        }
        setTaskMessage("Finalizing the saved job and credit status. This can take a little longer…");
      } catch {
        if (cancelled) return;
        unavailableAttempts += 1;
        if (unavailableAttempts >= 5) {
          try { await load(controller.signal, true); } catch { /* Keep the last safe view. */ }
          if (!cancelled) {
            setSettlingJobId(null);
            setSettlementRecoveryBlocked(true);
            setTaskMessage("The saved job could not be recovered. Select Refresh status before continuing.");
          }
          return;
        }
        setTaskMessage("The saved job is still being recovered. We will keep checking safely…");
        if (!cancelled) timer = setTimeout(refreshSettlement, Math.min(4_000 * 2 ** (unavailableAttempts - 1), 30_000));
        return;
      }
      if (!cancelled) timer = setTimeout(refreshSettlement, 4000);
    };
    void refreshSettlement();
    return () => { cancelled = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, [caseId, go, load, settlingJobId]);

  useEffect(() => {
    mounted.current = true;
    if (!paymentIdRef.current) {
      const params = new URLSearchParams(window.location.search);
      const paymentId = params.get("payment_id");
      if (params.get("payment") === "return" && paymentId) {
        paymentIdRef.current = paymentId;
        const cleanUrl = new URL(window.location.href);
        cleanUrl.search = "";
        window.history.replaceState(null, "", cleanUrl.pathname);
      }
    }
    if (paymentIdRef.current) void confirmReturnedPayment();
    return () => {
      mounted.current = false;
      if (paymentRetryTimer.current) clearTimeout(paymentRetryTimer.current);
      paymentRetryTimer.current = null;
      if (balanceRefreshTimer.current) clearTimeout(balanceRefreshTimer.current);
      balanceRefreshTimer.current = null;
      if (latestProjectionTimer.current) clearTimeout(latestProjectionTimer.current);
      latestProjectionTimer.current = null;
      const controller = paymentAbort.current;
      const balanceController = balanceRefreshAbort.current;
      const latestController = latestProjectionAbort.current;
      paymentAbort.current = null;
      balanceRefreshAbort.current = null;
      latestProjectionAbort.current = null;
      paymentConfirmFlight.current = false;
      balanceRefreshFlight.current = false;
      latestProjectionFlight.current = false;
      actionLock.current = false;
      controller?.abort();
      balanceController?.abort();
      latestController?.abort();
    };
    // Payment return is a mount-time handoff. The ID is scrubbed once and kept
    // only in refs so render changes cannot duplicate confirmation requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refresh() {
    if (latestProjectionSync !== "hidden") {
      latestProjectionCallback.current();
      return;
    }
    setSettlementRecoveryBlocked(false);
    setLoading(true);
    setRevision((value) => value + 1);
  }

  function openManager() {
    setManageOpen(true);
    window.setTimeout(() => document.getElementById("manage-google-sources")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function handleAction(next: ConnectionCenterAction) {
    if (next.code === "create_prospect_report" || next.code === "confirm_public_gbp") {
      go("/cases/new");
      return;
    }
    if (next.code === "view_evidence" && data?.coverage.parent_report_id) {
      go(`/cases/${caseId}/reports/${data.coverage.parent_report_id}`);
      return;
    }
    if (next.code === "open_verified_report" && data?.verified_job?.report_id) {
      go(`/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(data.verified_job.report_id)}`);
      return;
    }
    openManager();
  }

  async function generateVerified() {
    if (actionLock.current || !data || !window.confirm("Generate a Verified Action Plan now? This uses 1 credit.")) return;
    actionLock.current = true;
    setActionBusy("generate");
    setTaskMessage("");
    try {
      const jobId = crypto.randomUUID();
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "x-searchtrust-job-id": jobId,
        "idempotency-key": `verified:${caseId}:${jobId}`,
      };
      if (data.verified_job?.status === "failed") headers["x-searchtrust-previous-job-id"] = data.verified_job.id;
      const response = await fetch(`/api/v2/cases/${encodeURIComponent(caseId)}/verified-analysis`, {
        method: "POST", headers, body: "{}",
      });
      if (!response.ok) throw new Error(await responseMessage(response, "The Verified Action Plan could not be started."));
      const body = await response.json() as { job_id?: unknown };
      if (body.job_id !== jobId) throw new Error("The Verified Action Plan returned an invalid task ID.");
      setTaskMessage("Verified Action Plan queued…");
      setActiveJobId(jobId);
      await load(undefined, true);
    } catch (value) {
      setTaskMessage(value instanceof Error ? value.message : "The Verified Action Plan could not be started.");
    } finally {
      actionLock.current = false;
      setActionBusy(null);
    }
  }

  async function buyCredit() {
    if (actionLock.current) return;
    actionLock.current = true;
    setActionBusy("checkout");
    setTaskMessage("");
    try {
      const response = await fetch(`/api/v2/cases/${encodeURIComponent(caseId)}/verified-credit/checkout`, { method: "POST" });
      if (!response.ok) throw new Error(await responseMessage(response, "Secure checkout could not be opened."));
      const body = await response.json() as { checkout_url?: unknown };
      const checkoutUrl = safeCheckoutUrl(body.checkout_url);
      if (!checkoutUrl) throw new Error("Secure checkout returned an invalid address.");
      go(checkoutUrl);
    } catch (value) {
      setTaskMessage(value instanceof Error ? value.message : "Secure checkout could not be opened.");
      actionLock.current = false;
      setActionBusy(null);
    }
  }

  function primaryAction() {
    const next = data?.coverage.next_action;
    if (!next) return;
    if (next.code === "generate_verified_plan") void generateVerified();
    else if (next.code === "buy_verified_credit") void buyCredit();
    else handleAction(next);
  }

  const current = data?.case ?? { business_name: businessName, site_url: siteUrl };
  const generationActive = Boolean(activeJobId || settlingJobId || latestProjectionSync !== "hidden" || settlementRecoveryBlocked || (data?.verified_job && (["queued", "running"].includes(data.verified_job.status)
    || (data.verified_job.status === "failed" && data.verified_job.charge_state === "reserved"))));
  const primaryDisabled = loading || actionBusy !== null || balanceRefresh !== "hidden" || generationActive || data?.coverage.next_action.code === "wait_for_verified_analysis";
  const returnedCredit = data?.verified_job?.status === "failed" && data.verified_job.charge_state === "compensated";
  const displayedTaskMessage = taskMessage || (returnedCredit ? "Generation failed. 1 credit returned. You can try again when ready." : "");

  return <main className="min-h-screen bg-[#f3f4ed] px-4 py-8 text-[#1c251b] sm:px-6 sm:py-12">
    <div className="mx-auto max-w-7xl">
      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <a className="font-medium underline decoration-[#91aa35] underline-offset-4" href="/reports">← Reports</a>
        <button type="button" onClick={refresh} disabled={loading} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-medium hover:bg-white disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh status
        </button>
      </nav>

      <header className="mt-8 max-w-3xl">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#687362]">Connection Center</p>
          <span className="rounded-full border border-[#cfd6c9] px-2.5 py-1 text-xs font-semibold">V2.2</span>
        </div>
        <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Verified data for {current.business_name}</h1>
        <p className="mt-3 break-all text-sm text-[#687362]">{current.site_url}</p>
        <p className="mt-4 max-w-2xl leading-7 text-[#53604f]">Connect, confirm and refresh the three sources required for a Verified Client Action Plan.</p>
      </header>

      {error && <div role="alert" className="mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ecd9af] bg-[#fff7e6] p-5 text-[#6f5013]">
        <span>{error}</span><button type="button" onClick={refresh} className="font-semibold underline">Try again</button>
      </div>}

      <section aria-label="Verified Core readiness" className="mt-8 overflow-hidden rounded-[1.6rem] border border-[#d9ded3] bg-[#182218] p-6 text-white shadow-[0_20px_50px_rgba(25,36,24,0.12)] sm:p-8">
        <div className="grid items-center gap-7 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-6 w-6 text-[#b8e626]" aria-hidden="true" />
              <h2 className="text-xl font-semibold">Verified Core</h2>
            </div>
            {data ? <>
              <p className="mt-3 text-[#c7d0c3]">{data.coverage.verified_core_ready
                ? "Ready to generate. All required evidence is healthy and matched to this Case."
                : "Complete the required source shown below before generating."}</p>
              {!data.coverage.verified_core_ready && data.coverage.blockers[0] && <p className="mt-4 text-sm text-[#d6ddd3]">Next: {data.coverage.blockers[0].message}</p>}
            </> : <p className="mt-3 text-[#c7d0c3]">Loading the latest source status…</p>}
          </div>
          <button type="button" onClick={primaryAction} disabled={primaryDisabled} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#b8e626] px-6 py-3 font-semibold text-[#182218] transition hover:bg-[#c8ef4a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b8e626]/30 disabled:cursor-not-allowed disabled:opacity-60">
            {data?.coverage.next_action.code === "buy_verified_credit" ? <CreditCard className="h-4 w-4" aria-hidden="true" /> : <FileCheck2 className="h-4 w-4" aria-hidden="true" />}
            {actionBusy === "checkout" ? "Opening secure checkout…"
              : actionBusy === "generate" ? "Starting…"
                : settlementRecoveryBlocked ? "Refresh status required"
                  : latestProjectionSync !== "hidden" ? "Latest status refresh pending"
                  : settlingJobId ? "Finalizing credit status…"
                    : generationActive ? "Generating Verified Action Plan…"
                  : data?.coverage.next_action.label ?? "Check readiness"}
          </button>
        </div>
        {data && <p className="mt-5 text-sm text-[#c7d0c3]">Account balance: <span className="font-semibold text-white">{data.billing.audit_credits} {data.billing.audit_credits === 1 ? "credit" : "credits"}</span></p>}
      </section>

      <div aria-live="polite" aria-atomic="true" className="mt-4 min-h-6 text-sm text-[#53604f]">
        {displayedTaskMessage}
        {paymentRetry !== "hidden" && <button type="button" disabled={paymentRetry === "waiting" || actionBusy === "confirm"} onClick={() => void confirmReturnedPayment()} className="ml-3 font-semibold underline underline-offset-4 disabled:cursor-wait disabled:opacity-60">
          Retry payment confirmation
        </button>}
        {balanceRefresh !== "hidden" && <button type="button" disabled={balanceRefresh === "refreshing"} onClick={() => void refreshBalanceAfterPayment()} className="ml-3 font-semibold underline underline-offset-4 disabled:cursor-wait disabled:opacity-60">
          Refresh balance
        </button>}
        {latestProjectionSync !== "hidden" && <button type="button" disabled={latestProjectionSync === "refreshing"} onClick={() => void refreshLatestProjection()} className="ml-3 font-semibold underline underline-offset-4 disabled:cursor-wait disabled:opacity-60">
          Refresh latest status
        </button>}
      </div>

      {loading && !data && <div role="status" className="mt-8 grid min-h-64 place-items-center rounded-2xl border border-[#d9ded3] bg-white text-[#64705f]">
        <span className="inline-flex items-center gap-3"><LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading connection status…</span>
      </div>}

      {data && <>
        <section aria-label="Required data sources" className="mt-8 grid gap-5 lg:grid-cols-3">
          {data.sources.map((source) => <SourceCard key={source.source_key} source={source} onAction={handleAction} />)}
        </section>

        <section className="mt-7 rounded-2xl border border-[#d9ded3] bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Next required action</h2>
              <p className="mt-2 text-sm leading-6 text-[#687362]">{generationActive
                ? taskMessage || "Your Verified Action Plan is being generated. You can safely leave and return to this page."
                : data.coverage.verified_core_ready ? data.coverage.next_action.label : data.coverage.blockers[0]?.message}</p>
            </div>
            {!data.coverage.verified_core_ready && <button type="button" onClick={() => handleAction(data.coverage.next_action)} className="min-h-11 rounded-xl bg-[#182218] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#283627] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b8e626]/30">
              {data.coverage.next_action.label}
            </button>}
          </div>
        </section>
      </>}

      <details id="manage-google-sources" open={manageOpen} onToggle={(event) => setManageOpen(event.currentTarget.open)} className="group mt-8 scroll-mt-5 rounded-[1.6rem] border border-[#d9ded3] bg-white p-6 sm:p-8">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
          <div className="flex items-center gap-3"><Settings2 className="h-5 w-5 text-[#749016]" aria-hidden="true" /><div><h2 className="text-xl font-semibold">Manage connections and resources</h2><p className="mt-1 text-sm text-[#687362]">Connect accounts, choose the matching property, confirm identity and start syncs.</p></div></div>
          <ChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-7 border-t border-[#e5e8df] pt-7">
          <GoogleResourceSelector caseId={caseId} businessName={current.business_name} siteUrl={current.site_url}
            gscSyncEnabled={gscSyncEnabled} ga4SyncEnabled={ga4SyncEnabled} gbpSyncEnabled={gbpSyncEnabled}
            embedded onStateChanged={refresh} />
        </div>
      </details>
    </div>
  </main>;
}
