import { describe, expect, it } from "vitest";

import { E2E_IDS, assertSyntheticFixtureValue } from "./ids";

describe("E2E synthetic identities", () => {
  it("uses deterministic reserved identifiers and non-routable domains", () => {
    expect(new Set(Object.values(E2E_IDS)).size).toBe(Object.values(E2E_IDS).length);
    for (const value of Object.values(E2E_IDS)) {
      expect(() => assertSyntheticFixtureValue(value)).not.toThrow();
    }
  });

  it("rejects ordinary customer-shaped values", () => {
    expect(() => assertSyntheticFixtureValue("https://example.com/")).toThrow(
      "reserved synthetic identifiers",
    );
  });
});
