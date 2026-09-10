import type { SupabaseClient } from "@supabase/supabase-js";

export type RegistrationOutcome = "created" | "existing" | "blocked_deleted_identity";
export type DeletionOutcome = "deleted" | "already_deleted";

export interface IdentityWebhookRepository {
  register(input: {
    clerkUserId: string;
    subjectDigest: string;
    email: string;
    name: string | null;
  }): Promise<RegistrationOutcome>;
  prepareDeletion(clerkUserId: string): Promise<string | null>;
  completeDeletion(input: {
    clerkUserId: string;
    eventIdDigest: string;
    subjectDigest: string;
    eventOccurredAt: string;
  }): Promise<DeletionOutcome>;
}

function byteaFromHex(value: string): string {
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error("INVALID_IDENTITY_DIGEST");
  return `\\x${value}`;
}

function persistenceFailure(): never {
  throw new Error("IDENTITY_PERSISTENCE_FAILED");
}

export class SupabaseIdentityWebhookRepository implements IdentityWebhookRepository {
  constructor(private readonly db: SupabaseClient) {}

  async register(input: {
    clerkUserId: string;
    subjectDigest: string;
    email: string;
    name: string | null;
  }): Promise<RegistrationOutcome> {
    const { data, error } = await this.db.rpc("register_v22_clerk_user", {
      p_clerk_user_id: input.clerkUserId,
      p_subject_digest: byteaFromHex(input.subjectDigest),
      p_email: input.email,
      p_name: input.name,
    });
    if (error || !["created", "existing", "blocked_deleted_identity"].includes(String(data))) {
      return persistenceFailure();
    }
    return data as RegistrationOutcome;
  }

  async prepareDeletion(clerkUserId: string): Promise<string | null> {
    const { data, error } = await this.db.rpc("prepare_v22_user_deletion", {
      p_clerk_user_id: clerkUserId,
    });
    if (error) return persistenceFailure();
    return typeof data === "string" && data ? data : null;
  }

  async completeDeletion(input: {
    clerkUserId: string;
    eventIdDigest: string;
    subjectDigest: string;
    eventOccurredAt: string;
  }): Promise<DeletionOutcome> {
    const { data, error } = await this.db.rpc("complete_v22_user_deletion", {
      p_clerk_user_id: input.clerkUserId,
      p_event_id_digest: byteaFromHex(input.eventIdDigest),
      p_subject_digest: byteaFromHex(input.subjectDigest),
      p_event_occurred_at: input.eventOccurredAt,
    });
    if (error || !["deleted", "already_deleted"].includes(String(data))) return persistenceFailure();
    return data as DeletionOutcome;
  }
}
