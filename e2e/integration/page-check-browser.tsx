import React from "react";
import {createRoot} from "react-dom/client";
import {PageChecks} from "../../src/components/report/PageChecks";
import {owner, target} from "../../src/lib/page-checks/test-fixture";

const query = new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-4xl p-4 text-[#214532]">
  <PageChecks ownerId={query.get("owner") ?? owner} {...target} deliveryRevisionId={query.get("delivery") ?? target.deliveryRevisionId}/>
</main>);
