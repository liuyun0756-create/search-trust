"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { BusinessMatchStep } from "./business-match-step";
import { runPreflight, type BusinessConfirmation, type PreflightResponse } from "@/lib/preflight-v22";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function FirstServiceClient() {
  const router = useRouter();
  const [website, setWebsite] = useState("");
  const [profile, setProfile] = useState("");
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [existing, setExisting] = useState<{ id: string; archived: boolean } | null>(null);
  const draftId = useRef<string | null>(null);
  const flight = useRef<AbortController | null>(null);
  useEffect(() => () => { flight.current?.abort(); }, []);

  async function checkWebsite(event: FormEvent) {
    event.preventDefault();
    if (flight.current) return;
    const controller = new AbortController();
    flight.current = controller;
    setBusy(true); setError(""); setExisting(null);
    try {
      const result = await runPreflight({ site_url: website.trim(), gbp_url: profile.trim() || null }, controller.signal);
      if (!controller.signal.aborted) setPreflight(result);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The website could not be checked. Please retry.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (flight.current === controller) flight.current = null;
    }
  }

  async function save(confirmation: BusinessConfirmation) {
    if (flight.current) return;
    const controller = new AbortController();
    flight.current = controller;
    draftId.current ??= crypto.randomUUID();
    setBusy(true); setError(""); setExisting(null);
    try {
      const identity = confirmation.business_identity;
      const response = await fetch("/api/v2/cases", {
        method: "POST", cache: "no-store", signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ draft_case_id: draftId.current, site_url: identity.site_url,
          business_name: identity.business_name, operating_model: identity.operating_model,
          primary_location: identity.primary_location, target_market: confirmation.target_market,
          primary_service: confirmation.primary_service, public_gbp_url: identity.public_gbp_url }),
      });
      const body = await response.json();
      if (controller.signal.aborted) return;
      if (response.status === 409 && body.error?.code === "CASE_ALREADY_EXISTS"
        && typeof body.error.case_id === "string" && uuid.test(body.error.case_id)) {
        // Never silently overwrite a previously saved Case, including an uncertain
        // create response. The user explicitly chooses the existing record.
        setExisting({ id: body.error.case_id, archived: body.error.status === "archived" });
        return;
      }
      if (!response.ok) throw new Error(body.error?.message || "The client could not be saved. Please retry.");
      if (body.id !== draftId.current || body.status !== "active") throw new Error("The saved client could not be confirmed. Please retry with the same details.");
      router.push(`/cases/${body.id}/service-setup`);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The client could not be saved. Please retry.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (flight.current === controller) flight.current = null;
    }
  }

  async function restoreClient() {
    if (!existing?.archived || flight.current) return;
    const controller = new AbortController();
    flight.current = controller;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/v2/cases/${existing.id}`, { method: "PATCH", cache: "no-store",
        signal: controller.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "active" }) });
      const body = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || body.id !== existing.id || body.status !== "active") {
        throw new Error("The client could not be restored. Please retry.");
      }
      router.push(`/cases/${existing.id}/service-setup`);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "The client could not be restored. Please retry.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
      if (flight.current === controller) flight.current = null;
    }
  }

  return <div className="space-y-7">
    <div className="flex items-start gap-3 rounded-2xl border border-[#d7e4d2] bg-[#edf4e9] p-5 text-sm leading-6 text-[#42604a]">
      <ShieldCheck className="mt-1 shrink-0" size={20} aria-hidden="true" />
      <p><strong>Client setup · no credit used.</strong> Confirm the business and connect its data. This does not create a Prospect report or start a service analysis. Paid first-service analysis is not available yet.</p>
    </div>
    {preflight ? <fieldset disabled={busy} className="min-w-0">
      <legend className="sr-only">Confirm client identity and service scope</legend>
      <BusinessMatchStep preflight={preflight} submittedGbpUrl={profile.trim() || null}
        confirmLabel="Save client and connect data" onConfirm={save} onEditSource={() => { setPreflight(null); setError(""); setExisting(null); }} />
    </fieldset> : <form onSubmit={checkWebsite} className="max-w-2xl rounded-3xl border border-[#dce6d9] bg-white p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-widest text-[#668a50]">01 / Identify your client</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Start with the client you already serve.</h1>
      <p className="mt-4 text-sm leading-6 text-[#657267]">Check the website, then confirm the business, service and location. You will review suggested details before saving.</p>
      <label className="mt-7 block text-sm font-semibold" htmlFor="service-website">Business website</label>
      <input id="service-website" required maxLength={2083} disabled={busy} inputMode="url" autoComplete="url" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="example.com" className="mt-2 min-h-12 w-full rounded-xl border border-[#bdcdbd] bg-[#f8faf7] px-4 focus-visible:outline-[#26432e]" />
      <label className="mt-5 block text-sm font-semibold" htmlFor="service-profile">Public Google Maps link <span className="font-normal text-[#657267]">(optional for this check)</span></label>
      <input id="service-profile" maxLength={2083} disabled={busy} inputMode="url" value={profile} onChange={(event) => setProfile(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-[#bdcdbd] bg-[#f8faf7] px-4 focus-visible:outline-[#26432e]" />
      <button disabled={busy} className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-xl bg-[#26432e] px-5 font-semibold text-white disabled:opacity-50">Check business details <ArrowRight size={17} aria-hidden="true" /></button>
    </form>}
    {busy && <p role="status" className="text-sm text-[#42604a]">{preflight ? "Saving this client…" : "Checking public business details…"}</p>}
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-amber-900">{error}</p>}
    {existing && <div role="status" className="rounded-xl border border-[#d7e4d2] bg-white p-5">
      <p>This client already has a Case. Your saved details have not been changed.</p>
      {existing.archived ? <><p className="mt-2 text-sm">This Case is archived. Restoring it keeps its existing details and reports.</p>
        <button disabled={busy} onClick={restoreClient} className="mt-3 min-h-11 font-semibold underline disabled:opacity-50">Restore this client and continue</button></>
        : <Link className="mt-3 inline-block font-semibold underline" href={`/cases/${existing.id}/service-setup`}>Continue with the existing client</Link>}
    </div>}
  </div>;
}
