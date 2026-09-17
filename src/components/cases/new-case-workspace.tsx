"use client";

import { Coins, LockKeyhole, LoaderCircle, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuditModal } from "@/components/common/AuditModalProvider";
import { useAuthenticatedFetch } from "@/lib/use-authenticated-fetch";
import type { TaskStatusResponse } from "@/lib/analysis-v22";
import { useAppUser } from "@/lib/client-auth";
import {
  clearDraft,
  createNewCaseDraft,
  getCompetitorDiscovery,
  isMissingDiscoveryTaskError,
  loadDraft,
  PreflightApiError,
  reduceWorkspaceState,
  retryCompetitorDiscovery,
  runPreflight,
  saveDraft,
  type BusinessConfirmation,
  type NewCaseDraft,
} from "@/lib/preflight-v22";

import { BusinessMatchStep } from "./business-match-step";
import { CasePaymentHandoff, type PaymentHandoffStatus } from "./case-payment-handoff";
import { CompetitorConfirmationStep } from "./competitor-confirmation-step";
import { CoverageStep } from "./coverage-step";
import { GoalWebsiteStep } from "./goal-website-step";
import { NewCaseStepper } from "./new-case-stepper";
import { PreflightStatus } from "./preflight-status";

function normalizeWebInput(value: string) {
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(withProtocol);
  if (!/^https?:$/.test(url.protocol) || !url.hostname) throw new Error("INVALID_URL");
  return url.toString();
}

function discoveryQueries(confirmation: BusinessConfirmation) {
  const service = confirmation.primary_service.trim();
  const market = confirmation.target_market.city?.trim() || confirmation.target_market.display_name.trim();
  return [`${service} ${market}`, `best ${service} ${market}`, `${service} near me`];
}

function apiError(error: unknown) {
  return error instanceof PreflightApiError
    ? { code: error.code, message: error.message }
    : { code: "UNEXPECTED_ERROR", message: "Something interrupted the request. Your draft is still safe." };
}

