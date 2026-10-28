import React from "react";
import {createRoot} from "react-dom/client";
import {Ga4SessionReading} from "../../src/components/report/Ga4SessionReading";
import {readingJob} from "../../src/lib/ga4-session-readings/test-fixture";
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-4xl p-4 text-[#214532]">
  <h1 className="mb-6 text-2xl font-semibold">Saved GA4 collection</h1><Ga4SessionReading job={readingJob()}/>
</main>);
