import { resolveError } from "./catalog";
import { AppError } from "./app-error";
import { MBP } from "./codes";

export type ApiErrorBody = {
  ok: false;
  code: string;
  message: string;
  correlationId: string;
  details?: unknown;
};

export type ApiSuccessBody<T> = { ok: true; correlationId: string } & T;

export function jsonError(
  correlationId: string,
  code: string,
  details?: unknown,
  overrideMessage?: string,
): Response {
  const def = resolveError(code);
  const status = def.httpStatus === 200 ? 400 : def.httpStatus;
  const body: ApiErrorBody = {
    ok: false,
    code,
    message: overrideMessage ?? def.userMessage,
    correlationId,
    ...(details !== undefined ? { details } : {}),
  };
  return Response.json(body, { status });
}

export function jsonFromAppError(correlationId: string, err: AppError): Response {
  const def = resolveError(err.code);
  const status = def.httpStatus === 200 ? 400 : def.httpStatus;
  const body: ApiErrorBody = {
    ok: false,
    code: err.code,
    message: err.message,
    correlationId,
    ...(err.details !== undefined ? { details: err.details } : {}),
  };
  return Response.json(body, { status });
}

export function jsonSuccess<T extends Record<string, unknown>>(correlationId: string, data: T): Response {
  return Response.json({ ok: true, correlationId, ...data } as ApiSuccessBody<T>);
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e;
  if (e instanceof Error) return new AppError(MBP.common.internal, e.message);
  return new AppError(MBP.common.internal, String(e));
}
