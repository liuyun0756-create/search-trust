"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";

import type { ClientReportV22ViewModel } from "@/lib/report-v22/view-model";
import { isReportShareToken } from "@/lib/report-shares/token-format";

import { SharedClientReportShell } from "./shared-client-report-shell";
import { CapabilitySharedReport } from "../CapabilitySharedReport";
import type { ApprovedCapabilityDelivery } from "@/lib/report-capability/delivery";
import {ReviewSharedReport} from "../review-delivery/ReviewSharedReport";
import type {ReviewClientDocument} from "@/lib/review-reports/projection";

type ResolvedShare = { report: ClientReportV22ViewModel;schemaVersion?:never } | {schemaVersion:"2.2.2";delivery:ApprovedCapabilityDelivery} | {schemaVersion:"2.2.3";delivery:ReviewClientDocument};

export function SharedReportEntry() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; value:ResolvedShare; token: string }
  >({ status: "loading" });

  useEffect(() => {
    const token = window.location.hash.slice(1);
    if (!isReportShareToken(token)) {
      setState({ status: "error" });
      return;
    }

    const controller = new AbortController();
    void fetch("/api/share/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("SHARE_NOT_FOUND");
        return response.json() as Promise<ResolvedShare>;
      })
      .then(value => setState({ status: "ready", value, token }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error" });
      });

    return () => controller.abort();
  }, []);

  if (state.status === "ready") {
    if(state.value.schemaVersion==="2.2.3")return <ReviewSharedReport delivery={state.value.delivery} token={state.token}/>;
    if(state.value.schemaVersion==="2.2.2")return <CapabilitySharedReport delivery={state.value.delivery} token={state.token}/>;
    return <SharedClientReportShell report={state.value.report} token={state.token} />;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#f7faf7] px-5">
      <div className="max-w-md rounded-2xl border border-[#e3eae2] bg-white p-8 text-center">
        {state.status === "loading" ? (
          <>
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#57805b]" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-bold text-[#1d2a22]">Opening secure report</h1>
            <p className="mt-3 text-sm leading-6 text-[#667064]">Checking this private, read-only share link.</p>
          </>
        ) : (
          <>
            <AlertTriangle className="mx-auto h-8 w-8 text-[#a8640a]" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-bold text-[#1d2a22]">This report link is unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-[#667064]">The link may be incomplete, expired, or revoked. Ask the sender for a new link.</p>
          </>
        )}
      </div>
    </div>
  );
}
