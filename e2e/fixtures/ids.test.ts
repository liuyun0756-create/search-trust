import { describe, expect, it } from "vitest";

import { E2E_IDS, assertSyntheticFixtureValue } from "./ids";

describe("E2E synthetic identities", () => {
  it("uses deterministic reserved identifiers and non-routable domains", () => {
    const values = Object.values(E2E_IDS).flat();
    expect(new Set(values).size).toBe(values.length);
    for (const value of values) {
      expect(() => assertSyntheticFixtureValue(value)).not.toThrow();
    }
  });

  it("rejects ordinary customer-shaped values", () => {
    expect(() => assertSyntheticFixtureValue("https://example.com/")).toThrow(
      "reserved synthetic identifiers",
    );
  });
});
