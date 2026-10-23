export class ApiException extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly errors: string[] = [],
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiException';
  }

  static badRequest(message: string, errors: string[] = []) {
    return new ApiException(message, 400, errors);
  }

  static unauthorized(message = 'No autenticado') {
    return new ApiException(message, 401);
  }

  static forbidden(message = 'Acceso denegado') {
    return new ApiException(message, 403);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new ApiException(message, 404);
  }

  static conflict(message: string) {
    return new ApiException(message, 409);
  }

  static tooManyRequests(message = 'Demasiadas solicitudes') {
    return new ApiException(message, 429);
  }

  static internalServerError(message = 'Error interno del servidor') {
    return new ApiException(message, 500);
  }
}
