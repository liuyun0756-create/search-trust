"use client";

import { useCallback, useEffect, useState } from "react";
import type { GoogleConnectionSummary } from "@/lib/google-connections/contracts";
import type { GoogleSource } from "@/lib/google-connections/scopes";
import type { GoogleResource, ResourcePage } from "@/lib/google-resources/contracts";
import { GoogleIdentityReview } from "./google-identity-review";
import { GscSyncControl } from "./gsc-sync-control";
import { Ga4SyncControl } from "./ga4-sync-control";

type Binding = { id: string; source_type: GoogleSource; external_resource_name: string; external_resource_id: string; connection_id: string | null;
  identity_match_status: string; confirmation_method: string | null; confirmed_at: string | null };
const LABELS: Record<GoogleSource, string> = { gsc: "Search Console", ga4: "Google Analytics", gbp: "Business Profile" };
const button = "rounded-xl bg-[#1c251b] px-5 py-3 text-white disabled:opacity-40 disabled:cursor-not-allowed";
const secondary = "rounded-xl border border-[#dce1d5] px-4 py-2 disabled:opacity-40";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", headers: { "content-type": "application/json" } });
  let body;
  try { body = await response.json(); } catch { throw new Error("Please sign in again and reload this page."); }
  if (!response.ok) throw new Error(body.error?.message || "The request could not be completed. Please try again.");
  return body as T;
}

