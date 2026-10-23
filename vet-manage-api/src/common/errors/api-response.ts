export type ApiResponse<T> = {
  statusCode: number;
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
  code?: string;
  traceId?: string;
};

export function failure(
  message: string,
  statusCode: number,
  options: Pick<ApiResponse<never>, 'errors' | 'code' | 'traceId'> = {},
): ApiResponse<never> {
  return { statusCode, success: false, message, ...options };
}
