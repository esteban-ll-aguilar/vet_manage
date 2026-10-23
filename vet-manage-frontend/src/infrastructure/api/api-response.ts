export type ApiResponse<T> = {
  statusCode: number;
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
  code?: string;
  traceId?: string;
};

export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return typeof value === 'object'
    && value !== null
    && 'success' in value
    && 'statusCode' in value;
}
