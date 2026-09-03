export class CasePaymentError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CasePaymentError";
  }

  static unauthorized() {
    return new CasePaymentError("UNAUTHORIZED", "Sign in to continue.", 401);
  }

  static invalid(message = "The payment request is invalid.") {
    return new CasePaymentError("INVALID_REQUEST", message, 400);
  }

  static notFound() {
    return new CasePaymentError("CASE_NOT_FOUND", "Case not found.", 404);
  }

  static alreadyUnlocked() {
    return new CasePaymentError("CASE_REPORT_ALREADY_UNLOCKED", "This Case report is already unlocked.", 409);
  }

  static paymentPending(status = "pending") {
    return new CasePaymentError("PAYMENT_NOT_COMPLETED", `Payment is ${status}.`, 409);
  }

  static unavailable() {
    return new CasePaymentError("CHECKOUT_UNAVAILABLE", "Secure checkout is temporarily unavailable.", 503);
  }

  static internal() {
    return new CasePaymentError("INTERNAL_ERROR", "The payment could not be processed.", 500);
  }
}

export function casePaymentErrorBody(error: CasePaymentError) {
  return { error: { code: error.code, message: error.message } };
}

