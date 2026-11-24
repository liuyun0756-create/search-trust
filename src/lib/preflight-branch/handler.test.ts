import {createHmac} from "node:crypto";
import {describe, expect, it, vi} from "vitest";
import {createPreflightBranchHandler} from "./handler";

const owner = "11111111-1111-4111-8111-111111111111";
const caseId = "22222222-2222-4222-8222-222222222222";
const rowId = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-11-23T12:00:00Z").getTime();
const key = "local-synthetic-key";
const url = "https://www.google.com/maps?cid=42";
const expires = "2026-11-23T12:15:00Z";

function body(expiry = expires) {
  const evidence = {observed_at:"2026-11-23T11:59:00Z",expires_at:expiry,public_gbp_url:url};
  const encoded = Buffer.from(JSON.stringify(evidence)).toString("base64url");
  const sig = createHmac("sha256", key).update("v22-preflight-branch:" + encoded).digest("hex");
  return {request_id:rowId,evidence_token:encoded+"."+sig,reason:"  The saved domain matches  ",
    customers_can_visit:false,operating_mode:null};
}
function request(input: object, origin = "https://app.example") {
  return new Request("https://app.example/api/branch-confirmation", {method:"POST",
    headers:{origin,"content-type":"application/json"},body:JSON.stringify(input)});
}

describe("preflight branch confirmation", () => {
  it("saves only server-signed evidence against the authenticated owner and route Case", async () => {
    const save = vi.fn(async () => ({data:{id:rowId,case_id:caseId,revision:1,expires_at:expires,public_gbp_url:url},error:null}));
    const handle = createPreflightBranchHandler({user:async()=>({userId:owner}),key:()=>key,now:()=>now,save});
    const response = await handle(request(body()),{params:Promise.resolve({id:caseId})});
    expect(response.status).toBe(200);
    expect(save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({p_user_id:owner,p_case_id:caseId,
      p_reason:"The saved domain matches",p_operating_mode:null,p_customers_can_visit:false}));
  });
  it("rejects expired or changed evidence and cross-origin requests before saving", async () => {
    const save = vi.fn();
    const handle = createPreflightBranchHandler({user:async()=>({userId:owner}),key:()=>key,now:()=>now,save});
    const ctx = {params:Promise.resolve({id:caseId})};
    expect((await handle(request(body("2026-11-23T12:00:00Z")),ctx)).status).toBe(409);
    const altered = body();
    altered.evidence_token = "x" + altered.evidence_token;
    expect((await handle(request(altered),ctx)).status).toBe(400);
    expect((await handle(request(body(),"https://cross-site.example"),ctx)).status).toBe(403);
    expect(save).not.toHaveBeenCalled();
  });
});
