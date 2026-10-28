import React from "react";
import {createRoot} from "react-dom/client";
import {ComparisonChecks} from "../../src/components/report/ComparisonChecks";
import {record} from "../../src/lib/comparison-checks/test-fixture";
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-4xl p-4 text-[#214532]"><ComparisonChecks record={record} collectionsEnabled={new URLSearchParams(location.search).has("collections")} ga4CollectionsEnabled={new URLSearchParams(location.search).has("ga4")} actions={[{id:record.entries[0].action_id,title:"Improve the confirmed service page",target:record.entries[0].scope}]}/></main>);
