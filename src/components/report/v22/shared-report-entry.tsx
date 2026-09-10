"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle } from "lucide-react";

import type { ClientReportV22ViewModel } from "@/lib/report-v22/view-model";
import { isReportShareToken } from "@/lib/report-shares/tokens";

import { SharedClientReportShell } from "./shared-client-report-shell";

type ResolvedShare = { report: ClientReportV22ViewModel };

export function SharedReportEntry() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; report: ClientReportV22ViewModel; token: string }
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
      .then(({ report }) => setState({ status: "ready", report, token }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error" });
      });

    return () => controller.abort();
  }, []);

  if (state.status === "ready") {
    return <SharedClientReportShell report={state.report} token={state.token} />;
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-[#f4f1e8] px-5">
      <div className="max-w-md rounded-3xl border border-[#dce1d3] bg-white p-8 text-center shadow-sm">
        {state.status === "loading" ? (
          <>
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#7fa60d]" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-black text-[#172019]">Opening secure report</h1>
            <p className="mt-3 text-sm leading-6 text-[#667064]">Checking this private, read-only share link.</p>
          </>
        ) : (
          <>
            <AlertTriangle className="mx-auto h-8 w-8 text-[#a8640a]" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-black text-[#172019]">This report link is unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-[#667064]">The link may be incomplete, expired, or revoked. Ask the sender for a new link.</p>
          </>
        )}
      </div>
    </div>
  );
}
