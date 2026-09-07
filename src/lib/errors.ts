export class AppError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;

  constructor(
    public readonly httpStatus: number,
    errorCode: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AppError";
    this.errorCode = errorCode;
    this.statusCode = httpStatus;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isAppError(err: unknown): err is AppError {
  if (err instanceof AppError) return true;
  if (!err || typeof err !== "object") return false;
  const candidate = err as { name?: string; httpStatus?: number; errorCode?: string; code?: string };
  return (
    candidate.name === "AppError" &&
    typeof candidate.httpStatus === "number" &&
    typeof (candidate.errorCode ?? candidate.code) === "string"
  );
}

export const errors = {
  badRequest: (message: string, details?: Record<string, unknown>) =>
    new AppError(400, "BAD_REQUEST", message, details),
  unauthorized: (message = "Missing or invalid credentials") =>
    new AppError(401, "UNAUTHORIZED", message),
  insufficientCredits: (need: number, have: number) =>
    new AppError(402, "INSUFFICIENT_CREDITS", `You need ${need} credits. You have ${have}.`, {
      need,
      have,
    }),
  forbidden: (message = "Forbidden") => new AppError(403, "FORBIDDEN", message),
  notFound: (message = "Not found") => new AppError(404, "NOT_FOUND", message),
  conflict: (message: string) => new AppError(409, "CONFLICT", message),
  validation: (message: string, details?: Record<string, unknown>) =>
    new AppError(422, "VALIDATION_ERROR", message, details),
  rateLimited: () => new AppError(429, "RATE_LIMITED", "Too many requests"),
  aiBusy: () => new AppError(503, "AI_BUSY", "Gemini/BFL overloaded — retry"),
  server: (message = "Internal error") => new AppError(500, "SERVER_ERROR", message),
};

export function errorEnvelope(err: AppError) {
  return {
    success: false as const,
    error: {
      code: err.errorCode,
      message: err.message,
      details: err.details ?? {},
    },
  };
}

export function ok<T>(data: T, message?: string) {
  return message ? { success: true as const, data, message } : { success: true as const, data };
}

const KNOWN_CODES = new Set([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "INSUFFICIENT_CREDITS",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "VALIDATION_ERROR",
  "RATE_LIMITED",
  "AI_BUSY",
  "SERVER_ERROR",
]);

export function toClientError(err: unknown): AppError | null {
  if (isAppError(err)) return err;
  if (!err || typeof err !== "object") return null;
  const candidate = err as {
    code?: string;
    errorCode?: string;
    httpStatus?: number;
    statusCode?: number;
    message?: string;
    details?: Record<string, unknown>;
    cause?: unknown;
  };
  if (isAppError(candidate.cause)) return candidate.cause;
  const status = candidate.httpStatus ?? candidate.statusCode;
  const code = candidate.errorCode ?? candidate.code;
  if (typeof code === "string" && KNOWN_CODES.has(code) && typeof status === "number") {
    return new AppError(status, code, candidate.message ?? code, candidate.details ?? {});
  }
  if (typeof status === "number" && status === 429) return errors.rateLimited();
  if (typeof status === "number" && status >= 400 && status < 500) {
    return new AppError(status, "BAD_REQUEST", candidate.message ?? "Bad request");
  }
  return null;
}

function codeFromStatus(status: number): string {
  if (status === 400) return "BAD_REQUEST";
  if (status === 401) return "UNAUTHORIZED";
  if (status === 402) return "INSUFFICIENT_CREDITS";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "AI_BUSY";
  return "SERVER_ERROR";
}

export function rewriteFastifyErrorPayload(payload: unknown): unknown {
  if (typeof payload !== "string" && !Buffer.isBuffer(payload) && typeof payload !== "object") return payload;
  let parsed: Record<string, unknown> | null = null;
  if (typeof payload === "string") {
    try {
      parsed = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return payload;
    }
  } else if (Buffer.isBuffer(payload)) {
    try {
      parsed = JSON.parse(payload.toString("utf8")) as Record<string, unknown>;
    } catch {
      return payload;
    }
  } else {
    parsed = payload as Record<string, unknown>;
  }
  if (!parsed || parsed.success !== undefined || parsed.error instanceof Object) return payload;
  if (typeof parsed.statusCode === "number" && typeof parsed.message === "string" && typeof parsed.error === "string") {
    const fromField = typeof parsed.code === "string" && KNOWN_CODES.has(parsed.code) ? parsed.code : null;
    return JSON.stringify({
      success: false,
      error: { code: fromField ?? codeFromStatus(Number(parsed.statusCode)), message: parsed.message, details: {} },
    });
  }
  return payload;
}
