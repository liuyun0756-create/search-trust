import type { ApiErrorPayload } from "./contracts";

export class PreflightApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PreflightApiError";
  }
}

export function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const error = (value as { error?: unknown }).error;
  return Boolean(
    error
      && typeof error === "object"
      && !Array.isArray(error)
      && typeof (error as { code?: unknown }).code === "string"
      && typeof (error as { message?: unknown }).message === "string",
  );
}
