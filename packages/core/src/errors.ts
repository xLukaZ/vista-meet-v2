import type { AppError, ErrorCode } from "./types.js";

export class VistaError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(error: AppError) {
    super(error.message);
    this.name = "VistaError";
    this.code = error.code;
    this.details = error.details;
  }

  toJSON(): AppError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

export function createError(code: ErrorCode, message: string, details?: unknown): VistaError {
  return new VistaError({ code, message, details });
}

export function isVistaError(err: unknown): err is VistaError {
  return err instanceof VistaError;
}
