"use client";

import { useCallback, useEffect, useState } from "react";
import type { GoogleConnectionSummary } from "@/lib/google-connections/contracts";
import type { GoogleSource } from "@/lib/google-connections/scopes";
import type { GoogleResource, ResourcePage } from "@/lib/google-resources/contracts";

type Binding = { id: string; source_type: GoogleSource; external_resource_name: string; external_resource_id: string; connection_id: string | null };
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

export function GoogleResourceSelector({ caseId, businessName, siteUrl }: { caseId: string; businessName: string; siteUrl: string }) {
  const endpoint = `/api/v2/cases/${caseId}/google-resources`;
  const [connections, setConnections] = useState<GoogleConnectionSummary[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [connection, setConnection] = useState("");
  const [source, setSource] = useState<GoogleSource>("gsc");
  const [parent, setParent] = useState<string | null>(null);
  const [page, setPage] = useState<ResourcePage | null>(null);
  const [selected, setSelected] = useState<GoogleResource | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    const [accounts, state] = await Promise.all([
      api<{ connections: GoogleConnectionSummary[] }>("/api/v2/google/connections"), api<{ bindings: Binding[] }>(endpoint),
    ]);
    setConnections(accounts.connections);
    setBindings(state.bindings);
  }, [endpoint]);
  useEffect(() => {
    setBusy(true);
    refresh().catch(e => setError(e.message)).finally(() => setBusy(false));
  }, [refresh]);
  const current = connections.find(c => c.id === connection);
  const usable = !!current && ["active", "error"].includes(current.status) && current.covered_sources.includes(source);
  function reset() { setPage(null); setSelected(null); setParent(null); setError(""); setNotice(""); }
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
      setParent(nextParent); setSelected(null); setPage(result);
    });
  }
  async function preview(resource: GoogleResource) {
    await action(async () => {
      setSelected(null);
      const q = new URLSearchParams({ connection_id: connection, source, resource_id: resource.id });
      if (resource.parent) q.set("parent", resource.parent);
      const result = await api<ResourcePage>(`${endpoint}?${q}`);
      setSelected(result.resources[0] ?? null);
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
            <p className="break-all text-sm">{binding.external_resource_id}</p><p className="text-sm text-[#687362]">Identity and data health still need verification.</p></div>
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
        {selected && <div className="space-y-3 rounded-xl bg-[#f3f4ed] p-5" aria-label="Review selected resource">
          <h3 className="text-lg font-semibold">Confirm {selected.name}</h3>
          <p className="break-all">{selected.id}</p>
          {selected.website_urls.map(url => <p key={url} className="break-all">Website: {url}</p>)}
          {selected.website_urls.length === 0 && <p>No website URL is available for this resource.</p>}
          {selected.address && <p>Address: {selected.address}</p>}
          {selected.service_areas.length > 0 && <p>Service area: {selected.service_areas.join(", ")}</p>}
          <p>Check these details against {businessName}. Saving records your selection; identity and data health remain unverified.</p>
          {bindings.some(b => b.source_type === source) && <p>This replaces the current {LABELS[source]} selection for this Case.</p>}
          <button disabled={busy} className={button} onClick={() => action(async () => {
            await api(endpoint, { method: "POST", body: JSON.stringify({ connection_id: connection, source, resource_id: selected.id,
              parent: selected.parent, confirm_selection: true, expected_binding_id: bindings.find(b => b.source_type === source)?.id ?? null }) });
            await refresh(); setSelected(null); setNotice("Resource selection saved. Identity and health checks are still pending.");
          })}>Save this resource</button>
        </div>}
      </section>
    </div>
  </main>;
}
