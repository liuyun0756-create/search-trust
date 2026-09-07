import type { ConnectionCenterResponse } from "./contracts";
import { projectConnectionCenter, type ConnectionCenterProjectionInput } from "./projector";
import { ConnectionCenterRepositoryError, type ConnectionCenterRepository } from "./repository";

const MESSAGES: Record<string, string> = {
  CONNECTION_CENTER_DISABLED: "Connection Center is not available.",
  CONNECTION_CENTER_NOT_FOUND: "This Case is not available.",
  CONNECTION_CENTER_BUSY: "This Case changed while its connection status was loading. Please try again.",
  CONNECTION_CENTER_STORAGE_UNAVAILABLE: "Connection status could not be loaded. Please try again.",
  CONNECTION_CENTER_INVALID_REQUEST: "Please submit a valid Connection Center request.",
  CONNECTION_CENTER_FORBIDDEN: "Please sign in to continue.",
};

export class ConnectionCenterError extends Error {
  constructor(readonly code: keyof typeof MESSAGES, readonly status: number) {
    super(MESSAGES[code]);
    this.name = "ConnectionCenterError";
  }
}

export function createConnectionCenterService(deps: {
  repository: ConnectionCenterRepository;
  flags: ConnectionCenterProjectionInput["flags"];
  now?: () => Date;
}) {
  return {
    async get(userId: string, caseId: string): Promise<ConnectionCenterResponse> {
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const value = await deps.repository.read(userId, caseId);
          if (!value) throw new ConnectionCenterError("CONNECTION_CENTER_NOT_FOUND", 404);
          if (await deps.repository.isCurrent(userId, caseId, value.revision)) {
            return projectConnectionCenter({ ...value.data, flags: deps.flags }, deps.now?.() ?? new Date());
          }
        }
        throw new ConnectionCenterError("CONNECTION_CENTER_BUSY", 409);
      } catch (error) {
        if (error instanceof ConnectionCenterError) throw error;
        if (error instanceof ConnectionCenterRepositoryError) {
          throw new ConnectionCenterError("CONNECTION_CENTER_STORAGE_UNAVAILABLE", 503);
        }
        throw new ConnectionCenterError("CONNECTION_CENTER_STORAGE_UNAVAILABLE", 503);
      }
    },
  };
}

export type ConnectionCenterService = ReturnType<typeof createConnectionCenterService>;
