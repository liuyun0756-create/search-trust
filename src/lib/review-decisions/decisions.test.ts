import { describe, it, expect, vi } from "vitest";
import fixture from "./contracts/fixture.json";
import {
  parseCommand,
  parseResponse,
  parseSave,
  revisionFits,
  verifyHashes,
} from "./contracts";
import { strictJson } from "./json";
import {
  blank,
  getDecision,
  changeType,
  makeRequest,
  parseLocation,
  readMarker,
  validateDraft,
} from "./draft";
import { createDecisionHandlers } from "./handler";
import { isDecisionWorkspaceEnabled } from "./config";
import type { Context, Revision, Command, SaveDecision } from "./types";
const c = fixture.context as Context,
  r = fixture.revision as Revision,
  s = fixture.request as SaveDecision;
const identity = {
  user_id: r.user_id,
  case_id: r.case_id,
  report_id: r.report_id,
};
const cmd = (operation: "context" | "history" | "read", other = {}) =>
  ({ ...identity, operation, review_id: r.review_id, ...other }) as Command;
describe("decision contracts", () => {
  it("treats inherited object names as undecided action IDs", () => {
    const context = structuredClone(c);
    context.approved[0].action_id = "__proto__";
    expect(getDecision({}, "__proto__")).toBeUndefined();
    expect(getDecision({}, "constructor")).toBeUndefined();
    expect(makeRequest({}, context, null, s.id).decisions).toEqual([]);
    const d = {
      ...blank("__proto__", "continue"),
      reason: "Keep the approved work",
    };
    expect(getDecision({ [d.action_id]: d }, d.action_id)).toEqual(d);
  });
  it("accepts exported context, exact receipt and verified hashes", async () => {
    expect(parseResponse(c, cmd("context"))).toEqual(c);
    expect(parseResponse(r, cmd("read", { decision_id: r.id }))).toEqual(r);
    expect(revisionFits(r, c)).toBe(true);
    expect(await verifyHashes(r)).toBe(true);
  });
  it.each(["review_id", "user_id", "report_id", "case_id"])(
    "rejects foreign %s",
    (key) => {
      expect(
        parseResponse(
          { ...r, [key]: "10000000-0000-4000-8000-000000000099" },
          cmd("read", { decision_id: r.id }),
        ),
      ).toBeNull();
    },
  );
  it("rejects changed reference catalogs and approval identity", () => {
    const changed = structuredClone(c);
    changed.references[0].id = "page:missing";
    expect(parseResponse(changed, cmd("context"))).toBeNull();
    changed.references = c.references;
    changed.approved[0].title = "wrong";
    expect(parseResponse(changed, cmd("context"))).toBeNull();
  });
  it.each([
    '{"a":1,"a":2}',
    '{"a":1,"\\u0061":2}',
    '{"x":{"a":1,"a":2}}',
    '{"v":NaN}',
    '{"v":1e999}',
    '{"x":1,}',
    "[1,]",
    "true false",
  ])("rejects invalid JSON %s", (raw) =>
    expect(() => strictJson(raw)).toThrow(),
  );
  it("accepts escaped strings and independent object keys", () =>
    expect(strictJson('{"a":"quote\\\"","b":[{"a":1},{"a":2}]}')).toEqual({
      a: 'quote"',
      b: [{ a: 1 }, { a: 2 }],
    }));
  it("requires fields and rejects unapproved observe and foreign references", () => {
    const a = c.approved[0].action_id,
      d = changeType(a, "adjust", c);
    d.reason = "Explain why";
    expect(validateDraft({ [a]: d }, c)).toHaveLength(1);
    d.references = [c.references[0].id];
    expect(validateDraft({ [a]: d }, c)).toEqual([]);
    d.references = ["other"];
    expect(validateDraft({ [a]: d }, c)).toHaveLength(1);
    const changed = structuredClone(c);
    changed.evidence.actions[0]!.recorded_work.state = "not_recorded";
    expect(
      validateDraft(
        {
          [a]: {
            ...blank(a, "observe"),
            reason: "Done",
            completion_statement: "I checked it",
          },
        },
        changed,
      ),
    ).toHaveLength(1);
  });
  it("supports clear and empty decisions, enforces active maximum", () => {
    expect(parseSave(makeRequest({}, c, null, s.id))).toBeTruthy();
    const ds = Object.fromEntries(
      [1, 2, 3, 4].map((i) => [
        "new" + i,
        {
          ...blank("new" + i, "new"),
          reason: "why",
          target: "page",
          work: "work",
          references: [c.references[0].id],
        },
      ]),
    );
    expect(validateDraft(ds, c).length).toBeGreaterThan(0);
  });
  it("does not coerce blank, unknown, overlong or incompatible fields", () => {
    for (const patch of [
      { reason: " " },
      { reason: "x".repeat(1201) },
      { other: true },
      { work: "unexpected" },
      { completion_statement: "extra" },
    ])
      expect(
        parseSave({ ...s, decisions: [{ ...s.decisions[0], ...patch }] }),
      ).toBeNull();
    expect(parseCommand({ ...cmd("context"), raw_bundle: {} })).toBeNull();
  });
  it("bounds full UTF8 size and uses Unicode character count", () => {
    expect(
      parseSave({
        ...s,
        decisions: [{ ...s.decisions[0], reason: "😀".repeat(1200) }],
      }),
    ).toBeTruthy();
    expect(
      parseSave({
        ...s,
        decisions: [{ ...s.decisions[0], reason: "😀".repeat(1201) }],
      }),
    ).toBeNull();
  });
  it("validates history chain and does not hide a truncated page", () => {
    const row = {
      id: r.id,
      revision: 1,
      previous_id: null,
      recorded_at: r.recorded_at,
      checksum: r.checksum,
      decision_count: 1,
    };
    const h = {
      review_id: r.review_id,
      report_id: r.report_id,
      items: [row],
      next_cursor: null,
    };
    expect(parseResponse(h, cmd("history"))).toEqual(h);
    expect(
      parseResponse(
        {
          ...h,
          items: [
            {
              ...row,
              revision: 2,
              previous_id: "10000000-0000-4000-8000-000000000099",
            },
          ],
        },
        cmd("history"),
      ),
    ).toBeNull();
  });
  it("checks exact location and minimal recovery identity", () => {
    expect(parseLocation({ reviewId: r.review_id })).toEqual({
      reviewId: r.review_id,
    });
    expect(parseLocation({ reviewId: [r.review_id] })).toBeNull();
    expect(parseLocation({ reviewId: r.review_id, other: "1" })).toBeNull();
    const i = { ownerId: r.user_id, caseId: r.case_id, reportId: r.report_id },
      m = { ...i, reviewId: r.review_id, requestId: r.id };
    expect(
      readMarker({ getItem: () => JSON.stringify(m) }, i, r.review_id),
    ).toEqual(m);
    expect(
      readMarker(
        { getItem: () => JSON.stringify({ ...m, reason: "private" }) },
        i,
        r.review_id,
      ),
    ).toBeNull();
  });
});
function setup() {
  const upstream = vi.fn(async () => Response.json(r));
  return {
    upstream,
    api: createDecisionHandlers({
      enabled: () => true,
      user: async () => ({ userId: r.user_id }),
      config: () => ({ baseUrl: "https://backend.invalid", token: "local" }),
      fetch: upstream,
    }),
  };
}
const params = {
  params: Promise.resolve({ id: r.case_id, reportId: r.report_id }),
};
const post = (body: unknown) =>
  new Request("http://local/api", {
    method: "POST",
    headers: { origin: "http://local", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
describe("private decision BFF", () => {
  it("injects identity, validates receipt and never caches", async () => {
    const { api, upstream } = setup();
    const response = await api.POST(
      post({ operation: "save", request: s }),
      params,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const options = upstream.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(options[1].body as string)).toMatchObject(identity);
    expect(options[1].redirect).toBe("error");
  });
  it("rejects duplicate keys, foreign owner and cross origin before forwarding", async () => {
    const { api, upstream } = setup();
    expect(
      (
        await api.POST(
          post({ operation: "save", request: s, user_id: r.user_id }),
          params,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await api.POST(
          new Request("http://local/api", {
            method: "POST",
            headers: {
              origin: "https://evil",
              "content-type": "application/json",
            },
            body: "{}",
          }),
          params,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await api.POST(
          new Request("http://local/api", {
            method: "POST",
            headers: {
              origin: "http://local",
              "content-type": "application/json",
            },
            body: '{"operation":"save","operation":"save"}',
          }),
          params,
        )
      ).status,
    ).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("makes tampered success and oversized response an unknown result", async () => {
    const { api, upstream } = setup();
    upstream.mockImplementation(async () =>
      Response.json({ ...r, checksum: "sha256:" + "0".repeat(64) }),
    );
    expect(
      (await api.POST(post({ operation: "save", request: s }), params)).status,
    ).toBe(503);
    upstream.mockImplementation(async () => new Response(" ".repeat(131073)));
    expect(
      (await api.POST(post({ operation: "save", request: s }), params)).status,
    ).toBe(503);
  });
  it("keeps stale errors safe and validates GET parameters", async () => {
    const { api, upstream } = setup();
    upstream.mockImplementation(async () =>
      Response.json({ code: "STALE" }, { status: 409 }),
    );
    expect(
      (await api.POST(post({ operation: "save", request: s }), params)).status,
    ).toBe(409);
    expect(
      (
        await api.GET(
          new Request(
            `http://local/api?operation=history&review_id=${r.review_id}&cursor=01`,
          ),
          params,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await api.GET(
          new Request(
            `http://local/api?operation=history&operation=read&review_id=${r.review_id}`,
          ),
          params,
        )
      ).status,
    ).toBe(400);
  });
  it("is default off and authenticates before doing work", async () => {
    const off = createDecisionHandlers({
      enabled: () => false,
      user: async () => null,
      config: () => null,
    });
    expect((await off.POST(post({}), params)).status).toBe(404);
    const unauth = createDecisionHandlers({
      enabled: () => true,
      user: async () => null,
      config: () => null,
    });
    expect(
      (await unauth.GET(new Request("http://local/api"), params)).status,
    ).toBe(401);
    expect(isDecisionWorkspaceEnabled()).toBe(false);
  });
});
