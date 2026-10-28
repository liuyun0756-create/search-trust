"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LockKeyhole, RefreshCw } from "lucide-react";
import { GoogleResourceSelector } from "@/components/google/google-resource-selector";
import type { FirstServiceSetupView } from "@/lib/first-service-setup/view";
import { FirstServiceEntry } from "./first-service-entry";

export function FirstServiceConnections({
  view,
  gscSyncEnabled,
  ga4SyncEnabled,
  entryOwnerId,
  intakeEnabled = true,
  planningEnabled = false,
}: {
  view: FirstServiceSetupView;
  gscSyncEnabled: boolean;
  ga4SyncEnabled: boolean;
  entryOwnerId?: string;
  intakeEnabled?: boolean;
  planningEnabled?: boolean;
}) {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-[#668a50]">
          First service / preparation
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          Connect evidence for {view.businessName}.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[#657267]">
          Keep this client in one Case. Confirm the matching Search Console and
          GA4 resources, then sync each source. No Prospect report is required
          for this preparation.
        </p>
      </header>
      <ol
        aria-label="First-service setup steps"
        className="grid gap-px overflow-hidden rounded-2xl border border-[#d7e4d2] bg-[#d7e4d2] text-sm sm:grid-cols-3"
      >
        <li className="flex items-center gap-3 bg-white p-5">
          <Check size={18} aria-hidden="true" />
          01 · Client saved
        </li>
        <li
          aria-current="step"
          className="bg-[#26432e] p-5 font-semibold text-white"
        >
          02 · Connect and check data
        </li>
        <li className="flex items-center gap-3 bg-[#edf4e9] p-5 text-[#657267]">
          <LockKeyhole size={16} aria-hidden="true" />
          03 ·{" "}
          {entryOwnerId
            ? intakeEnabled
              ? "Review scope & start"
              : "Continue saved analysis"
            : "Analysis not yet available"}
        </li>
      </ol>
      <section
        aria-labelledby="service-scope"
        className="rounded-2xl border border-[#d7e4d2] bg-white p-6"
      >
        <h2 id="service-scope" className="text-lg font-semibold">
          The scope you saved
        </h2>
        <dl className="mt-4 grid gap-5 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[#657267]">Website</dt>
            <dd className="mt-1 break-all font-medium">{view.siteUrl}</dd>
          </div>
          <div>
            <dt className="text-[#657267]">Service</dt>
            <dd className="mt-1 font-medium">{view.service}</dd>
          </div>
          <div>
            <dt className="text-[#657267]">Target location</dt>
            <dd className="mt-1 font-medium">{view.market}</dd>
          </div>
        </dl>
        <div className="mt-5 border-t border-[#e1e9df] pt-4 text-sm leading-6">
          <p className="font-semibold">
            Public Business Profile ·{" "}
            {view.publicProfile
              ? "link saved, evidence pending"
              : "link still needed"}
          </p>
          {view.publicProfile && (
            <p className="mt-1 break-all text-[#657267]">
              {view.publicProfile}
            </p>
          )}
          <p className="mt-2 text-[#657267]">
            Saving a profile link does not verify its contents. Public website,
            profile and competitor evidence will be collected as part of the
            first-service workflow. No separate Prospect purchase is needed.
          </p>
        </div>
      </section>
      <section aria-labelledby="service-source-status">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <h2 id="service-source-status" className="text-xl font-semibold">
            Your data connections
          </h2>
          <button
            disabled={refreshing}
            onClick={refresh}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#bdcdbd] px-4 text-sm font-semibold disabled:opacity-50"
          >
            <RefreshCw size={15} aria-hidden="true" />
            {refreshing ? "Refreshing…" : "Refresh status"}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {view.sources.map((source) => (
            <article
              key={source.key}
              className="rounded-2xl border border-[#d7e4d2] bg-white p-6"
            >
              <h3 className="text-lg font-semibold">{source.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#657267]">
                {source.summary}
              </p>
              {source.resource && (
                <p className="mt-3 break-all text-sm font-semibold">
                  {source.resource}
                </p>
              )}
              {source.coverageStart && source.coverageEnd && (
                <p className="mt-2 text-xs leading-5 text-[#657267]">
                  Coverage: {source.coverageStart} – {source.coverageEnd}
                </p>
              )}
              {source.fetchedAt && (
                <p className="mt-1 text-xs leading-5 text-[#657267]">
                  Last collected: {source.fetchedAt}
                </p>
              )}
            </article>
          ))}
        </div>
        <p className="mt-3 text-xs leading-5 text-[#657267]">
          Source health is a preparation check, not approval to generate a
          report. Scope, freshness, competitors and available credit must be
          checked again at analysis start.
        </p>
      </section>
      <GoogleResourceSelector
        caseId={view.caseId}
        businessName={view.businessName}
        siteUrl={view.siteUrl}
        embedded
        returnTo="service-setup"
        gscSyncEnabled={gscSyncEnabled}
        ga4SyncEnabled={ga4SyncEnabled}
        onStateChanged={refresh}
      />
      {entryOwnerId ? (
        <FirstServiceEntry
          caseId={view.caseId}
          ownerId={entryOwnerId}
          planningEnabled={planningEnabled}
          intakeEnabled={intakeEnabled}
        />
      ) : (
        <section
          aria-labelledby="service-start-boundary"
          className="rounded-2xl bg-[#eaf2e9] p-6 sm:p-8"
        >
          <h2 id="service-start-boundary" className="text-xl font-semibold">
            Your first diagnosis stays one piece of work.
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#526857]">
            Setup, authorization and data synchronization do not start a paid
            report. Once the first-service entry is available, you will confirm
            one 1-credit analysis covering the public and connected evidence.
          </p>
          <button
            disabled
            aria-describedby="first-service-unavailable"
            className="mt-5 inline-flex min-h-12 items-center gap-3 rounded-xl bg-[#d7e2d4] px-5 text-sm font-semibold text-[#526857]"
          >
            <LockKeyhole size={16} aria-hidden="true" />
            First-service analysis · not yet available
          </button>
          <p
            id="first-service-unavailable"
            className="mt-3 max-w-3xl text-xs leading-6 text-[#526857]"
          >
            Competitor preparation and the single-credit start are not connected
            to this page yet. No charge is made here. A completed diagnosis will
            use 1 credit even when the evidence supports no action; a technical
            failure returns that credit once.
          </p>
        </section>
      )}
    </div>
  );
}
