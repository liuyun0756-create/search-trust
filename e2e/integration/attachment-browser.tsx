import React from "react";
import {createRoot} from "react-dom/client";
import {ImplementationAttachments} from "../../src/components/report/ImplementationAttachments";
import {owner,target} from "../../src/lib/implementation-attachments/test-fixture";
const q=new URLSearchParams(location.search);
createRoot(document.getElementById("root")!).render(<main className="mx-auto max-w-3xl p-5 text-[#214532]">
  <h2 className="text-xl font-semibold">Improve the repair-service page</h2>
  <ImplementationAttachments ownerId={q.get("owner")??owner} target={{...target,revision:Number(q.get("revision")??1)}} readOnly={q.get("readonly")==="1"}/>
</main>);
