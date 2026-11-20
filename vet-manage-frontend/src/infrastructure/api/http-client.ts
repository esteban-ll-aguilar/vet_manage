import { env } from '../../config/env';
import { isApiResponse } from './api-response';
import { sessionToken } from './session-token';

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

async function requestJson<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = sessionToken.get();
  const response = await fetch(`${env.apiUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // Con el token de acceso vencido se renueva la sesión y se repite la petición una vez.
  if (response.status === 401 && token && !retried) {
    if (await sessionToken.refresh()) return requestJson<T>(path, options, true);
    sessionToken.expire();
  }

  const body: unknown = await response.json().catch(() => null);

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

export function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

export function postJson<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  return requestJson<TResponse>(path, { method: 'POST', body: JSON.stringify(body) });
}

export function patchJson<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  return requestJson<TResponse>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export function putJson<TResponse, TBody>(path: string, body: TBody): Promise<TResponse> {
  return requestJson<TResponse>(path, { method: 'PUT', body: JSON.stringify(body) });
}
