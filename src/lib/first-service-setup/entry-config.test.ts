import { afterEach, describe, it, expect, vi } from "vitest";
import { isFirstServiceEntryEnabled } from "./entry-config";
afterEach(() => vi.unstubAllEnvs());
describe("first service paid gate", () => {
  it("requires all independent gates and never treats preparation as charging permission", () => {
    const keys = [
      "V22_FIRST_SERVICE_SETUP_ENABLED",
      "GOOGLE_CONNECTIONS_ENABLED",
      "V22_PUBLIC_ENTRY_ENABLED",
      "V22_CAPABILITY_DISPATCH_ENABLED",
      "V22_FIRST_SERVICE_ENTRY_ENABLED",
    ];
    for (const key of keys) vi.stubEnv(key, "true");
    expect(isFirstServiceEntryEnabled()).toBe(true);
    for (const key of keys) {
      for (const value of [undefined, "false", "TRUE", "1"]) {
        vi.stubEnv(key, value);
        expect(isFirstServiceEntryEnabled()).toBe(false);
      }
      vi.stubEnv(key, "true");
    }
  });
});
it("keeps existing-work API availability when new intake is paused", async () => {
  const { isFirstServiceEntryAvailable } = await import("./entry-config");
  for (const k of [
    "V22_FIRST_SERVICE_SETUP_ENABLED",
    "GOOGLE_CONNECTIONS_ENABLED",
    "V22_CAPABILITY_DISPATCH_ENABLED",
    "V22_FIRST_SERVICE_ENTRY_ENABLED",
  ])
    vi.stubEnv(k, "true");
  vi.stubEnv("V22_PUBLIC_ENTRY_ENABLED", "false");
  expect(isFirstServiceEntryEnabled()).toBe(false);
  expect(isFirstServiceEntryAvailable()).toBe(true);
  vi.stubEnv("V22_FIRST_SERVICE_ENTRY_ENABLED", "false");
  expect(isFirstServiceEntryAvailable()).toBe(false);
});
