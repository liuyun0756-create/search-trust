// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleResourceSelector } from "./google-resource-selector";

afterEach(() => vi.unstubAllGlobals());
describe("resource authorization return destinations", () => {
  it.each(["connections", "service-setup"] as const)("returns to %s without triggering any analysis", async (returnTo) => {
    const calls: { path: string; init?: RequestInit }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({ path, init });
      const body = path.endsWith("/authorize") ? { authorization_url: "https://invalid.example/consent" }
        : path.endsWith("/google-resources") ? { bindings: [] } : { connections: [] };
      return new Response(JSON.stringify(body));
    }));
    render(<GoogleResourceSelector caseId="case" businessName="Client" siteUrl="https://example.test" embedded returnTo={returnTo} />);
    const connect = screen.getByRole("button", { name: "Connect another Google account" });
    await waitFor(() => expect(connect).toBeEnabled());
    expect(calls.map((item) => item.init?.method ?? "GET")).toEqual(["GET", "GET"]);
    await userEvent.setup().click(connect);
    expect(await screen.findByRole("alert")).toHaveTextContent("Google authorization could not be started");
    const posts = calls.filter((item) => item.init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].path).toBe("/api/v2/google/connections/authorize");
    expect(JSON.parse(String(posts[0].init!.body))).toEqual({ case_id: "case", sources: ["gsc"], return_path: `/cases/case/${returnTo}` });
  });
});
