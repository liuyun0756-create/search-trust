import { describe, expect, it } from "vitest";

import { readShareToken } from "./public-request";

const token = "a".repeat(43);

function request(body: string, headers?: HeadersInit) {
  return new Request("https://searchtrust.example/api/share/resolve", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

describe("public report share request", () => {
  it("accepts a valid token only from a bounded request body", async () => {
    await expect(readShareToken(request(JSON.stringify({ token })))).resolves.toBe(token);
  });

  it("fails closed for malformed, invalid, and oversized bodies", async () => {
    await expect(readShareToken(request("not-json"))).resolves.toBeNull();
    await expect(readShareToken(request(JSON.stringify({ token: "short" })))).resolves.toBeNull();
    await expect(readShareToken(new Request("https://searchtrust.example/api/share/resolve", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: JSON.stringify({ token }),
    }))).resolves.toBeNull();
    await expect(readShareToken(request(JSON.stringify({ token }), { "content-length": "2048" }))).resolves.toBeNull();
    await expect(readShareToken(request(JSON.stringify({ token, padding: "x".repeat(1100) })))).resolves.toBeNull();
  });
});
