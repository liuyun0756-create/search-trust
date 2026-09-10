import { createHash } from "node:crypto";

import type { GoogleConnectionRecord } from "../google-connections/contracts";
import type { GoogleConnectionRepository } from "../google-connections/repository";
import type { GoogleTokenRevoker } from "../google-connections/provider";
import type { TokenVault } from "../google-connections/token-vault";
import type {
  DeletionOutcome,
  IdentityWebhookRepository,
  RegistrationOutcome,
} from "./repository";

type ConnectionReader = Pick<GoogleConnectionRepository, "listConnections">;

export interface IdentityWebhookServiceDependencies {
  repository: IdentityWebhookRepository;
  connections: ConnectionReader;
  vault: TokenVault | null;
  revoker: GoogleTokenRevoker;
}

export interface AccountDeletionResult {
  outcome: DeletionOutcome;
  connectionsFound: number;
  revocationsAttempted: number;
  revocationsFailed: number;
}

export function identityDigest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function tokenContext(connection: GoogleConnectionRecord, secretKind: "access_token" | "refresh_token") {
  return {
    recordType: "connection" as const,
    userId: connection.userId,
    recordId: connection.id,
    secretKind,
  };
}

export function createIdentityWebhookService(dependencies: IdentityWebhookServiceDependencies) {
  return {
    async register(input: {
      clerkUserId: string;
      email: string;
      name: string | null;
    }): Promise<RegistrationOutcome> {
      return dependencies.repository.register({
        ...input,
        subjectDigest: identityDigest(input.clerkUserId),
      });
    },

    async deleteAccount(input: {
      clerkUserId: string;
      eventId: string;
      eventOccurredAt: string;
    }): Promise<AccountDeletionResult> {
      const userId = await dependencies.repository.prepareDeletion(input.clerkUserId);
      let connections: GoogleConnectionRecord[] = [];
      if (userId) {
        try {
          connections = await dependencies.connections.listConnections(userId);
        } catch {
          connections = [];
        }
      }

      let revocationsAttempted = 0;
      let revocationsFailed = 0;
      if (dependencies.vault) {
        for (const connection of connections) {
          const secretKind = connection.refreshToken ? "refresh_token" as const : "access_token" as const;
          const encryptedToken = connection.refreshToken ?? connection.accessToken;
          if (!encryptedToken) continue;
          revocationsAttempted += 1;
          try {
            const token = dependencies.vault.decrypt(
              encryptedToken,
              tokenContext(connection, secretKind),
            );
            await dependencies.revoker.revoke(token);
          } catch {
            revocationsFailed += 1;
          }
        }
      } else {
        revocationsFailed = connections.filter((connection) => connection.refreshToken ?? connection.accessToken).length;
      }

      const outcome = await dependencies.repository.completeDeletion({
        clerkUserId: input.clerkUserId,
        eventIdDigest: identityDigest(input.eventId),
        subjectDigest: identityDigest(input.clerkUserId),
        eventOccurredAt: input.eventOccurredAt,
      });
      return {
        outcome,
        connectionsFound: connections.length,
        revocationsAttempted,
        revocationsFailed,
      };
    },
  };
}

export type IdentityWebhookService = ReturnType<typeof createIdentityWebhookService>;
