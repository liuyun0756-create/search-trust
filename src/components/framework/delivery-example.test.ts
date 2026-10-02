import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import example from "./delivery-example.json";

describe("delivery sample contract", () => {
  it("includes the same action and limitations without invented result values", () => {
    for (const role of ["client", "seo"] as const) expect(example.views[role].sections.some((item) => item.text.includes(example.action))).toBe(true);
    expect(example.evidence).toHaveLength(3); expect(example.pending).toHaveLength(3);
    expect(example.status.map((item) => item.label)).toEqual(["Planned", "Implemented", "Reviewed"]);
    expect(example.scenarios[0].actions).toHaveLength(3);
    expect(example.limitations).toContain("No real source snapshots");
  });

  it("ships a real PDF generated from the current shared example copy", () => {
    const source = readFileSync(resolve("src/components/framework/delivery-example.json"));
    const hash = createHash("sha256").update(source).digest("hex");
    const pdf = readFileSync(resolve("public/samples/searchtrust-client-delivery-example.pdf"));
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(5000);
    expect(pdf.toString("latin1")).toContain(`source-sha256:${hash}`);
    expect(pdf.toString("latin1")).toContain("Fictional client delivery example");
  });
});
