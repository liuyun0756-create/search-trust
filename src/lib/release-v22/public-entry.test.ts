import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  requireV22PublicEntry,
  resolveV22PublicEntryEnabled,
  V22_PUBLIC_ENTRY_PAUSED,
  v22PublicEntryPausedResponse,
} from "./public-entry";

describe("V2.2 public entry boundary", () => {
  it("opens only for the exact true value", () => {
    expect(resolveV22PublicEntryEnabled({ V22_PUBLIC_ENTRY_ENABLED: "true" })).toBe(true);
    for (const value of [undefined, "", "false", "TRUE", "1", "yes"]) {
      expect(resolveV22PublicEntryEnabled({ V22_PUBLIC_ENTRY_ENABLED: value })).toBe(false);
    }
  });

  it("allows the explicit loopback-only browser fixture", () => {
    expect(resolveV22PublicEntryEnabled({
      NEXT_PUBLIC_E2E_TEST_MODE: "true",
      NEXT_PUBLIC_E2E_BASE_URL: "http://127.0.0.1:3100",
    })).toBe(true);
    expect(resolveV22PublicEntryEnabled({
      V22_PUBLIC_ENTRY_ENABLED: "false",
      NEXT_PUBLIC_E2E_TEST_MODE: "true",
      NEXT_PUBLIC_E2E_BASE_URL: "http://127.0.0.1:3100",
    })).toBe(false);
    expect(() => resolveV22PublicEntryEnabled({
      NEXT_PUBLIC_E2E_TEST_MODE: "true",
      NEXT_PUBLIC_E2E_BASE_URL: "https://searchtrust.example",
    })).toThrow("loopback origin");
  });

  it("returns one stable fail-closed response without invoking the write handler", async () => {
    const response = v22PublicEntryPausedResponse();
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("retry-after")).toBe("300");
    expect(await response.json()).toEqual(V22_PUBLIC_ENTRY_PAUSED);

    const handler = vi.fn(async () => new Response(null, { status: 201 }));
    const previous = process.env.V22_PUBLIC_ENTRY_ENABLED;
    delete process.env.V22_PUBLIC_ENTRY_ENABLED;
    try {
      const guarded = await requireV22PublicEntry(handler)();
      expect(guarded.status).toBe(503);
      expect(handler).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.V22_PUBLIC_ENTRY_ENABLED;
      else process.env.V22_PUBLIC_ENTRY_ENABLED = previous;
    }
  });

  it("guards every new-write route while preserving read and settlement exports", async () => {
    const root = process.cwd();
    const files = await Promise.all([
      "src/app/api/v2/cases/route.ts",
      "src/app/api/v2/preflight/route.ts",
      "src/app/api/v2/competitors/discover/route.ts",
      "src/app/api/v2/competitors/tasks/[id]/retry/route.ts",
      "src/app/api/v2/analyze/route.ts",
      "src/app/api/v2/cases/[id]/checkout/route.ts",
    ].map((file) => readFile(path.join(root, file), "utf8")));
    for (const file of files) expect(file).toContain("requireV22PublicEntry");

    const cases = files[0];
    const checkout = files[5];
    expect(cases).toContain("export const GET = handlers.GET");
    expect(cases).toContain("export const POST = requireV22PublicEntry(handlers.POST)");
    expect(checkout).toContain("export const GET = handlers.GET");
    expect(checkout).toContain("export const POST = requireV22PublicEntry(handlers.POST)");

    const confirm = await readFile(
      path.join(root, "src/app/api/v2/cases/[id]/checkout/confirm/route.ts"),
      "utf8",
    );
    expect(confirm).not.toContain("requireV22PublicEntry");
  });
});
