"use client";

import { AlertCircle, CheckCircle2, HelpCircle, MapPin, MinusCircle, Phone, Store } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import type { BusinessIdentity, TargetMarket } from "@/lib/report-v22/generated/types";
import type { BusinessConfirmation, IdentityComparisonStatus, PreflightResponse } from "@/lib/preflight-v22";

interface BusinessMatchStepProps {
  preflight: PreflightResponse;
  onConfirm(value: BusinessConfirmation): void;
  onEditSource(): void;
}

const statusMeta: Record<IdentityComparisonStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  exact_match: { label: "Exact match", className: "bg-[#edf7d5] text-[#56720c]", icon: CheckCircle2 },
  partial_match: { label: "Partial match", className: "bg-[#fff6d9] text-[#8a6500]", icon: HelpCircle },
  not_matched: { label: "Not matched", className: "bg-[#fff0e8] text-[#a44328]", icon: MinusCircle },
  error: { label: "Missing / error", className: "bg-[#fbe9e7] text-[#a3332b]", icon: AlertCircle },
};

const fieldLabel = { business_name: "Business name", phone: "Phone", address: "Address", service_area: "Service area" };

function normalizedDomain(url: string) {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; }
}

export function BusinessMatchStep({ preflight, onConfirm, onEditSource }: BusinessMatchStepProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const candidate = preflight.identity_candidates[selectedIndex];
  const initialMarket = candidate?.business.primary_location ?? preflight.market_candidates[0]?.market;
  const [businessName, setBusinessName] = useState(candidate?.business.business_name ?? "");
  const [operatingModel, setOperatingModel] = useState<BusinessIdentity["operating_model"]>(candidate?.business.operating_model ?? "storefront");
  const [service, setService] = useState(preflight.service_candidates[0]?.value ?? "");
  const [location, setLocation] = useState(initialMarket?.display_name ?? "");
  const [marketName, setMarketName] = useState(preflight.market_candidates[0]?.market.display_name ?? initialMarket?.display_name ?? "");

  const baseMarket = useMemo(() => preflight.market_candidates[0]?.market ?? initialMarket, [initialMarket, preflight.market_candidates]);

  function choose(index: number) {
    const next = preflight.identity_candidates[index];
    setSelectedIndex(index);
    if (!next) return;
    setBusinessName(next.business.business_name);
    setOperatingModel(next.business.operating_model);
    setLocation(next.business.primary_location.display_name);
    setMarketName(preflight.market_candidates[0]?.market.display_name ?? next.business.primary_location.display_name);
  }

  function market(displayName: string): TargetMarket {
    return {
      display_name: displayName.trim(),
      country_code: baseMarket?.country_code ?? "US",
      region: baseMarket?.region ?? null,
      city: baseMarket?.city ?? null,
      postal_code: baseMarket?.postal_code ?? null,
      latitude: baseMarket?.latitude ?? null,
      longitude: baseMarket?.longitude ?? null,
    };
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const primaryLocation = market(location);
    onConfirm({
      business_identity: {
        business_name: businessName.trim(),
        site_url: preflight.normalized_site_url,
        normalized_domain: normalizedDomain(preflight.normalized_site_url),
        operating_model: operatingModel,
        primary_location: primaryLocation,
        public_gbp_url: candidate?.business.public_gbp_url ?? null,
      },
      primary_service: service.trim(),
      target_market: market(marketName),
    });
  }

  return (
    <section>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#718218]">Step 2 of 4</p>
          <h1 className="text-3xl font-bold tracking-[-0.035em] text-[#172017] sm:text-[38px]">Confirm the business match.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#657165]">We compare website facts with public Google Business Profile data. You stay in control of the final scope.</p>
        </div>
        <button type="button" onClick={onEditSource} className="self-start text-sm font-bold text-[#657165] underline decoration-[#b5c1b0] underline-offset-4 hover:text-[#1d271d]">Edit website</button>
      </div>

      {preflight.identity_candidates.length > 1 && (
        <fieldset className="mb-5 rounded-2xl border border-[#dfe4da] bg-white p-5">
          <legend className="px-2 text-sm font-bold text-[#283228]">Possible business identities</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {preflight.identity_candidates.map((item, index) => (
              <label key={`${item.business.business_name}-${index}`} className={`cursor-pointer rounded-xl border p-3 ${selectedIndex === index ? "border-[#8caf1b] bg-[#f5fadf]" : "border-[#e0e5dc]"}`}>
                <input type="radio" className="mr-2 accent-[#789b12]" checked={selectedIndex === index} onChange={() => choose(index)} />
                <span className="text-sm font-bold text-[#253025]">{item.business.business_name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {candidate ? (
        <div className="mb-6 overflow-hidden rounded-2xl border border-[#dfe4da] bg-white">
          <div className="grid grid-cols-[1fr_auto] items-center border-b border-[#e5e9e1] bg-[#fafbf8] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#778177] sm:grid-cols-[150px_1fr_1fr_auto]">
            <span className="hidden sm:block">Field</span><span>Website</span><span className="hidden sm:block">Public GBP</span><span>Result</span>
          </div>
          {candidate.field_comparisons.map((comparison) => {
            const meta = statusMeta[comparison.status];
            const Icon = meta.icon;
            return (
              <div key={comparison.field} className="grid grid-cols-1 gap-3 border-b border-[#edf0ea] px-5 py-4 last:border-b-0 sm:grid-cols-[150px_1fr_1fr_auto] sm:items-center">
                <div className="text-sm font-bold text-[#263026]">{fieldLabel[comparison.field]}</div>
                <div><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#98a098] sm:hidden">Website</span><span className="text-sm text-[#566156]">{comparison.site_value ?? "Not found"}</span></div>
                <div><span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-[#98a098] sm:hidden">Public GBP</span><span className="text-sm text-[#566156]">{comparison.gbp_value ?? "Not found"}</span></div>
                <span title={comparison.reason} className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}><Icon size={13} />{meta.label}</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-[#e3c985] bg-[#fff9e8] p-5 text-sm leading-6 text-[#72560d]">
          We couldn’t form a complete public identity automatically. Enter the confirmed client scope below to continue; missing GBP coverage will remain visible as a gap.
        </div>
      )}

      <form onSubmit={submit} className="rounded-2xl border border-[#dfe4da] bg-white p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#edf3e5] text-[#607060]"><Store size={18} /></span><div><h2 className="font-bold text-[#202a20]">Confirmed report scope</h2><p className="text-xs text-[#7d877d]">Editing these fields invalidates any prior competitor search.</p></div></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name"><input required value={businessName} onChange={(event) => setBusinessName(event.target.value)} className="field-input" /></Field>
          <Field label="Operating model"><select value={operatingModel} onChange={(event) => setOperatingModel(event.target.value as BusinessIdentity["operating_model"])} className="field-input"><option value="storefront">Storefront</option><option value="service_area">Service area</option><option value="hybrid">Hybrid</option></select></Field>
          <Field label="Primary service"><input required value={service} onChange={(event) => setService(event.target.value)} className="field-input" /></Field>
          <Field label="Primary location"><div className="relative"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-[#929b92]" size={16} /><input required value={location} onChange={(event) => setLocation(event.target.value)} className="field-input pl-10" /></div></Field>
          <Field label="Target market"><input required value={marketName} onChange={(event) => setMarketName(event.target.value)} className="field-input" /></Field>
          <Field label="Public GBP"><div className="flex min-h-11 items-center gap-2 rounded-xl border border-[#d5dcd0] bg-[#f8faf6] px-3 text-sm text-[#637063]"><Phone size={15} />{candidate?.business.public_gbp_url ? "Profile identified" : "Not identified — coverage limited"}</div></Field>
        </div>
        <div className="mt-6 flex justify-end"><button type="submit" className="min-h-12 rounded-xl bg-[#1a211a] px-6 text-sm font-bold text-white outline-none hover:bg-black focus-visible:ring-4 focus-visible:ring-[#A5D020]/40">Confirm & find competitors <span aria-hidden="true">→</span></button></div>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-[#687468]">{label}</span>{children}</label>;
}
