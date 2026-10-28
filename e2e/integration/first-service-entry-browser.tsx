import React from "react";
import {createRoot} from "react-dom/client";
import {FirstServiceEntry} from "../../src/components/cases/first-service-entry";
const params=new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(<main className="min-h-screen bg-[#f7faf7] p-5 text-[#1d2a22] sm:p-10"><div className="mx-auto max-w-5xl"><FirstServiceEntry caseId={params.get('case')!} ownerId={params.get('owner')!}/></div></main>);
