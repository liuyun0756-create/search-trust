// Isolated browser harness: real preparation components, synthetic client/source
// data, and test-only routing. No production auth, provider or billing calls.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { FirstServiceClient } from "../../src/components/cases/first-service-client";
import { FirstServiceConnections } from "../../src/components/cases/first-service-connections";
import { E2E_IDS } from "../fixtures/ids";

function Harness() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const update = () => setPath(location.pathname);
    window.addEventListener("setup-navigation", update);
    return () => window.removeEventListener("setup-navigation", update);
  }, []);
  return <main className="min-h-screen bg-[#f7faf7] px-5 py-12 text-[#1d2a22] sm:px-8"><div className="mx-auto max-w-5xl">
    {path.endsWith("/service-setup") ? <FirstServiceConnections gscSyncEnabled ga4SyncEnabled view={{
      caseId: path.split("/")[2], businessName: "SearchTrust E2E Plumbing", siteUrl: E2E_IDS.siteUrl,
      service: "Emergency plumbing", market: "Austin", publicProfile: "https://www.google.com/maps?cid=123456",
      sources: ["gsc", "ga4"].map((key) => ({ key: key as "gsc" | "ga4", title: key === "gsc" ? "Search Console" : "Google Analytics",
        status: "needs_resource", summary: "Select the resource that belongs to this client.", resource: null, fetchedAt: null, coverageStart: null, coverageEnd: null })),
    }} /> : <FirstServiceClient />}
  </div></main>;
}
createRoot(document.getElementById("root")!).render(<Harness />);
