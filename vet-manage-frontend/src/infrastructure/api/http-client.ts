import { env } from '../../config/env';

export class ApiError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new ApiError(`API request failed with status ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}
