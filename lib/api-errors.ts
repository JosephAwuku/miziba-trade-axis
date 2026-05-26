/** Structured API error from Next.js route handlers */
export class ApiError extends Error {
  readonly code?: string;
  readonly guards?: Record<string, boolean | undefined>;
  readonly status: number;

  constructor(
    message: string,
    options?: {
      code?: string;
      guards?: Record<string, boolean | undefined>;
      status?: number;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = options?.code;
    this.guards = options?.guards;
    this.status = options?.status ?? 400;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
