"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Globe2, HelpCircle, MapPin, MapPinned, MinusCircle, PencilLine, SearchCheck, Store } from "lucide-react";
import { FormEvent, useState } from "react";

import { isLocalE2ETestMode } from "@/lib/e2e-v22/config";
import type { BusinessIdentity, TargetMarket } from "@/lib/report-v22/generated/types";
import type { BusinessConfirmation, IdentityComparisonStatus, IdentityFieldComparison, PreflightResponse } from "@/lib/preflight-v22";

interface BusinessMatchStepProps {
  preflight: PreflightResponse;
  submittedGbpUrl: string | null;
  initialConfirmation?: BusinessConfirmation | null;
  confirmLabel?: string;
  onConfirm(value: BusinessConfirmation): void;
  onEditSource(): void;
}

const statusMeta: Record<IdentityComparisonStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  exact_match: { label: "Exact match", className: "bg-[#edf7d5] text-[#56720c]", icon: CheckCircle2 },
  partial_match: { label: "Partial match", className: "bg-[#fff6d9] text-[#8a6500]", icon: HelpCircle },
  not_matched: { label: "Different observed values", className: "bg-[#fff0e8] text-[#a44328]", icon: MinusCircle },
  error: { label: "Not verified", className: "bg-[#fff6d9] text-[#8a6500]", icon: AlertCircle },
};

function displayStatus(comparison: IdentityFieldComparison): IdentityComparisonStatus {
  return !comparison.site_value?.trim() || !comparison.gbp_value?.trim() ? "error" : comparison.status;
}

const fieldLabel = { business_name: "Business name", phone: "Phone", address: "Address", service_area: "Service area" };

function normalizedDomain(url: string) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

