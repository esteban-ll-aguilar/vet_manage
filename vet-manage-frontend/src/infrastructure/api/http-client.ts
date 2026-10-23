import { env } from '../../config/env';
import { isApiResponse } from './api-response';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly errors: string[];
  readonly traceId?: string;

  constructor(
    message: string,
    status: number,
    options: { code?: string; errors?: string[]; traceId?: string } = {},
  ) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
    this.code = options.code;
    this.errors = options.errors ?? [];
    this.traceId = options.traceId;
  }
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    headers: { Accept: 'application/json' },
  });

  const body: unknown = await response.json();

  if (!response.ok) {
    if (isApiResponse(body)) {
      throw new ApiError(body.message, response.status, body);
    }

    throw new ApiError(`API request failed with status ${response.status}`, response.status);
  }

  // Los endpoints nuevos pueden responder con el envelope estándar. Se mantiene
  // compatibilidad con endpoints legacy que devuelven el payload directamente.
  if (isApiResponse<T>(body) && body.data !== undefined) {
    return body.data;
  }

  return body as T;
}
