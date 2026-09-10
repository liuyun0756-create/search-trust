"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronDown,
  Circle,
  ExternalLink,
  Globe2,
  LoaderCircle,
  LockKeyhole,
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

type Props = {
  caseId: string;
  businessName: string;
  siteUrl: string;
  gscSyncEnabled?: boolean;
  ga4SyncEnabled?: boolean;
  gbpSyncEnabled?: boolean;
  initialData?: ConnectionCenterResponse;
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
}: Props) {
  const endpoint = `/api/v2/cases/${caseId}/connection-center`;
  const [data, setData] = useState<ConnectionCenterResponse | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);

  const activeSync = useMemo(() => Boolean(data && [...data.sources, ...data.optional_sources]
    .some((source) => source.technical_status.job && ["queued", "running"].includes(source.technical_status.job.status))), [data]);

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(endpoint, { cache: "no-store", signal });
    let body: ConnectionCenterResponse | { error?: { code?: string; message?: string } };
    try { body = await response.json(); }
    catch { throw new Error("Connection status could not be loaded. Please sign in again."); }
    if (!response.ok) {
      const code = "error" in body ? body.error?.code : undefined;
      throw new Error(code && ERROR_MESSAGES[code] ? ERROR_MESSAGES[code] : "Connection status could not be loaded. Please try again.");
    }
    setData(body as ConnectionCenterResponse);
    setError("");
  }, [endpoint]);

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

  function refresh() {
    setLoading(true);
    setRevision((value) => value + 1);
  }

  function openManager() {
    setManageOpen(true);
    window.setTimeout(() => document.getElementById("manage-google-sources")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function handleAction(next: ConnectionCenterAction) {
    if (next.code === "create_prospect_report" || next.code === "confirm_public_gbp") {
      window.location.assign("/cases/new");
      return;
    }
    if (next.code === "view_evidence" && data?.coverage.parent_report_id) {
      window.location.assign(`/cases/${caseId}/reports/${data.coverage.parent_report_id}`);
      return;
    }
    openManager();
  }

  const current = data?.case ?? { business_name: businessName, site_url: siteUrl };
  const progress = data ? Math.round((data.coverage.ready_source_count / data.coverage.required_source_count) * 100) : 0;

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
                ? "All required evidence is healthy and matched to this Case."
                : `${data.coverage.ready_source_count} of ${data.coverage.required_source_count} required sources are ready.`}</p>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={3} aria-valuenow={data.coverage.ready_source_count} aria-label="Verified Core sources ready">
                <div className="h-full rounded-full bg-[#b8e626] transition-[width]" style={{ width: `${progress}%` }} />
              </div>
              {!data.coverage.verified_core_ready && data.coverage.blockers[0] && <p className="mt-4 text-sm text-[#d6ddd3]">Next: {data.coverage.blockers[0].message}</p>}
            </> : <p className="mt-3 text-[#c7d0c3]">Loading the latest source status…</p>}
          </div>
          <button type="button" disabled className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#b8e626] px-6 py-3 font-semibold text-[#182218] disabled:cursor-not-allowed disabled:opacity-60" title="Verified analysis generation is delivered in the next milestone">
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            {data?.coverage.verified_core_ready ? "Ready — generation coming next" : "Generate Verified Action Plan"}
          </button>
        </div>
      </section>

      {loading && !data && <div role="status" className="mt-8 grid min-h-64 place-items-center rounded-2xl border border-[#d9ded3] bg-white text-[#64705f]">
        <span className="inline-flex items-center gap-3"><LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading connection status…</span>
      </div>}

      {data && <>
        <section aria-label="Required data sources" className="mt-8 grid gap-5 lg:grid-cols-3">
          {data.sources.map((source) => <SourceCard key={source.source_key} source={source} onAction={handleAction} />)}
        </section>

        <details className="group mt-6 rounded-2xl border border-[#d9ded3] bg-white p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <div><p className="font-semibold">Official GBP Performance</p><p className="mt-1 text-sm text-[#687362]">Optional owner-only data for Full Evidence. It never blocks Verified Core.</p></div>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(data.optional_sources[0])}`}>{STATUS_LABELS[data.optional_sources[0].user_status]}</span>
          </summary>
          <div className="mt-5 border-t border-[#e8ebe4] pt-5"><SourceCard source={data.optional_sources[0]} onAction={handleAction} /></div>
        </details>

        <section className="mt-7 rounded-2xl border border-[#d9ded3] bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Next required action</h2>
              <p className="mt-2 text-sm leading-6 text-[#687362]">{data.coverage.verified_core_ready
                ? "Verified Core is ready. Generation remains safely locked until the verified-analysis milestone is released."
                : data.coverage.blockers[0]?.message}</p>
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
