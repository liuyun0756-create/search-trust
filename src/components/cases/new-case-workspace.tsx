"use client";

import { useUser } from "@clerk/nextjs";
import { LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAuditModal } from "@/components/common/AuditModalProvider";
import { useAuthenticatedFetch } from "@/lib/use-authenticated-fetch";
import type { TaskStatusResponse } from "@/lib/analysis-v22";
import {
  clearDraft,
  createNewCaseDraft,
  getCompetitorDiscovery,
  loadDraft,
  PreflightApiError,
  reduceWorkspaceState,
  retryCompetitorDiscovery,
  runPreflight,
  saveDraft,
  submitCompetitorDiscovery,
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
  const { isLoaded, isSignedIn } = useUser();
  const { openLogin } = useAuditModal();
  const authenticatedFetch = useAuthenticatedFetch();
  const [analysisStatus, setAnalysisStatus] = useState<TaskStatusResponse | null>(null);
  const [analysisPollTick, setAnalysisPollTick] = useState(0);

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
    if (draft.goal === "work_existing_client") setHandoffMessage("Saving the verified client Case…");
    else setPaymentHandoff({ status: "saving_case", caseId: null, message: "Saving the verified Case before checkout…" });
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
          if (draft.goal === "work_existing_client") {
            clearDraft(sessionStorage);
            setHandoffMessage("Client Case is already saved. Connection preparation will continue from this verified scope.");
          } else {
            setPaymentHandoff({
              status: "ready",
              caseId: draft.draft_case_id,
              message: "Your verified Case is saved. Payment status is being checked before another checkout can be opened.",
            });
          }
          return draft.draft_case_id;
        }
        const message = payload?.error?.code === "CASE_ALREADY_EXISTS"
          ? "This client already has a Case. Open the existing Case instead of creating a duplicate."
          : payload?.error?.message || "The Case could not be saved yet.";
        if (draft.goal === "work_existing_client") setHandoffMessage(message);
        else setPaymentHandoff({ status: "error", caseId: payload?.error?.case_id ?? null, message });
        return null;
      }
      if (draft.goal === "work_existing_client") {
        clearDraft(sessionStorage);
        setHandoffMessage("Client Case saved. Connection preparation will continue from this verified scope.");
      } else {
        setPaymentHandoff({
          status: "ready",
          caseId: payload.id,
          message: "Your verified business and competitor scope is now attached to this Case. Continue when you are ready to pay.",
        });
      }
      return payload.id as string;
    } catch {
      const message = "The Case could not be saved yet. Your session draft is still safe.";
      if (draft.goal === "work_existing_client") setHandoffMessage(message);
      else setPaymentHandoff({ status: "error", caseId: null, message });
      return null;
    } finally {
      savingCase.current = false;
    }
  }, [authenticatedFetch, draft.business_confirmation, draft.draft_case_id, draft.goal]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || draft.stage !== "auth_handoff") return;
    if (draft.goal === "work_existing_client") void saveCase();
    else if (!paymentHandoff.caseId && paymentHandoff.status === "saving_case") void saveCase();
  }, [draft.goal, draft.stage, isLoaded, isSignedIn, paymentHandoff.caseId, paymentHandoff.status, saveCase]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || draft.stage !== "auth_handoff" || draft.goal !== "win_new_client" || !paymentHandoff.caseId) return;
    const params = new URLSearchParams(window.location.search);
    const paymentReturn = params.get("payment");
    const returnedCaseId = params.get("case_id");
    const matchesReturn = returnedCaseId === paymentHandoff.caseId;

    if (paymentReturn === "cancelled" && matchesReturn) {
      setPaymentHandoff((current) => ({ ...current, status: "ready", message: "Checkout was cancelled. Your Case is still saved and nothing was charged." }));
      window.history.replaceState(null, "", "/cases/new");
      return;
    }
    if (paymentReturn && (!matchesReturn || paymentReturn !== "return")) return;

    const controller = new AbortController();
    void (async () => {
      if (paymentReturn === "return") {
        setPaymentHandoff((current) => ({ ...current, status: "confirming_payment", message: "Confirming payment and securing this Case entitlement…" }));
      }
      try {
        const statusResponse = await authenticatedFetch(`/api/v2/cases/${paymentHandoff.caseId}/checkout`, { signal: controller.signal });
        const statusPayload = await statusResponse.json().catch(() => null);
        if (statusResponse.ok && statusPayload?.unlocked) {
          setPaymentHandoff((current) => ({ ...current, status: "unlocked", message: "Payment is confirmed. This entitlement can be used only for the first prospect report on this Case." }));
          window.history.replaceState(null, "", "/cases/new");
          return;
        }

        if (paymentReturn !== "return") return;

        const paymentId = params.get("payment_id");
        if (!paymentId) {
          setPaymentHandoff((current) => ({ ...current, status: "error", message: "Payment confirmation is still arriving. Refresh this page in a moment; you will not be charged twice." }));
          return;
        }
        const confirmResponse = await authenticatedFetch(`/api/v2/cases/${paymentHandoff.caseId}/checkout/confirm`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ payment_id: paymentId }),
          signal: controller.signal,
        });
        const confirmPayload = await confirmResponse.json().catch(() => null);
        if (!confirmResponse.ok) throw new Error(confirmPayload?.error?.message || "Payment confirmation failed.");
        setPaymentHandoff((current) => ({ ...current, status: "unlocked", message: "Payment is confirmed. This entitlement can be used only for the first prospect report on this Case." }));
        window.history.replaceState(null, "", "/cases/new");
      } catch (error) {
        if (controller.signal.aborted) return;
        setPaymentHandoff((current) => ({ ...current, status: "error", message: error instanceof Error ? error.message : "Payment confirmation could not be completed yet." }));
      }
    })();
    return () => controller.abort();
  }, [authenticatedFetch, draft.goal, draft.stage, isLoaded, isSignedIn, paymentHandoff.caseId]);

  const submitAnalysis = useCallback(async () => {
    const discovery = draft.discovery_status?.result;
    const confirmation = draft.business_confirmation;
    const jobId = draft.analysis_job_id;
    const idempotencyKey = draft.analysis_idempotency_key;
    if (submittingAnalysis.current || !paymentHandoff.caseId || !discovery || !confirmation || !jobId || !idempotencyKey) return;
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
          "idempotency-key": idempotencyKey,
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
      setPaymentHandoff((current) => ({ ...current, status: "analysis_failed", message: error instanceof Error ? error.message : "The report task could not be started yet." }));
    } finally {
      submittingAnalysis.current = false;
    }
  }, [authenticatedFetch, draft.analysis_idempotency_key, draft.analysis_job_id, draft.business_confirmation, draft.discovery_status, draft.selected_competitor_ids, paymentHandoff.caseId]);

  useEffect(() => {
    if (paymentHandoff.status !== "unlocked" || draft.goal !== "win_new_client") return;
    if (!draft.analysis_job_id) {
      const jobId = crypto.randomUUID();
      setDraft((current) => reduceWorkspaceState(current, { type: "START_ANALYSIS", job_id: jobId, idempotency_key: `analyze:${current.draft_case_id}:${jobId}` }));
      return;
    }
    void submitAnalysis();
  }, [draft.analysis_job_id, draft.goal, paymentHandoff.status, submitAnalysis]);

  useEffect(() => {
    const jobId = draft.analysis_job_id;
    const caseId = paymentHandoff.caseId;
    if (!jobId || !caseId || !["starting_analysis", "analyzing"].includes(paymentHandoff.status)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      let shouldContinue = true;
      try {
        const response = await authenticatedFetch(`/api/v2/tasks/${jobId}`, { signal: controller.signal });
        const payload = await response.json().catch(() => null) as TaskStatusResponse | null;
        if (!response.ok || !payload) throw new Error("Reconnecting to the report task…");
        setAnalysisStatus(payload);
        if (payload.status === "succeeded" && payload.database_report_id) {
          clearDraft(sessionStorage);
          window.location.assign(`/cases/${encodeURIComponent(caseId)}/reports/${encodeURIComponent(payload.database_report_id)}`);
          shouldContinue = false;
          return;
        }
        if (payload.status === "failed") {
          setPaymentHandoff((current) => ({ ...current, status: "analysis_failed", message: payload.error?.user_message ?? "The analysis stopped safely. You can retry without another payment." }));
          shouldContinue = false;
          return;
        }
        setPaymentHandoff((current) => ({ ...current, status: "analyzing", message: `${payload.message} ${payload.progress}% complete.` }));
      } catch (error) {
        if (controller.signal.aborted) return;
        setPaymentHandoff((current) => ({ ...current, status: "analyzing", message: error instanceof Error ? error.message : "Reconnecting to the report task…" }));
      } finally {
        if (shouldContinue && !controller.signal.aborted) setAnalysisPollTick((value) => value + 1);
      }
    }, document.hidden ? 5_000 : 1_500);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [analysisPollTick, authenticatedFetch, draft.analysis_job_id, paymentHandoff.caseId, paymentHandoff.status]);

  function retryAnalysis() {
    if (analysisStatus?.status === "failed") {
      setAnalysisStatus(null);
      setDraft((current) => reduceWorkspaceState(current, { type: "RESET_ANALYSIS" }));
    }
    setPaymentHandoff((current) => ({ ...current, status: "unlocked", message: "Your entitlement is ready. Restarting the report task…" }));
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
    const normalizedSupplements: string[] = [];
    try {
      for (const value of supplements) normalizedSupplements.push(normalizeWebInput(value));
    } catch {
      setDraft((current) => reduceWorkspaceState(current, { type: "DISCOVERY_REQUEST_FAILED", code: "INVALID_COMPETITOR_URL", message: "Enter valid public competitor website addresses." }));
      return;
    }
    const jobId = crypto.randomUUID();
    const idempotencyKey = `discover:${draft.draft_case_id}:${jobId}`;
    setDraft((current) => reduceWorkspaceState(current, { type: "START_DISCOVERY", job_id: jobId, idempotency_key: idempotencyKey, supplemental_website_urls: normalizedSupplements }));
    try {
      await submitCompetitorDiscovery({
        case_id: draft.draft_case_id,
        business_identity: confirmation.business_identity,
        primary_service: confirmation.primary_service,
        target_market: confirmation.target_market,
        queries: discoveryQueries(confirmation),
        search_language: "en",
        search_device: "mobile",
        supplemental_website_urls: normalizedSupplements,
      }, jobId, idempotencyKey);
    } catch (error) {
      const safe = apiError(error);
      setDraft((current) => reduceWorkspaceState(current, { type: "DISCOVERY_REQUEST_FAILED", ...safe }));
    }
  }

  function confirmBusiness(confirmation: BusinessConfirmation) {
    setDraft((current) => reduceWorkspaceState(current, { type: "CONFIRM_BUSINESS", confirmation }));
    void startDiscovery(confirmation);
  }

  async function retryDiscovery() {
    if (!draft.discovery_job_id || !draft.business_confirmation) return;
    try {
      const latest = await getCompetitorDiscovery(draft.discovery_job_id);
      if (latest.status !== "failed") {
        setDraft((current) => reduceWorkspaceState(current, { type: "DISCOVERY_UPDATED", status: latest }));
        return;
      }
      if (latest.error?.retryable) {
        await retryCompetitorDiscovery(draft.discovery_job_id);
        setDraft((current) => reduceWorkspaceState(current, { type: "START_DISCOVERY", job_id: draft.discovery_job_id!, idempotency_key: draft.discovery_idempotency_key ?? `retry:${draft.discovery_job_id}` }));
        return;
      }
      setDraft((current) => reduceWorkspaceState(current, { type: "DISCOVERY_UPDATED", status: latest }));
    } catch (error) {
      const safe = apiError(error);
      setDraft((current) => reduceWorkspaceState(current, { type: "DISCOVERY_REQUEST_FAILED", ...safe }));
    }
  }

  function continueAfterCoverage() {
    setDraft((current) => reduceWorkspaceState(current, { type: "BEGIN_AUTH_HANDOFF" }));
    if (!isSignedIn) openLogin();
  }

  async function startCaseCheckout() {
    if (!paymentHandoff.caseId) {
      setPaymentHandoff((current) => ({ ...current, status: "saving_case", message: "Saving the verified Case before checkout…" }));
      await saveCase();
      return;
    }
    setPaymentHandoff((current) => ({ ...current, status: "creating_checkout", message: "Preparing a secure checkout for this Case…" }));
    try {
      const response = await authenticatedFetch(`/api/v2/cases/${paymentHandoff.caseId}/checkout`, { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok || typeof payload?.checkout_url !== "string") {
        throw new Error(payload?.error?.message || "Secure checkout could not be opened.");
      }
      window.location.assign(payload.checkout_url);
    } catch (error) {
      setPaymentHandoff((current) => ({ ...current, status: "error", message: error instanceof Error ? error.message : "Secure checkout could not be opened." }));
    }
  }

  function reset() {
    clearDraft(sessionStorage);
    skipNextSave.current = true;
    setDraft(createNewCaseDraft());
    setAnalysisStatus(null);
    setAnalysisPollTick(0);
    setHandoffMessage(null);
    setPaymentHandoff({ status: "saving_case", caseId: null, message: "Saving the verified Case before checkout…" });
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
            {draft.stage === "business_confirmation" && draft.preflight && <BusinessMatchStep key={draft.preflight.preflight_id} preflight={draft.preflight} onConfirm={confirmBusiness} onEditSource={() => setDraft((current) => reduceWorkspaceState(current, { type: "CHANGE_SOURCE", goal: current.goal, site_url: current.site_url, gbp_url: current.gbp_url }))} />}
            {draft.stage === "competitor_discovery_running" && <PreflightStatus kind="loading" title="Finding qualified local competitors" message={draft.discovery_status?.message ?? "The durable discovery task is checking market results and validating candidate websites."} progress={draft.discovery_status?.progress} />}
            {draft.stage === "competitor_discovery_failed" && <PreflightStatus kind="error" title="Competitor discovery needs attention" message={draft.discovery_error?.message ?? "The competitor search could not be completed."} onRetry={draft.discovery_error?.retryable === false ? undefined : () => void retryDiscovery()} />}
            {draft.stage === "competitor_confirmation" && draft.discovery_status?.result && <CompetitorConfirmationStep status={draft.discovery_status} selectedIds={draft.selected_competitor_ids} onSelectionChange={(competitor_ids) => setDraft((current) => reduceWorkspaceState(current, { type: "SELECT_COMPETITORS", competitor_ids }))} onConfirm={() => setDraft((current) => reduceWorkspaceState(current, { type: "CONFIRM_COMPETITORS" }))} onRerun={(urls) => draft.business_confirmation && void startDiscovery(draft.business_confirmation, urls)} onEditScope={() => setDraft((current) => reduceWorkspaceState(current, { type: "EDIT_BUSINESS" }))} />}
            {draft.stage === "coverage" && <CoverageStep draft={draft} onContinue={continueAfterCoverage} onBack={() => setDraft((current) => reduceWorkspaceState(current, { type: "EDIT_COMPETITORS" }))} />}
            {draft.stage === "auth_handoff" && (
              draft.goal === "win_new_client" && isSignedIn ? (
                <CasePaymentHandoff
                  status={paymentHandoff.status}
                  message={paymentHandoff.message}
                  caseId={paymentHandoff.caseId}
                  onCheckout={() => void startCaseCheckout()}
                  onRetryAnalysis={retryAnalysis}
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