export function BusinessMatchStep({ preflight, submittedGbpUrl, initialConfirmation, confirmLabel, onConfirm, onEditSource }: BusinessMatchStepProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const candidate = preflight.identity_candidates[selectedIndex];
  const discoveredMarket = preflight.market_candidates[0]?.market ?? candidate?.business.primary_location;
  const initialPrimaryLocation = initialConfirmation?.business_identity.primary_location ?? candidate?.business.primary_location ?? discoveredMarket;
  const initialTargetMarket = initialConfirmation?.target_market ?? discoveredMarket ?? initialPrimaryLocation;
  const [businessName, setBusinessName] = useState(initialConfirmation?.business_identity.business_name ?? candidate?.business.business_name ?? "");
  const [operatingModel, setOperatingModel] = useState<BusinessIdentity["operating_model"]>(initialConfirmation?.business_identity.operating_model ?? candidate?.business.operating_model ?? "storefront");
  const [service, setService] = useState(initialConfirmation?.primary_service ?? preflight.service_candidates[0]?.value ?? "");
  const [location, setLocation] = useState(initialPrimaryLocation?.display_name ?? "");
  const [marketName, setMarketName] = useState(initialTargetMarket?.display_name ?? "");
  const [gbpUrl, setGbpUrl] = useState(initialConfirmation?.business_identity.public_gbp_url ?? candidate?.business.public_gbp_url ?? submittedGbpUrl ?? "");
  const [gbpError, setGbpError] = useState<string | null>(null);

  const primaryLocationBase = initialPrimaryLocation;
  const targetMarketBase = initialTargetMarket;
  const comparisons = candidate?.field_comparisons ?? [];
  const exactMatches = comparisons.filter((comparison) => displayStatus(comparison) === "exact_match").length;
  const hasMissingEvidence = comparisons.some((comparison) => displayStatus(comparison) === "error");
  const hasConflict = comparisons.some((comparison) => displayStatus(comparison) === "not_matched");
  const hasPartialMatch = comparisons.some((comparison) => displayStatus(comparison) === "partial_match");
  const verdict = !candidate
    ? { label: "Manual confirmation required", detail: "No complete public identity was formed automatically. Confirm every Case field below and provide a traceable GBP listing.", tone: "attention" as const }
    : hasConflict
      ? { label: "Identity conflict needs review", detail: "Observed website and public GBP values differ for at least one business field. Confirm the correct business and branch before continuing.", tone: "conflict" as const }
      : hasMissingEvidence
        ? { label: "Public evidence is incomplete", detail: "At least one field was not observed on one or both sources, or could not be checked. A missing observation does not establish a business mismatch. Confirm the Case details below.", tone: "attention" as const }
        : hasPartialMatch
          ? { label: "Identity partially overlaps", detail: "The sources appear related, but at least one field is not identical. Check the details before confirming the Case.", tone: "attention" as const }
          : { label: "Public identity is aligned", detail: "The checked website and GBP fields point to the same business. You still set the service and market the report should cover.", tone: "aligned" as const };

  function choose(index: number) {
    const next = preflight.identity_candidates[index];
    setSelectedIndex(index);
    if (!next) return;
    setBusinessName(next.business.business_name);
    setOperatingModel(next.business.operating_model);
    setLocation(next.business.primary_location.display_name);
    setMarketName(preflight.market_candidates[0]?.market.display_name ?? next.business.primary_location.display_name);
    setGbpUrl(next.business.public_gbp_url ?? submittedGbpUrl ?? "");
    setGbpError(null);
  }

  function market(displayName: string, baseMarket: TargetMarket | undefined): TargetMarket {
    const normalizedDisplayName = displayName.trim();
    if (baseMarket && normalizedDisplayName === baseMarket.display_name.trim()) {
      return { ...baseMarket, display_name: normalizedDisplayName };
    }
    return {
      display_name: normalizedDisplayName,
      country_code: baseMarket?.country_code ?? "US",
      region: null,
      city: null,
      postal_code: null,
      latitude: null,
      longitude: null,
    };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const confirmedGbpUrl = traceableGoogleMapsUrl(gbpUrl);
    if (!confirmedGbpUrl) {
      setGbpError("A full Google Maps business link with a place ID or cid is required before analysis.");
      return;
    }
    setGbpError(null);
    const primaryLocation = market(location, primaryLocationBase);
    onConfirm({
      business_identity: {
        business_name: businessName.trim(),
        site_url: preflight.normalized_site_url,
        normalized_domain: normalizedDomain(preflight.normalized_site_url),
        operating_model: operatingModel,
        primary_location: primaryLocation,
        public_gbp_url: confirmedGbpUrl,
      },
      primary_service: service.trim(),
      target_market: market(marketName, targetMarketBase),
    });
  }

  return (
    <section className="case-step-enter">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#718218]">02 / Confirm the business</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.045em] text-[#172017] sm:text-[42px]">Prove the website and public profile belong to the same business.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#657165]">We compare the available identity evidence. You resolve conflicts and define the service and market this Case will actually represent.</p>
        </div>
        <button type="button" onClick={onEditSource} className="inline-flex self-start items-center gap-2 text-sm font-bold text-[#657165] outline-none hover:text-[#1d271d] focus-visible:rounded-lg focus-visible:ring-4 focus-visible:ring-[#A5D020]/25"><PencilLine size={15} />Edit website</button>
      </div>

      {preflight.identity_candidates.length > 1 && (
        <fieldset className="mb-5 rounded-[22px] bg-[#e7ece3] p-5">
          <legend className="px-2 text-sm font-bold text-[#283228]">Choose the business identity to inspect</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {preflight.identity_candidates.map((item, index) => (
              <label key={`${item.business.business_name}-${index}`} className={`cursor-pointer rounded-2xl p-4 transition focus-within:ring-4 focus-within:ring-[#A5D020]/25 ${selectedIndex === index ? "bg-white shadow-[0_10px_28px_rgba(34,49,31,.08)]" : "hover:bg-white/55"}`}>
                <input type="radio" className="mr-2 accent-[#789b12]" checked={selectedIndex === index} onChange={() => choose(index)} />
                <span className="text-sm font-bold text-[#253025]">{item.business.business_name}</span>
                <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-[#849084]">{item.confidence} confidence</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className={`mb-6 grid overflow-hidden rounded-2xl border lg:grid-cols-[1fr_auto] ${verdict.tone === "conflict" ? "border-[#efdcd0] bg-[#fff8f3]" : "border-[#e3eae2] bg-white"}`}>
        <div className="px-6 py-6 sm:px-8 sm:py-7">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#668a50]"><SearchCheck size={15} />Identity verdict</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-[#1d2a22]">{verdict.label}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#647466]">{verdict.detail}</p>
        </div>
        <div className="grid grid-cols-2 gap-px bg-[#e3eae2] text-[#26432e] lg:min-w-[250px]">
          <div className="bg-[#f2f7f1] px-5 py-5 lg:grid lg:content-center"><span className="text-2xl font-semibold">{exactMatches}/{comparisons.length || 4}</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#718073]">fields aligned</span></div>
          <div className="bg-[#f2f7f1] px-5 py-5 lg:grid lg:content-center"><span className="text-2xl font-semibold">{candidate?.confidence ?? "—"}</span><span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#718073]">source confidence</span></div>
        </div>
      </div>

      {candidate ? (
        <section aria-labelledby="identity-evidence-title" className="mb-6 rounded-[24px] bg-white p-5 shadow-[0_18px_50px_rgba(31,39,27,0.06)] ring-1 ring-[#dfe4da] sm:p-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-[#718218]">Evidence reconciliation</p><h2 id="identity-evidence-title" className="mt-2 text-xl font-bold tracking-[-0.025em] text-[#1d281e]">Website and GBP, field by field.</h2></div>
            <p className="text-xs text-[#7b867b]">{comparisons.length} public fields compared</p>
          </div>
          <div className="hidden grid-cols-[160px_1fr_1fr_165px] gap-5 px-4 pb-3 text-[10px] font-bold uppercase tracking-[0.13em] text-[#929b92] sm:grid"><span>Identity field</span><span>Website evidence</span><span>Public GBP evidence</span><span>Result</span></div>
          <div className="divide-y divide-[#e9ede5]">
            {comparisons.map((comparison) => {
              const meta = statusMeta[displayStatus(comparison)];
              const Icon = meta.icon;
              return (
                <div key={comparison.field} className="grid gap-4 px-1 py-5 first:pt-4 sm:grid-cols-[160px_1fr_1fr_165px] sm:items-start sm:gap-5 sm:px-4">
                  <div><p className="text-sm font-bold text-[#263026]">{fieldLabel[comparison.field]}</p><p className="mt-1 text-[11px] leading-4 text-[#8a948a]">{comparison.reason}</p></div>
                  <div><span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#98a098] sm:hidden">Website</span><span className="flex items-start gap-2 text-sm leading-5 text-[#566156]"><Globe2 className="mt-0.5 hidden shrink-0 text-[#a1aaa1] lg:block" size={14} />{comparison.site_value ?? "Not found"}</span></div>
                  <div><span className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-[#98a098] sm:hidden">Public GBP</span><span className="flex items-start gap-2 text-sm leading-5 text-[#566156]"><MapPinned className="mt-0.5 hidden shrink-0 text-[#a1aaa1] lg:block" size={14} />{comparison.gbp_value ?? "Not found"}</span></div>
                  <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}><Icon size={13} />{meta.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="mb-6 flex gap-4 rounded-[22px] bg-[#fff6dc] p-5 text-sm leading-6 text-[#72560d]"><AlertCircle className="mt-0.5 shrink-0" size={20} /><div><p className="font-bold">Public identity needs manual confirmation.</p><p className="mt-1">Enter the client scope below. Missing GBP evidence remains a blocking gap until a full traceable listing URL is provided.</p></div></div>
      )}

      <form onSubmit={submit} className="rounded-[24px] bg-[#e8ede4] p-5 sm:p-7">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#607060]"><Store size={18} /></span><div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#718218]">SEO-confirmed scope</p><h2 className="mt-1 text-xl font-bold tracking-[-0.025em] text-[#202a20]">Define what this Case will analyze.</h2><p className="mt-1 max-w-xl text-xs leading-5 text-[#697569]">Your edits set the Case scope; they do not rewrite the public evidence above.</p></div></div>
          <span className="w-fit rounded-full bg-white/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#728072]">Required before competitors</span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-[20px] bg-white/70 p-5">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#718218]">Business identity</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field label="Business name"><input required value={businessName} onChange={(event) => setBusinessName(event.target.value)} className="field-input" /></Field>
              <Field label="Operating model"><select value={operatingModel} onChange={(event) => setOperatingModel(event.target.value as BusinessIdentity["operating_model"])} className="field-input"><option value="storefront">Storefront</option><option value="service_area">Service area</option><option value="hybrid">Hybrid</option></select></Field>
              <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2"><Field label="Public GBP"><div className="relative"><MapPinned aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#929b92]" size={16} /><input required type="url" aria-label="Public GBP" autoComplete="url" inputMode="url" value={gbpUrl} onChange={(event) => { setGbpUrl(event.target.value); setGbpError(null); }} aria-describedby={gbpError ? "business-gbp-error" : "business-gbp-help"} placeholder="https://www.google.com/maps?cid=..." className="field-input pl-10" /></div>{gbpError ? <p id="business-gbp-error" role="alert" className="mt-2 text-xs font-semibold leading-5 text-[#a3412c]">{gbpError}</p> : <p id="business-gbp-help" className="mt-2 text-xs leading-5 text-[#798479]">Use the full listing URL with a place ID or cid. A short share link is not traceable enough for the report.</p>}</Field></div>
            </div>
          </div>

          <div className="rounded-[20px] bg-white/70 p-5">
            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-[#718218]">Analysis scope</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="sm:col-span-2 lg:col-span-1 xl:col-span-2"><Field label="Primary service"><input required value={service} onChange={(event) => setService(event.target.value)} className="field-input" /></Field></div>
              <Field label="Primary location"><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[#929b92]" size={16} /><input required value={location} onChange={(event) => setLocation(event.target.value)} className="field-input pl-10" /></div></Field>
              <Field label="Target market"><input required value={marketName} onChange={(event) => setMarketName(event.target.value)} className="field-input" /></Field>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-xs leading-5 text-[#667266]">Changing this scope later invalidates earlier competitor results, so the next analysis never reuses evidence from a different business or market.</p>
          <button type="submit" className="group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#234b38] px-6 text-sm font-bold text-white outline-none transition hover:bg-[#2c6348] focus-visible:ring-4 focus-visible:ring-[#8ab49a]/40">{confirmLabel ?? "Confirm business scope"} <ArrowRight aria-hidden="true" size={16} className="transition-transform group-hover:translate-x-0.5" /></button>
        </div>
      </form>
    </section>
  );
}

function traceableGoogleMapsUrl(value: string): string | null {
  const raw = value.trim();
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    if (isLocalE2ETestMode() && host.endsWith(".invalid")) return raw;
    const supportedHost = host === "google.com" || host === "www.google.com" || host === "maps.google.com" || host === "search.google.com";
    const supportedPath = (host === "google.com" || host === "www.google.com")
      ? parsed.pathname.startsWith("/maps")
      : host === "search.google.com"
        ? parsed.pathname.startsWith("/local/")
        : true;
    if (parsed.protocol !== "https:" || !supportedHost || !supportedPath) return null;
    const hasCid = Boolean(parsed.searchParams.get("cid"));
    const hasPlaceId = ["destination_place_id", "query_place_id", "place_id", "placeid"]
      .some((key) => Boolean(parsed.searchParams.get(key)?.trim()));
    const hasDataId = /0x[0-9a-f]+:0x[0-9a-f]+/i.test(decodeURIComponent(raw));
    return hasCid || hasPlaceId || hasDataId ? raw : null;
  } catch {
    return null;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-[#687468]">{label}</span>{children}</label>;
}
