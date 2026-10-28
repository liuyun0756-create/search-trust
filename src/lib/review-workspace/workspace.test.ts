import { describe, it, expect, vi } from "vitest";
import fixture from "./contracts/fixture.json";
import { parseCommand, parseResponse, parseSelection } from "./contracts";
import { parseLocation } from "./navigation";
import { createReviewWorkspaceHandlers } from "./handler";
import type { ReviewFreezeSelection } from "./types";
const v = fixture.view,
  id = {
    user_id: "10000000-0000-4000-8000-000000000001",
    case_id: v.case_id,
    report_id: v.report_id,
  };
const read = { operation: "read", review_id: v.review_id, ...id };
const command = () => parseCommand(read)!;
describe("review workspace contracts", () => {
  it("accepts exported safe view and rejects mixed paths and private fields", () => {
    expect(parseResponse(v, command())).not.toBeNull();
    for (const patch of [
      { case_id: id.user_id },
      { report_id: id.user_id },
      { user_id: id.user_id },
      { bundle: {} },
      { state: "preview" },
    ])
      expect(parseResponse({ ...v, ...patch }, command())).toBeNull();
  });
  it("requires exact selection and non-independent previous checks", () => {
    const selection = structuredClone(v.selection) as ReviewFreezeSelection;
    selection.actions[0]!.page_current_id = null;
    selection.actions[0]!.page_previous_id = id.user_id;
    expect(parseSelection(selection)).toBeNull();
    expect(parseCommand({ ...read, raw_evidence: {} })).toBeNull();
    expect(
      parseCommand({ ...id, operation: "history", kind: "gsc" }),
    ).toBeNull();
    expect(
      parseCommand({ ...id, operation: "versions", kind: "implementations" }),
    ).toBeNull();
  });
  it("rejects wrong report selection and missing source projections", () => {
    expect(
      parseCommand({
        ...id,
        operation: "preview",
        selection: {
          ...v.selection,
          report: { ...v.selection.report, id: id.user_id },
        },
      }),
    ).toBeNull();
    const changed = structuredClone(v);
    changed.actions[0].page = null as never;
    expect(parseResponse(changed, command())).toBeNull();
  });
  it("explicit routes never silently choose a version", () => {
    expect(parseLocation({})).toEqual({});
    expect(parseLocation({ reviewId: v.review_id })).toEqual({
      reviewId: v.review_id,
    });
    for (const q of [
      { reviewId: v.review_id, deliveryRevisionId: id.user_id },
      { implementationRevision: "1" },
      { reviewId: ["a", "b"] },
      { unknown: "x" },
    ])
      expect(parseLocation(q)).toBeNull();
  });
});
describe("workspace BFF boundary", () => {
  const route = {
    params: Promise.resolve({ id: id.case_id, reportId: id.report_id }),
  };
  const url = `https://app.test/api/v2/cases/${id.case_id}/reports/${id.report_id}/review-evidence`;
  const deps = () => ({
    enabled: () => true,
    user: async () => ({ userId: id.user_id }),
    config: () => ({ baseUrl: "https://api.test", token: "internal" }),
    fetch: vi.fn(async () => Response.json(v)),
  });
  it("is gated and authenticated before upstream work", async () => {
    const d = deps();
    expect(
      (
        await createReviewWorkspaceHandlers({ ...d, enabled: () => false }).GET(
          new Request(url),
          route,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await createReviewWorkspaceHandlers({
          ...d,
          user: async () => null,
        }).GET(new Request(url), route)
      ).status,
    ).toBe(401);
    expect(d.fetch).not.toHaveBeenCalled();
  });
  it("injects trusted owner; returns private no-store", async () => {
    const d = deps();
    const response = await createReviewWorkspaceHandlers(d).GET(
      new Request(`${url}?operation=read&review_id=${v.review_id}`),
      route,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    const options = (
      d.fetch.mock.calls as unknown as [string, RequestInit][]
    )[0][1];
    expect(JSON.parse(options.body as string)).toEqual(read);
    expect(options.redirect).toBe("error");
  });
  it("rejects client identity, duplicated parameters and extra keys", async () => {
    const d = deps(),
      h = createReviewWorkspaceHandlers(d);
    for (const suffix of [
      `&user_id=${id.user_id}`,
      "&operation=read",
      "&extra=1",
    ])
      expect(
        (
          await h.GET(
            new Request(
              `${url}?operation=read&review_id=${v.review_id}${suffix}`,
            ),
            route,
          )
        ).status,
      ).toBe(400);
    expect(d.fetch).not.toHaveBeenCalled();
  });
  it("rejects cross-site writes and oversized requests", async () => {
    const d = deps(),
      h = createReviewWorkspaceHandlers(d);
    const body = JSON.stringify({
      operation: "preview",
      selection: v.selection,
    });
    expect(
      (
        await h.POST(
          new Request(url, {
            method: "POST",
            headers: {
              origin: "https://other.test",
              "content-type": "application/json",
            },
            body,
          }),
          route,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await h.POST(
          new Request(url, {
            method: "POST",
            headers: {
              origin: "https://app.test",
              "content-type": "application/json",
            },
            body: " ".repeat(50000),
          }),
          route,
        )
      ).status,
    ).toBe(413);
    expect(d.fetch).not.toHaveBeenCalled();
  });
  it("treats malformed, wrong-bound and oversized success as unavailable", async () => {
    for (const body of [
      { ...v, report_id: id.user_id },
      { ...v, secret: "x" },
      "x".repeat(530000),
    ]) {
      const d = { ...deps(), fetch: vi.fn(async () => Response.json(body)) };
      const response = await createReviewWorkspaceHandlers(d).GET(
        new Request(`${url}?operation=read&review_id=${v.review_id}`),
        route,
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ code: "UNAVAILABLE" });
    }
  });
});
