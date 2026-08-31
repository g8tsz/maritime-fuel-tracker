import type { ErrorCode } from "./codes";
import { resolveError } from "./catalog";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message?: string, details?: unknown) {
    super(message ?? resolveError(code).userMessage);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }

  get httpStatus(): number {
    return resolveError(this.code).httpStatus;
  }
}
