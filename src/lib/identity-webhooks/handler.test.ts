import { Webhook } from "svix";
import { describe, expect, it, vi } from "vitest";

import { createClerkWebhookHandler } from "./handler";

const secret = `whsec_${Buffer.alloc(32, 9).toString("base64")}`;
const occurredAt = new Date();

function signedRequest(payload: object, overrides: Record<string, string> = {}) {
  const body = JSON.stringify(payload);
  const eventId = "msg_security_event";
  const signature = new Webhook(secret).sign(eventId, occurredAt, body);
  return new Request("https://example.test/api/webhook/clerk", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": eventId,
      "svix-timestamp": String(Math.floor(occurredAt.getTime() / 1_000)),
      "svix-signature": signature,
      ...overrides,
    },
    body,
  });
}

function setup() {
  const register = vi.fn(async () => "created" as const);
  const deleteAccount = vi.fn(async () => ({
    outcome: "deleted" as const,
    connectionsFound: 0,
    revocationsAttempted: 0,
    revocationsFailed: 0,
  }));
  const handler = createClerkWebhookHandler({
    getSecret: () => secret,
    createService: () => ({ register, deleteAccount }),
  });
  return { handler, register, deleteAccount };
}

describe("Clerk webhook handler", () => {
  it("accepts a signed user.created event without logging or returning profile data", async () => {
    const h = setup();
    const response = await h.handler(signedRequest({
      type: "user.created",
      data: {
        id: "user_created",
        email_addresses: [{ email_address: "owner@example.com" }],
        first_name: "Test",
        last_name: "Owner",
      },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ received: true });
    expect(h.register).toHaveBeenCalledWith({
      clerkUserId: "user_created",
      email: "owner@example.com",
      name: "Test Owner",
    });
  });

  it("accepts a signed user.deleted event and binds it to the verified event metadata", async () => {
    const h = setup();
    const response = await h.handler(signedRequest({
      type: "user.deleted",
      data: { id: "user_deleted" },
    }));
    expect(response.status).toBe(200);
    expect(h.deleteAccount).toHaveBeenCalledWith({
      clerkUserId: "user_deleted",
      eventId: "msg_security_event",
      eventOccurredAt: new Date(Math.floor(occurredAt.getTime() / 1_000) * 1_000).toISOString(),
    });
  });

  it("rejects missing or invalid signatures before creating a service", async () => {
    const h = setup();
    const missing = await h.handler(new Request("https://example.test/api/webhook/clerk", {
      method: "POST",
      body: "{}",
    }));
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ error: "WEBHOOK_INVALID" });

    const invalid = await h.handler(signedRequest({ type: "user.deleted", data: { id: "user" } }, {
      "svix-signature": "v1,invalid",
    }));
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toEqual({ error: "WEBHOOK_SIGNATURE_INVALID" });
    expect(h.register).not.toHaveBeenCalled();
    expect(h.deleteAccount).not.toHaveBeenCalled();
  });

  it("fails closed for oversized and structurally invalid payloads", async () => {
    const h = setup();
    const oversized = await h.handler(new Request("https://example.test/api/webhook/clerk", {
      method: "POST",
      headers: {
        "svix-id": "msg",
        "svix-timestamp": "1",
        "svix-signature": "v1,invalid",
        "content-length": "1000001",
      },
      body: "{}",
    }));
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toEqual({ error: "WEBHOOK_TOO_LARGE" });

    const malformed = await h.handler(signedRequest({ type: "user.created", data: { id: "user" } }));
    expect(malformed.status).toBe(400);
    expect(h.register).not.toHaveBeenCalled();
  });
});