export function NewCaseWorkspace() {
  const [draft, setDraft] = useState<NewCaseDraft>(() => createNewCaseDraft());
  const [hydrated, setHydrated] = useState(false);
  const [handoffMessage, setHandoffMessage] = useState<string | null>(null);
  const [paymentHandoff, setPaymentHandoff] = useState<{
    status: PaymentHandoffStatus;
    caseId: string | null;
    message: string;
  }>({ status: "saving_case", caseId: null, message: "Saving the verified Case before checkout…" });
  const savingCase = useRef(false);
  const submittingAnalysis = useRef(false);
  const skipNextSave = useRef(false);
  const latestLookupCase = useRef<string | null>(null);
  const { isLoaded, isSignedIn } = useAppUser();
  const { openLogin } = useAuditModal();
  const authenticatedFetch = useAuthenticatedFetch();
  const [analysisStatus, setAnalysisStatus] = useState<TaskStatusResponse | null>(null);
  const [latestAnalysisChecked, setLatestAnalysisChecked] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const needsGbpRepair = analysisStatus?.status === "failed"
    && analysisStatus.error?.error_code.startsWith("V22_CUSTOMER_PUBLIC_GBP_");

  useEffect(() => {
    setDraft(loadDraft(sessionStorage));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    saveDraft(sessionStorage, draft);
  }, [draft, hydrated]);

  useEffect(() => {
    if (!hydrated || !draft.prospect_workflow_id || paymentHandoff.caseId) return;
    setPaymentHandoff({
      status: "unlocked",
      caseId: draft.draft_case_id,
      message: "This Prospect Case is already covered. Refreshing or resuming will not use another credit.",
    });
  }, [draft.draft_case_id, draft.prospect_workflow_id, hydrated, paymentHandoff.caseId]);

  useEffect(() => {
    if (!hydrated || draft.stage !== "competitor_discovery_running" || !draft.discovery_job_id) return;
    const controller = new AbortController();
    const delay = draft.discovery_status ? (document.hidden ? 5_000 : 1_500) : 0;
    const timer = window.setTimeout(async () => {
      try {
        const status = await getCompetitorDiscovery(draft.discovery_job_id!, controller.signal);
        setDraft((current) => reduceWorkspaceState(current, { type: "DISCOVERY_UPDATED", status }));
      } catch (error) {
        if (controller.signal.aborted) return;
        const safe = apiError(error);
        setDraft((current) => reduceWorkspaceState(current, { type: "DISCOVERY_REQUEST_FAILED", ...safe }));
      }
    }, delay);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [draft.discovery_job_id, draft.discovery_status, draft.stage, hydrated]);

  useEffect(() => {
    const expiry = draft.discovery_status?.result?.expires_at;
    if (expiry && Date.parse(expiry) <= Date.now()) {
      setDraft((current) => reduceWorkspaceState(current, { type: "DISCOVERY_EXPIRED" }));
    }
  }, [draft.discovery_status]);

  const saveCase = useCallback(async (): Promise<string | null> => {
    if (savingCase.current || !draft.business_confirmation) return null;
    savingCase.current = true;
    setPaymentHandoff({ status: "saving_case", caseId: null, message: "Saving this confirmed Case before analysis…" });
    try {
      const scope = draft.business_confirmation;
      const response = await authenticatedFetch("/api/v2/cases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draft_case_id: draft.draft_case_id,
          site_url: scope.business_identity.site_url,
          business_name: scope.business_identity.business_name,
          operating_model: scope.business_identity.operating_model,
          primary_service: scope.primary_service,
          primary_location: scope.business_identity.primary_location,
          target_market: scope.target_market,
          public_gbp_url: scope.business_identity.public_gbp_url ?? null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (payload?.error?.code === "CASE_ALREADY_EXISTS" && payload?.error?.case_id === draft.draft_case_id) {
          const updateResponse = await authenticatedFetch(`/api/v2/cases/${encodeURIComponent(draft.draft_case_id)}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              business_name: scope.business_identity.business_name,
              operating_model: scope.business_identity.operating_model,
              primary_service: scope.primary_service,
              primary_location: scope.business_identity.primary_location,
              target_market: scope.target_market,
              public_gbp_url: scope.business_identity.public_gbp_url ?? null,
            }),
          });
          const updatePayload = await updateResponse.json().catch(() => null);
          if (!updateResponse.ok) {
            setPaymentHandoff({ status: "error", caseId: draft.draft_case_id, message: updatePayload?.error?.message || "The confirmed Case could not be updated yet." });
            return null;
          }
          setPaymentHandoff({
            status: "ready",
            caseId: draft.draft_case_id,
            message: "This Case is saved. Starting provider-backed discovery uses 1 credit.",
          });
          return draft.draft_case_id;
        }
        const message = payload?.error?.code === "CASE_ALREADY_EXISTS"
          ? "This client already has a Case. Open the existing Case instead of creating a duplicate."
          : payload?.error?.message || "The Case could not be saved yet.";
        setPaymentHandoff({ status: "error", caseId: payload?.error?.case_id ?? null, message });
        return null;
      }
      setPaymentHandoff({
        status: "ready",
        caseId: payload.id,
        message: "This Case is saved. Starting provider-backed discovery uses 1 credit.",
      });
      return payload.id as string;
    } catch {
      const message = "The Case could not be saved yet. Your session draft is still safe.";
      setPaymentHandoff({ status: "error", caseId: null, message });
      return null;
    } finally {
      savingCase.current = false;
    }
  }, [authenticatedFetch, draft.business_confirmation, draft.draft_case_id, draft.goal]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || draft.stage !== "prospect_start") return;
    if (!paymentHandoff.caseId && paymentHandoff.status === "saving_case") void saveCase();
  }, [draft.stage, isLoaded, isSignedIn, paymentHandoff.caseId, paymentHandoff.status, saveCase]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || draft.stage !== "prospect_start") return;
    const controller = new AbortController();
    void authenticatedFetch("/api/v2/credits", { signal: controller.signal })
      .then(async (response) => ({ response, payload: await response.json().catch(() => null) }))
      .then(({ response, payload }) => {
        if (!controller.signal.aborted && response.ok && Number.isSafeInteger(payload?.credit_balance)) {
          setCreditBalance(payload.credit_balance);
        }
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [authenticatedFetch, draft.stage, isLoaded, isSignedIn]);

  const submitAnalysis = useCallback(async () => {
    const discovery = draft.discovery_status?.result;
    const confirmation = draft.business_confirmation;
    const jobId = draft.analysis_job_id;
    const idempotencyKey = draft.analysis_idempotency_key;
    if (submittingAnalysis.current || !paymentHandoff.caseId || !draft.prospect_workflow_id || !discovery || !confirmation || !jobId || !idempotencyKey) return;
    const selected = new Set(draft.selected_competitor_ids);
    const competitors = discovery.candidates
      .filter((candidate) => selected.has(candidate.competitor_id))
      .map((candidate) => ({
        competitor_id: candidate.competitor_id,
        business_name: candidate.business_name,
        website_url: candidate.website_url,
        public_gbp_url: candidate.public_gbp_url,
        confirmation_source: "user" as const,
      }));
    submittingAnalysis.current = true;
    setPaymentHandoff((current) => ({ ...current, status: "starting_analysis", message: "Securing the report task and its exact confirmed competitor scope…" }));
    try {
      const response = await authenticatedFetch("/api/v2/analyze", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-searchtrust-job-id": jobId,
          "x-searchtrust-discovery-id": discovery.discovery_id,
          "x-searchtrust-workflow-id": draft.prospect_workflow_id,
          "idempotency-key": idempotencyKey,
          ...(draft.previous_analysis_job_id
            ? { "x-searchtrust-previous-job-id": draft.previous_analysis_job_id }
            : {}),
        },
        body: JSON.stringify({
          case_id: paymentHandoff.caseId,
          report_type: "prospect",
          business_identity: confirmation.business_identity,
          primary_service: confirmation.primary_service,
          target_market: confirmation.target_market,
          queries: discoveryQueries(confirmation),
          competitors,
          first_party_snapshots: [],
          parent_report: null,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "The report task could not be started yet.");
      setPaymentHandoff((current) => ({ ...current, status: "analyzing", message: "The task is queued. We’ll open the report automatically when its evidence has been validated." }));
    } catch (error) {
      setPaymentHandoff((current) => ({
        ...current,
        status: "starting_analysis",
        message: error instanceof Error ? `${error.message} Retrying the same reserved task…` : "Reconnecting to the same reserved report task…",
      }));
      window.setTimeout(() => {
        setPaymentHandoff((current) => current.status === "starting_analysis"
          ? { ...current, status: "unlocked", message: "Retrying the same reserved report task…" }
          : current);
      }, 10_000);
    } finally {
      submittingAnalysis.current = false;
    }
  }, [authenticatedFetch, draft.analysis_idempotency_key, draft.analysis_job_id, draft.business_confirmation, draft.discovery_status, draft.previous_analysis_job_id, draft.prospect_workflow_id, draft.selected_competitor_ids, paymentHandoff.caseId]);

  useEffect(() => {
    const caseId = paymentHandoff.caseId;
    if (!caseId || draft.goal !== "win_new_client" || draft.analysis_job_id) {
      if (draft.analysis_job_id) setLatestAnalysisChecked(true);
      return;
    }
    if (latestLookupCase.current === caseId) {
      setLatestAnalysisChecked(true);
      return;
    }
    latestLookupCase.current = caseId;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await authenticatedFetch(`/api/v2/cases/${encodeURIComponent(caseId)}/tasks/latest`, {
          signal: controller.signal,
        });
        if (response.status === 204) return;
        const latest = await response.json().catch(() => null) as { id?: string } | null;
        if (response.ok && latest?.id) {
          setDraft((current) => reduceWorkspaceState(current, {
            type: "START_ANALYSIS",
            job_id: latest.id!,
            idempotency_key: `resume:${latest.id}`,
          }));
          setPaymentHandoff((current) => ({ ...current, status: "analyzing", message: "Reconnected to the latest server-owned report task…" }));
        }
      } finally {
        if (!controller.signal.aborted) setLatestAnalysisChecked(true);
      }
    })();
    return () => controller.abort();
  }, [authenticatedFetch, draft.analysis_job_id, draft.goal, paymentHandoff.caseId]);

  useEffect(() => {
    if (draft.stage !== "auth_handoff" || paymentHandoff.status !== "unlocked" || draft.goal !== "win_new_client" || !latestAnalysisChecked) return;
    if (!draft.analysis_job_id) {
      const jobId = crypto.randomUUID();
      setDraft((current) => reduceWorkspaceState(current, { type: "START_ANALYSIS", job_id: jobId, idempotency_key: `analyze:${current.draft_case_id}:${jobId}` }));
      return;
    }
    void submitAnalysis();
  }, [draft.analysis_job_id, draft.goal, draft.stage, latestAnalysisChecked, paymentHandoff.status, submitAnalysis]);

  useEffect(() => {
    const jobId = draft.analysis_job_id;
    const caseId = paymentHandoff.caseId;
    if (!jobId || !caseId || !["starting_analysis", "analyzing"].includes(paymentHandoff.status)) return;
    const controller = new AbortController();
    let stopped = false;
    let pollTimer: number | undefined;
    let lastRevision = analysisStatus?.revision ?? 0;
    let events: EventSource | null = null;

    const applyStatus = (payload: TaskStatusResponse) => {
      if (payload.revision < lastRevision) return false;
      lastRevision = payload.revision;
      setAnalysisStatus(payload);
      if (payload.status === "succeeded" && payload.database_report_id) {
        clearDraft(sessionStorage);
        window.location.assign(`/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(payload.database_report_id)}`);
        stopped = true;
        return false;
      }
      if (payload.status === "failed") {
        setPaymentHandoff((current) => ({
          ...current,
          status: "analysis_failed",
          message: `${payload.error?.user_message ?? "The analysis stopped safely."} One credit has been returned. Generating again will use one credit.`,
        }));
        stopped = true;
        return false;
      }
      setPaymentHandoff((current) => ({ ...current, status: "analyzing", message: `${payload.message} ${payload.progress}% complete.` }));
      return true;
    };

    const poll = async () => {
      if (stopped || controller.signal.aborted) return;
      try {
        const response = await authenticatedFetch(`/api/v2/tasks/${jobId}`, { signal: controller.signal });
        const payload = await response.json().catch(() => null) as TaskStatusResponse | null;
        if (!response.ok || !payload) throw new Error("Reconnecting to the report task…");
        applyStatus(payload);
      } catch (error) {
        if (controller.signal.aborted) return;
        setPaymentHandoff((current) => ({
          ...current,
          status: current.status === "starting_analysis" ? "starting_analysis" : "analyzing",
          message: error instanceof Error ? error.message : "Reconnecting to the report task…",
        }));
      } finally {
        if (!stopped && !controller.signal.aborted) pollTimer = window.setTimeout(poll, 10_000);
      }
    };

    events = new EventSource(`/api/v2/tasks/${encodeURIComponent(jobId)}/stream`);
    events.addEventListener("state", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent<string>).data) as TaskStatusResponse;
        if (!applyStatus(payload)) events?.close();
        if (payload.status === "succeeded") void poll();
      } catch {
        events?.close();
      }
    });
    events.onerror = () => {
      events?.close();
      void poll();
    };
    void poll();
    return () => {
      stopped = true;
      events?.close();
      controller.abort();
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    };
  }, [authenticatedFetch, draft.analysis_job_id, paymentHandoff.caseId, paymentHandoff.status]);

  function retryAnalysis() {
    if (needsGbpRepair) {
      setAnalysisStatus(null);
      setLatestAnalysisChecked(false);
      latestLookupCase.current = null;
      setPaymentHandoff({ status: "saving_case", caseId: null, message: "Add and confirm the client’s public Google Business Profile before restarting analysis." });
      setDraft((current) => reduceWorkspaceState(current, { type: "REPAIR_BUSINESS" }));
      return;
    }
    if (analysisStatus?.status === "failed") {
      setAnalysisStatus(null);
      setDraft((current) => reduceWorkspaceState(current, { type: "RESTART_PROSPECT" }));
    }
    setPaymentHandoff((current) => ({ ...current, status: "ready", message: "1 credit was returned. Start a new Prospect analysis when you are ready; it will use 1 credit." }));
  }

  async function startPreflight(input: { goal: NewCaseDraft["goal"]; site_url: string; gbp_url: string | null }) {
    let siteUrl: string;
    let gbpUrl: string | null;
    try {
      siteUrl = normalizeWebInput(input.site_url);
      gbpUrl = input.gbp_url ? normalizeWebInput(input.gbp_url) : null;
    } catch {
      setDraft((current) => reduceWorkspaceState(reduceWorkspaceState(current, { type: "CHANGE_SOURCE", ...input }), { type: "PREFLIGHT_FAILED", code: "INVALID_URL", message: "Enter a valid public website address." }));
      return;
    }
    setDraft((current) => reduceWorkspaceState(reduceWorkspaceState(current, { type: "CHANGE_SOURCE", goal: input.goal, site_url: siteUrl, gbp_url: gbpUrl }), { type: "START_PREFLIGHT" }));
    try {
      const response = await runPreflight({ site_url: siteUrl, gbp_url: gbpUrl });
      setDraft((current) => reduceWorkspaceState(current, { type: "PREFLIGHT_SUCCEEDED", response }));
    } catch (error) {
      const safe = apiError(error);
      setDraft((current) => reduceWorkspaceState(current, { type: "PREFLIGHT_FAILED", ...safe }));
    }
  }

  async function startDiscovery(confirmation: BusinessConfirmation, supplements: string[] = []) {
    if (!isSignedIn) {
      openLogin();
      return;
    }
    if (!paymentHandoff.caseId) {
      await saveCase();
      return;
    }
    const normalizedSupplements: string[] = [];
    try {
      for (const value of supplements) normalizedSupplements.push(normalizeWebInput(value));
    } catch {
      setDraft((current) => reduceWorkspaceState(current, { type: "DISCOVERY_REQUEST_FAILED", code: "INVALID_COMPETITOR_URL", message: "Enter valid public competitor website addresses." }));
      return;
    }
    const workflowId = draft.prospect_workflow_id ?? crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const idempotencyKey = `discover:${draft.draft_case_id}:${jobId}`;
    const workflowIdempotencyKey = `prospect:${draft.draft_case_id}:${workflowId}`;
    setDraft((current) => reduceWorkspaceState(current, { type: "START_DISCOVERY", workflow_id: workflowId, job_id: jobId, idempotency_key: idempotencyKey, supplemental_website_urls: normalizedSupplements }));
    setPaymentHandoff((current) => ({ ...current, status: "starting_analysis", message: "Reserving 1 credit and starting provider-backed discovery…" }));
    try {
      const response = await authenticatedFetch(`/api/v2/cases/${encodeURIComponent(paymentHandoff.caseId)}/prospect-workflow`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-searchtrust-workflow-id": workflowId,
          "x-searchtrust-workflow-idempotency-key": workflowIdempotencyKey,
          "x-searchtrust-discovery-job-id": jobId,
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({
          case_id: paymentHandoff.caseId,
          business_identity: confirmation.business_identity,
          primary_service: confirmation.primary_service,
          target_market: confirmation.target_market,
          queries: discoveryQueries(confirmation),
          search_language: "en",
          search_device: "mobile",
          supplemental_website_urls: normalizedSupplements,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new PreflightApiError(payload?.error?.code ?? "PROSPECT_WORKFLOW_UNAVAILABLE", payload?.error?.message ?? "The Prospect workflow could not be started.", response.status);
      const balance = Number(response.headers.get("x-searchtrust-credit-balance"));
      if (Number.isSafeInteger(balance) && balance >= 0) setCreditBalance(balance);
      setPaymentHandoff((current) => ({ ...current, status: "unlocked", message: "This Prospect Case is already covered. Refreshing or resuming will not use another credit." }));
    } catch (error) {
      const safe = apiError(error);
      if (safe.code === "INSUFFICIENT_CREDITS") {
        setCreditBalance(0);
        setDraft((current) => reduceWorkspaceState(current, { type: "PROSPECT_START_REJECTED" }));
      } else {
        setDraft((current) => reduceWorkspaceState(current, { type: "DISCOVERY_REQUEST_FAILED", ...safe }));
      }
      setPaymentHandoff((current) => ({ ...current, status: "error", message: safe.message }));
    }
  }

  function confirmBusiness(confirmation: BusinessConfirmation) {
    setDraft((current) => reduceWorkspaceState(current, { type: "CONFIRM_BUSINESS", confirmation }));
    if (!isSignedIn) openLogin();
  }

  async function retryDiscovery() {
    if (!draft.business_confirmation) return;
    if (!draft.discovery_job_id) {
      await startDiscovery(draft.business_confirmation, draft.supplemental_website_urls);
      return;
    }
    try {
      const latest = await getCompetitorDiscovery(draft.discovery_job_id);
      if (latest.status !== "failed") {
        setDraft((current) => reduceWorkspaceState(current, { type: "DISCOVERY_UPDATED", status: latest }));
        return;
      }
      if (latest.error?.retryable) {
        await retryCompetitorDiscovery(draft.discovery_job_id);
        setDraft((current) => reduceWorkspaceState(current, { type: "START_DISCOVERY", workflow_id: draft.prospect_workflow_id!, job_id: draft.discovery_job_id!, idempotency_key: draft.discovery_idempotency_key ?? `retry:${draft.discovery_job_id}` }));
        return;
      }
      setDraft((current) => reduceWorkspaceState(current, { type: "DISCOVERY_UPDATED", status: latest }));
    } catch (error) {
      if (isMissingDiscoveryTaskError(error)) {
        await startDiscovery(draft.business_confirmation, draft.supplemental_website_urls);
        return;
      }
      const safe = apiError(error);
      setDraft((current) => reduceWorkspaceState(current, { type: "DISCOVERY_REQUEST_FAILED", ...safe }));
    }
  }

  function continueAfterCoverage() {
    setPaymentHandoff((current) => ({
      ...current,
      status: "unlocked",
      message: "Your Prospect workflow is covered. Generating its report will not use another credit.",
    }));
    setDraft((current) => reduceWorkspaceState(current, { type: "BEGIN_AUTH_HANDOFF" }));
    if (!isSignedIn) openLogin();
  }

  function reset() {
    clearDraft(sessionStorage);
    skipNextSave.current = true;
    setDraft(createNewCaseDraft());
    setAnalysisStatus(null);
    setLatestAnalysisChecked(false);
    latestLookupCase.current = null;
    setHandoffMessage(null);
    setCreditBalance(null);
    setPaymentHandoff({ status: "saving_case", caseId: null, message: "Saving this confirmed Case before analysis…" });
  }

  if (!hydrated) return <div className="min-h-screen bg-[#171d17]" />;

  return (
    <div className="min-h-screen bg-[#171d17] text-[#1c241c]">
      <header className="border-b border-white/10 bg-[#171d17]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 sm:px-8">
          <Link href="/" className="flex items-center gap-3 text-white outline-none focus-visible:ring-4 focus-visible:ring-[#A5D020]/30"><img src="/images/small-logo.png" alt="" className="h-8 w-8 rounded-lg" /><span className="text-sm font-bold tracking-tight">SearchTrust</span><span className="rounded-full border border-white/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">v2.2</span></Link>
          <div className="flex items-center gap-4"><span className="hidden items-center gap-1.5 text-xs font-semibold text-white/50 sm:flex"><ShieldCheck size={14} className="text-[#A5D020]" />Public-data preflight</span><button type="button" onClick={reset} className="text-xs font-bold text-white/55 outline-none hover:text-white focus-visible:ring-4 focus-visible:ring-[#A5D020]/30">Clear draft</button></div>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1440px] lg:grid-cols-[290px_1fr]">
        <aside className="border-white/10 bg-[#171d17] lg:border-r lg:px-7 lg:py-10"><NewCaseStepper stage={draft.stage} /><div className="hidden px-4 lg:mt-12 lg:block"><p className="flex items-center gap-2 text-xs font-semibold text-white/45"><LockKeyhole size={13} />Saved only in this session</p><p className="mt-2 break-all text-[10px] leading-4 text-white/25">Draft {draft.draft_case_id}</p></div></aside>
        <main className="bg-[#f1f3ed] px-5 py-8 sm:px-8 sm:py-12 lg:px-12 xl:px-20">
          <div className="mx-auto max-w-[920px]">
            {draft.stage === "goal_website" && <GoalWebsiteStep key={draft.draft_case_id} initialGoal={draft.goal} initialSiteUrl={draft.site_url} initialGbpUrl={draft.gbp_url} onSubmit={startPreflight} />}
            {draft.stage === "preflight_running" && <PreflightStatus kind="loading" title="Checking the public evidence surface" message="We’re resolving the business website, public profile, service, market, and available analysis modules." />}
            {draft.stage === "preflight_failed" && <PreflightStatus kind="error" title="Preflight needs attention" message={draft.preflight_error?.message ?? "The public data check could not be completed."} onRetry={() => void startPreflight({ goal: draft.goal, site_url: draft.site_url, gbp_url: draft.gbp_url })} />}
            {draft.stage === "business_confirmation" && draft.preflight && <BusinessMatchStep key={draft.preflight.preflight_id} preflight={draft.preflight} submittedGbpUrl={draft.gbp_url} initialConfirmation={draft.business_confirmation} onConfirm={confirmBusiness} onEditSource={() => setDraft((current) => reduceWorkspaceState(current, { type: "CHANGE_SOURCE", goal: current.goal, site_url: current.site_url, gbp_url: current.gbp_url }))} />}
            {draft.stage === "prospect_start" && draft.business_confirmation && (
              <section className="overflow-hidden rounded-2xl border border-[#d9dfd3] bg-white shadow-[0_18px_55px_rgba(31,39,27,0.07)]">
                <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_270px] lg:items-center">
                  <div>
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-[#1a211a] text-[#b7dc3f]">
                      {paymentHandoff.status === "saving_case" ? <LoaderCircle className="animate-spin" size={23} /> : <Coins size={23} />}
                    </span>
                    <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.16em] text-[#718218]">Prospect Opportunity Report</p>
                    <h1 className="mt-2 max-w-xl text-3xl font-bold tracking-[-0.035em] text-[#172017]">Start the complete prospect analysis.</h1>
                    <p className="mt-4 max-w-xl text-sm leading-6 text-[#667266]">{draft.prospect_workflow_id ? "This Prospect Case is already covered. Resume competitor discovery without another charge." : "Your site and business scope are confirmed. Starting now reserves 1 credit before competitor and market providers are called. This same Case can be refreshed and resumed without another charge."}</p>
                    {!isSignedIn && <p className="mt-4 text-sm font-semibold text-[#7a5b14]">Sign in first to receive and use your permanent credits.</p>}
                    <p aria-live="polite" className="mt-4 text-sm text-[#667266]">{paymentHandoff.message}</p>
                  </div>
                  <div className="rounded-2xl border border-[#dfe5d8] bg-[#f7f9f3] p-5">
                    <div className="flex items-center justify-between border-b border-[#dfe5d8] pb-4">
                      <span className="text-xs font-bold text-[#657065]">This workflow</span>
                      <span className="text-xl font-bold text-[#1a231a]">{draft.prospect_workflow_id ? "Covered" : "1 credit"}</span>
                    </div>
                    <p className="mt-4 text-xs leading-5 text-[#667266]">{creditBalance === null ? "Loading your balance…" : `${creditBalance} ${creditBalance === 1 ? "credit" : "credits"} available`}</p>
                    {isSignedIn ? (
                      creditBalance === 0 ? (
                        <Link href="/pricing" className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#1a211a] px-5 text-sm font-bold text-white">Buy 1 credit · $19</Link>
                      ) : (
                        <button type="button" onClick={() => void startDiscovery(draft.business_confirmation!)} disabled={!paymentHandoff.caseId || paymentHandoff.status === "saving_case" || paymentHandoff.status === "starting_analysis" || creditBalance === null} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1a211a] px-5 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-55">
                          {paymentHandoff.status === "saving_case" || paymentHandoff.status === "starting_analysis" ? <LoaderCircle className="animate-spin" size={17} /> : <Coins size={17} />}
                          {draft.prospect_workflow_id ? "Resume discovery · no extra credit" : "Start analysis · uses 1 credit"}
                        </button>
                      )
                    ) : (
                      <button type="button" onClick={openLogin} className="mt-5 min-h-12 w-full rounded-xl bg-[#1a211a] px-5 text-sm font-bold text-white">Sign in & continue</button>
                    )}
                  </div>
                </div>
              </section>
            )}
            {draft.stage === "competitor_discovery_running" && <PreflightStatus kind="loading" title="Finding qualified local competitors" message={draft.discovery_status?.message ?? "The durable discovery task is checking market results and validating candidate websites."} progress={draft.discovery_status?.progress} />}
            {draft.stage === "competitor_discovery_failed" && <PreflightStatus kind="error" title="Competitor discovery needs attention" message={draft.discovery_error?.message ?? "The competitor search could not be completed."} onRetry={draft.discovery_error?.retryable === false ? undefined : () => void retryDiscovery()} onEdit={() => setDraft((current) => reduceWorkspaceState(current, { type: "EDIT_BUSINESS" }))} editLabel="Edit business scope" />}
            {draft.stage === "competitor_confirmation" && draft.discovery_status?.result && <CompetitorConfirmationStep status={draft.discovery_status} selectedIds={draft.selected_competitor_ids} onSelectionChange={(competitor_ids) => setDraft((current) => reduceWorkspaceState(current, { type: "SELECT_COMPETITORS", competitor_ids }))} onConfirm={() => setDraft((current) => reduceWorkspaceState(current, { type: "CONFIRM_COMPETITORS" }))} onRerun={(urls) => draft.business_confirmation && void startDiscovery(draft.business_confirmation, urls)} onEditScope={() => setDraft((current) => reduceWorkspaceState(current, { type: "EDIT_BUSINESS" }))} />}
            {draft.stage === "coverage" && <CoverageStep draft={draft} onContinue={continueAfterCoverage} onBack={() => setDraft((current) => reduceWorkspaceState(current, { type: "EDIT_COMPETITORS" }))} />}
            {draft.stage === "auth_handoff" && (
              isSignedIn ? (
                <CasePaymentHandoff
                  status={paymentHandoff.status}
                  message={paymentHandoff.message}
                  caseId={paymentHandoff.caseId}
                  onCheckout={() => undefined}
                  onRetryAnalysis={retryAnalysis}
                  retryLabel={needsGbpRepair ? "Add confirmed GBP" : undefined}
                  onBack={() => setDraft((current) => reduceWorkspaceState(current, { type: "RETURN_TO_COVERAGE" }))}
                />
              ) : (
                <section className="rounded-2xl border border-[#cbd8a5] bg-white p-8 text-center shadow-[0_18px_55px_rgba(31,39,27,0.07)]">
                  <h1 className="text-2xl font-bold tracking-tight text-[#1d271d]">Your verified setup is preserved.</h1>
                  <p aria-live="polite" className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#667266]">{handoffMessage ?? (isSignedIn ? "Preparing the next step…" : "Sign in to continue from this exact business and competitor scope.")}</p>
                  {!isSignedIn && <button type="button" onClick={openLogin} className="mt-6 rounded-xl bg-[#1a211a] px-6 py-3 text-sm font-bold text-white">Sign in & continue</button>}
                  <button type="button" onClick={() => setDraft((current) => reduceWorkspaceState(current, { type: "RETURN_TO_COVERAGE" }))} className="mx-auto mt-5 flex items-center gap-2 text-xs font-bold text-[#697569] underline underline-offset-4">Return to coverage</button>
                </section>
              )
            )}
            <p className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] leading-5 text-[#849084]"><RotateCcw size={12} />Refreshing this page resumes active discovery from its real task status.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
