import type { CaseStatus, ValidationIssue } from "./contracts";

export type CaseErrorCode =
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "CASE_NOT_FOUND"
  | "CASE_ALREADY_EXISTS"
  | "CASE_ARCHIVED"
  | "INTERNAL_ERROR";

type DuplicateContext = {
  case_id: string;
  status: CaseStatus;
};

export class CaseApiError extends Error {
  readonly code: CaseErrorCode;
  readonly status: number;
  readonly issues?: ValidationIssue[];
  readonly duplicate?: DuplicateContext;

  constructor(
    code: CaseErrorCode,
    status: number,
    message: string,
    options: { issues?: ValidationIssue[]; duplicate?: DuplicateContext } = {},
  ) {
    super(message);
    this.name = "CaseApiError";
    this.code = code;
    this.status = status;
    this.issues = options.issues;
    this.duplicate = options.duplicate;
  }

  static invalid(issues: ValidationIssue[]): CaseApiError {
    return new CaseApiError("INVALID_REQUEST", 400, "The request is invalid.", { issues });
  }

  static unauthorized(): CaseApiError {
    return new CaseApiError("UNAUTHORIZED", 401, "Authentication is required.");
  }

  static notFound(): CaseApiError {
    return new CaseApiError("CASE_NOT_FOUND", 404, "Case not found.");
  }

  static duplicate(caseId: string, status: CaseStatus): CaseApiError {
    return new CaseApiError("CASE_ALREADY_EXISTS", 409, "A Case already exists for this website and Location.", {
      duplicate: { case_id: caseId, status },
    });
  }

  static archived(): CaseApiError {
    return new CaseApiError("CASE_ARCHIVED", 409, "Restore the Case before updating confirmation information.");
  }

  static internal(): CaseApiError {
    return new CaseApiError("INTERNAL_ERROR", 500, "An internal error occurred.");
  }
}

export function caseErrorBody(error: CaseApiError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.issues ? { issues: error.issues } : {}),
      ...(error.duplicate ?? {}),
    },
  };
}
