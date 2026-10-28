import { describe, it, expect, vi } from "vitest";
import { createReviewIntakeHandlers } from "./handler";
import { command, reviewJob } from "./contracts";
import { identity, start, job } from "./test-support";
function setup() {
  const deps = {
    enabled: () => true,
    intakeEnabled: () => true,
    user: async () =>
      ({ userId: identity.ownerId }) as { userId: string } | null,
    config: () => ({
      baseUrl: "https://internal.invalid",
      token: "test-server",
    }),
    fetch: vi.fn<typeof fetch>(async () => Response.json(job())),
  };
  return {
    deps,
    h: createReviewIntakeHandlers(deps),
    ctx: {
      params: Promise.resolve({
        id: identity.caseId,
        reportId: identity.reportId,
      }),
    },
  };
}
const req = (body: unknown = start, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/test", {
    method: "POST",
    headers: {
      origin: "http://127.0.0.1:3248",
      host: "127.0.0.1:3248",
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
describe("review generation owner boundary", () => {
  it("injects only the authenticated owner and route; validates safe status", async () => {
    const { deps, h, ctx } = setup();
    const r = await h.POST(req(), ctx);
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    const [url, init] = deps.fetch.mock.calls[0];
    expect(url).toBe("https://internal.invalid/api/v2/review-generation");
    expect(JSON.parse(String(init?.body))).toEqual({
      ...start,
      user_id: identity.ownerId,
      case_id: identity.caseId,
      report_id: identity.reportId,
    });
    expect(init?.redirect).toBe("error");
  });
  it.each([
    "off",
    "auth",
    "origin",
    "forwarded",
    "extra",
    "confirm",
    "duplicate",
    "oversize",
  ])("blocks %s before contacting backend", async (kind) => {
    const { deps, ctx } = setup();
    if (kind === "off") deps.enabled = () => false;
    if (kind === "auth") deps.user = async () => null;
    const h = createReviewIntakeHandlers(deps);
    let body: unknown = start;
    let heads: Record<string, string> = {};
    if (kind === "origin") heads = { origin: "https://evil.invalid" };
    if (kind === "forwarded")
      heads = {
        origin: "https://evil.invalid",
        "x-forwarded-host": "evil.invalid",
      };
    if (kind === "extra") body = { ...start, user_id: identity.ownerId };
    if (kind === "confirm") body = { ...start, confirmed: false };
    if (kind === "duplicate")
      body = '{"operation":"start","operation":"status"}';
    if (kind === "oversize") body = { data: "x".repeat(6000) };
    expect((await h.POST(req(body, heads), ctx)).status).toBe(
      kind === "off"
        ? 404
        : kind === "auth"
          ? 401
          : ["origin", "forwarded"].includes(kind)
            ? 403
            : 400,
    );
    expect(deps.fetch).not.toHaveBeenCalled();
  });
  it.each(["owner", "private", "charge", "selection"])(
    "rejects %s in a nominally successful response",
    async (kind) => {
      const { deps, h, ctx } = setup();
      const r = job() as unknown as Record<string, unknown>;
      if (kind === "owner") r.user_id = "bad";
      if (kind === "private") r.input_text = "secret";
      if (kind === "charge") r.credit_state = "consumed";
      if (kind === "selection") r.job_id = identity.ownerId;
      deps.fetch.mockResolvedValue(Response.json(r));
      expect((await h.POST(req(), ctx)).status).toBe(503);
    },
  );
  it("returns no task for bounded read and does not expose backend details", async () => {
    const { deps, h, ctx } = setup();
    deps.fetch.mockResolvedValueOnce(Response.json(null));
    const q = new URLSearchParams({
      operation: "status",
      job_id: job().job_id,
    });
    expect(
      await (await h.GET(new Request(`http://local/api?${q}`), ctx)).json(),
    ).toBeNull();
    deps.fetch.mockResolvedValue(
      Response.json({ message: "private SQL" }, { status: 500 }),
    );
    const r = await h.POST(req(), ctx);
    expect(r.status).toBe(503);
    expect(await r.text()).not.toContain("private SQL");
  });
  it("passes a known insufficient credit result, never treats a failed connection as a refund", async () => {
    const { deps, h, ctx } = setup();
    deps.fetch.mockResolvedValueOnce(
      Response.json({ code: "INSUFFICIENT_CREDITS" }, { status: 402 }),
    );
    expect((await h.POST(req(), ctx)).status).toBe(402);
    deps.fetch.mockRejectedValue(new Error("offline"));
    expect((await h.POST(req(), ctx)).status).toBe(503);
  });
  it("rejects duplicate query parameters and unsafe internal URLs", async () => {
    const { deps, ctx } = setup();
    deps.config = () => ({
      baseUrl: "https://user:password@internal.invalid",
      token: "test",
    });
    expect(
      (await createReviewIntakeHandlers(deps).POST(req(), ctx)).status,
    ).toBe(503);
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(
      (
        await createReviewIntakeHandlers(deps).GET(
          new Request("http://local/?operation=find&operation=status"),
          ctx,
        )
      ).status,
    ).toBe(400);
  });
  it("keeps all lifecycle pairs consistent", () => {
    const r = job();
    expect(command(start) && reviewJob(r, identity, start)).toBe(true);
    r.status = "succeeded";
    expect(reviewJob(r, identity, start)).toBe(false);
    r.report_id = r.job_id;
    r.credit_state = "consumed";
    expect(reviewJob(r, identity, start)).toBe(true);
    r.status = "failed";
    r.report_id = null;
    r.credit_state = "compensated";
    r.error_code = "TECHNICAL_FAILURE";
    expect(reviewJob(r, identity, start)).toBe(true);
  });
});

describe("paused review intake", () => {
  it("checks the exact existing job without sending a start while paused", async () => {
    const { deps, ctx } = setup();
    deps.intakeEnabled = () => false;
    const r = await createReviewIntakeHandlers(deps).POST(req(), ctx);
    expect(r.status).toBe(200);
    expect(JSON.parse(String(deps.fetch.mock.calls[0][1]?.body))).toEqual({
      operation: "status",
      job_id: job().job_id,
      user_id: identity.ownerId,
      case_id: identity.caseId,
      report_id: identity.reportId,
    });
  });
  it("returns the standard pause when no saved job exists and never calls start", async () => {
    const { deps, ctx } = setup();
    deps.intakeEnabled = () => false;
    deps.fetch.mockResolvedValue(Response.json(null));
    const r = await createReviewIntakeHandlers(deps).POST(req(), ctx);
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({
      error: { code: "V22_PUBLIC_ENTRY_PAUSED" },
    });
    expect(r.headers.get("retry-after")).toBe("300");
    expect(deps.fetch).toHaveBeenCalledOnce();
  });
  it("keeps ordinary status reads available and refuses mismatched recovered content", async () => {
    const { deps, ctx } = setup();
    deps.intakeEnabled = () => false;
    const h = createReviewIntakeHandlers(deps);
    const q = new URLSearchParams({
      operation: "status",
      job_id: job().job_id,
    });
    expect((await h.GET(new Request(`http://local/?${q}`), ctx)).status).toBe(
      200,
    );
    const r = job();
    r.selection.decision_checksum = "sha256:" + "f".repeat(64);
    deps.fetch.mockResolvedValue(Response.json(r));
    expect((await h.POST(req(), ctx)).status).toBe(503);
  });
});