export function GoogleResourceSelector({ caseId, businessName, siteUrl, gscSyncEnabled = false, ga4SyncEnabled = false }: { caseId: string; businessName: string; siteUrl: string; gscSyncEnabled?: boolean; ga4SyncEnabled?: boolean }) {
  const endpoint = `/api/v2/cases/${caseId}/google-resources`;
  const [connections, setConnections] = useState<GoogleConnectionSummary[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [connection, setConnection] = useState("");
  const [source, setSource] = useState<GoogleSource>("gsc");
  const [parent, setParent] = useState<string | null>(null);
  const [page, setPage] = useState<ResourcePage | null>(null);
  const [selected, setSelected] = useState<GoogleResource | null>(null);
  const [reviewCase, setReviewCase] = useState<ResourcePage["case_identity"]>();
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const load = useCallback(() => Promise.all([
      api<{ connections: GoogleConnectionSummary[] }>("/api/v2/google/connections"), api<{ bindings: Binding[] }>(endpoint),
    ]), [endpoint]);
  const refresh = useCallback(async () => {
    const [accounts, state] = await load();
    setConnections(accounts.connections);
    setBindings(state.bindings);
  }, [load]);
  useEffect(() => {
    let active = true;
    load().then(([accounts, state]) => {
      if (!active) return;
      setConnections(accounts.connections); setBindings(state.bindings);
    }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [load]);
  const current = connections.find(c => c.id === connection);
  const usable = !!current && ["active", "error"].includes(current.status) && current.covered_sources.includes(source);
  function reset() { setPage(null); setSelected(null); setReviewCase(undefined); setIdentityConfirmed(false); setParent(null); setError(""); setNotice(""); }
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  async function discover(nextParent: string | null = parent, pageToken: string | null = null) {
    await action(async () => {
      const q = new URLSearchParams({ connection_id: connection, source });
      if (nextParent) q.set("parent", nextParent);
      if (pageToken) q.set("page_token", pageToken);
      const result = await api<ResourcePage>(`${endpoint}?${q}`);
      setParent(nextParent); setSelected(null); setIdentityConfirmed(false); setPage(result);
    });
  }
  async function preview(resource: GoogleResource) {
    await action(async () => {
      setSelected(null); setIdentityConfirmed(false); setReviewCase(undefined);
      const q = new URLSearchParams({ connection_id: connection, source, resource_id: resource.id });
      if (resource.parent) q.set("parent", resource.parent);
      const result = await api<ResourcePage>(`${endpoint}?${q}`);
      setSelected(result.resources[0] ?? null);
      setReviewCase(result.case_identity);
    });
  }
  async function authorize(newAccount: boolean) {
    await action(async () => {
      const path = newAccount ? "/api/v2/google/connections/authorize" : `/api/v2/google/connections/${connection}/authorize`;
      const result = await api<{ authorization_url: string }>(path, { method: "POST", body: JSON.stringify({
        case_id: caseId, sources: [source], return_path: `/cases/${caseId}/connections`,
      }) });
      const url = new URL(result.authorization_url);
      if (url.origin !== "https://accounts.google.com") throw new Error("Google authorization could not be started.");
      window.location.assign(url.toString());
    });
  }
  return <main className="min-h-screen bg-[#f3f4ed] px-5 py-12 text-[#1c251b]">
    <div className="mx-auto max-w-4xl space-y-7">
      <a className="underline" href="/reports">← Reports</a>
      <header><p className="mb-2 text-sm uppercase tracking-widest">Google resources</p><h1 className="text-3xl font-semibold">Choose data for {businessName}</h1>
        <p className="mt-3 break-all text-[#687362]">Case website: {siteUrl}</p>
        <p className="mt-2">Choose the correct resource for each source. Each may use a different Google account.</p></header>
      <section aria-label="Current selections" className="rounded-2xl border border-[#dce1d5] bg-white p-6">
        <h2 className="text-xl font-semibold">Current selections</h2>
        {bindings.length === 0 && <p className="mt-3">No Google resources selected yet.</p>}
        {bindings.map(binding => <div key={binding.id} className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e8df] pt-4">
          <div><p className="font-medium">{LABELS[binding.source_type]} · {binding.external_resource_name}</p>
            <p className="break-all text-sm">{binding.external_resource_id}</p>
            <p className="text-sm text-[#687362]">{binding.identity_match_status === "matched"
              ? binding.confirmation_method === "automatic" ? "Identity confirmed from high-confidence evidence."
                : binding.confirmation_method === "user_confirmed" ? "Identity explicitly confirmed by you." : "Identity confirmed."
              : binding.identity_match_status === "mismatch" ? "Identity mismatch. Choose another resource." : "Identity needs review. Select this resource again to confirm."}</p>
            {binding.confirmed_at && binding.identity_match_status === "matched" && <p className="text-sm">Confirmed: {new Date(binding.confirmed_at).toLocaleString()}</p>}
            <p className="text-sm text-[#687362]">Identity confirmation does not verify data health or start data synchronization.</p>
            {gscSyncEnabled && binding.source_type === "gsc" && <GscSyncControl key={binding.id} caseId={caseId} bindingId={binding.id} identityMatched={binding.identity_match_status === "matched"} />}
            {ga4SyncEnabled && binding.source_type === "ga4" && <Ga4SyncControl key={binding.id} caseId={caseId} bindingId={binding.id} identityMatched={binding.identity_match_status === "matched"} />}</div>
          <button disabled={busy} className={secondary} onClick={() => action(async () => {
            await api(endpoint, { method: "DELETE", body: JSON.stringify({ binding_id: binding.id }) });
            await refresh(); setSelected(null); setNotice("Resource disconnected from this Case.");
          })}>Disconnect resource</button>
        </div>)}
      </section>
      <section className="space-y-5 rounded-2xl border border-[#dce1d5] bg-white p-6" aria-label="Resource selection">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="space-y-2">Data source<select disabled={busy} className="block w-full rounded-lg border p-3" value={source} onChange={e => { reset(); setSource(e.target.value as GoogleSource); }}>
            {Object.entries(LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></label>
          <label className="space-y-2">Google account<select disabled={busy} className="block w-full rounded-lg border p-3" value={connection} onChange={e => { reset(); setConnection(e.target.value); }}>
            <option value="">Choose an account</option>{connections.filter(c => !["revoked", "deleted"].includes(c.status)).map(c => <option key={c.id} value={c.id}>{c.account_email || c.account_display_name || "Google account"}</option>)}
          </select></label>
        </div>
        <div className="flex flex-wrap gap-3"><button disabled={busy || !usable} className={button} onClick={() => discover(null)}>Find resources</button>
          <button disabled={busy} className={secondary} onClick={() => authorize(true)}>Connect another Google account</button>
          {current && !usable && <button disabled={busy} className={secondary} onClick={() => authorize(false)}>Authorize {LABELS[source]}</button>}
        </div>
        {busy && <p role="status">Loading Google resources…</p>}
        {error && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-900">{error} <button className="underline" disabled={busy} onClick={() => action(refresh)}>Refresh selections</button></p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-4">{notice}</p>}
        {parent && <button disabled={busy} className="underline" onClick={() => discover(null)}>← All Business Profile accounts</button>}
        {page && page.resources.length === 0 && <p>No resources on this page. Check the selected account or its permissions.{page.next_page_token ? " More pages are available below." : ""}</p>}
        {page?.resources.map(resource => <article key={`${resource.parent}:${resource.id}`} className="rounded-xl border border-[#dce1d5] p-4">
          <h3 className="font-semibold">{resource.name}</h3><p className="break-all text-sm">{resource.id}</p>
          {resource.account_name && <p className="text-sm">Analytics account: {resource.account_name}</p>}
          {resource.website_urls.map(url => <p className="break-all" key={url}>{url}</p>)}
          {resource.address && <p>{resource.address}</p>}
          {resource.service_areas.length > 0 && <p>Service area: {resource.service_areas.join(", ")}</p>}
          <button disabled={busy} className={`${secondary} mt-3`} onClick={() => resource.selectable ? preview(resource) : discover(resource.id)}>{resource.selectable ? "Review selection" : "View locations"}</button>
        </article>)}
        {page?.next_page_token && <button disabled={busy} className={secondary} onClick={() => discover(parent, page.next_page_token)}>Next page</button>}
        {selected && <GoogleIdentityReview resource={selected} caseIdentity={reviewCase} busy={busy} confirmed={identityConfirmed}
          replaces={bindings.some(b => b.source_type === source) ? LABELS[source] : undefined} onConfirm={setIdentityConfirmed}
          onReview={() => preview(selected)} onSave={() => action(async () => {
            await api(endpoint, { method: "POST", body: JSON.stringify({ connection_id: connection, source, resource_id: selected.id,
              parent: selected.parent, confirm_selection: true, identity_confirmed: identityConfirmed, identity_review_token: selected.identity_review_token,
              expected_binding_id: bindings.find(b => b.source_type === source)?.id ?? null }) });
            await refresh(); setSelected(null); setIdentityConfirmed(false); setNotice("Resource saved with identity confirmation. Data health checks are still pending.");
          })} />}
      </section>
    </div>
  </main>;
}
