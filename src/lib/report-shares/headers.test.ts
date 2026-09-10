import { describe, expect, it } from "vitest";

import nextConfig, { SHARE_SECURITY_HEADERS } from "../../../next.config";

describe("report share response policy", () => {
  it("applies no-store, no-referrer and noindex to pages and PDFs", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([
      { source: "/share", headers: SHARE_SECURITY_HEADERS },
      { source: "/api/share/:path*", headers: SHARE_SECURITY_HEADERS },
    ]);
    expect(SHARE_SECURITY_HEADERS).toEqual(expect.arrayContaining([
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
    ]));
  });
});
