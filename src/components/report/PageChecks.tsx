"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {parsePageContext, parsePageRate, parsePageSelection, parsePageView, type PageCheckTarget} from "@/lib/page-checks/contracts";
import {parsePendingPageCheck, pendingPageKey, type PendingPageCheck} from "@/lib/page-checks/pending";
import type {PageCheckContext, PageCheckHistory, PageCheckView, PageCondition} from "@/lib/page-checks/types";

type Props = PageCheckTarget & {ownerId: string};
const field = "mt-1 block w-full min-w-0 rounded-lg border border-[#c8d8c7] bg-white p-2 text-sm disabled:opacity-60";
const button = "rounded-lg border border-[#c8d8c7] bg-white px-3 py-2 text-sm disabled:opacity-50";
const limitation = "This does not verify rendered behavior, functionality or SEO impact.";
const failureCopy = {
  unsafe_target: "This destination could not be checked safely.", dns_unavailable: "The page address could not be resolved safely.",
  redirect_requires_confirmation: "The page redirects. Confirm the destination before requesting a separate check.",
  robots_unavailable: "The site's crawl instructions could not be retrieved.", robots_disallowed: "The site's crawl instructions do not allow this check.",
  robots_invalid: "The site's crawl instructions could not be safely interpreted.", crawl_delay_exceeds_budget: "The required crawl delay exceeds this check's time limit.",
  page_timeout: "The page did not respond within the check's time limit.", http_error: "The page request could not be completed.",
  http_status: "The page did not return a successful response.", content_unsupported: "The response was not a supported HTML page.",
  response_too_large: "The response exceeded this check's size limit.", empty_page: "The page returned an empty response.",
  access_restricted: "The page response appears to require access or verification.", parse_failed: "The static page response could not be read safely.",
};
function statusText(job: PageCheckHistory | PageCheckView) {
  if (job.status === "queued") return "Waiting to check";
  if (job.status === "running") return "Checking this page";
  if (job.status === "completed") return "observation" in job && job.observation?.status === "unable_to_check" ? "Could not check this page" : "Page check saved";
  return {PAGE_CHECK_SOURCE_CHANGED: "Source changed", PAGE_CHECK_EXPIRED: "Request expired", PAGE_CHECK_INTERRUPTED: "Check interrupted", PAGE_CHECK_FAILED: "Check failed"}[job.error_code!];
}
function dateText(value: string) {
  return new Intl.DateTimeFormat(undefined, {year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short"}).format(new Date(value));
}

export function PageChecks(props: Props) {
  // A different account or report cannot retain the previous account's local UI state.
  return <PageChecksPanel key={pendingPageKey(props.ownerId, props)} {...props}/>;
}

function PageChecksPanel({ownerId, caseId, reportId, deliveryRevisionId}: Props) {
  const target = useMemo(() => ({caseId, reportId, deliveryRevisionId}), [caseId, reportId, deliveryRevisionId]);
  const storageKey = pendingPageKey(ownerId, target);
  const url = `/api/v2/cases/${caseId}/reports/${reportId}/page-checks?deliveryRevisionId=${deliveryRevisionId}`;
  const [context, setContext] = useState<PageCheckContext | null>(null);
  const [view, setView] = useState<PageCheckView | null>(null);
  const [actionId, setActionId] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [conditions, setConditions] = useState<PageCondition[]>([{id: "condition-1", kind: "text_present", value: ""}]);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState<PendingPageCheck | null>(null);
  const [pendingMissing, setPendingMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const lock = useRef(false), pendingRef = useRef<PendingPageCheck | null>(null), serial = useRef(1);
  const lifetime = useRef<AbortController | null>(null);

  const loadContext = useCallback(async () => {
    const signal = lifetime.current?.signal;
    try {
      const response = await fetch(url, {cache: "no-store", signal});
      const parsed = parsePageContext(await response.json(), target);
      if (!response.ok || !parsed) throw new Error("context");
      if (signal?.aborted) return;
      setContext(parsed); setConsent(false);
      setActionId(current => parsed.actions.some(a => a.id === current) ? current : parsed.actions[0]?.id ?? "");
    } catch {
      if (!signal?.aborted) {setContext(null); setConsent(false); setMessage("Page checks could not be loaded. Availability and remaining checks are unknown. No new check was requested.");}
    } finally {if (!signal?.aborted) setLoading(false);}
  }, [url, target]);

  const clearPending = useCallback(() => {
    pendingRef.current = null; setPending(null); setPendingMissing(false); setConsent(false);
    try {sessionStorage.removeItem(storageKey);} catch { /* A saved ID can still be recovered by a later read. */ }
  }, [storageKey]);

  const readCheck = useCallback(async (id: string, original?: PendingPageCheck) => {
    const signal = lifetime.current?.signal;
    try {
      const response = await fetch(`${url}&checkId=${id}`, {cache: "no-store", signal});
      if (signal?.aborted) return;
      if (response.status === 404 && original) {
        await response.body?.cancel();
        setPendingMissing(true);
        setMessage("The original request is not saved yet. Recover the same confirmed request below; no new request ID will be created.");
        return;
      }
      const parsed = parsePageView(await response.json(), target, id, original?.selection);
      if (!response.ok || !parsed) throw new Error("read");
      if (signal?.aborted) return;
      setView(parsed);
      if (original && pendingRef.current?.checkId === id) {clearPending(); setMessage("Original request recovered. No additional check was created.");}
    } catch {
      if (!signal?.aborted) setMessage(original ? "The request could not be confirmed. Keep this request ID and refresh its status before starting another check." : "This saved check could not be loaded. No new check was requested.");
    }
  }, [url, target, clearPending]);

  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    let original: PendingPageCheck | null = null;
    try {original = parsePendingPageCheck(sessionStorage.getItem(storageKey));} catch { /* Submission checks storage availability again. */ }
    if (original) {pendingRef.current = original; setPending(original);}
    void Promise.all([loadContext(), original ? readCheck(original.checkId, original) : Promise.resolve()]);
    return () => controller.abort();
  }, [storageKey, loadContext, readCheck]);

  const selection = context?.implementation ? parsePageSelection({implementation: context.implementation, action_id: actionId, target_url: pageUrl, conditions}, context.site_url) : null;
  const eligible = context?.eligibility === "eligible";
  const localActive = view?.status === "queued" || view?.status === "running";
  const canSubmit = !!selection && consent && eligible && !!context && context.limits.reason === null && !pending && !busy && !localActive;

  async function send(original: PendingPageCheck) {
    if (lock.current) return;
    const signal = lifetime.current?.signal;
    lock.current = true; setBusy(true); setMessage(""); setPendingMissing(false);
    try {
      // Save before POST. Storage failure must not create an unrecoverable request.
      sessionStorage.setItem(storageKey, JSON.stringify(original));
      pendingRef.current = original; setPending(original); setConsent(false);
      const response = await fetch(url, {method: "POST", cache: "no-store", signal,
        headers: {"Content-Type": "application/json"}, body: JSON.stringify({checkId: original.checkId, selection: original.selection})});
      if (signal?.aborted) return;
      if (response.status === 429) {
        const rate = parsePageRate(await response.json());
        if (!rate) throw new Error("rate");
        clearPending(); setContext(c => c ? {...c, limits: rate.limits} : c);
        setMessage("This request was not created. Check this Case's availability below."); return;
      }
      if ([400, 409].includes(response.status)) {
        clearPending(); await loadContext();
        setMessage("This request was rejected. Review the latest saved record, page and conditions before confirming a new check."); return;
      }
      const parsed = parsePageView(await response.json(), target, original.checkId, original.selection);
      if (!response.ok || !parsed) throw new Error("request");
      if (signal?.aborted) return;
      setView(parsed); clearPending(); setMessage("Page check request saved. No credits used."); await loadContext();
    } catch {
      if (!signal?.aborted) {
        if (pendingRef.current) {setMessage("The response was uncertain. Looking up the original request only…"); await readCheck(original.checkId, original);}
        else setMessage("This browser could not save a recovery ID. No check was requested. Allow session storage and try again.");
      }
    } finally {lock.current = false; if (!signal?.aborted) setBusy(false);}
  }
  function updateCondition(id: string, change: Partial<PageCondition>) {
    setConsent(false); setConditions(current => current.map(c => c.id === id ? {...c, ...change} : c));
  }
  async function refresh() {
    if (lock.current) return;
    setMessage("");
    const original = pendingRef.current;
    await Promise.all([loadContext(), original ? readCheck(original.checkId, original) : view ? readCheck(view.id) : Promise.resolve()]);
  }

  return <section aria-labelledby="page-check-heading" className="mt-6 space-y-4 border-t border-[#dce6d9] pt-6">
    <header className="space-y-2"><h3 id="page-check-heading" className="text-lg font-semibold">Check the published page.</h3>
      <p className="text-sm text-[#52695b]">Check specific text, a same-site link or an anchor on one page. This checks the static response, not rendered behavior or SEO performance.</p>
    </header>
    {loading ? <p role="status" className="text-sm">Loading page checks…</p> : null}
    {context ? <>
      <p className="break-words text-sm">Approved delivery revision {context.delivery_revision} · {context.implementation ? `Implementation revision ${context.implementation.revision}` : "No saved implementation"} · {new URL(context.site_url).host}</p>
      {!eligible ? <p className="text-sm">{context.eligibility === "source_changed" ? "The source has changed. Review the current business and saved implementation before requesting a new check. Your authorized history remains below." : "Save at least one implemented action before requesting a page check. Existing history remains available."}</p> : null}
      <form onSubmit={event => {event.preventDefault(); if (canSubmit && selection) void send({version: 1, checkId: crypto.randomUUID(), selection});}} className="space-y-4">
        <fieldset disabled={!eligible || !!pending || busy} className="min-w-0 space-y-4">
          <legend className="sr-only">New page check</legend>
          <label className="block text-sm">Saved action<select aria-label="Saved action" className={field} value={actionId} onChange={e => {setActionId(e.target.value); setConsent(false);}}>
            {!context.actions.length ? <option value="">No saved actions</option> : null}
            {context.actions.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}
          </select></label>
          <label className="block text-sm">Page URL<input required type="url" maxLength={2000} className={field} value={pageUrl} placeholder={`${context.site_url}service-page`} onChange={e => {setPageUrl(e.target.value); setConsent(false);}} aria-describedby="page-check-url-hint"/></label>
          <p id="page-check-url-hint" className="text-xs text-[#52695b]">Use an exact HTTPS URL on the confirmed host, without a query string or credentials.</p>
          <fieldset className="min-w-0 space-y-3"><legend className="mb-2 text-sm font-semibold">What should we look for?</legend>
            {conditions.map((c, index) => <div key={c.id} className="grid min-w-0 gap-3 rounded-lg border border-[#dce6d9] bg-white p-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]">
              <label className="text-sm">Condition {index + 1} type<select aria-label={`Condition ${index + 1} type`} className={field} value={c.kind} onChange={e => updateCondition(c.id, {kind: e.target.value as PageCondition["kind"]})}>
                <option value="text_present">Text</option><option value="link_present">Same-site link</option><option value="anchor_present">Anchor ID</option>
              </select></label>
              <label className="text-sm">Condition {index + 1} value<input required className={field} value={c.value} maxLength={{text_present: 200, link_present: 2000, anchor_present: 128}[c.kind]} onChange={e => updateCondition(c.id, {value: e.target.value})}/></label>
              <button type="button" className={`${button} self-end`} disabled={conditions.length <= 1} aria-label={`Remove condition ${index + 1}`} onClick={() => {setConditions(current => current.filter(item => item.id !== c.id)); setConsent(false);}}>Remove</button>
            </div>)}
            <button type="button" className={button} disabled={conditions.length >= 5} onClick={() => {setConditions(current => [...current, {id: `condition-${++serial.current}`, kind: "text_present", value: ""}]); setConsent(false);}}>Add condition</button>
          </fieldset>
          {pageUrl && !selection ? <p className="text-sm">Enter a valid page URL and 1–5 complete conditions. Links must use the same confirmed host.</p> : null}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)}/>I confirm this page and these checks match the work I recorded.</label>
        </fieldset>
        <button type="submit" disabled={!canSubmit} className="rounded-lg bg-[#214532] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving request…" : "Check this page · no credits used"}</button>
      </form>
      <div className="space-y-2 rounded-lg bg-white p-3 text-sm">
        <p>{context.limits.used} checks used in the rolling 24-hour window · availability as of {dateText(context.limits.server_time)}</p>
        {context.limits.reason === "active" ? <p>A check is already in progress for this Case.</p> : null}
        {context.limits.reason === "quota" ? <p>This Case has reached 10 checks in the last 24 hours.</p> : null}
        {context.limits.reason === "cooldown" || context.limits.reason === "quota" ? <p>You can request another check after <time dateTime={context.limits.next_request_at}>{dateText(context.limits.next_request_at)}</time>. Refresh availability then; the server checks again on submission.</p> : null}
      </div>
    </> : null}
    <p className="text-xs text-[#52695b]">Up to 10 checks per Case in a rolling 24-hour period. Wait at least 5 minutes between new checks. Accepted requests count even if the page cannot be checked.</p>
    {pending ? <div className="space-y-2 rounded-lg border border-[#c8d8c7] p-3 text-sm">
      <p className="break-all">Unconfirmed request: {pending.checkId}</p><p className="break-all">{pending.selection.target_url}</p>
      <p>Your original selection is kept unchanged until this request is resolved.</p>
      {pendingMissing ? <button type="button" className={button} disabled={busy} onClick={() => void send(pending)}>Recover the same confirmed request</button> : null}
    </div> : null}
    {message ? <p role="status" className="text-sm">{message}</p> : null}
    <button type="button" className={button} disabled={busy} onClick={() => void refresh()}>Refresh status and availability</button>
    {view ? <article className="space-y-3 rounded-xl border border-[#dce6d9] bg-white p-4 text-sm" aria-label="Saved page check">
      <h4 className="font-semibold" aria-live="polite">{statusText(view)}</h4>
      <p className="break-all">Page: {view.selection.target_url}</p>
      <p>Implementation revision {view.selection.implementation.revision} · approved delivery revision {view.delivery_revision}</p>
      <p>Requested {dateText(view.created_at)}{view.observation ? ` · checked ${dateText(view.observation.observed_at)}` : ""}</p>
      {view.observation?.failure ? <p>{failureCopy[view.observation.failure]}</p> : null}
      {view.status === "failed" ? <p>No page result was saved. Review this request before explicitly starting another eligible check.</p> : null}
      <ul className="space-y-2">{view.selection.conditions.map(c => {
        const result = view.observation?.results.find(r => r.condition_id === c.id);
        return <li key={c.id} className="break-words"><strong>{result ? {observed: "Observed", not_observed: "Not observed", unable_to_check: "Unable to check"}[result.state] : "Not checked yet"}</strong> — {c.value}
          {result?.state === "not_observed" ? <p className="mt-1 text-xs text-[#52695b]">Not found in the checked static response; rendered content may differ.</p> : null}</li>;
      })}</ul><p className="text-xs text-[#52695b]">{limitation}</p>
    </article> : null}
    {context?.history.length ? <div className="space-y-2"><h4 className="text-sm font-semibold">Page check history · latest {context.history.length}</h4>
      <ul className="space-y-2">{context.history.map(h => <li key={h.id}><button type="button" className={`${button} w-full text-left`} disabled={busy} onClick={() => void readCheck(h.id)}>
        {statusText(h)} · {dateText(h.created_at)}<span className="ml-2 underline">View saved check</span>
      </button></li>)}</ul>
    </div> : null}
    <p className="text-xs text-[#52695b]">{limitation} Reading status and history never starts another check.</p>
  </section>;
}
