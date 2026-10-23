import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Response } from 'express';
import { ApiException } from './api-exception.js';
import { failure } from './api-response.js';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const traceId = response.req.header('x-request-id') ?? randomUUID();

    if (exception instanceof ApiException) {
      return response
        .status(exception.statusCode)
        .json(failure(exception.message, exception.statusCode, {
          errors: exception.errors.length > 0 ? exception.errors : undefined,
          code: exception.code,
          traceId,
        }));
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const message = typeof exceptionResponse === 'string'
        ? exceptionResponse
        : this.extractMessage(exceptionResponse);

      return response.status(statusCode).json(failure(message, statusCode, { traceId }));
    }

    return response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(failure('Error interno del servidor', HttpStatus.INTERNAL_SERVER_ERROR, { traceId }));
  }

  private extractMessage(exceptionResponse: string | object): string {
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse) {
      const message = exceptionResponse.message;
      return Array.isArray(message) ? message.join('; ') : String(message);
    }

    return 'Solicitud inválida';
  }
}
