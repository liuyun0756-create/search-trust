import { Webhook } from "svix";

import { safeLogError } from "../security-v22/safe-log";
import type { IdentityWebhookService } from "./service";

const MAX_WEBHOOK_BYTES = 1_000_000;

interface HandlerDependencies {
  getSecret: () => string | undefined;
  createService: () => IdentityWebhookService;
}

function response(body: object, status: number): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function createClerkWebhookHandler(dependencies: HandlerDependencies) {
  return async function handle(request: Request): Promise<Response> {
    const secret = dependencies.getSecret()?.trim();
    if (!secret) return response({ error: "WEBHOOK_NOT_CONFIGURED" }, 503);

    const eventId = request.headers.get("svix-id");
    const timestamp = request.headers.get("svix-timestamp");
    const signature = request.headers.get("svix-signature");
    if (!eventId || !timestamp || !signature) return response({ error: "WEBHOOK_INVALID" }, 400);

    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
      return response({ error: "WEBHOOK_TOO_LARGE" }, 413);
    }
    const payload = await request.text();
    if (Buffer.byteLength(payload, "utf8") > MAX_WEBHOOK_BYTES) {
      return response({ error: "WEBHOOK_TOO_LARGE" }, 413);
    }

    let event: Record<string, unknown>;
    try {
      const verified = new Webhook(secret).verify(payload, {
        "svix-id": eventId,
        "svix-timestamp": timestamp,
        "svix-signature": signature,
      });
      const parsed = record(verified);
      if (!parsed) return response({ error: "WEBHOOK_INVALID" }, 400);
      event = parsed;
    } catch {
      return response({ error: "WEBHOOK_SIGNATURE_INVALID" }, 401);
    }

    const eventType = requiredString(event.type);
    const data = record(event.data);
    const clerkUserId = requiredString(data?.id);
    if (!eventType || !data || !clerkUserId) return response({ error: "WEBHOOK_INVALID" }, 400);

    try {
      const service = dependencies.createService();
      if (eventType === "user.created") {
        const emailAddresses = Array.isArray(data.email_addresses) ? data.email_addresses : [];
        const firstEmail = record(emailAddresses[0]);
        const email = requiredString(firstEmail?.email_address);
        if (!email) return response({ error: "WEBHOOK_INVALID" }, 400);
        const name = [requiredString(data.first_name), requiredString(data.last_name)]
          .filter((value): value is string => Boolean(value)).join(" ") || null;
        await service.register({ clerkUserId, email, name });
      } else if (eventType === "user.deleted") {
        const seconds = Number(timestamp);
        if (!Number.isSafeInteger(seconds) || seconds <= 0) {
          return response({ error: "WEBHOOK_INVALID" }, 400);
        }
        await service.deleteAccount({
          clerkUserId,
          eventId,
          eventOccurredAt: new Date(seconds * 1_000).toISOString(),
        });
      }
      return response({ received: true }, 200);
    } catch (error) {
      console.error("Clerk webhook processing failed", safeLogError(error));
      return response({ error: "WEBHOOK_PROCESSING_FAILED" }, 500);
    }
  };
}
