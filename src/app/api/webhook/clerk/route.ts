import { createClerkWebhookHandler } from "@/lib/identity-webhooks/handler";
import { createServerIdentityWebhookService } from "@/lib/identity-webhooks/server";

export const POST = createClerkWebhookHandler({
  getSecret: () => process.env.CLERK_WEBHOOK_SIGNING_SECRET,
  createService: createServerIdentityWebhookService,
});
